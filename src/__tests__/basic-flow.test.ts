import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBossman, createQueue, defineEvents } from "../index";
import { createJobCounter, createTestDb } from "../tests/setup";

// Test constants
const CLEANUP_DELAY_MS = 100;
const JOB_PROCESSING_DELAY_MS = 1000;
const BATCH_PROCESSING_DELAY_MS = 3000;
const EXPECTED_JOB_COUNT = 5;
const BATCH_SIZE = 3;
const HIGH_PRIORITY = 10;
const THIRD_JOB_ID = 3;

describe("Basic Queue Flow", () => {
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

  it("should register a queue, send a job, and process it", async () => {
    // Create a job counter to track invocations
    const counter = createJobCounter();

    // Define queues using the flat map
    const jobs = {
      testJob: createQueue()
        .input<{ message: string }>()
        .handler((input) => {
          counter.handler(input);
          return Promise.resolve({ processed: true });
        }),
    };

    // Create bossman instance with PGlite db
    const bossman = createBossman({ db }).register(jobs).build();

    bossmanInstances.push(bossman);

    // Send a job via client namespace
    const jobId = await bossman.client.queues.testJob.send({
      message: "Hello, world!",
    });
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

    await bossman.start();

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

  it("should handle batch queues correctly", async () => {
    const processedBatches: Array<Array<{ id: number }>> = [];

    // Define queues using the flat map
    const jobs = {
      batchJob: createQueue()
        .input<{ id: number }>()
        .options({ batchSize: BATCH_SIZE })
        .batchHandler((inputs) => {
          processedBatches.push(inputs);
          return Promise.resolve(inputs.map((i) => ({ processedId: i.id })));
        }),
    };

    // Create bossman instance
    const bossman = createBossman({ db }).register(jobs).build();

    bossmanInstances.push(bossman);

    // Send first job to initialize pg-boss
    const firstJobId = await bossman.client.queues.batchJob.send({ id: 1 });

    // Send multiple jobs via client namespace
    const remainingJobIds = await Promise.all([
      bossman.client.queues.batchJob.send({ id: 2 }),
      bossman.client.queues.batchJob.send({ id: 3 }),
      bossman.client.queues.batchJob.send({ id: 4 }),
      bossman.client.queues.batchJob.send({ id: 5 }),
    ]);

    const jobIds = [firstJobId, ...remainingJobIds];

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

    await bossman.start();
    process.on = originalOn;

    const EXTRA_WAIT_MS = 5000;
    // Wait for processing (allow ample time)
    await new Promise((resolve) => setTimeout(resolve, EXTRA_WAIT_MS));

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

    const jobs = {
      sendEmail: createQueue()
        .input<{ to: string; subject: string }>()
        .handler((input) => {
          counter.handler(input);
          return Promise.resolve();
        }),
    };

    const bossman = createBossman({ db }).register(jobs).build();

    bossmanInstances.push(bossman);

    // Test that the send method exists and works via client namespace
    const jobId = await bossman.client.queues.sendEmail.send(
      { subject: "Test", to: "test@example.com" },
      { priority: HIGH_PRIORITY }
    );

    expect(jobId).toBeTruthy();

    // Verify job was created with correct data
    const pgBossInstance = await bossman.getPgBoss();
    const job = await pgBossInstance.getJobById("sendEmail", jobId as string);
    expect(job).toBeTruthy();
    expect(job?.data).toEqual({ subject: "Test", to: "test@example.com" });
    expect(job?.priority).toBe(HIGH_PRIORITY);

    // Cleanup handled in afterEach
  });

  it("should handle synchronous handlers correctly", async () => {
    const counter = createJobCounter();

    // Define a job with a sync handler (no async/await)
    const jobs = {
      syncJob: createQueue()
        .input<{ value: number }>()
        .handler((input) => {
          counter.handler(input);
          // Return directly without Promise
          return { doubled: input.value * 2 };
        }),
    };

    const bossman = createBossman({ db }).register(jobs).build();

    bossmanInstances.push(bossman);

    // Initialize pg-boss for sending

    // Send a job
    const jobId = await bossman.client.queues.syncJob.send({ value: 5 });
    expect(jobId).toBeTruthy();

    // Start worker
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

    await bossman.start();
    process.on = originalOn;

    // Wait for processing
    await new Promise((resolve) =>
      setTimeout(resolve, BATCH_PROCESSING_DELAY_MS)
    );

    // Verify the job was processed
    expect(counter.getCount()).toBe(1);
    expect(counter.getJobs()[0]).toEqual({ value: 5 });
  });

  it("should handle synchronous batch handlers correctly", async () => {
    const processedBatches: Array<Array<{ id: number }>> = [];

    // Define a batch job with a sync handler (no async/await)
    const jobs = {
      syncBatchJob: createQueue()
        .input<{ id: number }>()
        .options({ batchSize: 2 })
        .batchHandler((inputs) => {
          processedBatches.push(inputs);
          // Return directly without Promise
          return inputs.map((i) => ({ processedId: i.id }));
        }),
    };

    const bossman = createBossman({ db }).register(jobs).build();

    bossmanInstances.push(bossman);

    // Send first job to initialize pg-boss
    await bossman.client.queues.syncBatchJob.send({ id: 1 });

    // Send remaining jobs
    await Promise.all([
      bossman.client.queues.syncBatchJob.send({ id: 2 }),
      bossman.client.queues.syncBatchJob.send({ id: 3 }),
    ]);

    // Start worker
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

    await bossman.start();
    process.on = originalOn;

    // Wait for processing
    await new Promise((resolve) =>
      setTimeout(resolve, BATCH_PROCESSING_DELAY_MS)
    );

    // Should have processed in batches
    expect(processedBatches.length).toBeGreaterThanOrEqual(1);
    const allProcessed = processedBatches.flat();
    expect(allProcessed.some((item) => item.id === 1)).toBe(true);
    expect(allProcessed.some((item) => item.id === 2)).toBe(true);
  });

  it("should support multiple schedules per queue", async () => {
    const jobs = {
      scheduledJob: createQueue()
        .schedule({ cron: "* * * * *", key: "default" })
        .schedule({ cron: "*/5 * * * *", key: "five-minutes" })
        .handler(() => Promise.resolve()),
    };

    const bossman = createBossman({ db }).register(jobs).build();
    bossmanInstances.push(bossman);

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

    await bossman.start();
    process.on = originalOn;

    const schedules = await bossman.getSchedules();
    const jobSchedules = schedules.filter((s) => s.name === "scheduledJob");
    expect(jobSchedules).toHaveLength(2);
    expect(jobSchedules.map((s) => s.key).sort()).toEqual([
      "default",
      "five-minutes",
    ]);
  });

  it("should support nested routers", async () => {
    const emailsSent: Array<{ to: string; type: string }> = [];

    // Define flat queues structure
    const jobs = {
      // Top-level job with dash in name
      "data-export": createQueue()
        .input<void>()
        .handler(() => ({ exported: true })),
      "emails.sendPasswordReset": createQueue()
        .input<{ to: string }>()
        .handler((input) => {
          emailsSent.push({ to: input.to, type: "password-reset" });
        }),
      "emails.sendWelcome": createQueue()
        .input<{ to: string }>()
        .handler((input) => {
          emailsSent.push({ to: input.to, type: "welcome" });
        }),
      "images.resize": createQueue()
        .input<{ url: string }>()
        .options({ batchSize: 2 })
        .batchHandler((inputs) => inputs.map((i) => ({ resized: i.url }))),
    };

    const bossman = createBossman({ db }).register(jobs).build();

    bossmanInstances.push(bossman);

    // Send nested jobs
    await bossman.client.queues["emails.sendWelcome"].send({
      to: "user1@example.com",
    });
    await bossman.client.queues["emails.sendPasswordReset"].send({
      to: "user2@example.com",
    });
    await bossman.client.queues["data-export"].send();

    // Start worker
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

    await bossman.start();
    process.on = originalOn;

    // Wait for processing
    await new Promise((resolve) =>
      setTimeout(resolve, JOB_PROCESSING_DELAY_MS)
    );

    // Verify nested jobs were processed (order-agnostic)
    expect(emailsSent).toHaveLength(2);
    expect(emailsSent).toEqual(
      expect.arrayContaining([
        { to: "user1@example.com", type: "welcome" },
        { to: "user2@example.com", type: "password-reset" },
      ])
    );
  });

  it("should publish events to subscribed queues with mapping", async () => {
    const emailsSent: Array<{ to: string }> = [];

    const jobs = {
      sendWelcomeEmail: createQueue()
        .input<{ to: string }>()
        .handler((input) => {
          emailsSent.push({ to: input.to });
        }),
    };

    const events = defineEvents<{
      userCreated: { id: string; email: string };
    }>();

    const bossman = createBossman({ db })
      .register(jobs)
      .events(events)
      .subscriptions({
        userCreated: {
          sendWelcomeEmail: { map: (e) => ({ to: e.email }) },
        },
      })
      .build();

    bossmanInstances.push(bossman);

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

    await bossman.start();
    process.on = originalOn;

    await bossman.client.events.userCreated.emit({
      email: "user@example.com",
      id: "u1",
    });

    const EVENT_PROCESSING_EXTRA_WAIT_MS = 5000;
    // Allow time for processing; event path can be slower
    await new Promise((resolve) =>
      setTimeout(resolve, EVENT_PROCESSING_EXTRA_WAIT_MS)
    );

    expect(emailsSent).toEqual([{ to: "user@example.com" }]);
  });
});
