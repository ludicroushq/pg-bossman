import { html } from "hono/html";
import type { JobRow } from "../../db";
import { api } from "../utils/api";
import { CodeBlock } from "./code-block";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: UI rendering function with several branches
export function JobDetailCard({
  job,
  basePath,
}: {
  job: JobRow;
  basePath: string;
}) {
  // Determine state badge color
  let stateClass = "";
  let stateIcon = "";
  if (job.state === "completed") {
    stateClass = "badge-success";
    stateIcon = "✓";
  } else if (job.state === "failed") {
    stateClass = "badge-error";
    stateIcon = "✗";
  } else if (job.state === "active") {
    stateClass = "badge-primary";
    stateIcon = "⟳";
  } else if (job.state === "retry") {
    stateClass = "badge-warning";
    stateIcon = "↻";
  } else if (job.state === "created") {
    stateClass = "badge-info";
    stateIcon = "●";
  } else if (job.state === "cancelled") {
    stateClass = "badge-ghost";
    stateIcon = "⊘";
  } else {
    stateClass = "badge-ghost";
    stateIcon = "○";
  }

  const RAW_EVENT_PREFIX = "__bossman_event__";
  const isEvent = job.name.startsWith(RAW_EVENT_PREFIX);
  const displayQueueName = isEvent
    ? job.name.slice(RAW_EVENT_PREFIX.length)
    : job.name;
  const queueHref = `${basePath || ""}/queues/${encodeURIComponent(job.name)}`;
  const refreshPath = api(basePath).jobDetail(job.name, job.id);

  return html`
    <div class="card bg-base-100 shadow overflow-hidden">
      <div class="card-body gap-4 overflow-hidden">
        <!-- Header with job ID and state -->
        <div class="flex items-center justify-between">
          <h3 class="card-title font-mono text-lg">${job.id}</h3>
          <div class="flex items-center gap-2">
            <button 
              class="btn btn-sm btn-ghost"
              hx-get="${refreshPath}"
              hx-target="#job-detail"
              title="Refresh now"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <span class="badge ${stateClass} gap-1">
              <span>${stateIcon}</span>
              <span>${job.state}</span>
            </span>
          </div>
        </div>

        <!-- Job metadata grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="card bg-base-200">
            <div class="card-body p-4 gap-2">
              <h4 class="font-semibold text-sm opacity-70">Queue Info</h4>
              <div class="text-sm space-y-1">
                <div class="flex justify-between">
                  <span class="opacity-60">Queue:</span>
                  <a href="${queueHref}" class="link link-primary">${
                    isEvent ? `Event: ${displayQueueName}` : displayQueueName
                  }</a>
                </div>
                <div class="flex justify-between">
                  <span class="opacity-60">Priority:</span>
                  <span>${job.priority}</span>
                </div>
                <div class="flex justify-between">
                  <span class="opacity-60">Retries:</span>
                  <span>${job.retry_count} / ${job.retry_limit}</span>
                </div>
                <div class="flex justify-between">
                  <span class="opacity-60">Retry Delay:</span>
                  <span>${job.retry_delay}s</span>
                </div>
                ${
                  job.retry_backoff
                    ? html`
                <div class="flex justify-between">
                  <span class="opacity-60">Retry Backoff:</span>
                  <span>Yes</span>
                </div>
                `
                    : ""
                }
              </div>
            </div>
          </div>

          <div class="card bg-base-200">
            <div class="card-body p-4 gap-2">
              <h4 class="font-semibold text-sm opacity-70">Timestamps</h4>
              <div class="text-sm space-y-1">
                <div class="flex justify-between">
                  <span class="opacity-60">Created:</span>
                  <span class="text-xs">${job.created_on ? new Date(job.created_on).toLocaleString() : "—"}</span>
                </div>
                <div class="flex justify-between">
                  <span class="opacity-60">Start After:</span>
                  <span class="text-xs">${job.start_after ? new Date(job.start_after).toLocaleString() : "—"}</span>
                </div>
                <div class="flex justify-between">
                  <span class="opacity-60">Started:</span>
                  <span class="text-xs">${job.started_on ? new Date(job.started_on).toLocaleString() : "—"}</span>
                </div>
                <div class="flex justify-between">
                  <span class="opacity-60">Completed:</span>
                  <span class="text-xs">${job.completed_on ? new Date(job.completed_on).toLocaleString() : "—"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Additional metadata if present -->
        ${
          job.singleton_key ||
          job.expire_in ||
          job.keep_until ||
          job.dead_letter
            ? html`
        <div class="card bg-base-200">
          <div class="card-body p-4 gap-2">
            <h4 class="font-semibold text-sm opacity-70">Additional Settings</h4>
            <div class="text-sm space-y-1">
              ${
                job.singleton_key
                  ? html`
              <div class="flex justify-between">
                <span class="opacity-60">Singleton Key:</span>
                <span class="font-mono text-xs">${job.singleton_key}</span>
              </div>
              `
                  : ""
              }
              ${
                job.expire_in
                  ? html`
              <div class="flex justify-between">
                <span class="opacity-60">Expire In:</span>
                <span>${job.expire_in}</span>
              </div>
              `
                  : ""
              }
              ${
                job.keep_until
                  ? html`
              <div class="flex justify-between">
                <span class="opacity-60">Keep Until:</span>
                <span class="text-xs">${new Date(job.keep_until).toLocaleString()}</span>
              </div>
              `
                  : ""
              }
              ${
                job.dead_letter
                  ? html`
              <div class="flex justify-between">
                <span class="opacity-60">Dead Letter:</span>
                <span>${job.dead_letter}</span>
              </div>
              `
                  : ""
              }
              ${
                job.policy
                  ? html`
              <div class="flex justify-between">
                <span class="opacity-60">Policy:</span>
                <span>${job.policy}</span>
              </div>
              `
                  : ""
              }
            </div>
          </div>
        </div>
        `
            : ""
        }

        <!-- Job Data -->
        <div class="min-w-0 overflow-hidden">
          <div class="divider">Job Data</div>
          ${CodeBlock({
            code: JSON.stringify(job.data ?? {}, null, 2),
            language: "json",
          })}
        </div>

        <!-- Job Output (if exists) -->
        ${
          job.output
            ? html`
          <div class="min-w-0 overflow-hidden">
            <div class="divider">Job Output</div>
            ${CodeBlock({
              code:
                typeof job.output === "string"
                  ? job.output
                  : JSON.stringify(job.output, null, 2),
              language: typeof job.output === "string" ? "log" : "json",
            })}
          </div>
        `
            : ""
        }
      </div>
    </div>
  `;
}
