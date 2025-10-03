import type {
  BatchQueueDefinition,
  BatchQueueHandler,
  QueueHandler,
  QueueOptions,
  QueueSchedule,
  SingleQueueDefinition,
} from "../types/index";

/**
 * Fluent builder for creating queue definitions
 * Usage: createQueue().options({...}).handler(async (input) => {...})
 */
export class QueueBuilder<TInput = unknown, TOutput = void> {
  private queueOptions?: QueueOptions;
  private queueSchedules: QueueSchedule<TInput>[] = [];

  /**
   * Set job options (retry, priority, etc)
   * These options are passed directly to pg-boss
   */
  /**
   * Declare the input type up-front to improve schedule type safety
   */
  input(): QueueBuilder<undefined, TOutput>;
  input<I>(): QueueBuilder<I, TOutput>;
  // Implementation signature uses unknown to satisfy linter; overload determines the visible return type
  input(): unknown {
    return this as unknown;
  }

  options(options: QueueOptions): QueueBuilder<TInput, TOutput> {
    this.queueOptions = options;
    return this;
  }

  /**
   * Define a schedule for this job. Multiple schedules are supported via keys.
   */
  schedule(config: QueueSchedule<TInput>): QueueBuilder<TInput, TOutput> {
    const { cron, data, key, options } = config;
    if (!key || key.length === 0) {
      throw new TypeError("schedule requires a non-empty key");
    }
    this.upsertSchedule({
      cron,
      data,
      key,
      options,
    });
    return this;
  }

  private upsertSchedule(schedule: QueueSchedule<TInput>) {
    this.queueSchedules = this.queueSchedules.filter(
      (existing) => existing.key !== schedule.key
    );
    this.queueSchedules.push(schedule);
  }

  /**
   * Define a single job handler (terminal method)
   * The handler will be called once per job
   */
  handler<I extends TInput, O = void>(
    handler: QueueHandler<I, O>
  ): Omit<SingleQueueDefinition<I, O>, "name"> {
    const def: Omit<SingleQueueDefinition<I, O>, "name"> = {
      handler,
      options: this.queueOptions,
    };
    if (this.queueSchedules.length > 0) {
      def.schedules = this.queueSchedules as QueueSchedule<I>[];
    }
    return def;
  }

  /**
   * Define a batch job handler (terminal method)
   * The handler receives an array of inputs for bulk processing
   */
  batchHandler<I extends TInput, O = void>(
    batchHandler: BatchQueueHandler<I, O>
  ): Omit<BatchQueueDefinition<I, O>, "name"> {
    const def: Omit<BatchQueueDefinition<I, O>, "name"> = {
      batchHandler,
      options: this.queueOptions,
    };
    if (this.queueSchedules.length > 0) {
      def.schedules = this.queueSchedules as QueueSchedule<I>[];
    }
    return def;
  }
}

/**
 * Factory function to create a job builder
 * Name will be inferred from the object key when used in a jobs object
 */
export function createQueue(): QueueBuilder<undefined> {
  return new QueueBuilder<undefined>();
}
