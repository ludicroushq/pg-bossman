import { Hono } from "hono";
import { getQueueJobs } from "../../db";
import type { Env } from "../../types";
import { JobsList, JobsTable } from "../components/jobs";
import { withBasePath } from "../utils/path";
import { buildRefreshToggleHref } from "../utils/query";

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
    let offset = toInt(url.searchParams.get("offset"), 0);
    const basePath = c.get("basePath") ?? "";
    const currentUrlHeader = c.req.header("HX-Current-URL");
    let refreshOn = true;
    let currentPageUrl: URL | null = null;
    if (currentUrlHeader) {
      try {
        currentPageUrl = new URL(currentUrlHeader);
        if (!url.searchParams.has("offset")) {
          const pageParam = currentPageUrl.searchParams.get("page");
          const page =
            Number.isFinite(Number(pageParam)) && Number(pageParam) >= 1
              ? Math.floor(Number(pageParam))
              : 1;
          offset = (page - 1) * limit;
        }
        refreshOn =
          (currentPageUrl.searchParams.get("refresh") ?? "on") !== "off";
      } catch {
        currentPageUrl = null;
      }
    }
    const fallbackPage = Math.floor(offset / Math.max(1, limit)) + 1;
    const fallbackPath = withBasePath(
      basePath,
      `/queues/${encodeURIComponent(name)}/jobs`
    );
    const fallbackUrl = new URL(
      `${fallbackPath}?page=${fallbackPage}`,
      "http://pg-bossman.local"
    );
    const toggleHref = buildRefreshToggleHref(
      (currentPageUrl ?? fallbackUrl).toString(),
      refreshOn
    );
    // Recompute query using the possibly updated offset
    const { jobs, total } = await getQueueJobs(boss, name, limit, offset);
    return c.html(
      JobsList({
        basePath,
        jobs,
        limit,
        name,
        offset,
        refreshControlId: "jobs-refresh-control",
        refreshIndicatorId: "jobs-page-indicator",
        refreshOn,
        refreshToggleHref: toggleHref,
        total,
      })
    );
  });
