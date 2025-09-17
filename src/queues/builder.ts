import type PgBoss from "pg-boss";
import type {
  BatchQueueDefinition,
  BatchQueueHandler,
  QueueDefinition,
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
  private queueSchedule?: {
    cron: string;
    data?: TInput;
    options?: PgBoss.ScheduleOptions;
  };

  /**
   * Set job options (retry, priority, etc)
   * These options are passed directly to pg-boss
   */
  options(options: QueueOptions): QueueBuilder<TInput, TOutput> {
    this.queueOptions = options;
    return this;
  }

  /**
   * Define a schedule for this job (one per queue)
   */
  schedule(
    cron: string,
    data?: TInput,
    options?: PgBoss.ScheduleOptions
  ): QueueBuilder<TInput, TOutput> {
    this.queueSchedule = { cron, data, options };
    return this;
  }

  /**
   * Define a single job handler (terminal method)
   * The handler will be called once per job
   */
  handler<I, O = void>(
    handler: QueueHandler<I, O>
  ): Omit<SingleQueueDefinition<I, O>, "name"> {
    const def: Omit<SingleQueueDefinition<I, O>, "name"> = {
      handler,
      options: this.queueOptions,
    };
    if (this.queueSchedule) {
      def.schedule = this.queueSchedule as QueueSchedule<I>;
    }
    return def;
  }

  /**
   * Define a batch job handler (terminal method)
   * The handler receives an array of inputs for bulk processing
   */
  batchHandler<I, O = void>(
    batchHandler: BatchQueueHandler<I, O>
  ): Omit<BatchQueueDefinition<I, O>, "name"> {
    const def: Omit<BatchQueueDefinition<I, O>, "name"> = {
      batchHandler,
      options: this.queueOptions,
    };
    if (this.queueSchedule) {
      def.schedule = this.queueSchedule as QueueSchedule<I>;
    }
    return def;
  }
}

/**
 * Factory function to create a job builder
 * Name will be inferred from the object key when used in a jobs object
 */
export function createQueue(): QueueBuilder {
  return new QueueBuilder();
}
