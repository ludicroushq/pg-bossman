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
    myJob,
    nested: {
      anotherJob
    }
  })
  .build();

// Start processing jobs
await bossman.start();

// Can also send jobs via client
await bossman.client.myJob.send({ name: "test" });
```

### 3. Client (createClient)
Lightweight send-only client that can't process jobs:
```typescript
import type { bossman } from './bossman';

const client = createClient<typeof bossman>({ connectionString });
await client.myJob.send({ name: "test" });
```

## Architecture

### File Structure
```
src/
├── index.ts                 # Main exports
├── create-bossman.ts        # Worker implementation (BossmanWorker class)
├── create-client.ts         # Client-only implementation  
├── client/
│   └── build-proxy.ts       # Proxy-based client structure builder
├── jobs/
│   ├── builder.ts           # Job builder (createJob)
│   └── client.ts            # JobClient class (send/schedule/unschedule)
├── core/
│   └── create-pg-boss.ts    # Shared pg-boss instance creation
└── types/
    ├── index.ts             # Core type definitions
    └── router.ts            # Router and job flattening logic
```

### Key Design Patterns

1. **Proxy Pattern**: Used in `build-proxy.ts` to dynamically create JobClient instances as properties are accessed. This enables the dot-notation API (`client.emails.sendWelcome.send()`).

2. **Builder Pattern**: Jobs are created using a fluent builder API that allows chaining options before defining the handler.

3. **Type Inference**: Heavy use of TypeScript conditional types and inference to provide a tRPC-like developer experience where types flow through without explicit annotations.

4. **Lazy Initialization**: Clients use lazy initialization - pg-boss only starts when the first job is sent.

## Important Implementation Details

### Type System

1. **Parameterless Jobs**: Jobs without parameters use `unknown` type (not `undefined`) for simplicity. They require `null` to be passed when sending.

2. **ClientStructure Type**: Complex conditional type that maps a JobRouter to a structure of JobClient instances:
```typescript
export type ClientStructure<T extends JobRouter> = {
  [K in keyof T]: T[K] extends JobRouter
    ? ClientStructure<T[K]>  // Recursive for nested routers
    : T[K] extends { handler: infer H }
      ? JobClient<ExtractInput<H>, unknown>
      : T[K] extends { batchHandler: infer H }
        ? JobClient<ExtractInput<H>, unknown>
        : never;
}
```

3. **Router Flattening**: Nested job structures are flattened to dot-notation names (e.g., `emails.sendWelcome`) for pg-boss compatibility.

### Error Handling

- All pg-boss instances have error handlers attached by default to prevent losing error information
- Errors are logged to console with context (`[pg-bossman worker]` or `[pg-bossman client]`)

### Worker Lifecycle

1. **Registration**: Jobs are registered with pg-boss using `.work()` 
2. **Queue Creation**: Queues are created for each job (required in pg-boss v10+)
3. **Graceful Shutdown**: SIGTERM/SIGINT handlers are automatically set up for graceful shutdown
4. **Batch Processing**: Batch handlers always receive arrays, even for single items

### Client Features

- **send()**: Can accept single item or array of items
- **schedule()**: Schedule jobs with cron expressions
- **unschedule()**: Remove scheduled jobs
- Schedule names are prefixed with job name: `${jobName}__${scheduleName}`

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

1. **Removed PgBossmanClient**: Was confusing, functionality merged into create-bossman.ts
2. **Simplified API**: `init()` is now private, auto-called when needed
3. **Direct client access**: `client.jobName.send()` instead of `client.client.jobName.send()`
4. **tRPC-like types**: Use `typeof bossman` directly, no helper types needed
5. **Unified pg-boss creation**: Shared helper in `core/create-pg-boss.ts` with default options

## Common Patterns

### Creating a Job with No Parameters
```typescript
const myJob = createJob().handler(() => {
  // No input needed
  return { success: true };
});

// Sending requires null
await client.myJob.send(null);
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

1. **Type inference for parameterless jobs**: Shows as `unknown` instead of more specific type
2. **Schedule parameter**: Currently accepts any string (not validated as valid cron)
3. **Async type assertion needed**: In createClient due to TypeScript conditional type limitations

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

*Last updated: During session fixing client type inference to work like tRPC with simple `typeof` usage*