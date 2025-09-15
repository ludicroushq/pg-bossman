import type PgBoss from "pg-boss";
import type {
  BatchJobDefinition,
  BatchJobHandler,
  JobDefinition,
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
  private jobSchedule?: {
    cron: string;
    data?: TInput;
    options?: PgBoss.ScheduleOptions;
  };

  /**
   * Set job options (retry, priority, etc)
   * These options are passed directly to pg-boss
   */
  options(options: JobOptions): JobBuilder<TInput, TOutput> {
    this.jobOptions = options;
    return this;
  }

  /**
   * Define a schedule for this job (one per queue)
   */
  schedule(
    cron: string,
    data?: TInput,
    options?: PgBoss.ScheduleOptions
  ): JobBuilder<TInput, TOutput> {
    this.jobSchedule = { cron, data, options };
    return this;
  }

  /**
   * Define a single job handler (terminal method)
   * The handler will be called once per job
   */
  handler<I, O = void>(
    handler: JobHandler<I, O>
  ): Omit<SingleJobDefinition<I, O>, "name"> {
    const def: Omit<SingleJobDefinition<I, O>, "name"> & {
      schedule?: JobDefinition["schedule"];
    } = {
      handler,
      options: this.jobOptions,
    };
    if (this.jobSchedule) {
      def.schedule = this.jobSchedule as unknown as JobDefinition["schedule"];
    }
    return def;
  }

  /**
   * Define a batch job handler (terminal method)
   * The handler receives an array of inputs for bulk processing
   */
  batchHandler<I, O = void>(
    batchHandler: BatchJobHandler<I, O>
  ): Omit<BatchJobDefinition<I, O>, "name"> {
    const def: Omit<BatchJobDefinition<I, O>, "name"> & {
      schedule?: JobDefinition["schedule"];
    } = {
      batchHandler,
      options: this.jobOptions,
    };
    if (this.jobSchedule) {
      def.schedule = this.jobSchedule as unknown as JobDefinition["schedule"];
    }
    return def;
  }
}

/**
 * Factory function to create a job builder
 * Name will be inferred from the object key when used in a jobs object
 */
export function createJob(): JobBuilder {
  return new JobBuilder();
}
