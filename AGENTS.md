# Agent Knowledge Base for pg-bossman

> **IMPORTANT FOR AI AGENTS**: Always update this file when making significant changes to the codebase. This serves as a knowledge transfer document for future AI assistants working on this project.

## Overview

pg-bossman is a TypeScript wrapper around pg-boss that provides a type-safe, tRPC-like API for PostgreSQL-based job queues. It offers both worker (job processing) and client (job sending) capabilities with full TypeScript type inference.

## Compatibility

- `0.0.x` tracks pg-boss v10
- `0.1.x` tracks pg-boss v11 (requires Node 22+)

## Core Concepts

### 1. Job Definitions
Jobs are created using the `createQueue()` builder pattern:
```typescript
const myJob = createQueue()
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
    myJob: createQueue().handler(...),
    sendWelcomeEmail: createQueue().handler(...),
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

2. **Builder Pattern**: Jobs are created using a fluent builder API that allows chaining options before defining the handler. A new `input<T>()` helper lets users declare the job input type up-front so `schedule()` can be type-checked early.

3. **Type Inference**: Heavy use of TypeScript conditional types and inference to provide a tRPC-like developer experience where types flow through without explicit annotations.

4. **Lazy Initialization**: Clients use lazy initialization - pg-boss only starts when the first job is sent.

## Important Implementation Details

### Type System

1. **Parameterless Jobs**: Jobs without parameters infer input as `unknown`. `send()` and `schedule()` accept optional data; if omitted, `{}` is sent. Every schedule requires an explicit key (use a convention like `"default"`).

2. **Flat Jobs Map**: A single-level object `JobsMap = Record<string, JobWithoutName>` keyed by queue names (e.g., `sendWelcomeEmail`). Worker builds a concrete client map. Client uses a minimal proxy.

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
- No runtime scheduling on client: scheduling is configured via `createQueue().schedule()` at build time.

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
4. **Scheduling semantics**: QueueBuilder `schedule()` requires a key per schedule. Keys dedupe entries (overwriting matching keys) and map directly onto pg-boss v11 multi-schedule support.
5. **Dashboard rewrite**: Removed React/Vite SPA. New dashboard is a pure Hono SSR handler mounted under a configurable basePath. No RPC/ORPC.
6. **Client API**: `createClient` now exposes `getPgBoss(): Promise<PgBoss>` for read-only dashboard endpoints.
7. **Dashboard Export**: `createDashboard` is re-exported from `src/dashboard/index.ts` and surfaced via the root `src/index.ts`. The final build (`dist/index.*`) includes `createDashboard` in the root export.
8. **QueueOptions Update**: `QueueOptions` now extends `Partial<Omit<PgBoss.Queue, "name">>` (plus `batchSize`). When creating/updating queues we strip `batchSize` before passing options so only pg-boss fields flow through.
9. **Queue Update Typing**: When calling `updateQueue`, we include `{ name, ...options }` to satisfy pg-boss `Queue` typing where `name` is required in the options type.
10. **JSX Augmentation**: Replaced `declare module "hono/jsx"` augmentation with a global `JSX` declaration in `src/dashboard/htmx.ts` to avoid typecheck errors when JSX module isn't imported. Dashboard continues to use `hono/html` template tags (no TSX).
11. **Typecheck Script**: Added `"typecheck": "tsc -p tsconfig.json --noEmit"` to `package.json` for CI and local checks.
12. **Biome/Ultracite Compliance**: Fixed lint issues across dashboard and examples (magic numbers → constants, removed unused imports/vars, added missing block statements, complexity ignores for UI rendering helpers). `npx ultracite fix` runs clean.
13. **Examples Polishing**: Updated example server to avoid magic numbers and string concatenation; removed undefined `setupSchedules` call from example worker.
14. **Jobs List Pagination Refresh**: The jobs list auto-refresh keeps pagination aligned by sending an OOB `outerHTML` swap for `#jobs-poller` that rewrites its `hx-get` with the active offset and (when enabled) sets `hx-trigger="every 5s"`. The server derives the offset and refresh toggle from `HX-Current-URL`, so polling hits the same page the user is viewing without resetting to the first batch, the initial markup leaves the poller idle to avoid duplicate requests on page load, and the refresh toggle reuses the current URL so existing query params (e.g. `page=8`) are preserved when flipping the state.
15. **Client Accessor Change**: `bossman.client` is now a property (not a function). Update usages from `bossman.client().queues...` to `bossman.client.queues...`. Dashboard `createDashboard` accepts `client: bossman.client`.
16. **Refresh Toggle OOB Update**: The queue jobs list response now emits an OOB swap that re-renders the refresh control with the latest URL metadata (derived from `HX-Current-URL`). This keeps the "turn on/off" toggle anchored to the current pagination/filter query params instead of jumping back to the first page when the refresh state is flipped.
17. **Prism ESM Compatibility**: PrismJS language component imports include the `.js` extension so Vite/Node ESM resolution finds the bundled files without manual aliases.
18. **pg-boss v11 Upgrade**: The `0.1.x` release line targets pg-boss v11 (Node 22+). Archives are gone — completed jobs stay in `pgboss.job`, `getQueues()` exposes live counters, and queue creation supports optional `partition` plus `deleteAfterSeconds` defaults.
19. **Multi-schedule Support**: `reconcileSchedules()` now works with `(name, key)` pairs. Every schedule definition must supply a key; reconciliation unschedules leftovers per key, and the dashboard renders each keyed schedule (badge + cron + timezone).
20. **Dashboard Data Refresh**: Job detail cards surface `expire_seconds`, `delete_after_seconds`, and `retry_delay_max`; queue detail cards show new lifecycle fields (`retention_seconds`, `warning_queue_size`, `partition`). Custom SQL only targets `pgboss.job`—no archive unions remain.
21. **createPgBoss Defaults**: Constructor defaults align with v11: daily maintenance, supervision enabled, and warning thresholds set to pg-boss defaults.
22. **Empty Queue Registration**: `.register({})` is now valid; builders can be scaffolded without initial queues, though `.build()` still requires that `.register()` was called.

