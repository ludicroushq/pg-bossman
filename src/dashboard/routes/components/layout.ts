import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

export function Layout({
  children,
  basePath = "",
  title = "pg-bossman Dashboard",
}: {
  children: Promise<HtmlEscapedString> | HtmlEscapedString;
  basePath?: string;
  title?: string;
}) {
  const homeHref = `${basePath || ""}`;
  return html`
    <html data-theme="light" lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <title>${title}</title>
        <script src="https://unpkg.com/htmx.org@2.0.3"></script>
        <script src="https://unpkg.com/idiomorph@0.3.0/dist/idiomorph-ext.min.js"></script>
        <link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css" />
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      </head>
      <body class="min-h-screen bg-base-200" hx-ext="morph">
        <nav class="navbar bg-base-100 shadow-sm sticky top-0 z-10">
          <div class="container mx-auto max-w-6xl px-4 navbar">
            <div class="navbar-start">
              <a href="${homeHref}" class="btn btn-ghost text-xl">pg-bossman</a>
            </div>
            <div class="navbar-end">
              <ul class="menu menu-horizontal px-1">
                <li><a href="${homeHref}" class="menu-active">Queues</a></li>
              </ul>
            </div>
          </div>
        </nav>
        <main class="container mx-auto p-4 max-w-6xl">${children}</main>
      </body>
    </html>
  `;
}
