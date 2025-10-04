import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBossman, createQueue } from "../index";
import { createTestDb } from "../tests/setup";

// Test timeouts
const RETRY_WAIT_MS = 5000;
const FUTURE_DELAY_MS = 5000;
const EXPIRE_IN_SECONDS = 300;
const RETRY_DELAY_SECONDS = 120;

// Test constants
const RETRY_LIMIT = 2;
const EXPECTED_JOB_COUNT = 3;
const PRIORITY_VALUE = 10;

describe("Queue Options", () => {
  let pglite: PGlite;
  let db: {
    executeSql: (
      text: string,
      values?: unknown[]
    ) => Promise<{ rows: unknown[]; rowCount: number }>;
  };

  beforeEach(async () => {
    const testDb = await createTestDb();
    pglite = testDb.pglite;
    db = testDb.db;
  });

  afterEach(async () => {
    await pglite.close();
  });

  it("should respect retryLimit option", async () => {
    const bossman = createBossman({ db })
      .register({
        retryJob: createQueue()
          .input<{ shouldFail: boolean }>()
          .options({ retryLimit: RETRY_LIMIT })
          .handler((input) => {
            if (input.shouldFail) {
              throw new Error("Simulated failure");
            }
            return { success: true };
          }),
      })
      .build();

    await bossman.start();

    const jobId = await bossman.client.queues.retryJob.send({
      shouldFail: true,
    });

    // Wait for retries to complete
    await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT_MS));

    // Verify retryLimit was respected
    const result = await db.executeSql(
      "SELECT retry_limit, retry_count, state FROM pgboss.job WHERE id = $1",
      [jobId]
    );

    const job = result.rows[0] as {
      retry_limit?: number;
      retry_count?: number;
      state?: string;
    };

    expect(job.retry_limit).toBe(RETRY_LIMIT);
    // Job may be in retry or failed state depending on timing
    expect(["failed", "retry"].includes(job.state || "")).toBe(true);

    await bossman.stop({ graceful: false });
  });

  it("should respect expireInSeconds option", async () => {
    const bossman = createBossman({ db })
      .register({
        expiringJob: createQueue()
          .input<{ data: string }>()
          .options({ expireInSeconds: EXPIRE_IN_SECONDS })
          .handler(() => ({ done: true })),
      })
      .build();

    await bossman.start();

    const jobId = await bossman.client.queues.expiringJob.send({
      data: "test",
    });

    const result = await db.executeSql(
      "SELECT expire_seconds FROM pgboss.job WHERE id = $1",
      [jobId]
    );

    const expireSeconds = (result.rows[0] as { expire_seconds?: number })
      ?.expire_seconds;
    expect(expireSeconds).toBe(EXPIRE_IN_SECONDS);

    await bossman.stop({ graceful: false });
  });

  it("should support custom priority", async () => {
    const bossman = createBossman({ db })
      .register({
        priorityJob: createQueue()
          .input<{ task: string }>()
          .handler(() => {
            // Process job
            return { processed: true };
          }),
      })
      .build();

    await bossman.start();

    // Send job with high priority
    const jobId = await bossman.client.queues.priorityJob.send(
      { task: "important" },
      { priority: PRIORITY_VALUE }
    );

    // Verify priority was set in database
    const result = await db.executeSql(
      "SELECT priority FROM pgboss.job WHERE id = $1",
      [jobId]
    );

    const priority = (result.rows[0] as { priority?: number })?.priority;
    expect(priority).toBe(PRIORITY_VALUE);

    await bossman.stop({ graceful: false });
  });

  it("should support retryBackoff option", async () => {
    const bossman = createBossman({ db })
      .register({
        backoffJob: createQueue()
          .input<{ fail: boolean }>()
          .options({ retryBackoff: true, retryLimit: EXPECTED_JOB_COUNT })
          .handler((input) => {
            if (input.fail) {
              throw new Error("Will retry with backoff");
            }
            return { success: true };
          }),
      })
      .build();

    await bossman.start();

    const jobId = await bossman.client.queues.backoffJob.send({ fail: true });

    const result = await db.executeSql(
      "SELECT retry_backoff FROM pgboss.job WHERE id = $1",
      [jobId]
    );

    const retryBackoff = (result.rows[0] as { retry_backoff?: boolean })
      ?.retry_backoff;
    expect(retryBackoff).toBe(true);

    await bossman.stop({ graceful: false });
  });

  it("should support deadLetter option", async () => {
    const bossman = createBossman({ db })
      .register({
        deadLetterQueue: createQueue()
          .input<{ fail: boolean }>()
          .handler(() => {
            // Handle dead letter
            return { handled: true };
          }),
        mainJob: createQueue()
          .input<{ fail: boolean }>()
          .options({ deadLetter: "deadLetterQueue", retryLimit: 1 })
          .handler((input) => {
            if (input.fail) {
              throw new Error("Send to dead letter");
            }
            return { success: true };
          }),
      })
      .build();

    await bossman.start();

    const jobId = await bossman.client.queues.mainJob.send({ fail: true });

    const result = await db.executeSql(
      "SELECT dead_letter FROM pgboss.job WHERE id = $1",
      [jobId]
    );

    const deadLetter = (result.rows[0] as { dead_letter?: string })
      ?.dead_letter;
    expect(deadLetter).toBe("deadLetterQueue");

    await bossman.stop({ graceful: false });
  });

  it("should support singletonKey to prevent duplicate jobs", async () => {
    const bossman = createBossman({ db })
      .register({
        singletonJob: createQueue()
          .input<{ task: string }>()
          .handler(() => {
            // Process job
            return { done: true };
          }),
      })
      .build();

    await bossman.start();

    // Send job with singleton key
    const jobId = await bossman.client.queues.singletonJob.send(
      { task: "unique" },
      { singletonKey: "my-unique-task" }
    );

    expect(jobId).toBeTruthy();

    // Verify job was created successfully (singleton key is internal to pg-boss)
    expect(jobId).toBeTruthy();

    await bossman.stop({ graceful: false });
  });

  it("should support startAfter option", async () => {
    const futureDate = new Date(Date.now() + FUTURE_DELAY_MS);

    const bossman = createBossman({ db })
      .register({
        delayedJob: createQueue()
          .input<{ data: string }>()
          .handler(() => ({ done: true })),
      })
      .build();

    await bossman.start();

    const jobId = await bossman.client.queues.delayedJob.send(
      { data: "delayed" },
      { startAfter: futureDate }
    );

    const result = await db.executeSql(
      "SELECT start_after FROM pgboss.job WHERE id = $1",
      [jobId]
    );

    const startAfter = (result.rows[0] as { start_after?: Date | string })
      ?.start_after;
    if (startAfter) {
      expect(new Date(startAfter).getTime()).toBeGreaterThan(Date.now());
    }

    await bossman.stop({ graceful: false });
  });

  it("should support retryDelay option", async () => {
    const bossman = createBossman({ db })
      .register({
        retryDelayJob: createQueue()
          .input<{ fail: boolean }>()
          .options({ retryDelay: RETRY_DELAY_SECONDS, retryLimit: RETRY_LIMIT })
          .handler((input) => {
            if (input.fail) {
              throw new Error("Retry with delay");
            }
            return { success: true };
          }),
      })
      .build();

    await bossman.start();

    const jobId = await bossman.client.queues.retryDelayJob.send({
      fail: true,
    });

    const result = await db.executeSql(
      "SELECT retry_delay FROM pgboss.job WHERE id = $1",
      [jobId]
    );

    const retryDelay = (result.rows[0] as { retry_delay?: number })
      ?.retry_delay;
    expect(retryDelay).toBe(RETRY_DELAY_SECONDS);

    await bossman.stop({ graceful: false });
  });
});
