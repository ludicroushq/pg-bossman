import type {
  BatchQueueDefinition,
  BatchQueueHandler,
  QueueHandler,
  QueueOptions,
  QueueSchedule,
  SingleQueueDefinition,
} from "../types/index";

// Validation constants
const WHITESPACE_REGEX = /\s+/;
const MIN_CRON_FIELDS = 5;
const MAX_CRON_FIELDS = 6;

/**
 * Fluent builder for creating queue definitions
 * Usage: createQueue().options({...}).handler(async (input) => {...})
 */
export class QueueBuilder<TInput = unknown, TOutput = void> {
  private queueOptions?: QueueOptions;
  private queueSchedules: QueueSchedule<TInput>[] = [];

  /**
   * Declare the input type up-front to improve schedule type safety
   *
   * @example
   * ```typescript
   * const job = createQueue()
   *   .input<{ userId: string }>()
   *   .handler(async ({ userId }) => {
   *     // userId is typed as string
   *   });
   * ```
   */
  input(): QueueBuilder<undefined, TOutput>;
  input<I>(): QueueBuilder<I, TOutput>;
  // Implementation signature uses unknown to satisfy linter; overload determines the visible return type
  input(): unknown {
    return this as unknown;
  }

  /**
   * Set job options (retry, priority, etc)
   * These options are passed directly to pg-boss
   *
   * @param options - Queue configuration options
   * @throws TypeError if batchSize is less than 1
   *
   * @example
   * ```typescript
   * const job = createQueue()
   *   .options({
   *     retryLimit: 3,
   *     retryDelay: 60,
   *     expireInSeconds: 300,
   *     batchSize: 10  // For batch handlers
   *   })
   *   .handler(async (input) => { ... });
   * ```
   */
  options(options: QueueOptions): QueueBuilder<TInput, TOutput> {
    // Validate batchSize if provided
    if (options.batchSize !== undefined && options.batchSize < 1) {
      throw new TypeError(
        `batchSize must be at least 1, got ${options.batchSize}`
      );
    }

    this.queueOptions = options;
    return this;
  }

  /**
   * Define a schedule for this job. Multiple schedules are supported via keys.
   *
   * @param config - Schedule configuration with cron expression, data, and key
   * @throws TypeError if key is empty or cron expression is invalid
   *
   * @example
   * ```typescript
   * const job = createQueue()
   *   .input<{ type: string }>()
   *   .schedule({
   *     key: 'daily',
   *     cron: '0 0 * * *',  // Every day at midnight
   *     data: { type: 'daily-report' }
   *   })
   *   .schedule({
   *     key: 'hourly',
   *     cron: '0 * * * *',  // Every hour
   *     data: { type: 'hourly-sync' }
   *   })
   *   .handler(async (input) => { ... });
   * ```
   */
  schedule(config: QueueSchedule<TInput>): QueueBuilder<TInput, TOutput> {
    const { cron, data, key, options } = config;

    // Validate key
    if (!key || key.length === 0) {
      throw new TypeError("schedule requires a non-empty key");
    }

    // Basic cron validation (5 or 6 fields)
    if (!cron || typeof cron !== "string") {
      throw new TypeError("schedule requires a valid cron expression string");
    }
    const cronParts = cron.trim().split(WHITESPACE_REGEX);
    if (
      cronParts.length < MIN_CRON_FIELDS ||
      cronParts.length > MAX_CRON_FIELDS
    ) {
      throw new TypeError(
        `Invalid cron expression "${cron}": must have ${MIN_CRON_FIELDS} or ${MAX_CRON_FIELDS} fields (got ${cronParts.length})`
      );
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
   *
   * @param handler - Function that processes a single job
   * @returns Queue definition (without name, which is inferred from the jobs map key)
   * @throws TypeError if handler is not a function
   *
   * @example
   * ```typescript
   * const sendEmailJob = createQueue()
   *   .input<{ to: string; subject: string }>()
   *   .options({ retryLimit: 3 })
   *   .handler(async ({ to, subject }) => {
   *     await emailService.send(to, subject);
   *     return { sent: true };
   *   });
   * ```
   */
  handler<I extends TInput, O = void>(
    handler: QueueHandler<I, O>
  ): Omit<SingleQueueDefinition<I, O>, "name"> {
    if (typeof handler !== "function") {
      throw new TypeError("handler must be a function");
    }

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
   *
   * @param batchHandler - Function that processes multiple jobs at once
   * @returns Queue definition (without name, which is inferred from the jobs map key)
   * @throws TypeError if batchHandler is not a function or batchSize is not set
   *
   * @example
   * ```typescript
   * const processImagesJob = createQueue()
   *   .input<{ imageUrl: string; width: number }>()
   *   .options({ batchSize: 10, retryLimit: 2 })
   *   .batchHandler(async (items) => {
   *     const results = await Promise.all(
   *       items.map(item => imageService.resize(item.imageUrl, item.width))
   *     );
   *     return results;
   *   });
   * ```
   */
  batchHandler<I extends TInput, O = void>(
    batchHandler: BatchQueueHandler<I, O>
  ): Omit<BatchQueueDefinition<I, O>, "name"> {
    if (typeof batchHandler !== "function") {
      throw new TypeError("batchHandler must be a function");
    }

    // Warn if batchSize is not set (pg-boss will use default of 1)
    if (!this.queueOptions?.batchSize) {
      console.warn(
        "batchHandler used without batchSize option. Consider setting options({ batchSize: N }) for better performance."
      );
    }

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
 * Factory function to create a queue builder
 * The queue name will be inferred from the object key when registered
 *
 * @returns A new queue builder instance
 *
 * @example
 * ```typescript
 * // Basic queue
 * const sendEmail = createQueue()
 *   .input<{ to: string; subject: string }>()
 *   .handler(async (input) => {
 *     await emailService.send(input.to, input.subject);
 *   });
 *
 * // Queue with options
 * const processPayment = createQueue()
 *   .input<{ amount: number; currency: string }>()
 *   .options({
 *     retryLimit: 5,
 *     retryDelay: 60,
 *     retryBackoff: true
 *   })
 *   .handler(async (input) => {
 *     return await paymentGateway.charge(input);
 *   });
 *
 * // Scheduled queue
 * const dailyReport = createQueue()
 *   .input<{ reportType: string }>()
 *   .schedule({
 *     key: 'daily',
 *     cron: '0 0 * * *',
 *     data: { reportType: 'daily' }
 *   })
 *   .handler(async (input) => {
 *     await reportService.generate(input.reportType);
 *   });
 *
 * // Batch queue
 * const resizeImages = createQueue()
 *   .input<{ url: string; width: number }>()
 *   .options({ batchSize: 10 })
 *   .batchHandler(async (items) => {
 *     return await Promise.all(
 *       items.map(item => imageService.resize(item.url, item.width))
 *     );
 *   });
 * ```
 */
export function createQueue(): QueueBuilder<undefined> {
  return new QueueBuilder<undefined>();
}
