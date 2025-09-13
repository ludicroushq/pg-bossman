import type PgBoss from "pg-boss";

// Job handler types
export type JobHandler<TInput, TOutput = void> = (
  input: TInput
) => Promise<TOutput>;
export type BatchJobHandler<TInput, TOutput = void> = (
  inputs: TInput[]
) => Promise<TOutput[]>;

// Job options that pass through to pg-boss
export interface JobOptions extends Partial<PgBoss.SendOptions> {
  // Additional options can be added here
  batchSize?: number; // For batch handlers
}

// Job definition after builder completes
export type SingleJobDefinition<TInput = unknown, TOutput = void> = {
  name: string;
  handler: JobHandler<TInput, TOutput>;
  options?: JobOptions;
};

export type BatchJobDefinition<TInput = unknown, TOutput = void> = {
  name: string;
  batchHandler: BatchJobHandler<TInput, TOutput>;
  options?: JobOptions;
};

export type JobDefinition<TInput = unknown, TOutput = void> =
  | SingleJobDefinition<TInput, TOutput>
  | BatchJobDefinition<TInput, TOutput>;

// Helper to check if job is batch
export function isBatchJob<TInput, TOutput>(
  job: JobDefinition<TInput, TOutput>
): job is BatchJobDefinition<TInput, TOutput> {
  return "batchHandler" in job;
}

// Registry of all jobs for type inference
export type JobRegistry = Record<string, JobDefinition>;

// Extract input type from job definition
export type ExtractInput<T> = T extends JobDefinition<infer TInput, unknown>
  ? TInput
  : never;

// Extract output type from job definition
export type ExtractOutput<T> = T extends JobDefinition<unknown, infer TOutput>
  ? TOutput
  : never;
