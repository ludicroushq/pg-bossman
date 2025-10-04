<div align="center">

# pg-bossman

[![npm version](https://img.shields.io/npm/v/pg-bossman.svg)](https://www.npmjs.com/package/pg-bossman)
[![npm downloads](https://img.shields.io/npm/dm/pg-bossman.svg)](https://www.npmjs.com/package/pg-bossman)
[![CI](https://github.com/ludicroushq/pg-bossman/actions/workflows/main.yaml/badge.svg?branch=main)](https://github.com/ludicroushq/pg-bossman/actions/workflows/main.yaml)
[![Types](https://img.shields.io/badge/types-TypeScript-blue.svg)](./dist/index.d.ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/ludicroushq/pg-bossman/blob/main/package.json)

Type-safe, lightweight wrapper around pg-boss with a flat jobs map, queue-level scheduling, and a tiny send-only client — plus a zero-build SSR dashboard.

<br/>
<img alt="pg-bossman dashboard" src="https://raw.githubusercontent.com/ludicroushq/pg-bossman/main/public/images/homepage.png" width="900" />

</div>

## Install

```bash
pnpm add pg-bossman pg-boss
# or: npm i pg-bossman pg-boss
```

**NOTE:** Until pg-bossman hits 1.0, breaking changes may be made on minor versions (0.x.0) and the remaining changes will be patch versions (0.0.x)

## Compatibility

| pg-bossman | pg-boss | Runtime |
|------------|---------|---------|
| `0.0.x`    | `^10.0.0` | Follows pg-boss v10 requirements (Node 18+ recommended) |
| `0.1.x`    | `^11.0.0` | Requires Node 22+ (per pg-boss v11) |

## Quick Start

Define queues (flat map), optionally add one or more keyed schedules, build and start the worker. The client API is type-safe and identical in both the worker and a send-only client. Use descriptive schedule keys (for single schedules a `"default"` key works well).

```ts
import { createBossman, createClient, createQueue } from "pg-bossman";

const queues = {
  // single job
  sendWelcomeEmail: createQueue().handler((input: { to: string }) => {
    /* ...send email... */
  }),

  // scheduled job (multiple schedules supported via keys)
  tick: createQueue<void>()
    .schedule({ key: "default", cron: "* * * * *" })
    .schedule({ key: "five-minutes", cron: "*/5 * * * *" })
    .handler(() => {
      /* ...do work... */
    }),

  // batch job
  resizeImages: createQueue()
    .options({ batchSize: 10 })
    .batchHandler((items: Array<{ url: string }>) =>
      items.map((i) => ({ ok: i.url }))
    ),
};

// Build + start the worker
const bossman = createBossman({ connectionString: process.env.DATABASE_URL! })
  .register(queues)
  .build();

await bossman.start();

// Send a job (from the worker)
await bossman.client.queues.sendWelcomeEmail.send({ to: "user@example.com" });

// Send-only client (no handlers bundled)
type Bossman = typeof bossman;
const client = createClient<Bossman>({
  connectionString: process.env.DATABASE_URL!,
});
await client.queues.sendWelcomeEmail.send({ to: "user@example.com" });
```

Optional: typed events with subscriptions

```ts
import { defineEvents } from "pg-bossman";

const events = defineEvents<{ userCreated: { email: string } }>();

const bossman = createBossman({ connectionString: process.env.DATABASE_URL! })
  .register(queues)
  .events(events)
  .subscriptions({
    userCreated: { sendWelcomeEmail: { map: (e) => ({ to: e.email }) } },
  })
  .build();

await bossman.client.events.userCreated.emit({ email: "user@example.com" });
```

## Dashboard (SSR)

Mount the built-in Hono SSR dashboard anywhere (no bundler, no React). It reads via the client only.

```ts
import { createDashboard } from "pg-bossman";

export const GET = createDashboard({
  client: bossman.client,
  basePath: "/dashboard",
});
export const POST = GET; // for runtimes that need both
```

## License

MIT
