import type PgBoss from "pg-boss";

// Queue handler types - can be sync or async
export type QueueHandler<TInput, TOutput = void> = (
  input: TInput
) => TOutput | Promise<TOutput>;
export type BatchQueueHandler<TInput, TOutput = void> = (
  inputs: TInput[]
) => TOutput[] | Promise<TOutput[]>;

// Queue options that pass through to pg-boss
// Queue-level options that map to pg-boss Queue settings
// Note: These are distinct from per-job SendOptions
export interface QueueOptions extends Partial<PgBoss.Queue> {
  // Additional options can be added here
  batchSize?: number; // For batch handlers
}

// Queue definition after builder completes
export type SingleQueueDefinition<TInput = unknown, TOutput = void> = {
  name: string;
  handler: QueueHandler<TInput, TOutput>;
  options?: QueueOptions;
  schedule?: QueueSchedule<TInput>;
};

export type BatchQueueDefinition<TInput = unknown, TOutput = void> = {
  name: string;
  batchHandler: BatchQueueHandler<TInput, TOutput>;
  options?: QueueOptions;
  schedule?: QueueSchedule<TInput>;
};

export type QueueDefinition<TInput = unknown, TOutput = void> =
  | SingleQueueDefinition<TInput, TOutput>
  | BatchQueueDefinition<TInput, TOutput>;

// Optional attached schedule config on a queue
export type QueueSchedule<TInput = unknown> = {
  cron: string;
  data?: TInput;
  options?: PgBoss.ScheduleOptions;
};

// Helper to check if queue is batch
export function isBatchQueue<TInput, TOutput>(
  queue: QueueDefinition<TInput, TOutput>
): queue is BatchQueueDefinition<TInput, TOutput> {
  return "batchHandler" in queue;
}

// Registry of all queues for type inference
export type QueueRegistry = Record<string, QueueDefinition>;

// Extract input type from queue definition
export type ExtractInput<T> = T extends QueueDefinition<infer TInput, unknown>
  ? TInput
  : never;

// Extract output type from queue definition
export type ExtractOutput<T> = T extends QueueDefinition<unknown, infer TOutput>
  ? TOutput
  : never;

// Helper to check if a value is a promise
export function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return (
    value !== null &&
    typeof value === "object" &&
    "then" in value &&
    typeof value.then === "function"
  );
}

// Flat queues map
export type QueueWithoutName = Omit<QueueDefinition, "name">;
export type QueuesMap = Record<string, QueueWithoutName>;

// Helper to infer input from QueueWithoutName
export type InferInputFromQueue<J> = J extends {
  handler: (input: infer I) => unknown;
}
  ? I
  : J extends { batchHandler: (inputs: Array<infer I>) => unknown }
    ? I
    : unknown;
