import { Hono } from "hono";
import { getQueueJobs } from "../../db";
import type { Env } from "../../types";
import { JobsList, JobsTable } from "../components/jobs";

// Re-export JobRow type for components
export type { JobRow } from "../../db";

function toInt(value: string | null | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

const DEFAULT_PREVIEW_LIMIT = 5;
const DEFAULT_PAGE_LIMIT = 25;

export const queueJobs = new Hono<Env>()
  // preview list
  .get("/:name/jobs", async (c) => {
    const boss = await c.get("bossmanClient").getPgBoss();
    const name = c.req.param("name");
    const url = new URL(c.req.url);
    const limit = toInt(url.searchParams.get("limit"), DEFAULT_PREVIEW_LIMIT);
    const { jobs } = await getQueueJobs(boss, name, limit, 0);
    const basePath = c.get("basePath") ?? "";
    return c.html(JobsTable({ basePath, jobs }));
  })
  // paginated list
  .get("/:name/jobs/list", async (c) => {
    const boss = await c.get("bossmanClient").getPgBoss();
    const name = c.req.param("name");
    const url = new URL(c.req.url);
    const limit = toInt(url.searchParams.get("limit"), DEFAULT_PAGE_LIMIT);
    const offset = toInt(url.searchParams.get("offset"), 0);
    const { jobs, total } = await getQueueJobs(boss, name, limit, offset);
    const basePath = c.get("basePath") ?? "";
    return c.html(JobsList({ basePath, jobs, limit, name, offset, total }));
  });
