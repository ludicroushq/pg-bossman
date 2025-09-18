import type { HtmlEscapedString } from "hono/utils/html";
import type PgBoss from "pg-boss";
import type { PgBossmanInstance } from "../create-bossman";
import type { ClientStructure } from "../create-client";
import type { EventKeys, EventPayloads, EventsDef } from "../events/index";
import type { QueuesMap } from "../types/index";

export type HtmlNode = HtmlEscapedString | Promise<HtmlEscapedString>;

// Generic client shape matching createClient<typeof bossman>
export type BossmanClient<
  TBossman extends PgBossmanInstance<
    QueuesMap,
    EventsDef<Record<string, unknown>>
  >,
> = TBossman extends PgBossmanInstance<infer R, infer E>
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

export type Env = {
  Variables: {
    // biome-ignore lint/suspicious/noExplicitAny: Environment stores a generic client
    bossmanClient: BossmanClient<any>;
    basePath?: string;
  };
};
