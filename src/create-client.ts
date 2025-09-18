import type PgBoss from "pg-boss";
import { createLazyStarter, createPgBoss } from "./core/create-pg-boss";
import type { PgBossmanInstance } from "./create-bossman";
import type { EventKeys, EventPayloads } from "./events/index";
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
export type ClientStructure<T extends QueuesMap> = {
  [K in keyof T]: QueueClient<InferInputFromQueue<T[K]>, unknown>;
};

// Minimal proxy just for createClient
// biome-ignore lint/suspicious/noExplicitAny: Using any in constraint to preserve event payload inference while constraining the input to PgBossmanInstance
export function createClient<TBossman extends PgBossmanInstance<any, any>>(
  options: PgBoss.ConstructorOptions
): TBossman extends PgBossmanInstance<infer R, infer E>
  ? {
      queues: ClientStructure<R>;
      events: {
        [K in EventKeys<E>]: {
          emit: (
            payload: EventPayloads<E>[K],
            options?: PgBoss.SendOptions
          ) => Promise<string | string[] | null>;
        };
      };
      getPgBoss: () => Promise<PgBoss>;
    }
  : never {
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

  return {
    events: eventsProxy,
    getPgBoss: () => ensureStarted(),
    queues: queuesProxy,
  } as unknown as TBossman extends PgBossmanInstance<infer R, infer E>
    ? {
        queues: ClientStructure<R>;
        events: {
          [K in EventKeys<E>]: {
            emit: (
              payload: EventPayloads<E>[K],
              options?: PgBoss.SendOptions
            ) => Promise<string | string[] | null>;
          };
        };
        getPgBoss: () => Promise<PgBoss>;
      }
    : never;
}
