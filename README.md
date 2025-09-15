# pg-bossman

Type-safe wrapper for pg-boss with a flat jobs map, typed events, job-level scheduling, and a minimal client API that works in both the worker and send-only clients.

## Features

- 🔷 Type-safe job names and payloads (flat map of queues)
- 🏗️ Fluent builder for jobs; schedules defined on the job
- 📨 Typed events with builder-time subscriptions and optional mapping
- 🧩 Worker: `bossman.client()` returns jobs and events emitters
- 🪶 Client: `createClient<typeof bossman>()` returns typed jobs and events without bundling handlers

## Installation

```bash
npm install pg-bossman pg-boss
```

## Quick Start

### 1) Define jobs (flat map) and schedules

```ts
import { createJob } from 'pg-bossman';

export const jobs = {
  // Single job
  sendWelcomeEmail: createJob().handler((input: { to: string }) => {
    // ... send email
  }),

  // Scheduled job (one per queue in pg-boss v10)
  dailyReport: createJob()
    .schedule('0 3 * * *', { when: 'utc' }, { tz: 'America/Chicago' })
    .handler((input: { when: string }) => {
      // ... run report
    }),

  // Batch job
  'images.resize': createJob()
    .options({ batchSize: 10 })
    .batchHandler((inputs: Array<{ url: string }>) => {
      return inputs.map((i) => ({ resized: i.url }));
    }),
};
```

### 2) Define events and subscriptions

```ts
import { defineEvents, createBossman } from 'pg-bossman';

const events = defineEvents<{
  userCreated: { id: string; email: string };
  reportTick: { when: string };
}>();

export const bossman = createBossman({ connectionString: process.env.DATABASE_URL! })
  .register(jobs)
  .events(events)
  .subscriptions({
    // Requires a transform since payload ≠ job input
    userCreated: {
      sendWelcomeEmail: { map: (e) => ({ to: e.email }) },
    },
    // Direct subscription allowed since payload is assignable to job input
    reportTick: {
      dailyReport: true,
    },
  })
  .build();
```

### 3) Start the worker

```ts
await bossman.start();
```

### 4) Send jobs and emit events (worker-side)

```ts
// Jobs
await bossman.client().jobs.sendWelcomeEmail.send({ to: 'user@example.com' });

// Events
await bossman.client().events.userCreated.emit({ id: 'u1', email: 'user@example.com' });
```

### 5) Send-only client (no handlers bundled)

```ts
import { createClient } from 'pg-bossman';
import type { bossman } from './bossman';

const client = createClient<typeof bossman>({ connectionString: process.env.DATABASE_URL! });

// Jobs
await client.jobs.sendWelcomeEmail.send({ to: 'user@example.com' });

// Events
await client.events.userCreated.emit({ id: 'u1', email: 'user@example.com' });
```

## API Overview

### Jobs

```ts
createJob()
  .options({ /* optional pg-boss send options */ })
  .schedule(cron: string, data?: TInput, options?: { tz?: string })
  .handler((input: TInput) => TOutput | Promise<TOutput>)

createJob()
  .options({ batchSize: number })
  .batchHandler((inputs: TInput[]) => TOutput[] | Promise<TOutput[]>)
```

Notes:
- Input type is inferred from the handler parameter. No manual type args needed.
- Schedules are reconciled on start: upsert declared schedules and remove undeclared ones.

### Events and Subscriptions

```ts
const events = defineEvents<{
  userCreated: { id: string; email: string };
  reportTick: { when: string };
}>();

createBossman(...)
  .register(jobs)
  .events(events)
  .subscriptions({
    userCreated: {
      // Allowed when EventPayload extends JobInput for the queue
      sendWelcomeEmail: { map: (e) => ({ to: e.email }) },
    },
    reportTick: {
      dailyReport: true,
    },
  })
  .build();

// Emitting (worker or client)
await bossman.client().events.userCreated.emit({ id: 'u1', email: 'user@example.com' });
```

Notes:
- Bossman creates internal event queues and registers handlers to fan-out events to subscribed job queues.
- true is only allowed when the event payload is assignable to the job input; otherwise provide a map.

### Worker Client vs. Send-only Client

- Worker: `bossman.client()` returns `{ jobs, events }` (concrete map).
- Send-only: `createClient<typeof bossman>(options)` returns `{ jobs, events }` via a minimal proxy.

Both have the same shape:

```ts
client.jobs[queueName].send(data, options?)
client.jobs[queueName].schedule(cron, data?, options?)
client.jobs[queueName].unschedule()
client.events[eventName].emit(payload, options?)
```

## License

MIT
