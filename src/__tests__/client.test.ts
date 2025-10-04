import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBossman, createClient, createQueue } from "../index";
import { createJobCounter, createTestDb } from "../tests/setup";

// Test timeouts
const CLEANUP_WAIT_MS = 100;
const JOB_PROCESSING_WAIT_MS = 5000;

// Test constants
const EXPECTED_JOB_COUNT = 3;
const HIGH_PRIORITY = 100;
const EXPECTED_WORKER_AND_STANDALONE_COUNT = 2;

describe("Client", () => {
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

  it("should send jobs via standalone client", async () => {
    const counter = createJobCounter();

    // Set up worker
    const bossman = createBossman({ db })
      .register({
        testJob: createQueue()
          .input<{ message: string }>()
          .handler((input) => {
            counter.handler(input);
            return { processed: true };
          }),
      })
      .build();

    bossmanInstances.push(bossman);
    await bossman.start();

    // Create standalone client
    const client = createClient<typeof bossman>({ db });

    // Send job via client
    const jobId = await client.queues.testJob.send({
      message: "Hello from client",
    });
    expect(jobId).toBeTruthy();

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, JOB_PROCESSING_WAIT_MS));

    // Verify handler was called
    expect(counter.getCount()).toBe(1);
    expect(counter.getJobs()[0]).toEqual({ message: "Hello from client" });
  });

  it("should send array of jobs via standalone client", async () => {
    const bossman = createBossman({ db })
      .register({
        testJob: createQueue()
          .input<{ id: number }>()
          .handler(() => ({ done: true })),
      })
      .build();

    bossmanInstances.push(bossman);
    await bossman.start();

    const client = createClient<typeof bossman>({ db });

    const jobIds = await client.queues.testJob.send([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);

    expect(Array.isArray(jobIds)).toBe(true);
    expect((jobIds as string[]).length).toBe(EXPECTED_JOB_COUNT);
  });

  it("should send jobs with options via standalone client", async () => {
    const bossman = createBossman({ db })
      .register({
        testJob: createQueue()
          .input<{ task: string }>()
          .handler(() => ({ done: true })),
      })
      .build();

    bossmanInstances.push(bossman);
    await bossman.start();

    const client = createClient<typeof bossman>({ db });

    const jobId = await client.queues.testJob.send(
      { task: "high priority" },
      { priority: HIGH_PRIORITY }
    );

    expect(jobId).toBeTruthy();

    // Verify priority was set
    const result = await db.executeSql(
      "SELECT priority FROM pgboss.job WHERE id = $1",
      [jobId]
    );

    const priority = (result.rows[0] as { priority?: number })?.priority;
    expect(priority).toBe(HIGH_PRIORITY);
  });

  it("should allow accessing pg-boss instance from client", async () => {
    const client = createClient<typeof testBossman>({ db });

    const pgBoss = await client.getPgBoss();
    expect(pgBoss).toBeDefined();
    expect(typeof pgBoss.start).toBe("function");
    expect(typeof pgBoss.send).toBe("function");
  });

  it("should work with both worker client and standalone client", async () => {
    const counter = createJobCounter();

    const bossman = createBossman({ db })
      .register({
        testJob: createQueue()
          .input<{ from: string }>()
          .handler((input) => {
            counter.handler(input);
            return { processed: true };
          }),
      })
      .build();

    bossmanInstances.push(bossman);
    await bossman.start();

    const standaloneClient = createClient<typeof bossman>({ db });

    // Send via worker's client
    const jobId1 = await bossman.client.queues.testJob.send({ from: "worker" });
    expect(jobId1).toBeTruthy();

    // Send via standalone client
    const jobId2 = await standaloneClient.queues.testJob.send({
      from: "standalone",
    });
    expect(jobId2).toBeTruthy();

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, JOB_PROCESSING_WAIT_MS));

    // Both should have been processed
    expect(counter.getCount()).toBe(EXPECTED_WORKER_AND_STANDALONE_COUNT);
    expect(counter.getJobs()).toContainEqual({ from: "worker" });
    expect(counter.getJobs()).toContainEqual({ from: "standalone" });
  });

  it("should send parameterless jobs via client", async () => {
    const counter = createJobCounter();

    const bossman = createBossman({ db })
      .register({
        noParamsJob: createQueue().handler(() => {
          counter.handler({});
          return { executed: true };
        }),
      })
      .build();

    bossmanInstances.push(bossman);
    await bossman.start();

    const client = createClient<typeof bossman>({ db });

    // Send without params
    const jobId = await client.queues.noParamsJob.send();
    expect(jobId).toBeTruthy();

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, JOB_PROCESSING_WAIT_MS));

    expect(counter.getCount()).toBe(1);
  });
});

// Helper type for client test
const testBossman = createBossman({ connectionString: "test" })
  .register({
    testQueue: createQueue().handler(() => {
      // Test handler
      return {};
    }),
  })
  .build();
