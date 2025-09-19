import { Hono } from "hono";
import { getQueueStateCounts } from "../../db";
import type { Env } from "../../types";
import {
  QueueDetailCard,
  type QueueMeta,
  type QueueSchedule,
} from "../components/queue-detail";

export const queueDetail = new Hono<Env>().get(
  "/:name/detail-card",
  async (c) => {
    const client = c.get("bossmanClient");
    const boss = await client.getPgBoss();

    const name = c.req.param("name");
    const rawMeta = await boss.getQueue?.(name);

    // Convert from pg-boss camelCase to our snake_case format
    const meta: QueueMeta | null = rawMeta
      ? {
          created_on: rawMeta.createdOn,
          dead_letter: rawMeta.deadLetter,
          expire_seconds: rawMeta.expireInSeconds,
          name: rawMeta.name,
          policy: rawMeta.policy,
          retention_minutes: rawMeta.retentionMinutes,
          retry_backoff: rawMeta.retryBackoff,
          retry_delay: rawMeta.retryDelay,
          retry_limit: rawMeta.retryLimit,
          updated_on: rawMeta.updatedOn,
        }
      : null;

    // Get job counts by state
    const counts = await getQueueStateCounts(boss, name);

    // schedule info - schedules use the full queue name (e.g., "processPayment")
    const schedules = (await boss.getSchedules?.()) as QueueSchedule[] | null;
    const schedule =
      schedules?.find((s) => s.name === name || s.name.endsWith(`.${name}`)) ??
      null;

    return c.html(QueueDetailCard({ counts, meta, schedule }));
  }
);
