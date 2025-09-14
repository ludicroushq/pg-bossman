import type PgBoss from "pg-boss";

/**
 * Job client that provides type-safe methods for a specific job
 * This is the shared implementation used by both bossman and createClient
 */
export class JobClient<TInput = void, _TOutput = void> {
  private readonly pgBoss: PgBoss;
  private readonly jobName: string;

  constructor(pgBoss: PgBoss, jobName: string) {
    this.pgBoss = pgBoss;
    this.jobName = jobName;
  }

  /**
   * Send a job to the queue
   * Can accept a single item or an array of items
   */
  async send(
    data: TInput extends void ? null : TInput | TInput[],
    options?: PgBoss.SendOptions
  ): Promise<string | string[] | null> {
    // Handle void input type - require null
    const payload = data === null ? {} : data;

    // Handle array input - send multiple jobs
    if (Array.isArray(payload)) {
      const jobIds = await Promise.all(
        payload.map((item) =>
          // biome-ignore lint/nursery/noUnnecessaryConditions: options is optional
          options
            ? this.pgBoss.send(this.jobName, item as object, options)
            : this.pgBoss.send(this.jobName, item as object)
        )
      );
      return jobIds.filter((id) => id !== null) as string[];
    }

    // Single item
    // biome-ignore lint/nursery/noUnnecessaryConditions: options is optional
    return options
      ? await this.pgBoss.send(this.jobName, payload as object, options)
      : await this.pgBoss.send(this.jobName, payload as object);
  }

  /**
   * Schedule a job with a cron expression
   */
  async schedule(
    name: string,
    cron: string,
    data: TInput extends void ? null : TInput,
    options?: PgBoss.ScheduleOptions
  ): Promise<void> {
    // Handle void input type - require null
    const payload = data === null ? {} : data;

    // Use the schedule name directly with the job name prefix
    const fullScheduleName = `${this.jobName}__${name}`;
    return await this.pgBoss.schedule(
      fullScheduleName,
      cron,
      payload as object,
      options
    );
  }

  /**
   * Unschedule a scheduled job
   */
  async unschedule(name: string): Promise<void> {
    const fullScheduleName = `${this.jobName}__${name}`;
    return await this.pgBoss.unschedule(fullScheduleName);
  }
}
