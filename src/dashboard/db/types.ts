import type PgBoss from "pg-boss";

// Database interface that pg-boss exposes
export type PgBossDb = {
  executeSql: (
    text: string,
    values?: unknown[]
  ) => Promise<{ rows: unknown[] }>;
};

// Job row from the database
export type JobRow = {
  id: string;
  name: string;
  state: "created" | "retry" | "active" | "completed" | "cancelled" | "failed";
  priority: number;
  retry_limit: number;
  retry_count: number;
  retry_delay: number;
  retry_backoff: boolean;
  start_after: Date | string | null;
  started_on: Date | string | null;
  singleton_key: string | null;
  singleton_on: Date | string | null;
  expire_in: unknown; // PostgreSQL interval type (can be string or object)
  created_on: Date | string;
  completed_on: Date | string | null;
  keep_until: Date | string | null;
  dead_letter: string | null;
  policy: string | null;
  data?: unknown;
  output?: unknown;
};

// Helper to get the database instance from pg-boss
export function getDb(boss: PgBoss): PgBossDb {
  return (boss as unknown as { getDb: () => PgBossDb }).getDb();
}

// Default pg-boss schema
export const PGBOSS_SCHEMA = "pgboss";
