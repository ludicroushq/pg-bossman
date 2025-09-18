import type PgBoss from "pg-boss";
import { createLazyStarter, createPgBoss } from "./core/create-pg-boss";
import type { PgBossmanInstance } from "./create-bossman";
import type { EventKeys, EventPayloads, EventsDef } from "./events/index";
import { eventQueueName } from "./events/index";
import { QueueClient } from "./queues/client";
import type { InferInputFromQueue, QueuesMap } from "./types/index";

/**
 * Create a lightweight client without handlers (send-only)
 * This creates a client that can only send jobs, not process them
 *
 * Usage:
 * import type { bossman } from './jobs';
 * const client = createClient<typeof bossman>({
 *   connectionString: 'postgres://...'
 * });
 */
export type ClientStructure<TQueues extends QueuesMap> = {
  [K in keyof TQueues]: QueueClient<InferInputFromQueue<TQueues[K]>, unknown>;
};

export type PgBossmanClientInstance<
  TQueues extends QueuesMap,
  TEvents extends EventsDef<Record<string, unknown>>,
> = {
  queues: ClientStructure<TQueues>;
  events: {
    [K in EventKeys<TEvents>]: {
      emit: (
        payload: EventPayloads<TEvents>[K],
        options?: PgBoss.SendOptions
      ) => Promise<string | string[] | null>;
    };
  };
  getPgBoss: () => Promise<PgBoss>;
};

// Minimal proxy just for createClient
// Overload 1: Loosely typed client (no generics). Useful when not deriving types from a bossman instance.
export function createClient(
  options: PgBoss.ConstructorOptions
): PgBossmanClientInstance<QueuesMap, EventsDef<Record<string, unknown>>>;

// Overload 2: Strongly typed client derived from a PgBossmanInstance
// biome-ignore lint/suspicious/noExplicitAny: Loosen constraint to preserve event key/payload inference without forcing string index signature
export function createClient<TBossman extends PgBossmanInstance<any, any>>(
  options: PgBoss.ConstructorOptions
): TBossman extends PgBossmanInstance<infer TQueues, infer TEvents>
  ? PgBossmanClientInstance<TQueues, TEvents>
  : never;

export function createClient(options: PgBoss.ConstructorOptions): unknown {
  const pgBoss = createPgBoss(options, "client");
  const ensureStarted = createLazyStarter(pgBoss);

  const queuesProxy = new Proxy(
    {},
    {
      get: (_t, prop) =>
        typeof prop === "string"
          ? new QueueClient(ensureStarted, prop)
          : undefined,
    }
  );

  const eventsProxy = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (typeof prop !== "string") {
          return;
        }
        const q = eventQueueName(prop);
        const emitter = new QueueClient(ensureStarted, q);
        return {
          emit: (payload: unknown, opts?: PgBoss.SendOptions) =>
            emitter.send((payload as object) ?? {}, opts),
        } as {
          emit: (
            payload: unknown,
            opts?: PgBoss.SendOptions
          ) => Promise<string | string[] | null>;
        };
      },
    }
  );

  const result = {
    events: eventsProxy,
    getPgBoss: () => ensureStarted(),
    queues: queuesProxy,
  } satisfies PgBossmanClientInstance<
    QueuesMap,
    EventsDef<Record<string, unknown>>
  >;

  return result as unknown;
}
