import type PgBoss from "pg-boss";
import { JobClient } from "../jobs/client";
import type { JobRouter } from "../types/router";

/**
 * Type to represent the client structure
 */
export type ClientStructure<T extends JobRouter> = {
  [K in keyof T]: T[K] extends JobRouter
    ? ClientStructure<T[K]>
    : T[K] extends { handler: infer H }
      ? H extends (input: infer I) => unknown
        ? JobClient<I, unknown>
        : H extends () => unknown
          ? JobClient<unknown, unknown>
          : JobClient<unknown, unknown>
      : T[K] extends { batchHandler: infer H }
        ? H extends (inputs: Array<infer I>) => unknown
          ? JobClient<I, unknown>
          : H extends () => unknown
            ? JobClient<unknown, unknown>
            : JobClient<unknown, unknown>
        : never;
};

type ProxyTarget = Record<string, unknown>;
type JobClientMethods = "send" | "schedule" | "unschedule";

/**
 * Create a proxy-based client structure that lazily creates JobClients
 * This is shared between create-boss and createClient
 */
export function buildProxy(
  pgBoss: PgBoss,
  ensureStarted?: () => Promise<PgBoss>
): ClientStructure<JobRouter> {
  return new Proxy({} as ProxyTarget, {
    get(_target, prop) {
      if (typeof prop === "string") {
        return createJobProxy(pgBoss, prop, ensureStarted);
      }
      return;
    },
  }) as ClientStructure<JobRouter>;
}

function createJobProxy(
  pgBoss: PgBoss,
  path: string,
  ensureStarted?: () => Promise<PgBoss>
): JobClient<unknown, unknown> | ClientStructure<JobRouter> {
  // If ensureStarted is provided (for createClient), wrap methods to ensure started
  // biome-ignore lint/nursery/noUnnecessaryConditions: ensureStarted is optional
  if (ensureStarted) {
    const handler: ProxyHandler<ProxyTarget> = {
      get(_target, prop) {
        // If it's a JobClient method, wrap it to ensure started first
        if (typeof prop === "string" && isJobClientMethod(prop)) {
          return async (...args: unknown[]) => {
            const startedPgBoss = await ensureStarted();
            const jobClient = new JobClient(startedPgBoss, path);
            const method = jobClient[prop];
            if (typeof method === "function") {
              return Reflect.apply(method, jobClient, args);
            }
            return;
          };
        }

        // Otherwise, it's a nested path
        if (typeof prop === "string") {
          return createJobProxy(pgBoss, `${path}.${prop}`, ensureStarted);
        }

        return;
      },
    };

    return new Proxy({}, handler) as ClientStructure<JobRouter>;
  }

  // For create-boss (no lazy start needed)
  const jobClient = new JobClient(pgBoss, path);

  return new Proxy(jobClient, {
    get(target, prop) {
      // If it's a known JobClient method, return it
      if (prop in target) {
        return target[prop as keyof typeof target];
      }

      // Otherwise, it's a nested path
      if (typeof prop === "string") {
        return createJobProxy(pgBoss, `${path}.${prop}`, ensureStarted);
      }

      return;
    },
  }) as JobClient<unknown, unknown> | ClientStructure<JobRouter>;
}

function isJobClientMethod(prop: string): prop is JobClientMethods {
  return prop === "send" || prop === "schedule" || prop === "unschedule";
}
