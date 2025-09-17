# Agent Knowledge Base for pg-bossman

> **IMPORTANT FOR AI AGENTS**: Always update this file when making significant changes to the codebase. This serves as a knowledge transfer document for future AI assistants working on this project.

## Overview

pg-bossman is a TypeScript wrapper around pg-boss that provides a type-safe, tRPC-like API for PostgreSQL-based job queues. It offers both worker (job processing) and client (job sending) capabilities with full TypeScript type inference.

## Core Concepts

### 1. Job Definitions
Jobs are created using the `createJob()` builder pattern:
```typescript
const myJob = createJob()
  .options({ retryLimit: 3 })
  .handler((input: { name: string }) => {
    // Job logic here
    return { success: true };
  });
```

Jobs can be:
- **Single jobs**: Process one item at a time using `.handler()`
- **Batch jobs**: Process multiple items at once using `.batchHandler()` with `batchSize` option

### 2. Worker (createBossman)
The worker processes jobs and can also send jobs:
```typescript
const bossman = createBossman({ connectionString })
  .register({
    'myJob': createJob().handler(...),
    'emails.sendWelcome': createJob().handler(...),
  })
  .build();

// Start processing jobs
await bossman.start();

// Can also send jobs via client
await bossman.client.myJob.send({ name: "test" });
```

### 3. Client (createClient)
Lightweight send-only client that can't process jobs. Uses a minimal proxy for typed access with `typeof bossman`.
```typescript
import type { bossman } from './bossman';
const client = createClient<typeof bossman>({ connectionString });
await client['myJob'].send({ name: 'test' });
```

## Architecture

### File Structure
```
src/
├── index.ts                 # Main exports
├── create-bossman.ts        # Worker implementation (BossmanWorker class)
├── create-client.ts         # Client-only implementation (flat jobs map)
├── jobs/
│   ├── builder.ts           # Job builder (createJob)
│   └── client.ts            # JobClient class (send/schedule/unschedule)
├── core/
│   └── create-pg-boss.ts    # Shared pg-boss instance creation
├── dashboard/
│   └── index.ts            # Pure Hono SSR dashboard (queues list)
└── types/
    ├── index.ts             # Core type definitions
    └── (router.ts removed)  # Flat jobs map replaces nested routers
```

### Key Design Patterns

1. [Client] Minimal proxy retained: createClient uses a tiny Proxy for typed access while worker uses a concrete map.

2. **Builder Pattern**: Jobs are created using a fluent builder API that allows chaining options before defining the handler.

3. **Type Inference**: Heavy use of TypeScript conditional types and inference to provide a tRPC-like developer experience where types flow through without explicit annotations.

4. **Lazy Initialization**: Clients use lazy initialization - pg-boss only starts when the first job is sent.

## Important Implementation Details

### Type System

1. **Parameterless Jobs**: Jobs without parameters infer input as `unknown`. `send()` and `schedule()` accept optional data; if omitted, `{}` is sent.

2. **Flat Jobs Map**: A single-level object `JobsMap = Record<string, JobWithoutName>` keyed by queue names (e.g., `"emails.sendWelcome"`). Worker builds a concrete client map. Client uses a minimal proxy.

3. **ClientStructure**: Simple mapped type from `JobsMap` keys to `JobClient` with inferred input.

### Error Handling

- All pg-boss instances have error handlers attached by default to prevent losing error information
- Errors are logged to console with context (`[pg-bossman worker]` or `[pg-bossman client]`)

### Worker Lifecycle

1. **Registration**: Jobs are registered with pg-boss using `.work()` 
2. **Queue Creation**: Queues are created for each job (required in pg-boss v10+)
3. **Graceful Shutdown**: SIGTERM/SIGINT handlers are automatically set up for graceful shutdown
4. **Batch Processing**: Batch handlers always receive arrays, even for single items

### Client Features

- **send()**: Accepts single item or array; data optional for parameterless jobs
- **schedule()**: Schedule jobs with cron expressions; schedules are tied to the job/queue name (pg-boss v10+)
- **unschedule()**: Remove scheduled jobs for the queue

## Testing

Tests use:
- **PGlite**: In-memory PostgreSQL for testing
- **vitest**: Test runner
- Test utilities in `src/tests/setup.ts` for creating test databases and job counters

## Code Style & Linting

- **Biome**: Used for linting and formatting (via ultracite)
- **TypeScript**: Strict mode with no implicit any
- **Magic numbers**: Should be extracted as named constants
- **Loops**: Prefer `for...of` over `forEach`

## Recent Changes & Decisions

1. **Flat jobs map**: Replaced nested routers with a single-level jobs object keyed by queue names.
2. **Removed proxy**: Client is a concrete map; lazy init handled inside JobClient.
3. **Simplified types**: `JobsMap`, `JobWithoutName`, `InferInputFromJob` introduced; router flattening removed.
4. **Scheduling semantics**: Schedule/unschedule target queue name directly (pg-boss v10).
5. **Dashboard rewrite**: Removed React/Vite SPA. New dashboard is a pure Hono SSR handler mounted under a configurable basePath. No RPC/ORPC.
6. **Client API**: `createClient` now exposes `getPgBoss(): Promise<PgBoss>` for read-only dashboard endpoints.

## Dashboard

- Pure Hono SSR app. Styling via Tailwind CDN + daisyUI plugin; no build step.
- `createDashboard(client, { basePath? })` → `(req: Request) => Promise<Response>`.
- Base path is normalized (no trailing slash) and injected into context for links/htmx.
- Routes:
  - `GET {basePath}/` → Full HTML page (navbar + Queues section)
  - `GET {basePath}/api/queues/queues-list-card` → HTML partial (Queues card) for htmx auto-refresh
- htmx drives auto-refresh every 1s by fetching the partial; no JSON/RPC endpoints.
- No auth, no bundler, no React/JSX.

## Common Patterns

### Creating a Job with No Parameters
```typescript
const myJob = createJob().handler(() => {
  // No input needed
  return { success: true };
});

// Sending without data
await client.myJob.send();
// or
await client.myJob.send({});
```

### Batch Processing
```typescript
const batchJob = createJob()
  .options({ batchSize: 10 })
  .batchHandler((items: Array<{ id: number }>) => {
    // Process batch
    return items.map(item => ({ processed: item.id }));
  });
```

### Nested Job Structure
```typescript
const jobs = {
  emails: {
    welcome: createJob().handler(...),
    passwordReset: createJob().handler(...)
  },
  "data-export": createJob().handler(...) // Dashes supported
};
```

## Known Issues & Limitations

1. **Type inference for parameterless jobs**: Shows as `unknown` (acceptable tradeoff for simplicity)
2. **Cron string validation**: Currently accepts any string (not validated as valid cron)
3. **Client-only scheduling**: `createClient` cannot create queues; scheduling requires queues to already exist (e.g., a worker has initialized/created them)

## Future Considerations

- Could add runtime cron validation
- Could improve type inference for parameterless handlers
- Could add middleware/plugin system
- Could add job result typing (currently always `unknown`)

## Dependencies

- **pg-boss**: Core job queue library (v10+)
- **@electric-sql/pglite**: Used for testing only
- **vitest**: Test runner
- **biome**: Linting and formatting

---
*Last updated: Parameterless API simplification and schedule queue-name fix*
