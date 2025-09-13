import PgBoss from 'pg-boss';
import { PgBossmanClient, type TypedBossmanInterface } from './pg-bossman-client';
import type { JobDefinition } from './types/index';

/**
 * Create a lightweight client without handlers
 * This uses the same PgBossmanClient class but without job handlers
 * 
 * Usage:
 * import type { bossman } from './jobs';
 * const client = createClient<typeof bossman>('postgres://...');
 */
export function createClient<T extends TypedBossmanInterface<any>>(
  connectionString: string,
  options?: PgBoss.ConstructorOptions
): T extends TypedBossmanInterface<infer TJobs> ? TypedBossmanInterface<TJobs> : never {
  const pgBoss = options 
    ? new PgBoss(options)
    : new PgBoss(connectionString);
  
  // Extract job names from the type (no handlers needed for client)
  // Since this is type-only, we create empty job definitions
  const jobs = new Map<string, JobDefinition>();
  
  // The actual job names will be inferred from the type parameter
  // For now, we create an empty PgBossmanClient that will have methods added dynamically
  return new PgBossmanClient(pgBoss, jobs) as any;
}