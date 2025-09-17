import { Hono } from "hono";
import { html } from "hono/html";
import type { Env } from "../types";
import { Breadcrumbs } from "./components/breadcrumbs";
import { Layout } from "./components/layout";
import { withBasePath } from "./utils/path";

export const queue = new Hono<Env>().get("/:name", (c) => {
  const basePath = c.get("basePath") ?? "";
  const name = c.req.param("name");
  const cardPath = withBasePath(
    basePath,
    `/api/queues/${encodeURIComponent(name)}/detail-card`
  );
  return c.html(
    Layout({
      basePath,
      children: html`
        ${Breadcrumbs({
          basePath,
          items: [
            { href: "/", label: "Dashboard" },
            { href: "/", label: "Queues" },
            { label: name },
          ],
        })}
        <div class="grid gap-6">
          <section id="queue-detail" hx-get="${cardPath}" hx-trigger="load, every 5s" hx-swap="morph" class="card bg-base-100 shadow-xl">
            <div class="card-body gap-4">
              <div class="flex items-center justify-between">
                <h2 class="card-title">${name}</h2>
              </div>
              <div class="skeleton h-24 w-full"></div>
            </div>
          </section>

          <section class="card bg-base-100 shadow">
            <div class="card-body gap-3">
              <div class="flex items-center justify-between">
                <h3 class="card-title">Last 5 Jobs</h3>
                <a class="btn btn-sm" href="${withBasePath(basePath, `/queues/${encodeURIComponent(name)}/jobs`)}">View All</a>
              </div>
              <div id="jobs-preview"
                   hx-get="${withBasePath(basePath, `/api/queues/${encodeURIComponent(name)}/jobs`)}?limit=5"
                   hx-trigger="load, every 5s"
                   hx-swap="morph">
                <div class="skeleton h-24 w-full"></div>
              </div>
            </div>
          </section>
        </div>
      `,
    })
  );
});
