import type PgBoss from "pg-boss";
import { createLazyStarter, createPgBoss } from "./core/create-pg-boss";
import type { PgBossmanInstance } from "./create-bossman";
import type { EventKeys, EventPayloads } from "./events/index";
import { eventQueueName } from "./events/index";
import { JobClient } from "./jobs/client";
import type { InferInputFromJob, JobsMap } from "./types/index";

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
export type ClientStructure<T extends JobsMap> = {
  [K in keyof T]: JobClient<InferInputFromJob<T[K]>, unknown>;
};

// Minimal proxy just for createClient
export function createClient<TBossman extends PgBossmanInstance<JobsMap>>(
  options: PgBoss.ConstructorOptions
): TBossman extends PgBossmanInstance<infer R, infer E>
  ? {
      jobs: ClientStructure<R>;
      events: {
        [K in EventKeys<E>]: {
          emit: (
            payload: EventPayloads<E>[K],
            options?: PgBoss.SendOptions
          ) => Promise<string | string[] | null>;
        };
      };
    }
  : never {
  const pgBoss = createPgBoss(options, "client");
  const ensureStarted = createLazyStarter(pgBoss);

  const jobsProxy = new Proxy(
    {},
    {
      get: (_t, prop) =>
        typeof prop === "string"
          ? new JobClient(ensureStarted, prop)
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
        const emitter = new JobClient(ensureStarted, q);
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
    jobs: jobsProxy,
  } as unknown as TBossman extends PgBossmanInstance<infer R, infer E>
    ? {
        jobs: ClientStructure<R>;
        events: {
          [K in EventKeys<E>]: {
            emit: (
              payload: EventPayloads<E>[K],
              options?: PgBoss.SendOptions
            ) => Promise<string | string[] | null>;
          };
        };
      }
    : never;
}
