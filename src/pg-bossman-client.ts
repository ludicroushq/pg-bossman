import PgBoss from 'pg-boss';
import { JobClient } from './jobs/client';
import type { JobDefinition, JobRegistry, ExtractInput, ExtractOutput, isBatchJob } from './types/index';

/**
 * The typed interface that provides job clients
 * This is shared by both bossman.build() and createClient()
 */
export class PgBossmanClient<TJobs extends JobRegistry> {
  private pgBoss: PgBoss;
  private jobs: Map<string, JobDefinition>;
  private isWorkerStarted = false;
  private jobClients: Map<string, JobClient<any, any>> = new Map();

  constructor(
    pgBoss: PgBoss,
    jobs: Map<string, JobDefinition>
  ) {
    this.pgBoss = pgBoss;
    this.jobs = jobs;
    
    // Create job clients and add them as properties
    for (const [name, job] of jobs) {
      const client = new JobClient(pgBoss, name);
      this.jobClients.set(name, client);
      
      // Dynamically add the client as a property
      (this as any)[name] = client;
    }
  }

  /**
   * Start the pg-boss instance if not already started
   * In pg-boss v10+, queues must be created before jobs can be sent
   */
  async start(): Promise<void> {
    await this.pgBoss.start();
    
    // Create queues for all registered jobs (required in pg-boss v10+)
    // createQueue is idempotent - it won't error if the queue already exists
    for (const [name] of this.jobs) {
      try {
        await this.pgBoss.createQueue(name);
      } catch (error: any) {
        // Queue might already exist, which is fine
        if (!error.message?.includes('already exists')) {
          throw error;
        }
      }
    }
  }

  /**
   * Stop the pg-boss instance
   */
  async stop(options?: PgBoss.StopOptions): Promise<void> {
    await this.pgBoss.stop(options);
  }

  /**
   * Start worker with all registered handlers
   * Automatically handles SIGTERM/SIGINT for graceful shutdown
   */
  async startWorker(): Promise<void> {
    if (this.isWorkerStarted) {
      throw new Error('Worker already started');
    }

    await this.start();

    // Register all job handlers
    // In pg-boss v10, work() returns a promise that must be awaited
    for (const [name, job] of this.jobs) {
      console.log(`Registering worker for job: ${name}`);
      
      if ('batchHandler' in job) {
        // Batch job - receives array directly from pg-boss
        if (job.options) {
          await this.pgBoss.work(name, job.options as any, async (jobs) => {
            console.log(`Processing batch job ${name}, count: ${jobs.length}`);
            const inputs = jobs.map(j => j.data);
            return job.batchHandler(inputs);
          });
        } else {
          await this.pgBoss.work(name, async (jobs) => {
            console.log(`Processing batch job ${name}, count: ${jobs.length}`);
            const inputs = jobs.map(j => j.data);
            return job.batchHandler(inputs);
          });
        }
      } else if ('handler' in job) {
        // Single job - pg-boss passes array, we process individually
        if (job.options) {
          await this.pgBoss.work(name, job.options as any, async (jobs) => {
            console.log(`Processing job ${name}, count: ${jobs.length}`);
            return Promise.all(jobs.map(j => job.handler(j.data)));
          });
        } else {
          await this.pgBoss.work(name, async (jobs) => {
            console.log(`Processing job ${name}, count: ${jobs.length}`);
            return Promise.all(jobs.map(j => job.handler(j.data)));
          });
        }
      }
      // If neither handler nor batchHandler, it's a client-only job (no worker needed)
    }

    this.isWorkerStarted = true;

    // Automatic graceful shutdown
    const shutdown = async () => {
      console.log('Gracefully shutting down worker...');
      await this.stop({
        graceful: true,
        timeout: 30000,
        wait: true
      });
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Handle uncaught errors
    this.pgBoss.on('error', (error: Error) => {
      console.error('pg-boss error:', error);
    });
  }

  /**
   * Get all schedules
   * Returns all scheduled jobs across all queues
   */
  async getSchedules(): Promise<any[]> {
    return this.pgBoss.getSchedules();
  }

  /**
   * Get the underlying pg-boss instance for advanced usage
   */
  getPgBoss(): PgBoss {
    return this.pgBoss;
  }
}

// Type to make the job clients accessible as properties
export type TypedBossmanInterface<TJobs extends JobRegistry> = 
  PgBossmanClient<TJobs> & {
    [K in keyof TJobs]: JobClient<ExtractInput<TJobs[K]>, ExtractOutput<TJobs[K]>>;
  };