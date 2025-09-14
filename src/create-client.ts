import type PgBoss from "pg-boss";
import { buildProxy, type ClientStructure } from "./client/build-proxy";
import { createLazyStarter, createPgBoss } from "./core/create-pg-boss";
import type { PgBossmanInstance } from "./create-bossman";
import type { JobRouter } from "./types/router";

/**
 * Create a lightweight client without handlers (send-only)
 * This creates a client that can only send jobs, not process them
 *
 * Usage:
 * import type { bossman } from './jobs';
 * const client = createClient<typeof bossman>({
 *   connectionString: 'postgres://...'
 * });
 */
export function createClient<TBossman extends PgBossmanInstance<JobRouter>>(
  options: PgBoss.ConstructorOptions
): TBossman extends PgBossmanInstance<infer R> ? ClientStructure<R> : never {
  const pgBoss = createPgBoss(options, "client");
  const ensureStarted = createLazyStarter(pgBoss);

  // Build and return the client structure using shared proxy logic
  // We need the type assertion here because TypeScript can't infer the conditional type
  return buildProxy(
    pgBoss,
    ensureStarted
  ) as TBossman extends PgBossmanInstance<infer R> ? ClientStructure<R> : never;
}
