import { html } from "hono/html";
import type { QueueStateCounts } from "../../db/get-queue-state-counts";

type QueueRow = { name: string; counts: QueueStateCounts };

function QueuesTable({
  queues,
  basePath,
}: {
  queues: QueueRow[];
  basePath: string;
}) {
  if (!queues?.length) {
    return html`
      <div class="alert alert-soft">
        <span>No queues found.</span>
      </div>
    `;
  }
  return html`
    <div class="overflow-x-auto">
      <table class="table w-full">
        <thead>
          <tr>
            <th>Name</th>
            <th>Total</th>
            <th>Pending</th>
            <th>Active</th>
            <th>Completed</th>
            <th>Failed</th>
            <th>Cancelled</th>
          </tr>
        </thead>
        <tbody class="table-zebra">
          ${queues.map((q) => {
            const href = `${basePath || ""}/queues/${encodeURIComponent(q.name)}`;
            const RAW_EVENT_PREFIX = "__bossman_event__";
            const displayName = q.name.startsWith(RAW_EVENT_PREFIX)
              ? q.name.slice(RAW_EVENT_PREFIX.length)
              : q.name;
            const c = q.counts;
            const pending = (c.created ?? 0) + (c.retry ?? 0);
            return html`<tr>
              <td class="font-mono"><a class="link" href="${href}">${displayName}</a></td>
              <td>${c.all}</td>
              <td>${pending}</td>
              <td>${c.active}</td>
              <td class="text-success">${c.completed}</td>
              <td class="text-error">${c.failed}</td>
              <td>${c.cancelled}</td>
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
  queues: QueueRow[];
  basePath: string;
}) {
  return html`${QueuesTable({ basePath, queues })}`;
}
