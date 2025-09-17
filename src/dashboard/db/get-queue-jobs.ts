import type PgBoss from "pg-boss";
import { getDb, type JobRow, PGBOSS_SCHEMA } from "./types";

export interface GetQueueJobsResult {
  jobs: JobRow[];
  total: number;
}

/**
 * Fetches jobs for a specific queue with pagination
 * Queries both the active job table and archive table
 */
export async function getQueueJobs(
  boss: PgBoss,
  queueName: string,
  limit: number,
  offset: number
): Promise<GetQueueJobsResult> {
  const db = getDb(boss);

  // Query to get jobs from both job and archive tables
  const jobsSql = `
    WITH combined_jobs AS (
      SELECT id, name, state, priority, retry_limit, retry_count, retry_delay,
             retry_backoff, start_after, started_on, singleton_key, singleton_on,
             expire_in, created_on, completed_on, keep_until, dead_letter, policy,
             data, output
      FROM ${PGBOSS_SCHEMA}.job 
      WHERE name = $1
      UNION ALL
      SELECT id, name, state, priority, retry_limit, retry_count, retry_delay,
             retry_backoff, start_after, started_on, singleton_key, singleton_on,
             expire_in, created_on, completed_on, keep_until, dead_letter, policy,
             data, output
      FROM ${PGBOSS_SCHEMA}.archive 
      WHERE name = $1
    )
    SELECT * FROM combined_jobs
    ORDER BY created_on DESC, id DESC
    LIMIT $2 OFFSET $3
  `;

  // Query to get total count
  const countSql = `
    SELECT 
      (SELECT COUNT(*) FROM ${PGBOSS_SCHEMA}.job WHERE name = $1) +
      (SELECT COUNT(*) FROM ${PGBOSS_SCHEMA}.archive WHERE name = $1) AS total
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
