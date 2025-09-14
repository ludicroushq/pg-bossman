import type { JobDefinition } from "./index";

/**
 * A job definition without the name (name comes from object key)
 */
export type JobWithoutName = Omit<JobDefinition, "name">;

/**
 * A router can contain jobs or nested routers
 */
export type JobRouter = {
  [key: string]: JobWithoutName | JobRouter;
};

/**
 * Helper to check if something is a job definition (has handler or batchHandler)
 */
export function isJobDefinition(
  value: JobWithoutName | JobRouter
): value is JobWithoutName {
  return "handler" in value || "batchHandler" in value;
}

/**
 * Flattened job map with dot-notation names
 */
export type FlattenedJobs = Map<string, JobDefinition>;

/**
 * Recursively flatten a router structure into a map of job names to definitions
 */
export function flattenRouter(router: JobRouter, prefix = ""): FlattenedJobs {
  const jobs = new Map<string, JobDefinition>();

  for (const [key, value] of Object.entries(router)) {
    const fullName = prefix ? `${prefix}.${key}` : key;

    if (isJobDefinition(value)) {
      // It's a job - add it with the full name
      jobs.set(fullName, { ...value, name: fullName } as JobDefinition);
    } else {
      // It's a nested router - recurse
      const nestedJobs = flattenRouter(value as JobRouter, fullName);
      for (const [name, job] of nestedJobs) {
        jobs.set(name, job);
      }
    }
  }

  return jobs;
}
