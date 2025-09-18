import { Hono } from "hono";
import { handle } from "hono/vercel";
import { routes } from "./routes";

const TRAILING_SLASH_RE = /\/+$/;

import type PgBoss from "pg-boss";
import type { PgBossmanInstance } from "../create-bossman";
import type { ClientStructure } from "../create-client";
import type { EventsDef } from "../events/index";
import type { QueuesMap } from "../types/index";
import type { BossmanClient, Env } from "./types";

export function createDashboard<
  TBossman extends PgBossmanInstance<
    QueuesMap,
    EventsDef<Record<string, unknown>>
  >,
>(config: {
  client: BossmanClient<TBossman>;
  basePath?: string;
}): (req: Request) => Promise<Response>;

export function createDashboard(config: {
  client: {
    queues: ClientStructure<QueuesMap>;
    events: Record<string, unknown>;
    getPgBoss: () => Promise<PgBoss>;
  };
  basePath?: string;
}): (req: Request) => Promise<Response>;

export function createDashboard(config: {
  client:
    | BossmanClient<
        PgBossmanInstance<QueuesMap, EventsDef<Record<string, unknown>>>
      >
    | {
        queues: ClientStructure<QueuesMap>;
        events: Record<string, unknown>;
        getPgBoss: () => Promise<PgBoss>;
      };
  basePath?: string;
}) {
  let app = new Hono<Env>();
  const client = config.client;
  const normalizedBase = config.basePath
    ? config.basePath.replace(TRAILING_SLASH_RE, "")
    : undefined;
  if (normalizedBase) {
    app = app.basePath(normalizedBase);
  }

  app.use("*", async (c, next) => {
    // biome-ignore lint/suspicious/noExplicitAny: Environment stores a generic client
    c.set("bossmanClient", client as unknown as BossmanClient<any>);
    if (normalizedBase) {
      c.set("basePath", normalizedBase);
    }
    await next();
  });

  const chained = app.route("/", routes);
  return handle(chained);
}
