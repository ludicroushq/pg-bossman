import PgBoss from "pg-boss";

/**
 * Default options for pg-boss instances.
 * These align with pg-boss v11 maintenance defaults while ensuring
 * supervision and scheduling are enabled out of the box.
 */
const DEFAULT_OPTIONS: Partial<PgBoss.ConstructorOptions> = {
  maintenanceIntervalSeconds: 60 * 60 * 24,
  schedule: true,
  supervise: true,
  superviseIntervalSeconds: 60,
  warningQueueSize: 10_000,
  warningSlowQuerySeconds: 30,
};

/**
 * Create a pg-boss instance with default options and error handling
 * Used by both createBossman and createClient for consistency
 */
export function createPgBoss(
  options: PgBoss.ConstructorOptions,
  context: "worker" | "client" = "worker"
): PgBoss {
  // Merge default options with user options (user options take precedence)
  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const pgBoss = new PgBoss(mergedOptions);

  // Always handle error events to prevent losing error information
  pgBoss.on("error", (error: Error) => {
    console.error(`[pg-bossman ${context}] Error:`, error);
  });

  return pgBoss;
}

/**
 * Helper to ensure pg-boss is started (for lazy initialization)
 */
export function createLazyStarter(pgBoss: PgBoss) {
  let started = false;
  let startPromise: Promise<void> | null = null;

  return async () => {
    // biome-ignore lint/nursery/noUnnecessaryConditions: started is modified in the closure
    if (started) {
      return pgBoss;
    }

    if (!startPromise) {
      startPromise = pgBoss.start().then(() => {
        started = true;
      });
    }

    await startPromise;
    return pgBoss;
  };
}
