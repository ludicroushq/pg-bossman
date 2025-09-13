import { PGlite } from '@electric-sql/pglite';
import type PgBoss from 'pg-boss';

/**
 * Create a PGlite database adapter for pg-boss
 * This allows us to use an in-memory PostgreSQL database for testing
 */
export async function createTestDb() {
  const pglite = new PGlite();
  
  // Wait for PGlite to be ready
  await pglite.waitReady;
  
  // Create the adapter that pg-boss expects
  const db = {
    executeSql: async (text: string, values?: any[]) => {
      try {
        // Use exec for DDL and complex multi-statement queries
        // This handles dollar-quoted strings and complex SQL properly
        if (!values || values.length === 0) {
          // No parameters - use exec which can handle multiple statements
          const result = await pglite.exec(text);
          
          // exec returns an array of results, one per statement
          if (Array.isArray(result) && result.length > 0) {
            const lastResult = result[result.length - 1];
            return {
              rows: lastResult?.rows || [],
              rowCount: lastResult?.rows?.length || 0,
            };
          }
          
          return {
            rows: [],
            rowCount: 0,
          };
        } else {
          // Has parameters - must be a single statement
          const result = await pglite.query(text, values);
          return {
            rows: result.rows || [],
            rowCount: result.rows?.length || 0,
          };
        }
      } catch (error: any) {
        console.error('PGlite query error:', error);
        console.error('Query preview:', text.substring(0, 200));
        
        // pg-boss expects specific error properties
        const pgError = {
          message: error.message || String(error),
          position: error.position,
          code: error.code,
          severity: error.severity || 'ERROR',
        };
        throw pgError;
      }
    }
  };

  return { pglite, db };
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
    if (job && (job.state === 'completed' || job.state === 'failed')) {
      return job.state === 'completed';
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
}

/**
 * Create a test job counter to track handler invocations
 */
export function createJobCounter() {
  const jobs: any[] = [];
  const handler = async (input: any) => {
    jobs.push(input);
    return { processed: true };
  };
  
  return {
    handler,
    getJobs: () => [...jobs],
    getCount: () => jobs.length,
    reset: () => jobs.length = 0,
  };
}