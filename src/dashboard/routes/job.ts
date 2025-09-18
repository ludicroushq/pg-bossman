import { Hono } from "hono";
import { html } from "hono/html";
import type { Env } from "../types";
import { Breadcrumbs } from "./components/breadcrumbs";
import { Layout } from "./components/layout";
import { withBasePath } from "./utils/path";

export const jobPage = new Hono<Env>().get("/:name/jobs/:id", (c) => {
  const basePath = c.get("basePath") ?? "";
  const queueName = c.req.param("name");
  const id = c.req.param("id");
  const detailPath = withBasePath(
    basePath,
    `/api/queues/${encodeURIComponent(queueName)}/jobs/${encodeURIComponent(id)}`
  );
  const _queueHref = withBasePath(
    basePath,
    `/queues/${encodeURIComponent(queueName)}`
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
            {
              href: `/queues/${encodeURIComponent(queueName)}`,
              label: queueName,
            },
            {
              href: `/queues/${encodeURIComponent(queueName)}/jobs`,
              label: "Jobs",
            },
            { className: "font-mono", label: id },
          ],
        })}
        <div class="grid gap-6">
          <!-- Job detail container with auto-refresh -->
          <section 
            id="job-detail" 
            hx-get="${detailPath}" 
            hx-trigger="load, every 5s"
            hx-swap="morph"
          >
            <!-- Loading skeleton -->
            <div class="card bg-base-100 shadow">
              <div class="card-body gap-4">
                <div class="flex items-center justify-between">
                  <div class="skeleton h-8 w-64"></div>
                  <div class="skeleton h-6 w-24"></div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="skeleton h-32 w-full"></div>
                  <div class="skeleton h-32 w-full"></div>
                </div>
                <div class="skeleton h-48 w-full"></div>
              </div>
            </div>
          </section>

          <!-- Refresh indicator -->
          <div class="text-xs text-base-content/50 text-center">
            Auto-refreshing every 5 seconds
          </div>
        </div>
      `,
      title: `Job ${id} - pg-bossman Dashboard`,
    })
  );
});
