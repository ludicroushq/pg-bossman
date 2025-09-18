// Main exports

export { createBossman, type PgBossmanInstance } from "./create-bossman";
export {
  type ClientStructure,
  createClient,
  type PgBossmanClientInstance,
} from "./create-client";
// Dashboard
export { createDashboard } from "./dashboard";
// Events
export { defineEvents, type EventsDef } from "./events/index";
export { createQueue, QueueBuilder } from "./queues/builder";
// Queue client exports (for advanced usage)
export { QueueClient } from "./queues/client";
// Type exports
export type {
  BatchQueueDefinition,
  BatchQueueHandler,
  ExtractInput,
  ExtractOutput,
  QueueDefinition,
  QueueHandler,
  QueueOptions,
  QueueRegistry,
  QueuesMap,
  QueueWithoutName,
  SingleQueueDefinition,
} from "./types/index";
// Helper functions
export { isBatchQueue, isPromise } from "./types/index";
// Router types removed in flat API
