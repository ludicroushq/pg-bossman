import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

export function RefreshControl({
  refreshOn,
  indicatorId,
  toggleHref,
  controlId,
  swapTargetId,
}: {
  refreshOn: boolean;
  indicatorId: string;
  toggleHref: string;
  controlId?: string;
  swapTargetId?: string;
}): HtmlEscapedString {
  const idAttr = controlId ? html` id="${controlId}"` : html``;
  const swapAttr = swapTargetId
    ? html` hx-swap-oob="outerHTML:#${swapTargetId}"`
    : html``;
  const content = html`<div${idAttr}${swapAttr} class="flex items-center gap-3 text-sm">
    <div class="flex items-center gap-2" id="${indicatorId}">
      ${
        refreshOn
          ? html`<span class="loading loading-spinner loading-xs"></span>
          <span>Auto-refreshing…</span>`
          : html`<span class="opacity-60">Auto-refresh off</span>`
      }
    </div>
    <a class="btn btn-ghost btn-xs" href="${toggleHref}">${
      refreshOn ? "Turn off" : "Turn on"
    }</a>
  </div>`;
  return content as unknown as HtmlEscapedString;
}
