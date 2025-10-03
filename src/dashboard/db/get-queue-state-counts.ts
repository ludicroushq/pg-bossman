import type PgBoss from "pg-boss";
import { getDb, PGBOSS_SCHEMA } from "./types";

export type QueueStateCounts = {
  created: number;
  retry: number;
  active: number;
  completed: number;
  cancelled: number;
  failed: number;
  all: number;
};

/**
 * Get job counts by state for a specific queue
 * Queries the job table (completed jobs remain in-place in pg-boss v11)
 */
export async function getQueueStateCounts(
  boss: PgBoss,
  queueName: string
): Promise<QueueStateCounts> {
  const db = getDb(boss);

  const sql = `
    SELECT state, COUNT(*) as count
    FROM ${PGBOSS_SCHEMA}.job
    WHERE name = $1
    GROUP BY state
  `;

  const result = await db.executeSql(sql, [queueName]);
  const rows = result.rows as Array<{ state: string; count: string }>;

  // Initialize counts
  const counts: QueueStateCounts = {
    active: 0,
    all: 0,
    cancelled: 0,
    completed: 0,
    created: 0,
    failed: 0,
    retry: 0,
  };

  // Populate counts from query results
  for (const row of rows) {
    const count = Number(row.count);
    counts[row.state as keyof Omit<QueueStateCounts, "all">] = count;
    counts.all += count;
  }

  return counts;
}

/**
 * Get job counts by state for a specific queue since a cutoff time
 */
// (Note) If needed in the future, a "since" variant can be added back, but
// the dashboard currently uses aggregate counts for consistency with queue detail.
