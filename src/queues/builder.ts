import type PgBoss from "pg-boss";
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
  private queueSchedule?: {
    cron: string;
    data?: TInput;
    options?: PgBoss.ScheduleOptions;
  };

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
   * Define a schedule for this job (one per queue)
   */
  // Single signature with conditional tuple type: requires data when TInput is not undefined
  schedule(
    ...args: [
      cron: string,
      ...(TInput extends undefined
        ? [options?: PgBoss.ScheduleOptions]
        : [data: TInput, options?: PgBoss.ScheduleOptions]),
    ]
  ): QueueBuilder<TInput, TOutput> {
    const cron = args[0] as string;
    const a2 = args[1] as unknown;
    const a3 = args[2] as PgBoss.ScheduleOptions | undefined;

    let data: TInput | undefined;
    let options: PgBoss.ScheduleOptions | undefined;

    const ARGS_WITH_DATA_AND_OPTIONS = 3 as const;
    if (args.length === ARGS_WITH_DATA_AND_OPTIONS) {
      data = a2 as TInput;
      options = a3;
    } else if (args.length === 2) {
      const maybeOptions = a2 as Record<string, unknown>;
      if (
        maybeOptions &&
        typeof maybeOptions === "object" &&
        ("tz" in maybeOptions ||
          "priority" in maybeOptions ||
          "retryLimit" in maybeOptions ||
          "retryDelay" in maybeOptions ||
          "retryBackoff" in maybeOptions)
      ) {
        options = maybeOptions as PgBoss.ScheduleOptions;
      } else {
        data = a2 as TInput;
      }
    }

    this.queueSchedule = { cron, data, options } as {
      cron: string;
      data?: TInput;
      options?: PgBoss.ScheduleOptions;
    };
    return this as unknown as QueueBuilder<TInput, TOutput>;
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
    if (this.queueSchedule) {
      def.schedule = this.queueSchedule as QueueSchedule<I>;
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
export function createQueue(): QueueBuilder<undefined> {
  return new QueueBuilder<undefined>();
}
