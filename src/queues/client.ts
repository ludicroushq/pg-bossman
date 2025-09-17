import type PgBoss from "pg-boss";

/**
 * Queue client that provides type-safe methods for a specific queue
 * This is the shared implementation used by both bossman and createClient
 */
export class QueueClient<TInput = unknown, _TOutput = void> {
  private readonly getPgBoss: () => Promise<PgBoss>;
  private readonly queueName: string;

  constructor(getPgBoss: () => Promise<PgBoss>, queueName: string) {
    this.getPgBoss = getPgBoss;
    this.queueName = queueName;
  }

  /**
   * Send a job to the queue
   * Can accept a single item or an array of items
   */
  async send(
    data?: TInput | TInput[],
    options?: PgBoss.SendOptions
  ): Promise<string | string[] | null> {
    const pgBoss = await this.getPgBoss();
    // Support empty payloads without special-casing types
    const payload = (data as unknown) ?? {};

    // Handle array input - send multiple jobs
    if (Array.isArray(payload)) {
      const jobIds = await Promise.all(
        payload.map((item) =>
          // biome-ignore lint/nursery/noUnnecessaryConditions: options is optional
          options
            ? pgBoss.send(this.queueName, item as object, options)
            : pgBoss.send(this.queueName, item as object)
        )
      );
      return jobIds.filter((id) => id !== null) as string[];
    }

    // Single item
    // biome-ignore lint/nursery/noUnnecessaryConditions: options is optional
    return options
      ? await pgBoss.send(this.queueName, payload as object, options)
      : await pgBoss.send(this.queueName, payload as object);
  }

  /**
   * Schedule a job with a cron expression
   */
  async schedule(
    _name: string,
    cron: string,
    data?: TInput,
    options?: PgBoss.ScheduleOptions
  ): Promise<void> {
    const pgBoss = await this.getPgBoss();
    // Support empty payloads without special-casing types
    const payload = (data as unknown) ?? {};

    // In pg-boss v10+, schedules are tied to queue names.
    // Use the queue/job name directly to ensure the queue exists.
    return await pgBoss.schedule(
      this.queueName,
      cron,
      payload as object,
      options
    );
  }

  /**
   * Unschedule a scheduled job
   */
  async unschedule(_name?: string): Promise<void> {
    const pgBoss = await this.getPgBoss();
    // In pg-boss v10+, unschedule by queue/job name
    return await pgBoss.unschedule(this.queueName);
  }
}
