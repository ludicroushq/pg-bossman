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
   *
   * @param data - The job data to send. Can be a single item or array of items
   * @param options - Optional pg-boss send options (priority, startAfter, etc)
   * @returns Job ID(s) or null if sending failed
   * @throws Error if pg-boss is not started or sending fails
   *
   * @example
   * ```typescript
   * // Send single job
   * const jobId = await client.myQueue.send({ userId: '123' });
   *
   * // Send multiple jobs
   * const jobIds = await client.myQueue.send([
   *   { userId: '123' },
   *   { userId: '456' }
   * ]);
   *
   * // Send with options
   * const jobId = await client.myQueue.send(
   *   { userId: '123' },
   *   { priority: 10, startAfter: new Date('2024-01-01') }
   * );
   * ```
   */
  async send(
    data?: TInput | TInput[],
    options?: PgBoss.SendOptions
  ): Promise<string | string[] | null> {
    try {
      const pgBoss = await this.getPgBoss();
      // Support empty payloads without special-casing types
      const payload = (data as unknown) ?? {};

      // Handle array input - send multiple jobs
      if (Array.isArray(payload)) {
        const jobIds = await Promise.all(
          payload.map((item) =>
            options
              ? pgBoss.send(this.queueName, item as object, options)
              : pgBoss.send(this.queueName, item as object)
          )
        );
        return jobIds.filter((id) => id !== null) as string[];
      }

      // Single item
      return options
        ? await pgBoss.send(this.queueName, payload as object, options)
        : await pgBoss.send(this.queueName, payload as object);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to send job to queue "${this.queueName}": ${errorMessage}`
      );
    }
  }

  // Intentionally no schedule/unschedule on client queues.
  // Schedules are defined via createQueue().schedule() at build time.
}
