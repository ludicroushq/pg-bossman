import type PgBoss from "pg-boss";
import { createPgBoss } from "./core/create-pg-boss";
import type { PgBossmanClientInstance } from "./create-client";
import type { EventKeys, EventPayloads, EventsDef } from "./events/index";
import { eventQueueName } from "./events/index";
import { QueueClient } from "./queues/client";
import type {
  InferInputFromQueue,
  QueueDefinition,
  QueuesMap,
  QueueWithoutName,
} from "./types/index";
import { isBatchQueue, isPromise } from "./types/index";

/**
 * Worker instance with queue processing capabilities
 * This class is internal to create-bossman and contains all worker logic
 */
export type ClientStructure<TQueues extends QueuesMap> = {
  [K in keyof TQueues]: QueueClient<InferInputFromQueue<TQueues[K]>, unknown>;
};

type RuntimeSubscription = {
  queue: string;
  map?: (payload: unknown) => unknown;
};

class BossmanWorker<
  TQueues extends QueuesMap,
  TEvents extends EventsDef<Record<string, unknown>> = EventsDef<
    Record<string, unknown>
  >,
> {
  private readonly pgBoss: PgBoss;
  private readonly jobs: Map<string, QueueDefinition>;
  private isWorkerStarted = false;
  private isPgBossStarted = false;
  private readonly subs: Map<string, RuntimeSubscription[]> = new Map();

  // Internal client structure for job access
  private readonly clientMap: ClientStructure<TQueues>;
  // Exposed typed client (queues + events + getPgBoss)
  readonly client: {
    queues: ClientStructure<TQueues>;
    events: {
      [E in EventKeys<TEvents>]: {
        emit: (
          payload: EventPayloads<TEvents>[E],
          options?: PgBoss.SendOptions
        ) => Promise<string | string[] | null>;
      };
    };
    getPgBoss: () => Promise<PgBoss>;
  };

  constructor(
    pgBoss: PgBoss,
    jobs: Map<string, QueueDefinition>,
    router: TQueues,
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
      client[name] = new QueueClient(ensureStarted, name);
    }
    this.clientMap = client as ClientStructure<TQueues>;

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
          const emitter = new QueueClient(getPg, q);
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

    const getPgBoss = async () => {
      await this.init();
      return this.pgBoss;
    };

    this.client = {
      events,
      getPgBoss,
      queues: this.clientMap as ClientStructure<TQueues>,
    };
  }

  /**
   * Initialize pg-boss for sending (without starting workers)
   * This is called automatically by start() if not already done
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: composed startup steps
  private async init(): Promise<void> {
    if (this.isPgBossStarted) {
      return;
    }

    await this.pgBoss.start();

    // Create queues for all registered definitions (required in pg-boss v10+)
    for (const [name, job] of this.jobs) {
      try {
        // Pass options directly to pg-boss - they match the PgBoss.Queue type
        const queueOptions = {
          name,
          ...job.options,
        };
        await this.pgBoss.createQueue(name, queueOptions);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes("already exists")) {
          throw error;
        }
        // Queue exists, update it with current options
        // Always update to ensure removed options are cleared (undefined for pg-boss)
        // Using satisfies to ensure we handle all queue option keys
        type QueueUpdateOptions = Omit<PgBoss.Queue, "name">;
        const updateOptions = {
          deadLetter: job.options?.deadLetter,
          expireInHours: job.options?.expireInHours,
          expireInMinutes: job.options?.expireInMinutes,
          expireInSeconds: job.options?.expireInSeconds,
          policy: job.options?.policy,
          retentionDays: job.options?.retentionDays,
          retentionHours: job.options?.retentionHours,
          retentionMinutes: job.options?.retentionMinutes,
          retentionSeconds: job.options?.retentionSeconds,
          retryBackoff: job.options?.retryBackoff,
          retryDelay: job.options?.retryDelay,
          retryLimit: job.options?.retryLimit,
        } satisfies Partial<QueueUpdateOptions>;
        await this.pgBoss.updateQueue(name, { name, ...updateOptions });
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

    // Register all queue handlers
    const jobList = await this.registerQueueHandlers();

    console.log("\n📋 Registered queues:");
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
      const schedule = (job as QueueDefinition).schedule;
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
   * Returns all schedules across all queues
   */
  async getSchedules(): Promise<PgBoss.Schedule[]> {
    return await this.pgBoss.getSchedules();
  }

  /**
   * Get the underlying pg-boss instance for advanced usage
   * Ensures pg-boss is started before returning
   */
  async getPgBoss(): Promise<PgBoss> {
    await this.init();
    return this.pgBoss;
  }

  /**
   * Register all job handlers and return formatted job list
   */
  private async registerQueueHandlers(): Promise<string[]> {
    const jobList: string[] = [];

    for (const [name, job] of this.jobs) {
      // Build job info string
      jobList.push(this.formatQueueInfo(name, job));

      // Register the handler
      await this.registerSingleQueueHandler(name, job);
    }

    return jobList;
  }

  /**
   * Format job information for logging
   */
  private formatQueueInfo(name: string, job: QueueDefinition): string {
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
  private async registerSingleQueueHandler(
    name: string,
    job: QueueDefinition
  ): Promise<void> {
    if (isBatchQueue(job)) {
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
            `📦 Processing batch for queue "${name}" (${jobs.length} jobs)`
          );
          const inputs = jobs.map((j) => j.data);
          // Batch handler always receives an array
          const result = job.batchHandler(inputs);
          return isPromise(result) ? await result : result;
        }
      );
    } else {
      // Single handler - process each job individually
      const workOptions: PgBoss.WorkOptions & { includeMetadata: true } = {
        batchSize: 1,
        includeMetadata: true as const,
      };

      await this.pgBoss.work(
        name,
        workOptions,
        async (jobs: PgBoss.JobWithMetadata[]) => {
          console.log(`⚡ Processing queue "${name}" (${jobs.length} jobs)`);
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
  TQueues extends QueuesMap = Record<string, QueueWithoutName>,
  TEvents extends EventsDef<Record<string, unknown>> = EventsDef<
    Record<string, unknown>
  >,
> {
  private readonly pgBoss: PgBoss;
  // biome-ignore lint/style/useReadonlyClassProperties: This is reassigned in the register method
  private router?: TQueues;
  // eventsDef reserved for future; not used at runtime
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Reserved for future event type tracking
  // biome-ignore lint/style/useReadonlyClassProperties: Assigned via builder method
  private eventsDef?: TEvents;
  private subscriptionMap: Map<string, RuntimeSubscription[]> = new Map();

  constructor(options: PgBoss.ConstructorOptions) {
    this.pgBoss = createPgBoss(options, "worker");
  }

  /**
   * Register queues with the bossman instance
   */
  register<TNewQueues extends QueuesMap>(
    router: TNewQueues
  ): BossmanBuilder<TNewQueues, TEvents> {
    // We need to cast here because TypeScript can't track the type change
    const builder = this as unknown as BossmanBuilder<TNewQueues, TEvents>;
    builder.router = router;
    return builder;
  }

  events<TNewEvents extends EventsDef<Record<string, unknown>>>(
    events: TNewEvents
  ): BossmanBuilder<TQueues, TNewEvents> {
    const builder = this as unknown as BossmanBuilder<TQueues, TNewEvents>;
    builder.eventsDef = events;
    return builder;
  }

  subscriptions(
    map: {
      [E in keyof EventPayloads<TEvents>]?: Partial<{
        [Q in keyof TQueues]: EventPayloads<TEvents>[E] extends InferInputFromQueue<
          TQueues[Q]
        >
          ?
              | true
              | {
                  map: (
                    p: EventPayloads<TEvents>[E]
                  ) => InferInputFromQueue<TQueues[Q]>;
                }
          : {
              map: (
                p: EventPayloads<TEvents>[E]
              ) => InferInputFromQueue<TQueues[Q]>;
            };
      }>;
    }
  ): BossmanBuilder<TQueues, TEvents> {
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
  build(): PgBossmanInstance<TQueues, TEvents> {
    if (!this.router) {
      throw new Error("No queues registered. Call .register() before .build()");
    }

    // Build a map of queue definitions with names
    const jobMap = new Map<string, QueueDefinition>();
    for (const [name, def] of Object.entries(this.router)) {
      const withName = {
        ...(def as QueueWithoutName),
        name,
      } as QueueDefinition;
      jobMap.set(name, withName);
    }

    // Create the worker instance with all functionality
    return new BossmanWorker(
      this.pgBoss,
      jobMap,
      this.router,
      this.subscriptionMap
    ) as PgBossmanInstance<TQueues, TEvents>;
  }
}

/**
 * Create a pg-bossman instance builder
 *
 * Usage:
 * const bossman = createBossman({ connectionString: 'postgres://...' })
 *   .register({
 *     sendEmail: createQueue().handler(...),
 *     images: {
 *       resize: createQueue().batchHandler(...)
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
  TQueues extends QueuesMap,
  TEvents extends EventsDef<Record<string, unknown>> = EventsDef<
    Record<string, unknown>
  >,
> = {
  // Worker methods
  start: () => Promise<void>;
  stop: (options?: PgBoss.StopOptions) => Promise<void>;
  getSchedules: () => Promise<PgBoss.Schedule[]>;
  getPgBoss: () => Promise<PgBoss>;

  // Bossman client accessor (queues + events emitters)
  client: PgBossmanClientInstance<TQueues, TEvents>;
};
