import PgBoss from 'pg-boss';
import { PgBossmanClient, type TypedBossmanInterface } from './pg-bossman-client';
import type { JobDefinition, JobRegistry } from './types/index';

/**
 * Main registry class for defining jobs
 * Usage:
 * const bossman = new PgBossman('postgres://...')
 *   .register(job1)
 *   .register(job2)
 *   .build();
 */
export class PgBossman<TJobs extends JobRegistry = {}> {
  private connectionString?: string;
  private pgBossOptions?: PgBoss.ConstructorOptions;
  private jobs = new Map<string, JobDefinition>();

  constructor(connectionStringOrOptions: string | PgBoss.ConstructorOptions, options?: PgBoss.ConstructorOptions) {
    if (typeof connectionStringOrOptions === 'string') {
      this.connectionString = connectionStringOrOptions;
      this.pgBossOptions = options;
    } else {
      this.pgBossOptions = connectionStringOrOptions;
    }
  }

  /**
   * Register a job definition
   * Returns this for chaining
   */
  register<TName extends string, TInput, TOutput>(
    job: JobDefinition<TInput, TOutput> & { name: TName }
  ): PgBossman<TJobs & { [K in TName]: typeof job }> {
    if (this.jobs.has(job.name)) {
      throw new Error(`Job "${job.name}" is already registered`);
    }
    
    this.jobs.set(job.name, job as JobDefinition);
    return this as any;
  }

  /**
   * Build the final typed interface with all registered jobs
   * This creates the pg-boss instance and returns the typed wrapper
   */
  build(): TypedBossmanInterface<TJobs> {
    let pgBoss: PgBoss;
    
    if (this.connectionString && !this.pgBossOptions) {
      pgBoss = new PgBoss(this.connectionString);
    } else if (this.pgBossOptions) {
      pgBoss = new PgBoss(this.pgBossOptions);
    } else {
      throw new Error('Either connection string or options must be provided');
    }
    
    return new PgBossmanClient<TJobs>(pgBoss, this.jobs) as TypedBossmanInterface<TJobs>;
  }
}