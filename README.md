# pg-bossman

A type-safe wrapper for [pg-boss](https://github.com/timgit/pg-boss) that provides TypeScript-first job queue management with a fluent API.

## Features

- 🔷 **Full TypeScript support** - Compile-time type checking for job names and payloads
- 🏗️ **Builder pattern** - Fluent API inspired by tRPC/ORPC for defining jobs  
- 🔄 **Shared client architecture** - Same code powers both full instance and lightweight clients
- 📦 **Batch processing** - First-class support for batch handlers without array destructuring
- 🚀 **Zero boilerplate** - Automatic worker lifecycle management
- 🔌 **1:1 pg-boss API** - All pg-boss methods preserved, just without the `name` parameter

## Installation

```bash
npm install pg-bossman pg-boss
```

## Quick Start

### 1. Define Your Jobs

```typescript
import { createJob } from 'pg-bossman';

// Single job handler
export const sendEmailJob = createJob('sendEmail')
  .options({
    retryLimit: 3,
    retryDelay: 60,
  })
  .handler(async (input: { to: string; subject: string; body: string }) => {
    await emailService.send(input);
  });

// Batch job handler  
export const processImagesJob = createJob('processImages')
  .options({
    batchSize: 10,
  })
  .batchHandler(async (inputs: Array<{ url: string }>) => {
    return imageProcessor.batchProcess(inputs);
  });
```

### 2. Register Jobs

```typescript
import { PgBossman } from 'pg-bossman';

export const bossman = new PgBossman('postgres://localhost/mydb')
  .register(sendEmailJob)
  .register(processImagesJob)
  .build();
```

### 3. Start Worker

```typescript
// worker.ts
import { bossman } from './jobs';

await bossman.startWorker();
console.log('Worker started');
```

### 4. Send Jobs

```typescript
// api.ts - Option A: Use full instance
import { bossman } from './jobs';

await bossman.sendEmail.send({
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Thanks for signing up!'
});

// api.ts - Option B: Lightweight client (no handlers bundled)
import type { bossman } from './jobs';
import { createClient } from 'pg-bossman';

const client = createClient<typeof bossman>('postgres://localhost/mydb');
await client.sendEmail.send({ to: '...', subject: '...', body: '...' });
```

## API

### Job Definition

Jobs are defined using a builder pattern with `.handler()` or `.batchHandler()` as the terminal method:

```typescript
createJob('jobName')
  .options({ /* pg-boss options */ })
  .handler(async (input) => { /* process single */ })

createJob('jobName')  
  .options({ /* pg-boss options */ })
  .batchHandler(async (inputs) => { /* process batch */ })
```

### Job Client Methods

Each job gets a client with these methods (mirroring pg-boss but without the name parameter):

```typescript
// Currently implemented
await bossman.jobName.send(data, options);

// Coming soon (following pg-boss API exactly)
await bossman.jobName.sendAfter(data, options, delay);
await bossman.jobName.sendThrottled(data, options, seconds, key);
await bossman.jobName.sendDebounced(data, options, seconds, key);
await bossman.jobName.insert(jobs);
await bossman.jobName.fetch(options);
await bossman.jobName.cancel(id);
await bossman.jobName.resume(id);
await bossman.jobName.retry(id);
await bossman.jobName.complete(id, result);
await bossman.jobName.fail(id, error);
await bossman.jobName.deleteJob(id);
await bossman.jobName.getJobById(id);
await bossman.jobName.schedule(cron, data, options);
```

## Architecture

pg-bossman uses a shared `JobClient` class for all job operations. Both `bossman.build()` and `createClient()` return the same interface, ensuring consistent behavior whether you're using the full instance or a lightweight client.

```
JobClient (shared implementation)
    ↓
TypedPgBossman (adds type-safe job properties)
    ↓
┌─────────┬──────────┐
│ bossman │  client  │
│ .build()│ factory  │
└─────────┴──────────┘
```

## License

MIT