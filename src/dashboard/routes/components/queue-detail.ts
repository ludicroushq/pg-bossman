import { html } from "hono/html";

export type QueueMeta = {
  name: string;
  policy?: string | null;
  retry_limit?: number | null;
  retry_delay?: number | null;
  retry_delay_max?: number | null;
  retry_backoff?: boolean | null;
  expire_seconds?: number | null;
  retention_seconds?: number | null;
  delete_after_seconds?: number | null;
  dead_letter?: string | null;
  warning_queue_size?: number | null;
  partition?: boolean | null;
  created_on?: Date | null;
  updated_on?: Date | null;
};

export type QueueSchedule = {
  name: string;
  cron: string;
  key?: string | null;
  timezone?: string | null;
  options?: unknown;
  data?: unknown;
};

export type QueueStateCounts = {
  created: number;
  retry: number;
  active: number;
  completed: number;
  cancelled: number;
  failed: number;
};

function StatsGrid({
  total,
  counts,
}: {
  total: number;
  counts: QueueStateCounts | null;
}) {
  return html`<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
    <div class="stat bg-base-200 rounded-box">
      <div class="stat-title">Total Jobs</div>
      <div class="stat-value text-primary">${total}</div>
      <div class="stat-desc">created + active + completed + failed</div>
    </div>
    <div class="stat bg-base-200 rounded-box">
      <div class="stat-title">Pending</div>
      <div class="stat-value">${(counts?.created ?? 0) + (counts?.retry ?? 0)}</div>
      <div class="stat-desc">Created + Retry</div>
    </div>
    <div class="stat bg-base-200 rounded-box">
      <div class="stat-title">Active</div>
      <div class="stat-value">${counts?.active ?? 0}</div>
    </div>
    <div class="stat bg-base-200 rounded-box">
      <div class="stat-title">Completed</div>
      <div class="stat-value text-success">${counts?.completed ?? 0}</div>
    </div>
    <div class="stat bg-base-200 rounded-box">
      <div class="stat-title">Failed</div>
      <div class="stat-value text-error">${counts?.failed ?? 0}</div>
    </div>
    <div class="stat bg-base-200 rounded-box">
      <div class="stat-title">Cancelled</div>
      <div class="stat-value">${counts?.cancelled ?? 0}</div>
    </div>
  </div>`;
}

function ConfigGrid({ meta }: { meta: QueueMeta }) {
  return html`<div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
    <div class="card bg-base-200 p-3 space-y-1">
      <div><span class="font-medium">Retry Limit:</span> ${meta.retry_limit ?? "—"}</div>
      <div><span class="font-medium">Retry Delay (s):</span> ${meta.retry_delay ?? "—"}</div>
      <div><span class="font-medium">Retry Delay Max (s):</span> ${meta.retry_delay_max ?? "—"}</div>
      <div><span class="font-medium">Retry Backoff:</span> ${meta.retry_backoff ? "Yes" : "No"}</div>
    </div>
    <div class="card bg-base-200 p-3 space-y-1">
      <div><span class="font-medium">Expire (s):</span> ${meta.expire_seconds ?? "—"}</div>
      <div><span class="font-medium">Retention (s):</span> ${meta.retention_seconds ?? "—"}</div>
      <div><span class="font-medium">Delete After (s):</span> ${meta.delete_after_seconds ?? "—"}</div>
      <div><span class="font-medium">Warning Queue Size:</span> ${meta.warning_queue_size ?? "—"}</div>
      <div><span class="font-medium">Partitioned Table:</span> ${meta.partition ? "Yes" : "No"}</div>
      <div><span class="font-medium">Dead-letter:</span> ${meta.dead_letter ?? "—"}</div>
    </div>
  </div>`;
}

export function QueueDetailCard({
  meta,
  counts,
  schedules,
}: {
  meta: QueueMeta | null;
  counts: QueueStateCounts | null;
  schedules: QueueSchedule[];
}) {
  if (!meta) {
    return html`<div class="alert alert-error"><span>Queue not found</span></div>`;
  }

  const RAW_EVENT_PREFIX = "__bossman_event__";
  const isEvent = meta.name?.startsWith(RAW_EVENT_PREFIX) ?? false;
  const name = isEvent ? meta.name.slice(RAW_EVENT_PREFIX.length) : meta.name;
  const total = counts
    ? counts.created +
      counts.retry +
      counts.active +
      counts.completed +
      counts.cancelled +
      counts.failed
    : 0;

  return html`
    <section class="card bg-base-100 shadow-xl">
      <div class="card-body gap-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="card-title">${isEvent ? `Event: ${name}` : name}</h2>
            <p class="text-sm text-base-content/60">Policy: ${meta.policy ?? "standard"}</p>
          </div>
        </div>

        ${StatsGrid({ counts, total })}

        <div class="divider">Configuration</div>
        ${ConfigGrid({ meta })}

        <div class="divider">Schedules</div>
        ${
          schedules.length > 0
            ? html`<div class="space-y-2">
              ${schedules.map(
                (schedule) =>
                  html`<div class="alert alert-soft flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span>
                    Cron: <code class="font-mono">${schedule.cron}</code>${
                      schedule.timezone ? ` (${schedule.timezone})` : ""
                    }
                  </span>
                  ${
                    schedule.key
                      ? html`<span class="badge badge-outline">Key: ${schedule.key}</span>`
                      : ""
                  }
                </div>`
              )}
            </div>`
            : html`<div class="alert"><span>No schedules</span></div>`
        }
      </div>
    </section>
  `;
}
