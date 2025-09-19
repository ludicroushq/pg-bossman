import { createClient, createDashboard } from "pg-bossman";

const bossmanClient = createClient({
  connectionString: process.env.DATABASE_URL,
});

const dashboard = createDashboard({
  basePath: "/admin/dashboard",
  client: bossmanClient,
});

function handler(req: Request) {
  // IMPORTANT: ensure the request is coming from an admin user.
  return dashboard(req);
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const HEAD = handler;
export const TRACE = handler;
export const CONNECT = handler;
export const PURGE = handler;
export const LOCK = handler;
export const UNLOCK = handler;
