import type {
  BatchJobDefinition,
  BatchJobHandler,
  JobHandler,
  JobOptions,
  SingleJobDefinition,
} from "../types/index";

/**
 * Fluent builder for creating job definitions
 * Usage: createJob('name').options({...}).handler(async (input) => {...})
 */
export class JobBuilder<
  TName extends string,
  TInput = unknown,
  TOutput = void,
> {
  private readonly jobName: TName;
  private jobOptions?: JobOptions;

  constructor(name: TName) {
    this.jobName = name;
  }

  /**
   * Set job options (retry, priority, etc)
   * These options are passed directly to pg-boss
   */
  options(options: JobOptions): JobBuilder<TName, TInput, TOutput> {
    this.jobOptions = options;
    return this;
  }

  /**
   * Define a single job handler (terminal method)
   * The handler will be called once per job
   */
  handler<I, O = void>(
    handler: JobHandler<I, O>
  ): SingleJobDefinition<I, O> & { name: TName } {
    return {
      handler,
      name: this.jobName,
      options: this.jobOptions,
    };
  }

  /**
   * Define a batch job handler (terminal method)
   * The handler receives an array of inputs for bulk processing
   */
  batchHandler<I, O = void>(
    batchHandler: BatchJobHandler<I, O>
  ): BatchJobDefinition<I, O> & { name: TName } {
    return {
      batchHandler,
      name: this.jobName,
      options: this.jobOptions,
    };
  }
}

/**
 * Factory function to create a job builder
 * @param name - The unique name of the job
 */
export function createJob<TName extends string>(
  name: TName
): JobBuilder<TName> {
  return new JobBuilder(name);
}
