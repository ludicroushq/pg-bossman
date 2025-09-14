import type PgBoss from "pg-boss";
import { buildProxy, type ClientStructure } from "./client/build-proxy";
import { createPgBoss } from "./core/create-pg-boss";
import type { JobDefinition } from "./types/index";
import { isBatchJob, isPromise } from "./types/index";
import type { JobRouter } from "./types/router";
import { flattenRouter } from "./types/router";

/**
 * Worker instance with job processing capabilities
 * This class is internal to create-bossman and contains all worker logic
 */
class BossmanWorker<T extends JobRouter> {
  private readonly pgBoss: PgBoss;
  private readonly jobs: Map<string, JobDefinition>;
  private isWorkerStarted = false;
  private isPgBossStarted = false;

  // Public client structure for job access
  readonly client: ClientStructure<T>;

  constructor(pgBoss: PgBoss, jobs: Map<string, JobDefinition>, _router: T) {
    this.pgBoss = pgBoss;
    this.jobs = jobs;

    // Create ensureStarted function that initializes pg-boss when needed
    const ensureStarted = async () => {
      await this.init();
      return this.pgBoss;
    };

    this.client = buildProxy(pgBoss, ensureStarted) as ClientStructure<T>;
  }

  /**
   * Initialize pg-boss for sending jobs (without starting workers)
   * This is called automatically by start() if not already done
   */
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
}

/**
 * Builder for creating a pg-bossman instance
 */
class BossmanBuilder<T extends JobRouter = Record<string, never>> {
  private readonly pgBoss: PgBoss;
  // biome-ignore lint/style/useReadonlyClassProperties: This is reassigned in the register method
  private router?: T;

  constructor(options: PgBoss.ConstructorOptions) {
    this.pgBoss = createPgBoss(options, "worker");
  }

  /**
   * Register jobs with the bossman instance
   */
  register<R extends JobRouter>(router: R): BossmanBuilder<R> {
    // We need to cast here because TypeScript can't track the type change
    const builder = this as unknown as BossmanBuilder<R>;
    builder.router = router;
    return builder;
  }

  /**
   * Build the final bossman instance
   */
  build(): PgBossmanInstance<T> {
    if (!this.router) {
      throw new Error("No jobs registered. Call .register() before .build()");
    }

    // Flatten the router to get all jobs with their full names
    const flattenedJobs = flattenRouter(this.router);

    // Create the worker instance with all functionality
    return new BossmanWorker(
      this.pgBoss,
      flattenedJobs,
      this.router
    ) as PgBossmanInstance<T>;
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
export type PgBossmanInstance<T extends JobRouter> = {
  // Worker methods
  start: () => Promise<void>;
  stop: (options?: PgBoss.StopOptions) => Promise<void>;
  getSchedules: () => Promise<PgBoss.Schedule[]>;
  getPgBoss: () => PgBoss;

  // Client structure for job access
  client: ClientStructure<T>;
};
