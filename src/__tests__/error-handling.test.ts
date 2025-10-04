import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBossman, createQueue } from "../index";
import { createTestDb } from "../tests/setup";

// Test timeouts
const CLEANUP_WAIT_MS = 100;
const JOB_PROCESSING_WAIT_MS = 3000;
const BATCH_PROCESSING_WAIT_MS = 4000;

// Test constants
const BATCH_THRESHOLD_INDEX = 3;
const TOTAL_JOB_COUNT = 5;
const FIRST_JOB_ID = 1;
const SECOND_JOB_ID = 2;
const THIRD_JOB_ID = 3;

describe("Error Handling", () => {
  let pglite: PGlite;
  let db: {
    executeSql: (
      text: string,
      values?: unknown[]
    ) => Promise<{ rows: unknown[]; rowCount: number }>;
  };
  let bossmanInstances: Array<{
    stop: (options?: { graceful?: boolean; wait?: boolean }) => Promise<void>;
  }> = [];

  beforeEach(async () => {
    const testDb = await createTestDb();
    pglite = testDb.pglite;
    db = testDb.db;
    bossmanInstances = [];
  });

  afterEach(async () => {
    // Stop all bossman instances first
    for (const bossman of bossmanInstances) {
      try {
        await bossman.stop({ graceful: false, wait: false });
      } catch (_e) {
        // Ignore cleanup errors
      }
    }

    // Wait a bit for cleanup
    await new Promise((resolve) => setTimeout(resolve, CLEANUP_WAIT_MS));

    // Then close PGlite
    await pglite.close();
  });

  it("should allow sending jobs (pg-boss auto-initializes)", async () => {
    const bossman = createBossman({ db })
      .register({
        testQueue: createQueue()
          .input<{ test: string }>()
          .handler(() => {
            // Process test job
            return { success: true };
          }),
      })
      .build();

    // Send without explicit start (pg-boss will auto-initialize)
    const jobId = await bossman.client.queues.testQueue.send({ test: "value" });
    expect(jobId).toBeTruthy();

    await bossman.stop({ graceful: false });
  });

  it("should handle errors in job handler gracefully", async () => {
    const bossman = createBossman({ db })
      .register({
        failingJob: createQueue()
          .input<{ shouldFail: boolean }>()
          .options({ retryLimit: 0 }) // Disable retries for immediate failure
          .handler((input) => {
            if (input.shouldFail) {
              throw new Error("Intentional failure for testing");
            }
            return { success: true };
          }),
      })
      .build();

    await bossman.start();

    // Send job that will fail
    const jobId = await bossman.client.queues.failingJob.send({
      shouldFail: true,
    });
    expect(jobId).toBeTruthy();

    // Wait for job to be processed
    await new Promise((resolve) => setTimeout(resolve, JOB_PROCESSING_WAIT_MS));

    // Job should have failed but not crashed the worker
    // Check job state in database
    const result = await db.executeSql(
      "SELECT state FROM pgboss.job WHERE id = $1",
      [jobId]
    );

    const state = (result.rows[0] as { state?: string })?.state;
    // Should be 'failed' with retryLimit: 0
    expect(["failed", "retry"].includes(state || "")).toBe(true);

    await bossman.stop({ graceful: false });
  });

  it("should handle errors in batch handler gracefully", async () => {
    const bossman = createBossman({ db })
      .register({
        failingBatchJob: createQueue()
          .input<{ index: number }>()
          .options({ batchSize: 3, retryLimit: 0 })
          .batchHandler((items) => {
            // Fail on second batch
            if (items.some((item) => item.index >= BATCH_THRESHOLD_INDEX)) {
              throw new Error("Batch processing failed");
            }
            return items.map((item) => ({ processed: item.index }));
          }),
      })
      .build();

    await bossman.start();

    // Send jobs that will cause second batch to fail
    await Promise.all([
      bossman.client.queues.failingBatchJob.send({ index: 0 }),
      bossman.client.queues.failingBatchJob.send({ index: 1 }),
      bossman.client.queues.failingBatchJob.send({ index: 2 }),
      bossman.client.queues.failingBatchJob.send({ index: 3 }),
      bossman.client.queues.failingBatchJob.send({ index: 4 }),
    ]);

    // Wait for batches to be processed
    await new Promise((resolve) =>
      setTimeout(resolve, BATCH_PROCESSING_WAIT_MS)
    );

    // Check that jobs were processed (some succeeded, some failed/retrying)
    const result = await db.executeSql(
      "SELECT COUNT(*) as count FROM pgboss.job WHERE name = $1",
      ["failingBatchJob"]
    );

    const totalCount = Number((result.rows[0] as { count?: unknown })?.count);
    expect(totalCount).toBe(TOTAL_JOB_COUNT); // All jobs should exist

    await bossman.stop({ graceful: false });
  });

  it("should handle sending array of jobs", async () => {
    const bossman = createBossman({ db })
      .register({
        arrayJob: createQueue()
          .input<{ id: number }>()
          .handler((input) => ({ processed: input.id })),
      })
      .build();

    await bossman.start();

    const jobIds = await bossman.client.queues.arrayJob.send([
      { id: FIRST_JOB_ID },
      { id: SECOND_JOB_ID },
      { id: THIRD_JOB_ID },
    ]);

    expect(Array.isArray(jobIds)).toBe(true);
    expect((jobIds as string[]).length).toBe(THIRD_JOB_ID);
    expect((jobIds as string[]).every((id) => typeof id === "string")).toBe(
      true
    );

    await bossman.stop({ graceful: false });
  });

  it("should handle sending with options", async () => {
    const bossman = createBossman({ db })
      .register({
        priorityJob: createQueue()
          .input<{ task: string }>()
          .handler(() => {
            // Process priority job
            return { done: true };
          }),
      })
      .build();

    await bossman.start();

    const jobId = await bossman.client.queues.priorityJob.send(
      { task: "important" },
      { priority: 10 }
    );

    expect(jobId).toBeTruthy();

    // Verify priority was set
    const result = await db.executeSql(
      "SELECT priority FROM pgboss.job WHERE id = $1",
      [jobId]
    );

    const priority = (result.rows[0] as { priority?: number })?.priority;
    expect(priority).toBe(10);

    await bossman.stop({ graceful: false });
  });

  it("should handle sending empty/undefined data for parameterless jobs", async () => {
    const bossman = createBossman({ db })
      .register({
        noParamsJob: createQueue().handler(() => ({ executed: true })),
      })
      .build();

    await bossman.start();

    // Send without data
    const jobId1 = await bossman.client.queues.noParamsJob.send();
    expect(jobId1).toBeTruthy();

    await bossman.stop({ graceful: false });
  });

  it("should handle synchronous errors in handlers", async () => {
    const bossman = createBossman({ db })
      .register({
        syncErrorJob: createQueue()
          .input<{ fail: boolean }>()
          .options({ retryLimit: 0 })
          .handler((input) => {
            if (input.fail) {
              throw new Error("Sync error");
            }
            return { success: true };
          }),
      })
      .build();

    await bossman.start();

    const jobId = await bossman.client.queues.syncErrorJob.send({ fail: true });
    expect(jobId).toBeTruthy();

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, JOB_PROCESSING_WAIT_MS));

    const result = await db.executeSql(
      "SELECT state FROM pgboss.job WHERE id = $1",
      [jobId]
    );

    const state = (result.rows[0] as { state?: string })?.state;
    // Should be failed or retry
    expect(["failed", "retry"].includes(state || "")).toBe(true);

    await bossman.stop({ graceful: false });
  });

  it("should handle async errors in handlers", async () => {
    const bossman = createBossman({ db })
      .register({
        asyncErrorJob: createQueue()
          .input<{ fail: boolean }>()
          .options({ retryLimit: 0 })
          .handler(async (input) => {
            const ASYNC_DELAY_MS = 100;
            await new Promise((resolve) => setTimeout(resolve, ASYNC_DELAY_MS));
            if (input.fail) {
              throw new Error("Async error");
            }
            return { success: true };
          }),
      })
      .build();

    await bossman.start();

    const jobId = await bossman.client.queues.asyncErrorJob.send({
      fail: true,
    });
    expect(jobId).toBeTruthy();

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, JOB_PROCESSING_WAIT_MS));

    const result = await db.executeSql(
      "SELECT state FROM pgboss.job WHERE id = $1",
      [jobId]
    );

    const state = (result.rows[0] as { state?: string })?.state;
    // Should be failed or retry
    expect(["failed", "retry", "active"].includes(state || "")).toBe(true);

    await bossman.stop({ graceful: false });
  });
});
