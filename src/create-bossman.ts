import type PgBoss from "pg-boss";
import { createPgBoss } from "./core/create-pg-boss";
import type { EventKeys, EventPayloads, EventsDef } from "./events/index";
import { eventQueueName } from "./events/index";
import { JobClient } from "./jobs/client";
import type {
  InferInputFromJob,
  JobDefinition,
  JobsMap,
  JobWithoutName,
} from "./types/index";
import { isBatchJob, isPromise } from "./types/index";

/**
 * Worker instance with job processing capabilities
 * This class is internal to create-bossman and contains all worker logic
 */
type ClientStructure<T extends JobsMap> = {
  [K in keyof T]: JobClient<InferInputFromJob<T[K]>, unknown>;
};

type RuntimeSubscription = {
  queue: string;
  map?: (payload: unknown) => unknown;
};

class BossmanWorker<
  T extends JobsMap,
  TEvents extends EventsDef<Record<string, unknown>> = EventsDef<
    Record<string, unknown>
  >,
> {
  private readonly pgBoss: PgBoss;
  private readonly jobs: Map<string, JobDefinition>;
  private isWorkerStarted = false;
  private isPgBossStarted = false;
  private readonly subs: Map<string, RuntimeSubscription[]> = new Map();

  // Internal client structure for job access
  private readonly clientMap: ClientStructure<T>;
  // events are exposed via client() namespace

  constructor(
    pgBoss: PgBoss,
    jobs: Map<string, JobDefinition>,
    router: T,
    subscriptions?: Map<string, RuntimeSubscription[]>
  ) {
    this.pgBoss = pgBoss;
    this.jobs = jobs;
    if (subscriptions) {
      this.subs = subscriptions;
    }

    // Create ensureStarted function that initializes pg-boss when needed
    const ensureStarted = async () => {
      await this.init();
      return this.pgBoss;
    };

    // Build concrete client structure
    const client = {} as Record<string, unknown>;
    for (const name of Object.keys(router)) {
      client[name] = new JobClient(ensureStarted, name);
    }
    this.clientMap = client as ClientStructure<T>;
  }

  client(): {
    jobs: ClientStructure<T>;
    events: {
      [E in EventKeys<TEvents>]: {
        emit: (
          payload: EventPayloads<TEvents>[E],
          options?: PgBoss.SendOptions
        ) => Promise<string | string[] | null>;
      };
    };
  } {
    const jobs = this.clientMap as ClientStructure<T>;
    const events = new Proxy(
      {},
      {
        get: (_t, prop) => {
          if (typeof prop !== "string") {
            return;
          }
          const q = eventQueueName(prop);
          const getPg = async () => {
            await this.init();
            return this.pgBoss;
          };
          const emitter = new JobClient(getPg, q);
          return {
            emit: (payload: unknown, options?: PgBoss.SendOptions) =>
              emitter.send((payload as object) ?? {}, options),
          };
        },
      }
    ) as unknown as {
      [E in EventKeys<TEvents>]: {
        emit: (
          payload: EventPayloads<TEvents>[E],
          options?: PgBoss.SendOptions
        ) => Promise<string | string[] | null>;
      };
    };

    return { events, jobs };
  }

  /**
   * Initialize pg-boss for sending jobs (without starting workers)
   * This is called automatically by start() if not already done
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: composed startup steps
  private async init(): Promise<void> {
    if (this.isPgBossStarted) {
      return;
    }

    await this.pgBoss.start();

    // Create queues for all registered jobs (required in pg-boss v10+)
    for (const [name] of this.jobs) {
      try {
        await this.pgBoss.createQueue(name);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes("already exists")) {
          throw error;
        }
      }
    }

    this.isPgBossStarted = true;

    // Create event queues based on subscriptions
    for (const event of this.subs.keys()) {
      const q = eventQueueName(event);
      try {
        await this.pgBoss.createQueue(q);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes("already exists")) {
          throw error;
        }
      }
    }
  }

  /**
   * Start the worker with all registered handlers
   * Automatically handles SIGTERM/SIGINT for graceful shutdown
   */
  async start(): Promise<void> {
    if (this.isWorkerStarted) {
      console.warn("⚠️  Worker is already started");
      return;
    }

    console.log("🚀 Starting pg-bossman worker...");

    // Initialize pg-boss if not already done
    await this.init();

    // Reconcile schedules and register event handlers
    await this.reconcileSchedules();
    await this.registerEventHandlers();

    // Register all job handlers
    const jobList = await this.registerJobHandlers();

    console.log("\n📋 Registered jobs:");
    for (const job of jobList) {
      console.log(job);
    }

    console.log("\n✅ Worker started successfully!");
    console.log("   Listening for jobs...\n");

    this.isWorkerStarted = true;

    // Set up graceful shutdown handlers
    this.setupGracefulShutdown();
  }

  private async reconcileSchedules(): Promise<void> {
    const existing = await this.pgBoss.getSchedules();
    const existingNames = new Set(existing.map((s) => s.name));

    for (const [name, job] of this.jobs) {
      const schedule = (job as JobDefinition).schedule;
      if (schedule) {
        await this.pgBoss.schedule(
          name,
          schedule.cron,
          (schedule.data as object) ?? {},
          schedule.options
        );
        existingNames.delete(name);
      }
    }

    for (const leftover of existingNames) {
      await this.pgBoss.unschedule(leftover);
    }
  }

  /**
   * Stop the pg-boss instance
   */
  async stop(options?: PgBoss.StopOptions): Promise<void> {
    await this.pgBoss.stop(options);
    this.isPgBossStarted = false;
    this.isWorkerStarted = false;
  }

  /**
   * Get all schedules
   * Returns all scheduled jobs across all queues
   */
  async getSchedules(): Promise<PgBoss.Schedule[]> {
    return await this.pgBoss.getSchedules();
  }

  /**
   * Get the underlying pg-boss instance for advanced usage
   */
  getPgBoss(): PgBoss {
    return this.pgBoss;
  }

  /**
   * Register all job handlers and return formatted job list
   */
  private async registerJobHandlers(): Promise<string[]> {
    const jobList: string[] = [];

    for (const [name, job] of this.jobs) {
      // Build job info string
      jobList.push(this.formatJobInfo(name, job));

      // Register the handler
      await this.registerSingleJobHandler(name, job);
    }

    return jobList;
  }

  /**
   * Format job information for logging
   */
  private formatJobInfo(name: string, job: JobDefinition): string {
    let jobInfo = `  • ${name}`;

    // Add job configuration details
    const configs: string[] = [];
    if ("batchHandler" in job && job.options?.batchSize) {
      configs.push(`batch size: ${job.options.batchSize}`);
    }
    if (job.options?.retryLimit !== undefined) {
      configs.push(`retry limit: ${job.options.retryLimit}`);
    }
    if (job.options?.retryDelay !== undefined) {
      configs.push(`retry delay: ${job.options.retryDelay}s`);
    }

    if (configs.length > 0) {
      jobInfo += ` (${configs.join(", ")})`;
    }

    return jobInfo;
  }

  /**
   * Register a single job handler
   */
  private async registerSingleJobHandler(
    name: string,
    job: JobDefinition
  ): Promise<void> {
    if (isBatchJob(job)) {
      // Batch job handler - always receives an array
      const workOptions: PgBoss.WorkOptions & { includeMetadata: true } = {
        batchSize: job.options?.batchSize,
        includeMetadata: true as const,
      };

      await this.pgBoss.work(
        name,
        workOptions,
        async (jobs: PgBoss.JobWithMetadata[]) => {
          console.log(
            `📦 Processing batch job "${name}" (${jobs.length} items)`
          );
          const inputs = jobs.map((j) => j.data);
          // Batch handler always receives an array
          const result = job.batchHandler(inputs);
          return isPromise(result) ? await result : result;
        }
      );
    } else {
      // Single job handler - process each job individually
      const workOptions: PgBoss.WorkOptions & { includeMetadata: true } = {
        batchSize: 1,
        includeMetadata: true as const,
      };

      await this.pgBoss.work(
        name,
        workOptions,
        async (jobs: PgBoss.JobWithMetadata[]) => {
          console.log(`⚡ Processing job "${name}" (${jobs.length} items)`);
          // Single handler is called once per job
          const results: unknown[] = [];
          for (const pgBossJob of jobs) {
            const result = job.handler(pgBossJob.data);
            results.push(isPromise(result) ? await result : result);
          }
          return results.length === 1 ? results[0] : results;
        }
      );
    }
  }

  /**
   * Set up graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);
      try {
        await this.stop({
          graceful: true,
          timeout: 30_000,
        });
        console.log("✅ Worker stopped successfully");
        process.exit(0);
      } catch (error) {
        console.error("❌ Error during shutdown:", error);
        process.exit(1);
      }
    };

    // Handle termination signals
    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));

    // Log that handlers are set up
    console.log("   Graceful shutdown handlers registered (SIGTERM/SIGINT)");
  }

  private async registerEventHandlers(): Promise<void> {
    for (const [event, targets] of this.subs.entries()) {
      const q = eventQueueName(event);
      const workOptions: PgBoss.WorkOptions & { includeMetadata: true } = {
        batchSize: 1,
        includeMetadata: true as const,
      };
      await this.pgBoss.work(
        q,
        workOptions,
        async (jobs: PgBoss.JobWithMetadata[]) => {
          for (const job of jobs) {
            const payload = job.data as unknown;
            for (const t of targets) {
              const data = t.map ? t.map(payload) : payload;
              await this.pgBoss.send(t.queue, (data as object) ?? {});
            }
          }
        }
      );
    }
  }
}

/**
 * Builder for creating a pg-bossman instance
 */
class BossmanBuilder<
  T extends JobsMap = Record<string, JobWithoutName>,
  TEvents extends EventsDef<Record<string, unknown>> = EventsDef<
    Record<string, unknown>
  >,
> {
  private readonly pgBoss: PgBoss;
  // biome-ignore lint/style/useReadonlyClassProperties: This is reassigned in the register method
  private router?: T;
  // eventsDef reserved for future; not used at runtime
  // private readonly eventsDef?: TEvents;
  private subscriptionMap: Map<string, RuntimeSubscription[]> = new Map();

  constructor(options: PgBoss.ConstructorOptions) {
    this.pgBoss = createPgBoss(options, "worker");
  }

  /**
   * Register jobs with the bossman instance
   */
  register<R extends JobsMap>(router: R): BossmanBuilder<R, TEvents> {
    // We need to cast here because TypeScript can't track the type change
    const builder = this as unknown as BossmanBuilder<R, TEvents>;
    builder.router = router;
    return builder;
  }

  events<E extends EventsDef<Record<string, unknown>>>(
    events: E
  ): BossmanBuilder<T, E> {
    const builder = this as unknown as BossmanBuilder<T, E>;
    builder.eventsDef = events;
    return builder;
  }

  subscriptions(
    map: {
      [E in keyof EventPayloads<TEvents>]?: Partial<{
        [Q in keyof T]: EventPayloads<TEvents>[E] extends InferInputFromJob<
          T[Q]
        >
          ?
              | true
              | {
                  map: (
                    p: EventPayloads<TEvents>[E]
                  ) => InferInputFromJob<T[Q]>;
                }
          : {
              map: (p: EventPayloads<TEvents>[E]) => InferInputFromJob<T[Q]>;
            };
      }>;
    }
  ): BossmanBuilder<T, TEvents> {
    const subs = new Map<string, RuntimeSubscription[]>();
    for (const [event, value] of Object.entries(
      map as Record<string, unknown>
    )) {
      const entries: RuntimeSubscription[] = [];
      for (const [queue, spec] of Object.entries(
        (value as Record<string, unknown>) ?? {}
      )) {
        if (spec === true) {
          entries.push({ queue });
        } else if (
          spec &&
          typeof spec === "object" &&
          typeof (spec as { map?: (p: unknown) => unknown }).map === "function"
        ) {
          entries.push({
            map: (spec as { map: (p: unknown) => unknown }).map,
            queue,
          });
        }
      }
      subs.set(event, entries);
    }
    this.subscriptionMap = subs;
    return this;
  }

  /**
   * Build the final bossman instance
   */
  build(): PgBossmanInstance<T, TEvents> {
    if (!this.router) {
      throw new Error("No jobs registered. Call .register() before .build()");
    }

    // Build a map of job definitions with names
    const jobMap = new Map<string, JobDefinition>();
    for (const [name, def] of Object.entries(this.router)) {
      const withName = { ...(def as JobWithoutName), name } as JobDefinition;
      jobMap.set(name, withName);
    }

    // Create the worker instance with all functionality
    return new BossmanWorker(
      this.pgBoss,
      jobMap,
      this.router,
      this.subscriptionMap
    ) as PgBossmanInstance<T, TEvents>;
  }
}

/**
 * Create a pg-bossman instance builder
 *
 * Usage:
 * const bossman = createBossman({ connectionString: 'postgres://...' })
 *   .register({
 *     sendEmail: createJob().handler(...),
 *     images: {
 *       resize: createJob().batchHandler(...)
 *     }
 *   })
 *   .build();
 */
export function createBossman(
  options: PgBoss.ConstructorOptions
): BossmanBuilder {
  return new BossmanBuilder(options);
}

/**
 * The full pg-bossman instance with worker methods and client structure
 */
export type PgBossmanInstance<
  T extends JobsMap,
  TEvents extends EventsDef<Record<string, unknown>> = EventsDef<
    Record<string, unknown>
  >,
> = {
  // Worker methods
  start: () => Promise<void>;
  stop: (options?: PgBoss.StopOptions) => Promise<void>;
  getSchedules: () => Promise<PgBoss.Schedule[]>;
  getPgBoss: () => PgBoss;

  // Bossman client accessor (jobs + events emitters)
  client: () => {
    jobs: ClientStructure<T>;
    events: {
      [E in EventKeys<TEvents>]: {
        emit: (
          payload: EventPayloads<TEvents>[E],
          options?: PgBoss.SendOptions
        ) => Promise<string | string[] | null>;
      };
    };
  };
};
