import type { HtmlEscapedString } from "hono/utils/html";
import type { EventsDef, PgBossmanInstance, QueuesMap } from "pg-bossman";

export type HtmlNode = HtmlEscapedString | Promise<HtmlEscapedString>;

export type BossmanClient = PgBossmanInstance<
  QueuesMap,
  EventsDef<Record<string, unknown>>
>;

export type Env = {
  Variables: {
    bossmanClient: BossmanClient;
    basePath?: string;
  };
};
