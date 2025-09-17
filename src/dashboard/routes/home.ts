import { Hono } from "hono";
import { html } from "hono/html";
import type { Env } from "../types";
import { Breadcrumbs } from "./components/breadcrumbs";
import { Layout } from "./components/layout";
import { withBasePath } from "./utils/path";

export const home = new Hono<Env>().get((c) => {
  const basePath = c.get("basePath") ?? "";
  const queuesPath = withBasePath(basePath, "/api/queues/queues-list-card");
  return c.html(
    Layout({
      basePath,
      children: html`
        ${Breadcrumbs({
          basePath,
          items: [{ label: "Dashboard" }],
        })}
        <div class="grid gap-6">
          <section id="queues-card" hx-get="${queuesPath}" hx-trigger="load" hx-swap="morph" class="card bg-base-100 shadow-xl">
            <div class="card-body gap-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <h2 class="card-title">Queues</h2>
                  <div class="badge">—</div>
                </div>
              </div>
              <div class="skeleton h-24 w-full"></div>
              <div class="flex items-center justify-between pt-2 border-t border-base-200 text-xs text-base-content/60">
                <div class="flex items-center gap-2">
                  <span class="loading loading-spinner loading-xs"></span>
                  <span>Loading…</span>
                </div>
                <div>&nbsp;</div>
              </div>
            </div>
          </section>
        </div>
      `,
    })
  );
});
