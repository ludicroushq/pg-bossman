import { Hono } from "hono";
import { html } from "hono/html";
import type { Env } from "../types";
import { Breadcrumbs } from "./components/breadcrumbs";
import { Layout } from "./components/layout";
import { RefreshControl } from "./components/refresh-control";
import { api } from "./utils/api";
import { buildRefreshToggleHref } from "./utils/query";

export const home = new Hono<Env>().get((c) => {
  const basePath = c.get("basePath") ?? "";
  const routes = api(basePath);
  const queuesPath = routes.queuesCard();
  const eventsPath = routes.eventsCard();
  const refreshOn = (c.req.query("refresh") ?? "on") !== "off";
  const toggleHref = buildRefreshToggleHref(c.req.url, refreshOn);
  return c.html(
    Layout({
      basePath,
      children: html`
        ${Breadcrumbs({
          basePath,
          items: [{ label: "Dashboard" }],
          rightContent: RefreshControl({
            indicatorId: "home-page-indicator",
            refreshOn,
            toggleHref,
          }),
        })}
        <div class="grid gap-6">
          <div>
            <div class="flex items-center justify-between mb-2">
              <h2 class="text-lg font-semibold">Queues</h2>
            </div>
            <section id="queues-card" hx-get="${queuesPath}" hx-trigger="${refreshOn ? "load, every 5s" : "load"}" hx-indicator="#home-page-indicator" class="card bg-base-100 shadow">
              <div class="p-2">
                <div class="skeleton h-24 w-full"></div>
              </div>
            </section>
          </div>
          <div>
            <div class="flex items-center justify-between mb-2">
              <h2 class="text-lg font-semibold">Events</h2>
            </div>
            <section id="events-card" hx-get="${eventsPath}" hx-trigger="${refreshOn ? "load, every 5s" : "load"}" hx-indicator="#home-page-indicator" class="card bg-base-100 shadow">
              <div class="p-2">
                <div class="skeleton h-24 w-full"></div>
              </div>
            </section>
          </div>
        </div>
      `,
    })
  );
});
