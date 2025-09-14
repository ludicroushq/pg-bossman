import type {
  BatchJobDefinition,
  BatchJobHandler,
  JobHandler,
  JobOptions,
  SingleJobDefinition,
} from "../types/index";

/**
 * Fluent builder for creating job definitions
 * Usage: createJob().options({...}).handler(async (input) => {...})
 */
export class JobBuilder<TInput = unknown, TOutput = void> {
  private jobOptions?: JobOptions;

  /**
   * Set job options (retry, priority, etc)
   * These options are passed directly to pg-boss
   */
  options(options: JobOptions): JobBuilder<TInput, TOutput> {
    this.jobOptions = options;
    return this;
  }

  /**
   * Define a single job handler (terminal method)
   * The handler will be called once per job
   */
  handler<I, O = void>(
    handler: JobHandler<I, O>
  ): Omit<SingleJobDefinition<I, O>, "name"> {
    return {
      handler,
      options: this.jobOptions,
    };
  }

  /**
   * Define a batch job handler (terminal method)
   * The handler receives an array of inputs for bulk processing
   */
  batchHandler<I, O = void>(
    batchHandler: BatchJobHandler<I, O>
  ): Omit<BatchJobDefinition<I, O>, "name"> {
    return {
      batchHandler,
      options: this.jobOptions,
    };
  }
}

/**
 * Factory function to create a job builder
 * Name will be inferred from the object key when used in a jobs object
 */
export function createJob(): JobBuilder {
  return new JobBuilder();
}
