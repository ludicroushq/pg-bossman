import { html } from "hono/html";
import type { JobRow } from "../api/queue-jobs";
import { api } from "../utils/api";
import { RefreshControl } from "./refresh-control";

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
  const jobHref = `${basePath || ""}/queues/${encodeURIComponent(job.name)}/jobs/${encodeURIComponent(job.id)}`;
  return html`<tr>
    <td class="font-mono text-xs"><a class="link" href="${jobHref}">${job.id}</a></td>
    <td><span class="badge ${stateClass}">${job.state}</span></td>
    <td class="hidden sm:table-cell">${job.priority}</td>
    <td class="hidden md:table-cell">${job.retry_count}/${job.retry_limit}</td>
    <td class="hidden lg:table-cell">
      ${
        job.started_on
          ? html`<span class="cursor-help" title="${new Date(job.started_on).toLocaleString()}">
            <span data-relative-time="${new Date(job.started_on).toISOString()}"></span>
          </span>`
          : "—"
      }
    </td>
    <td class="hidden lg:table-cell">
      ${(() => {
        if (job.completed_on && job.started_on) {
          return html`<span class="cursor-help" title="${new Date(job.completed_on).toLocaleString()}">
              <span data-duration-between-start="${new Date(job.started_on).toISOString()}" data-duration-between-end="${new Date(job.completed_on).toISOString()}"></span>
            </span>`;
        }
        if (job.completed_on) {
          return html`<span>${new Date(job.completed_on).toLocaleString()}</span>`;
        }
        return "—";
      })()}
    </td>
    <td>
      ${
        job.created_on
          ? html`<span class="cursor-help" title="${new Date(job.created_on).toLocaleString()}">
            <span data-relative-time="${new Date(job.created_on).toISOString()}"></span>
          </span>`
          : "—"
      }
    </td>
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
  refreshOn,
  refreshToggleHref,
  refreshControlId,
  refreshIndicatorId,
}: {
  jobs: JobRow[];
  name: string;
  limit: number;
  offset: number;
  total: number;
  basePath: string;
  refreshOn: boolean;
  refreshToggleHref: string;
  refreshControlId: string;
  refreshIndicatorId: string;
}) {
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + limit, total);
  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = Math.min(total, offset + limit);
  const prevDisabled = offset <= 0;
  const nextDisabled = nextOffset >= total;
  const routes = api(basePath);
  const listPath = (o: number) => routes.queueJobsList(name, limit, o);
  const currentPage = Math.floor(offset / limit) + 1;
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = currentPage + 1;
  const prevPageUrl = `${basePath}/queues/${encodeURIComponent(name)}/jobs?page=${prevPage}`;
  const nextPageUrl = `${basePath}/queues/${encodeURIComponent(name)}/jobs?page=${nextPage}`;
  const caption = `Showing ${start}–${end} of ${total}`;
  const pollerPath = listPath(offset);
  const refreshControl = RefreshControl({
    controlId: refreshControlId,
    indicatorId: refreshIndicatorId,
    refreshOn,
    swapTargetId: refreshControlId,
    toggleHref: refreshToggleHref,
  });
  return html`
    ${refreshControl}
    <div
      hx-swap-oob="outerHTML:#jobs-poller"
      id="jobs-poller"
      hx-get="${pollerPath}"
      ${refreshOn ? html`hx-trigger="every 5s"` : html``}
      hx-target="#jobs-list"
      hx-indicator="#jobs-page-indicator"
      hx-swap="innerHTML"
      style="display:none"
    ></div>
    <!-- OOB updates for counters & pagination (outside the list container) -->
    <div hx-swap-oob="innerHTML:#jobs-count-top">${caption}</div>
    <div hx-swap-oob="innerHTML:#jobs-count-bottom">${caption}</div>
    <div hx-swap-oob="innerHTML:#jobs-pagination-top" class="join">
      <button class="btn btn-sm join-item" ${prevDisabled ? "disabled" : ""} hx-get="${listPath(prevOffset)}" hx-target="#jobs-list" hx-push-url="${prevPageUrl}">Prev</button>
      <button class="btn btn-sm join-item" ${nextDisabled ? "disabled" : ""} hx-get="${listPath(nextOffset)}" hx-target="#jobs-list" hx-push-url="${nextPageUrl}">Next</button>
    </div>
    <div hx-swap-oob="innerHTML:#jobs-pagination-bottom" class="join">
      <button class="btn btn-sm join-item" ${prevDisabled ? "disabled" : ""} hx-get="${listPath(prevOffset)}" hx-target="#jobs-list" hx-push-url="${prevPageUrl}">Prev</button>
      <button class="btn btn-sm join-item" ${nextDisabled ? "disabled" : ""} hx-get="${listPath(nextOffset)}" hx-target="#jobs-list" hx-push-url="${nextPageUrl}">Next</button>
    </div>

    ${JobsTable({ basePath, jobs })}
  `;
}
