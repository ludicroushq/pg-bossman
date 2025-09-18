import { Hono } from "hono";
import { html } from "hono/html";
import type { Env } from "../types";
import { Breadcrumbs } from "./components/breadcrumbs";
import { Layout } from "./components/layout";
import { RefreshControl } from "./components/refresh-control";
import { api } from "./utils/api";

export const queue = new Hono<Env>().get("/:name", (c) => {
  const basePath = c.get("basePath") ?? "";
  const name = c.req.param("name");
  const RAW_EVENT_PREFIX = "__bossman_event__";
  const displayName = name.startsWith(RAW_EVENT_PREFIX)
    ? name.slice(RAW_EVENT_PREFIX.length)
    : name;
  const routes = api(basePath);
  const refreshOn = (c.req.query("refresh") ?? "on") !== "off";
  const PREVIEW_LIMIT = 5;
  const cardPath = routes.queueDetail(name);
  return c.html(
    Layout({
      basePath,
      children: html`
        ${Breadcrumbs({
          basePath,
          items: [
            { href: "/", label: "Dashboard" },
            { href: "/", label: "Queues" },
            { label: displayName },
          ],
          rightContent: RefreshControl({
            indicatorId: "queue-page-indicator",
            refreshOn,
            toggleHref: `${basePath}/queues/${encodeURIComponent(name)}${refreshOn ? "?refresh=off" : "?refresh=on"}`,
          }),
        })}
        <div class="grid gap-6">
          <section id="queue-detail" hx-get="${cardPath}" hx-trigger="${refreshOn ? "load, every 5s" : "load"}" hx-indicator="#queue-page-indicator" class="card bg-base-100 shadow-xl">
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
            <a class="btn btn-sm" href="${basePath ?? ""}/queues/${encodeURIComponent(name)}/jobs">View All</a>
              </div>
              <div id="jobs-preview"
                  hx-get="${routes.queueJobsPreview(name, PREVIEW_LIMIT)}"
                  hx-trigger="${refreshOn ? "load, every 5s" : "load"}"
                   hx-indicator="#queue-page-indicator">
                <div class="skeleton h-24 w-full"></div>
              </div>
            </div>
          </section>
        </div>
      `,
    })
  );
});
