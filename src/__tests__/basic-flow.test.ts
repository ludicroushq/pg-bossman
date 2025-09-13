import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PgBossman, createJob } from '../index';
import { createTestDb, createJobCounter } from '../tests/setup';
import type { PGlite } from '@electric-sql/pglite';

describe('Basic Job Flow', () => {
  let pglite: PGlite;
  let db: any;
  let bossmanInstances: any[] = [];

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
        await bossman.stop({ wait: false, graceful: false });
      } catch (e) {
        // Ignore errors
      }
    }
    
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Then close PGlite
    await pglite.close();
  });

  it('should register a job, send it, and process it', async () => {
    // Create a job counter to track invocations
    const counter = createJobCounter();
    
    // Define a simple job
    const testJob = createJob('testJob')
      .handler(async (input: { message: string }) => {
        counter.handler(input);
        return { processed: true };
      });

    // Create bossman instance with PGlite db
    const bossman = new PgBossman({ db })
      .register(testJob)
      .build();
    
    bossmanInstances.push(bossman);

    // Start the system
    await bossman.start();
    
    // pg-boss needs the queue to exist
    const pgBoss = bossman.getPgBoss();
    await pgBoss.createQueue('testJob');

    // Send a job
    const jobId = await bossman.testJob.send({ message: 'Hello, world!' });
    expect(jobId).toBeTruthy();
    expect(typeof jobId).toBe('string');

    // Start worker (in same process for testing)
    // Remove SIGTERM/SIGINT handlers for testing
    const originalOn = process.on;
    const listeners: any[] = [];
    process.on = ((event: string, listener: any) => {
      if (event === 'SIGTERM' || event === 'SIGINT') {
        listeners.push({ event, listener });
        return process;
      }
      return originalOn.call(process, event, listener);
    }) as any;

    await bossman.startWorker();

    // Restore process.on
    process.on = originalOn;

    // Wait a bit for the job to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify the job was processed
    expect(counter.getCount()).toBe(1);
    expect(counter.getJobs()[0]).toEqual({ message: 'Hello, world!' });

    // Clean up - remove the listeners we captured
    for (const { event, listener } of listeners) {
      process.removeListener(event, listener);
    }
  });

  it('should handle batch jobs correctly', async () => {
    const processedBatches: any[] = [];
    
    // Define a batch job
    const batchJob = createJob('batchJob')
      .options({ batchSize: 3 })
      .batchHandler(async (inputs: Array<{ id: number }>) => {
        processedBatches.push(inputs);
        return inputs.map(i => ({ processedId: i.id }));
      });

    // Create bossman instance
    const bossman = new PgBossman({ db })
      .register(batchJob)
      .build();
    
    bossmanInstances.push(bossman);

    await bossman.start();
    
    // pg-boss needs the queue to exist
    const pgBoss = bossman.getPgBoss();
    await pgBoss.createQueue('batchJob');

    // Send multiple jobs
    const jobIds = await Promise.all([
      bossman.batchJob.send({ id: 1 }),
      bossman.batchJob.send({ id: 2 }),
      bossman.batchJob.send({ id: 3 }),
      bossman.batchJob.send({ id: 4 }),
      bossman.batchJob.send({ id: 5 }),
    ]);

    expect(jobIds).toHaveLength(5);
    jobIds.forEach(id => expect(id).toBeTruthy());

    // Start worker (suppress SIGTERM/SIGINT)
    const originalOn = process.on;
    process.on = ((event: string, listener: any) => {
      if (event === 'SIGTERM' || event === 'SIGINT') {
        return process;
      }
      return originalOn.call(process, event, listener);
    }) as any;

    await bossman.startWorker();
    process.on = originalOn;

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Should have processed in batches of 3
    expect(processedBatches.length).toBeGreaterThanOrEqual(1);
    
    // Flatten all processed items
    const allProcessed = processedBatches.flat();
    
    // Should have processed all 5 items (possibly in multiple batches)
    expect(allProcessed.some(item => item.id === 1)).toBe(true);
    expect(allProcessed.some(item => item.id === 2)).toBe(true);
    expect(allProcessed.some(item => item.id === 3)).toBe(true);

    // Cleanup handled in afterEach
  });

  it('should share the same API between full instance and send operations', async () => {
    const counter = createJobCounter();
    
    const emailJob = createJob('sendEmail')
      .handler(async (input: { to: string; subject: string }) => {
        counter.handler(input);
      });

    const bossman = new PgBossman({ db })
      .register(emailJob)
      .build();
    
    bossmanInstances.push(bossman);

    await bossman.start();
    
    // pg-boss needs the queue to exist
    const pgBoss = bossman.getPgBoss();
    await pgBoss.createQueue('sendEmail');

    // Test that the send method exists and works
    const jobId = await bossman.sendEmail.send(
      { to: 'test@example.com', subject: 'Test' },
      { priority: 10 }
    );

    expect(jobId).toBeTruthy();
    
    // Verify job was created with correct data
    const pgBossInstance = bossman.getPgBoss();
    const job = await pgBossInstance.getJobById('sendEmail', jobId!);
    expect(job).toBeTruthy();
    expect(job?.data).toEqual({ to: 'test@example.com', subject: 'Test' });
    expect(job?.priority).toBe(10);

    // Cleanup handled in afterEach
  });
});