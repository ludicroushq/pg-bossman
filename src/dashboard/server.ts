import { Hono } from "hono";
import { handle } from "hono/vercel";
import { routes } from "./routes";

const TRAILING_SLASH_RE = /\/+$/;

import type { BossmanClient, Env } from "./types";

export function createDashboard(
  bossmanClient: BossmanClient,
  opts?: { basePath?: string }
) {
  let app = new Hono<Env>();
  console.log("createDashboard", bossmanClient, opts);
  const normalizedBase = opts?.basePath
    ? opts.basePath.replace(TRAILING_SLASH_RE, "")
    : undefined;
  if (normalizedBase) {
    app = app.basePath(normalizedBase);
  }

  app.use("*", async (c, next) => {
    c.set("bossmanClient", bossmanClient);
    if (normalizedBase) {
      c.set("basePath", normalizedBase);
    }
    await next();
  });

  const chained = app.route("/", routes);
  return handle(chained);
}
