import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

export function RefreshControl({
  refreshOn,
  indicatorId,
  toggleHref,
}: {
  refreshOn: boolean;
  indicatorId: string;
  toggleHref: string;
}): HtmlEscapedString {
  const content = html`<div class="flex items-center gap-3 text-sm">
    ${
      refreshOn
        ? html`<div class="flex items-center gap-2" id="${indicatorId}">
          <span class="loading loading-spinner loading-xs"></span>
          <span>Auto-refreshing…</span>
        </div>`
        : html`<div class="opacity-60">Auto-refresh off</div>`
    }
    <a class="btn btn-ghost btn-xs" href="${toggleHref}">${
      refreshOn ? "Turn off" : "Turn on"
    }</a>
  </div>`;
  return content as unknown as HtmlEscapedString;
}
