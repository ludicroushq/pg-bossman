import { Hono } from "hono";
import { html } from "hono/html";
import type { Env } from "../types";
import { Breadcrumbs } from "./components/breadcrumbs";
import { Layout } from "./components/layout";
import { withBasePath } from "./utils/path";

export const queueJobsPage = new Hono<Env>().get("/:name/jobs", (c) => {
  const basePath = c.get("basePath") ?? "";
  const name = c.req.param("name");
  const listPath = withBasePath(
    basePath,
    `/api/queues/${encodeURIComponent(name)}/jobs/list?limit=25&offset=0`
  );
  const _overviewHref = withBasePath(
    basePath,
    `/queues/${encodeURIComponent(name)}`
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
            { href: `/queues/${encodeURIComponent(name)}`, label: name },
            { label: "Jobs" },
          ],
        })}
        <div class="grid gap-6">
          <section class="card bg-base-100 shadow">
            <div class="card-body gap-3">
              <div class="flex items-center justify-between">
                <h3 class="card-title">Jobs for ${name}</h3>
                <div class="flex items-center gap-3">
                  <span class="text-sm" id="jobs-count"></span>
                  <button class="btn btn-sm" hx-get="${listPath}" hx-target="#jobs-list" hx-swap="morph">Refresh</button>
                </div>
              </div>
              <div id="jobs-list" hx-get="${listPath}" hx-trigger="load" hx-swap="morph">
                <div class="skeleton h-24 w-full"></div>
              </div>

            </div>
          </section>
        </div>
      `,
    })
  );
});
