import { Hono } from "hono";
import { html } from "hono/html";
import type { Env } from "../types";
import { Breadcrumbs } from "./components/breadcrumbs";
import { Layout } from "./components/layout";
import { RefreshControl } from "./components/refresh-control";
import { api } from "./utils/api";

export const queueJobsPage = new Hono<Env>().get("/:name/jobs", (c) => {
  const basePath = c.get("basePath") ?? "";
  const name = c.req.param("name");
  const RAW_EVENT_PREFIX = "__bossman_event__";
  const displayName = name.startsWith(RAW_EVENT_PREFIX)
    ? name.slice(RAW_EVENT_PREFIX.length)
    : name;
  const DEFAULT_LIST_LIMIT = 25;
  const listPath = api(basePath).queueJobsList(name, DEFAULT_LIST_LIMIT, 0);
  const refreshOn = (c.req.query("refresh") ?? "on") !== "off";
  const _overviewHref = `${basePath || ""}/queues/${encodeURIComponent(name)}`;

  return c.html(
    Layout({
      basePath,
      children: html`
        ${Breadcrumbs({
          basePath,
          items: [
            { href: "/", label: "Dashboard" },
            { href: "/", label: "Queues" },
            { href: `/queues/${encodeURIComponent(name)}`, label: displayName },
            { label: "Jobs" },
          ],
          rightContent: RefreshControl({
            indicatorId: "jobs-page-indicator",
            refreshOn,
            toggleHref: `${basePath}/queues/${encodeURIComponent(name)}/jobs${refreshOn ? "?refresh=off" : "?refresh=on"}`,
          }),
        })}
        <div class="grid gap-6">
          <section class="card bg-base-100 shadow">
            <div class="card-body gap-3">
              <div class="flex items-center justify-between">
                <h3 class="card-title">Jobs for ${name}</h3>
                <div class="flex items-center gap-3">
                  <span class="text-sm" id="jobs-count"></span>
                  <button class="btn btn-sm" hx-get="${listPath}" hx-target="#jobs-list">Refresh</button>
                </div>
              </div>
              <div id="jobs-list" hx-get="${listPath}" hx-trigger="${refreshOn ? "load, every 5s" : "load"}" hx-indicator="#jobs-page-indicator">
                <div class="skeleton h-24 w-full"></div>
              </div>

            </div>
          </section>
        </div>
      `,
    })
  );
});
