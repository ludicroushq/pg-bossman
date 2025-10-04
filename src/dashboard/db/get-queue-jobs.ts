import type PgBoss from "pg-boss";
import { getDb, type JobRow, PGBOSS_SCHEMA } from "./types";

export type GetQueueJobsResult = {
  jobs: JobRow[];
  total: number;
};

/**
 * Fetches jobs for a specific queue with pagination
 * Jobs remain in the job table in pg-boss v11, so we query a single table.
 */
export async function getQueueJobs(
  boss: PgBoss,
  queueName: string,
  limit: number,
  offset: number
): Promise<GetQueueJobsResult> {
  const db = getDb(boss);

  const jobsSql = `
    SELECT id,
           name,
           state,
           priority,
           retry_limit,
           retry_count,
           retry_delay,
           retry_delay_max,
           retry_backoff,
           start_after,
           started_on,
           singleton_key,
           singleton_on,
           expire_seconds,
           deletion_seconds AS delete_after_seconds,
           created_on,
           completed_on,
           keep_until,
           dead_letter,
           policy,
           data,
           output
    FROM ${PGBOSS_SCHEMA}.job
    WHERE name = $1
    ORDER BY created_on DESC, id DESC
    LIMIT $2 OFFSET $3
  `;

  const countSql = `
    SELECT COUNT(*) AS total FROM ${PGBOSS_SCHEMA}.job WHERE name = $1
  `;

  const [jobsResult, countResult] = await Promise.all([
    db.executeSql(jobsSql, [queueName, limit, offset]),
    db.executeSql(countSql, [queueName]),
  ]);

  const jobs = (jobsResult.rows || []) as JobRow[];
  const total = Number(
    (countResult.rows?.[0] as { total?: unknown })?.total ?? 0
  );

  return { jobs, total };
}
