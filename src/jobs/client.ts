import type PgBoss from 'pg-boss';
import type { TimeZone } from '@vvo/tzdb';

/**
 * Timezone type - all valid IANA timezone identifiers
 */
export type Timezone = TimeZone['name'];

/**
 * Schedule options with type-safe timezone
 * Accepts any IANA timezone string (e.g., 'America/New_York', 'Europe/London', 'UTC')
 */
export interface ScheduleOptions extends Omit<PgBoss.SendOptions, 'startAfter'> {
  tz?: Timezone;
}

/**
 * Job client that provides type-safe methods for a specific job
 * This is the shared implementation used by both bossman and createClient
 */
export class JobClient<TInput, TOutput = void> {
  constructor(
    private pgBoss: PgBoss,
    private jobName: string
  ) {}

  /**
   * Send a job to the queue
   * Mirrors pg-boss send(name, data, options) but without the name
   */
  async send(data: TInput, options?: PgBoss.SendOptions): Promise<string | null> {
    if (options) {
      return this.pgBoss.send(this.jobName, data as object, options);
    } else {
      return this.pgBoss.send(this.jobName, data as object);
    }
  }

  /**
   * Send a job after a delay
   * Mirrors pg-boss sendAfter(name, data, options, value) but without the name
   */
  async sendAfter(data: TInput, options: PgBoss.SendOptions | undefined, value: number | string | Date): Promise<string | null> {
    const opts = options || {};
    // Handle different overloads
    if (typeof value === 'number') {
      return this.pgBoss.sendAfter(this.jobName, data as object, opts, value);
    } else if (typeof value === 'string') {
      return this.pgBoss.sendAfter(this.jobName, data as object, opts, value);
    } else {
      return this.pgBoss.sendAfter(this.jobName, data as object, opts, value);
    }
  }

  /**
   * Send a throttled job
   * Mirrors pg-boss sendThrottled(name, data, options, seconds, key) but without the name
   */
  async sendThrottled(data: TInput, options: PgBoss.SendOptions | undefined, seconds: number, key: string): Promise<string | null> {
    const opts = options || {};
    return this.pgBoss.sendThrottled(this.jobName, data as object, opts, seconds, key);
  }

  /**
   * Send a debounced job
   * Mirrors pg-boss sendDebounced(name, data, options, seconds, key) but without the name
   */
  async sendDebounced(data: TInput, options: PgBoss.SendOptions | undefined, seconds: number, key: string): Promise<string | null> {
    const opts = options || {};
    return this.pgBoss.sendDebounced(this.jobName, data as object, opts, seconds, key);
  }

  // async insert(jobs: PgBoss.JobInsert<TInput>[]): Promise<void> {
  //   return this.pgBoss.insert(jobs.map(j => ({ ...j, name: this.jobName })));
  // }

  // async fetch(options?: PgBoss.FetchOptions): Promise<PgBoss.Job<TInput>[] | null> {
  //   return this.pgBoss.fetch(this.jobName, options);
  // }

  // async cancel(id: string | string[]): Promise<void> {
  //   return this.pgBoss.cancel(this.jobName, id);
  // }

  // async resume(id: string | string[]): Promise<void> {
  //   return this.pgBoss.resume(this.jobName, id);
  // }

  // async retry(id: string | string[]): Promise<void> {
  //   return this.pgBoss.fail(this.jobName, id);
  // }

  // async complete(id: string | string[], data?: TOutput): Promise<void> {
  //   return this.pgBoss.complete(this.jobName, id, data);
  // }

  // async fail(id: string | string[], data?: any): Promise<void> {
  //   return this.pgBoss.fail(this.jobName, id, data);
  // }

  // async deleteJob(id: string | string[]): Promise<void> {
  //   return this.pgBoss.deleteJob(this.jobName, id);
  // }

  // async getJobById(id: string, options?: { includeArchive?: boolean }): Promise<PgBoss.Job<TInput> | null> {
  //   return this.pgBoss.getJobById(this.jobName, id, options);
  // }

  /**
   * Schedule a job with a cron expression
   * Mirrors pg-boss schedule(name, cron, data, options) but without the queue name
   * To support multiple schedules per job, use a unique schedule name
   */
  async schedule(
    scheduleName: string,
    cron: string,
    data: TInput,
    options?: ScheduleOptions
  ): Promise<void> {
    // pg-boss expects: schedule(name, cron, data, options)
    // We combine job name and schedule name to allow multiple schedules per job
    const fullScheduleName = `${this.jobName}__${scheduleName}`;
    return this.pgBoss.schedule(fullScheduleName, cron, data as object, options as PgBoss.SendOptions);
  }

  /**
   * Unschedule a scheduled job
   * Mirrors pg-boss unschedule(name) but with schedule name
   */
  async unschedule(scheduleName: string): Promise<void> {
    const fullScheduleName = `${this.jobName}__${scheduleName}`;
    return this.pgBoss.unschedule(fullScheduleName);
  }
}