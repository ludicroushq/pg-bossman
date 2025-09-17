# Basic pg-bossman Example

A simple example demonstrating core pg-bossman functionality.

## Setup

1. Create a PostgreSQL database
2. Copy `.env.example` to `.env` and update DATABASE_URL
3. Install dependencies: `pnpm install`

## Running

Terminal 1 - Start the worker:
```bash
pnpm worker
```

Terminal 2 - Send jobs:
```bash
pnpm client
```

## Features Demonstrated

- Queue registration with type safety
- Simple queue handlers
- Batch queue processing (processes multiple jobs at once)
- Retry configuration
- Worker lifecycle management
- Client job sending
