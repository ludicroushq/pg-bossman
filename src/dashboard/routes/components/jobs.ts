import { html } from "hono/html";
import type { JobRow } from "../api/queue-jobs";
import { withBasePath } from "../utils/path";

export function JobItem({ job, basePath }: { job: JobRow; basePath: string }) {
  let stateClass = "";
  if (job.state === "completed") {
    stateClass = "badge-success";
  } else if (job.state === "failed") {
    stateClass = "badge-error";
  } else if (job.state === "active") {
    stateClass = "badge-primary";
  } else if (job.state === "retry") {
    stateClass = "badge-warning";
  }
  const jobHref = withBasePath(
    basePath,
    `/queues/${encodeURIComponent(job.name)}/jobs/${encodeURIComponent(job.id)}`
  );
  return html`<tr>
    <td class="font-mono text-xs"><a class="link" href="${jobHref}">${job.id}</a></td>
    <td><span class="badge ${stateClass}">${job.state}</span></td>
    <td class="hidden sm:table-cell">${job.priority}</td>
    <td class="hidden md:table-cell">${job.retry_count}/${job.retry_limit}</td>
    <td class="hidden lg:table-cell">${job.started_on ? new Date(job.started_on).toLocaleString() : "—"}</td>
    <td class="hidden lg:table-cell">${job.completed_on ? new Date(job.completed_on).toLocaleString() : "—"}</td>
    <td class="text-xs">${job.created_on ? new Date(job.created_on).toLocaleString() : "—"}</td>
  </tr>`;
}

export function JobsTable({
  jobs,
  basePath = "",
}: {
  jobs: JobRow[];
  basePath?: string;
}) {
  if (!jobs.length) {
    return html`<div class="alert alert-soft"><span>No runs found</span></div>`;
  }
  return html`<div class="overflow-x-auto">
    <table class="table table-sm w-full">
      <thead>
        <tr>
          <th>ID</th>
          <th>State</th>
          <th class="hidden sm:table-cell">Priority</th>
          <th class="hidden md:table-cell">Retries</th>
          <th class="hidden lg:table-cell">Started</th>
          <th class="hidden lg:table-cell">Completed</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        ${jobs.map((job) => JobItem({ basePath, job }))}
      </tbody>
    </table>
  </div>`;
}

export function JobsList({
  jobs,
  name,
  limit,
  offset,
  total,
  basePath,
}: {
  jobs: JobRow[];
  name: string;
  limit: number;
  offset: number;
  total: number;
  basePath: string;
}) {
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + limit, total);
  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = Math.min(total, offset + limit);
  const prevDisabled = offset <= 0;
  const nextDisabled = nextOffset >= total;
  const listPath = (o: number) =>
    `${basePath}/api/queues/${encodeURIComponent(name)}/jobs/list?limit=${limit}&offset=${o}`;
  return html`
    <div id="jobs-list">
      <div hx-swap-oob="innerHTML:#jobs-count">Showing ${start}–${end} of ${total}</div>
      ${JobsTable({ basePath, jobs })}
      <div class="flex items-center justify-between text-sm mt-2">
        <div>Showing ${start}–${end} of ${total}</div>
        <div class="join">
          <button class="btn btn-sm join-item" ${prevDisabled ? "disabled" : ""} hx-get="${listPath(prevOffset)}" hx-target="#jobs-list" hx-swap="morph">Prev</button>
          <button class="btn btn-sm join-item" ${nextDisabled ? "disabled" : ""} hx-get="${listPath(nextOffset)}" hx-target="#jobs-list" hx-swap="morph">Next</button>
        </div>
      </div>
    </div>
  `;
}
