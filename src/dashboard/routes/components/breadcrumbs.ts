import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import { withBasePath } from "../utils/path";

export type BreadcrumbItem = {
  label: string;
  href?: string;
  className?: string;
};

export function Breadcrumbs({
  items,
  basePath,
  rightContent,
}: {
  items: BreadcrumbItem[];
  basePath: string;
  rightContent?: HtmlEscapedString | null;
}) {
  const crumbs = items.length
    ? html`<div class="breadcrumbs">
        <ul>
          ${items.map((item, index) => {
            const isLast = index === items.length - 1;
            const href = item.href ? withBasePath(basePath, item.href) : null;
            return html`<li>
              ${
                href && !isLast
                  ? html`<a href="${href}" class="underline ${item.className ?? ""}">${item.label}</a>`
                  : html`<span class="underline ${item.className ?? ""}">${item.label}</span>`
              }
            </li>`;
          })}
        </ul>
      </div>`
    : html``;

  return html`<div class="flex items-center justify-between mb-3 text-sm">
    ${crumbs}
    <div>${rightContent ?? ""}</div>
  </div>`;
}