## Dashboard

- Pure Hono SSR app. Styling via Tailwind CDN + daisyUI plugin; no build step.
- `createDashboard(client, { basePath? })` → `(req: Request) => Promise<Response>`.
- Base path is normalized (no trailing slash) and injected into context for links/htmx.
- Routes:
  - `GET {basePath}/` → Full HTML page (navbar + Queues section)
  - `GET {basePath}/api/queues/queues-list-card` → HTML partial (Queues card) for htmx auto-refresh
- htmx drives auto-refresh every 1s by fetching the partial; no JSON/RPC endpoints.
- No auth, no bundler, no React/JSX. Global JSX typing is present only to support potential TSX usage; current routes use `hono/html` templates.

## Common Patterns

### Creating a Job with No Parameters
```typescript
const myJob = createQueue<void>().schedule({ key: "default", cron: "* * * * *" }).handler(() => {
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

### Job Names
```typescript
const jobs = {
  sendWelcomeEmail: createQueue().handler(...),
  sendPasswordResetEmail: createQueue().handler(...),
  dataExport: createQueue().handler(...), // Prefer camelCase; dots/namespaces supported but discouraged
};
```

### Declaring Input Type Up-Front (recommended)
// Declare the input type so schedule() enforces providing data
const testJob = createQueue<{ user: { userId: string } }>()
  .schedule({ key: "default", cron: "0 * * * *", data: { user: { userId: "123" } } })
  .handler(({ user }) => {
    console.log(user.userId);
  });

// Alternatively, use the input() helper
const testJob2 = createQueue()
  .input<{ user: { userId: string } }>()
  .schedule({ key: "default", cron: "0 * * * *", data: { user: { userId: "123" } } })
  .handler(({ user }) => {
    console.log(user.userId);
  });

// Parameterless job can omit data
const tick = createQueue<void>()
  .schedule({ key: "default", cron: "* * * * *" })
  .handler(() => console.log("tick"));

## Known Issues & Limitations

1. **Type inference for parameterless jobs**: Shows as `unknown` (acceptable tradeoff for simplicity)
2. **Cron string validation**: Currently accepts any string (not validated as valid cron)
3. **Client-only scheduling**: Removed. Schedules are defined on queues via the builder; the client does not expose `schedule/unschedule`.

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
*Last updated: Prism component imports now include `.js` extensions to fix dashboard bundling in ESM/Vite environments.*
