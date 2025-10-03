import { Hono } from "hono";
import { html } from "hono/html";
import type PgBoss from "pg-boss";
import type { Env } from "../../types";
import { JobDetailCard } from "../components/job-detail";

// Type for pg-boss job with metadata (camelCase from pg-boss API)
type PgBossJob = PgBoss.JobWithMetadata<unknown>;

// Convert pg-boss job to our JobRow format (snake_case for consistency with DB)
function convertToJobRow(pgBossJob: PgBossJob) {
  return {
    completed_on: pgBossJob.completedOn,
    created_on: pgBossJob.createdOn,
    data: pgBossJob.data,
    dead_letter: pgBossJob.deadLetter,
    delete_after_seconds: pgBossJob.deleteAfterSeconds,
    expire_seconds: pgBossJob.expireInSeconds,
    id: pgBossJob.id,
    keep_until: pgBossJob.keepUntil,
    name: pgBossJob.name,
    output: pgBossJob.output,
    policy: pgBossJob.policy,
    priority: pgBossJob.priority,
    retry_backoff: pgBossJob.retryBackoff,
    retry_count: pgBossJob.retryCount,
    retry_delay: pgBossJob.retryDelay,
    retry_delay_max: pgBossJob.retryDelayMax ?? null,
    retry_limit: pgBossJob.retryLimit,
    singleton_key: pgBossJob.singletonKey,
    singleton_on: pgBossJob.singletonOn,
    start_after: pgBossJob.startAfter,
    started_on: pgBossJob.startedOn,
    state: pgBossJob.state,
  };
}

export const jobDetail = new Hono<Env>().get("/:name/jobs/:id", async (c) => {
  const boss = await c.get("bossmanClient").getPgBoss();
  const queueName = c.req.param("name");
  const id = c.req.param("id");

  const pgBossJob = (await boss.getJobById(queueName, id)) as PgBossJob | null;
  const basePath = c.get("basePath") ?? "";

  if (!pgBossJob) {
    return c.html(
      html`<div class="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Job with ID "${id}" not found in queue "${queueName}"</span>
      </div>`
    );
  }

  // Convert to our expected format
  const job = convertToJobRow(pgBossJob);

  return c.html(JobDetailCard({ basePath, job }));
});
