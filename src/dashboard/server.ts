import { Hono } from "hono";
import { handle } from "hono/vercel";
import { routes } from "./routes";

const TRAILING_SLASH_RE = /\/+$/;

import type { PgBossmanInstance } from "../create-bossman";
import type { EventsDef } from "../events/index";
import type { QueuesMap } from "../types/index";
import type { BossmanClient, Env } from "./types";

export function createDashboard<
  TBossman extends PgBossmanInstance<
    QueuesMap,
    EventsDef<Record<string, unknown>>
  >,
>(config: { client: BossmanClient<TBossman>; basePath?: string }) {
  let app = new Hono<Env>();
  const client = config.client;
  const normalizedBase = config.basePath
    ? config.basePath.replace(TRAILING_SLASH_RE, "")
    : undefined;
  if (normalizedBase) {
    app = app.basePath(normalizedBase);
  }

  app.use("*", async (c, next) => {
    c.set("bossmanClient", client);
    if (normalizedBase) {
      c.set("basePath", normalizedBase);
    }
    await next();
  });

  const chained = app.route("/", routes);
  return handle(chained);
}
