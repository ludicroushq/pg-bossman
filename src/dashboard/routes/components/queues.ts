import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { withBasePath } from "../utils/path";

type Queue = { name?: string } & Record<string, unknown>;

function QueuesTable({
  queues,
  basePath,
}: {
  queues: Queue[];
  basePath: string;
}) {
  if (!queues?.length) {
    return html`
      <div class="alert alert-soft">
        <span>No queues found.</span>
      </div>
    `;
  }

  const count = queues.length;
  return html`
    <div class="overflow-x-auto">
      <table class="table w-full">
        <thead>
          <tr>
            <th class="flex items-center gap-2">
              <span>Queues</span>
              <span class="badge badge-neutral">${count}</span>
            </th>
          </tr>
        </thead>
        <tbody class="table-zebra">
          ${queues.map((q) => {
            const href = withBasePath(
              basePath,
              `/queues/${encodeURIComponent(q.name ?? "")}`
            );
            return html`<tr>
              <td class="font-mono"><a class="link" href="${href}">${q.name ?? "(unnamed)"}</a></td>
            </tr>`;
          })}
        </tbody>
      </table>
    </div>
  `;
}

export function QueuesCard({
  queues,
  basePath,
}: {
  queues: Queue[];
  basePath: string;
}) {
  const refreshPath = withBasePath(basePath, "/api/queues/queues-list-card");
  const updatedAt = new Date().toLocaleTimeString();

  return html`
    <section id="queues-card" class="queues-card" hx-get="${refreshPath}" hx-trigger="every 1s" hx-swap="morph" hx-indicator="#queues-indicator">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body gap-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <h2 class="card-title">Queues</h2>
            </div>
            <div class="flex items-center gap-2">
              <button class="btn btn-primary btn-sm" hx-get="${refreshPath}" hx-target="#queues-card" hx-swap="morph" hx-indicator="#queues-indicator">
                Refresh
              </button>
            </div>
          </div>
          ${QueuesTable({ basePath, queues })}
          <div class="flex items-center justify-between pt-2 border-t border-base-200 text-xs text-base-content/60">
            <div class="flex items-center gap-2" id="queues-indicator">
              <span class="loading loading-spinner loading-xs"></span>
              <span>Refreshing…</span>
            </div>
            <div>Updated at ${updatedAt}</div>
          </div>
        </div>
      </div>
    </section>
  `;
}
