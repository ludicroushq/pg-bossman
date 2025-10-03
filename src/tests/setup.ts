import { EventEmitter } from "node:events";
import { PGlite } from "@electric-sql/pglite";
import type PgBoss from "pg-boss";

const QUERY_PREVIEW_LENGTH = 200;

/**
 * Handle parameterless query execution
 */
async function executeWithoutParams(pglite: PGlite, text: string) {
  const result = await pglite.exec(text);

  if (Array.isArray(result) && result.length > 0) {
    const lastResult = result.at(-1);
    return {
      rowCount: lastResult?.rows?.length || 0,
      rows: lastResult?.rows || [],
    };
  }

  return {
    rowCount: 0,
    rows: [],
  };
}

/**
 * Handle parameterized query execution
 */
async function executeWithParams(
  pglite: PGlite,
  text: string,
  values: unknown[]
) {
  const result = await pglite.query(text, values);
  return {
    rowCount: result.rows?.length || 0,
    rows: result.rows || [],
  };
}

/**
 * Format error for pg-boss
 */
function formatPgError(error: unknown, text: string) {
  console.error("PGlite query error:", error);
  console.error("Query preview:", text.substring(0, QUERY_PREVIEW_LENGTH));

  return {
    code: (error as { code?: string }).code,
    message: error instanceof Error ? error.message : String(error),
    position: (error as { position?: number }).position,
    severity: (error as { severity?: string }).severity || "ERROR",
  };
}

class BossmanTestDb extends EventEmitter {
  readonly _pgbdb = true;
  opened = true;
  readonly events = { error: "error" } as const;

  private readonly pglite: PGlite;

  constructor(pglite: PGlite) {
    super();
    this.pglite = pglite;
  }

  async executeSql(text: string, values?: unknown[]) {
    try {
      if (!values || values.length === 0) {
        return await executeWithoutParams(this.pglite, text);
      }
      return await executeWithParams(this.pglite, text, values);
    } catch (error) {
      throw formatPgError(error, text);
    }
  }

  open() {
    this.opened = true;
  }

  close() {
    this.opened = false;
  }
}

/**
 * Create a PGlite database adapter for pg-boss
 * This allows us to use an in-memory PostgreSQL database for testing
 */
export async function createTestDb() {
  const pglite = new PGlite();

  await pglite.waitReady;

  const db = new BossmanTestDb(pglite);

  return { db, pglite };
}

/**
 * Wait for a job to be processed
 * Polls the database until the job is completed or times out
 */
export async function waitForJob(
  pgBoss: PgBoss,
  queueName: string,
  jobId: string,
  timeoutMs = 5000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const job = await pgBoss.getJobById(queueName, jobId);
    if (job && (job.state === "completed" || job.state === "failed")) {
      return job.state === "completed";
    }
    const POLL_INTERVAL_MS = 100;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
}

/**
 * Create a test job counter to track handler invocations
 */
export function createJobCounter<T = unknown>() {
  const jobs: T[] = [];
  const handler = (input: T) => {
    jobs.push(input);
    return Promise.resolve({ processed: true });
  };

  return {
    getCount: () => jobs.length,
    getJobs: () => [...jobs],
    handler,
    reset: () => {
      jobs.length = 0;
    },
  };
}
