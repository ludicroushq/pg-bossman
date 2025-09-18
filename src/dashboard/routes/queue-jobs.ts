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
  const toInt = (v: string | null | undefined, f: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : f;
  };
  const DEFAULT_LIST_LIMIT = 25;
  const page = toInt(c.req.query("page"), 1);
  const offset = (page - 1) * DEFAULT_LIST_LIMIT;
  const listPath = api(basePath).queueJobsList(
    name,
    DEFAULT_LIST_LIMIT,
    offset
  );
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
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-lg font-semibold">Jobs for ${displayName}</h3>
          <div class="flex items-center gap-3">
            <span class="text-sm" id="jobs-count-top"></span>
            <div class="join" id="jobs-pagination-top"></div>
          </div>
        </div>
        <section class="card bg-base-100 shadow">
          <div class="p-2">
            <div id="jobs-list" hx-get="${listPath}" hx-trigger="${refreshOn ? "load, every 5s" : "load"}" hx-indicator="#jobs-page-indicator">
              <div class="skeleton h-24 w-full"></div>
            </div>
          </div>
        </section>
        <div class="flex items-center justify-between text-sm mt-2">
          <div id="jobs-count-bottom"></div>
          <div class="join" id="jobs-pagination-bottom"></div>
        </div>
      `,
    })
  );
});
