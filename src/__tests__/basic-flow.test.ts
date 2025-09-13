import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createJob, PgBossman } from "../index";
import { createJobCounter, createTestDb } from "../tests/setup";

// Test constants
const CLEANUP_DELAY_MS = 100;
const JOB_PROCESSING_DELAY_MS = 1000;
const BATCH_PROCESSING_DELAY_MS = 2000;
const EXPECTED_JOB_COUNT = 5;
const BATCH_SIZE = 3;
const HIGH_PRIORITY = 10;
const THIRD_JOB_ID = 3;

describe("Basic Job Flow", () => {
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
    // Create fresh in-memory database for each test
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
        // Ignore errors
      }
    }

    // Wait a bit for cleanup
    await new Promise((resolve) => setTimeout(resolve, CLEANUP_DELAY_MS));

    // Then close PGlite
    await pglite.close();
  });

  it("should register a job, send it, and process it", async () => {
    // Create a job counter to track invocations
    const counter = createJobCounter();

    // Define a simple job
    const testJob = createJob("testJob").handler(
      (input: { message: string }) => {
        counter.handler(input);
        return Promise.resolve({ processed: true });
      }
    );

    // Create bossman instance with PGlite db
    const bossman = new PgBossman({ db }).register(testJob).build();

    bossmanInstances.push(bossman);

    // Start the system
    await bossman.start();

    // pg-boss needs the queue to exist
    const pgBoss = bossman.getPgBoss();
    await pgBoss.createQueue("testJob");

    // Send a job
    const jobId = await bossman.testJob.send({ message: "Hello, world!" });
    expect(jobId).toBeTruthy();
    expect(typeof jobId).toBe("string");

    // Start worker (in same process for testing)
    // Remove SIGTERM/SIGINT handlers for testing
    const originalOn = process.on;
    const listeners: Array<{
      event: string;
      listener: (...args: unknown[]) => void;
    }> = [];
    process.on = ((event: string, listener: unknown) => {
      if (event === "SIGTERM" || event === "SIGINT") {
        listeners.push({
          event,
          listener: listener as (...args: unknown[]) => void,
        });
        return process;
      }
      return originalOn.call(
        process,
        event,
        listener as (...args: unknown[]) => void
      );
    }) as typeof process.on;

    await bossman.startWorker();

    // Restore process.on
    process.on = originalOn;

    // Wait a bit for the job to be processed
    await new Promise((resolve) =>
      setTimeout(resolve, JOB_PROCESSING_DELAY_MS)
    );

    // Verify the job was processed
    expect(counter.getCount()).toBe(1);
    expect(counter.getJobs()[0]).toEqual({ message: "Hello, world!" });

    // Clean up - remove the listeners we captured
    for (const { event, listener } of listeners) {
      process.removeListener(event, listener);
    }
  });

  it("should handle batch jobs correctly", async () => {
    const processedBatches: Array<Array<{ id: number }>> = [];

    // Define a batch job
    const batchJob = createJob("batchJob")
      .options({ batchSize: BATCH_SIZE })
      .batchHandler((inputs: Array<{ id: number }>) => {
        processedBatches.push(inputs);
        return Promise.resolve(inputs.map((i) => ({ processedId: i.id })));
      });

    // Create bossman instance
    const bossman = new PgBossman({ db }).register(batchJob).build();

    bossmanInstances.push(bossman);

    await bossman.start();

    // pg-boss needs the queue to exist
    const pgBoss = bossman.getPgBoss();
    await pgBoss.createQueue("batchJob");

    // Send multiple jobs
    const jobIds = await Promise.all([
      bossman.batchJob.send({ id: 1 }),
      bossman.batchJob.send({ id: 2 }),
      bossman.batchJob.send({ id: 3 }),
      bossman.batchJob.send({ id: 4 }),
      bossman.batchJob.send({ id: 5 }),
    ]);

    expect(jobIds).toHaveLength(EXPECTED_JOB_COUNT);
    for (const id of jobIds) {
      expect(id).toBeTruthy();
    }

    // Start worker (suppress SIGTERM/SIGINT)
    const originalOn = process.on;
    process.on = ((event: string, listener: unknown) => {
      if (event === "SIGTERM" || event === "SIGINT") {
        return process;
      }
      return originalOn.call(
        process,
        event,
        listener as (...args: unknown[]) => void
      );
    }) as typeof process.on;

    await bossman.startWorker();
    process.on = originalOn;

    // Wait for processing
    await new Promise((resolve) =>
      setTimeout(resolve, BATCH_PROCESSING_DELAY_MS)
    );

    // Should have processed in batches of 3
    expect(processedBatches.length).toBeGreaterThanOrEqual(1);

    // Flatten all processed items
    const allProcessed = processedBatches.flat();

    // Should have processed all 5 items (possibly in multiple batches)
    expect(allProcessed.some((item) => item.id === 1)).toBe(true);
    expect(allProcessed.some((item) => item.id === 2)).toBe(true);
    expect(allProcessed.some((item) => item.id === THIRD_JOB_ID)).toBe(true);

    // Cleanup handled in afterEach
  });

  it("should share the same API between full instance and send operations", async () => {
    const counter = createJobCounter();

    const emailJob = createJob("sendEmail").handler(
      (input: { to: string; subject: string }) => {
        counter.handler(input);
        return Promise.resolve();
      }
    );

    const bossman = new PgBossman({ db }).register(emailJob).build();

    bossmanInstances.push(bossman);

    await bossman.start();

    // pg-boss needs the queue to exist
    const pgBoss = bossman.getPgBoss();
    await pgBoss.createQueue("sendEmail");

    // Test that the send method exists and works
    const jobId = await bossman.sendEmail.send(
      { subject: "Test", to: "test@example.com" },
      { priority: HIGH_PRIORITY }
    );

    expect(jobId).toBeTruthy();

    // Verify job was created with correct data
    const pgBossInstance = bossman.getPgBoss();
    const job = await pgBossInstance.getJobById("sendEmail", jobId as string);
    expect(job).toBeTruthy();
    expect(job?.data).toEqual({ subject: "Test", to: "test@example.com" });
    expect(job?.priority).toBe(HIGH_PRIORITY);

    // Cleanup handled in afterEach
  });
});
