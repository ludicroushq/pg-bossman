import { Hono } from "hono";
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
    // Filter out internal pg-boss queues
    const userQueues = allQueues.filter(
      (q) => !q.name?.startsWith("__pgboss__")
    );
    const basePath = c.get("basePath") ?? "";
    return c.html(QueuesCard({ basePath, queues: userQueues }));
  });
