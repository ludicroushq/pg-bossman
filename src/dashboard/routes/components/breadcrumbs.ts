import { html } from "hono/html";
import { withBasePath } from "../utils/path";

export type BreadcrumbItem = {
  label: string;
  href?: string;
  className?: string;
};

export function Breadcrumbs({
  items,
  basePath,
}: {
  items: BreadcrumbItem[];
  basePath: string;
}) {
  if (!items.length) {
    return html``;
  }

  return html`
    <div class="breadcrumbs text-sm mb-4">
      <ul>
        ${items.map((item, index) => {
          const isLast = index === items.length - 1;
          const href = item.href ? withBasePath(basePath, item.href) : null;

          return html`
            <li>
              ${
                href && !isLast
                  ? html`<a href="${href}" class="link link-hover ${item.className ?? ""}">${item.label}</a>`
                  : html`<span class="${item.className ?? ""}">${item.label}</span>`
              }
            </li>
          `;
        })}
      </ul>
    </div>
  `;
}
