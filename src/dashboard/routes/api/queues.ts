import { Hono } from "hono";
import { getQueueStateCounts } from "../../db/get-queue-state-counts";
import type { Env } from "../../types";
import { QueuesCard } from "../components/queues";

type QueueRow = { name?: string } & Record<string, unknown>;

export const queues = new Hono<Env>()
  // HTML partial for the queues list card
  .get("/queues-list-card", async (c) => {
    const client = c.get("bossmanClient");
    const boss = await client.getPgBoss();
    const allQueues = ((await boss.getQueues?.()) ??
      []) as unknown as QueueRow[];
    const url = new URL(c.req.url);
    const only = url.searchParams.get("only");
    let filtered: QueueRow[];
    if (only === "events") {
      filtered = allQueues.filter((q) =>
        q.name?.startsWith("__bossman_event__")
      );
    } else {
      // default: show user queues excluding internal and events
      filtered = allQueues.filter(
        (q) =>
          !(
            q.name?.startsWith("__pgboss__") ||
            q.name?.startsWith("__bossman_event__")
          )
      );
    }
    // Build rows with aggregate counts (same semantics as queue detail page)
    const rows = await Promise.all(
      filtered.map(async (q) => ({
        counts: await getQueueStateCounts(boss, q.name ?? ""),
        name: q.name ?? "",
      }))
    );
    const basePath = c.get("basePath") ?? "";
    return c.html(QueuesCard({ basePath, queues: rows }));
  });
