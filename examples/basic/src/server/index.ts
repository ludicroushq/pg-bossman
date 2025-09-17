import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createClient, createDashboard } from "pg-bossman";
import type { bossman } from "../worker/start";

const PORT = Number(process.env.PORT ?? 3000);
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/bossman-dashboard";

async function main() {
  // Create a send-only client; types flow from the worker's bossman type.
  const client = createClient<typeof bossman>({
    connectionString: DATABASE_URL,
  });

  // Build the dashboard handler mounted at /dashboard
  const dashboardFetch = createDashboard(client, { basePath: "/dashboard" });

  // Simple Hono server that forwards requests to the dashboard
  const app = new Hono();

  // Redirect root to the dashboard
  app.get("/", (c) => c.redirect("/dashboard/", 302));

  // Forward everything else to the dashboard handler (supports HTML + API routes)
  app.all("*", (c) => dashboardFetch(c.req.raw));

  serve(
    {
      fetch: app.fetch,
      port: PORT,
    },
    (info) => {
      console.log(`Server running on http://localhost:${info.port}`);
      console.log("Dashboard: http://localhost:" + info.port + "/dashboard/");
    }
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
