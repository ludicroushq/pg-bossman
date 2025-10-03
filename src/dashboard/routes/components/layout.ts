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
        <script src="https://unpkg.com/htmx.org@1.9.12"></script>
        <link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css" />
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
        <script src="https://cdn.jsdelivr.net/npm/date-fns@4.1.0/cdn.min.js"></script>
        <script>
          // Global date formatting functions
          window.formatDurations = function(root) {
            const elements = (root || document).querySelectorAll('[data-duration]');
            elements.forEach(el => {
              if (el.textContent && el.textContent.trim()) return; // Already formatted
              const seconds = parseInt(el.getAttribute('data-duration'));
              if (!isNaN(seconds) && typeof dateFns !== 'undefined') {
                const duration = dateFns.intervalToDuration({ start: 0, end: seconds * 1000 });
                el.textContent = dateFns.formatDuration(duration);
              } else {
                el.textContent = seconds + 's';
              }
            });
          };

          window.formatRelativeTimes = function(root) {
            const elements = (root || document).querySelectorAll('[data-relative-time]');
            elements.forEach(el => {
              if (el.textContent && el.textContent.trim()) return; // Already formatted
              const isoString = el.getAttribute('data-relative-time');
              if (isoString && typeof dateFns !== 'undefined') {
                const date = new Date(isoString);
                el.textContent = dateFns.formatDistanceToNow(date, { addSuffix: true });
              }
            });
          };

          window.formatDurationBetween = function(root) {
            const elements = (root || document).querySelectorAll('[data-duration-between-start]');
            elements.forEach(el => {
              if (el.textContent && el.textContent.trim()) return; // Already formatted
              const startIso = el.getAttribute('data-duration-between-start');
              const endIso = el.getAttribute('data-duration-between-end');
              const showIn = el.getAttribute('data-show-in') !== 'false';
              if (startIso && endIso && typeof dateFns !== 'undefined') {
                const start = new Date(startIso);
                const end = new Date(endIso);
                const duration = dateFns.intervalToDuration({ start, end });
                const formatted = dateFns.formatDuration(duration, {
                  format: ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds']
                });
                el.textContent = (showIn ? 'in ' : '') + (formatted || '0 seconds');
              }
            });
          };

          // Format on page load and set up event listeners
          document.addEventListener('DOMContentLoaded', function() {
            formatDurations();
            formatRelativeTimes();
            formatDurationBetween();

            // Format after htmx swaps
            document.body.addEventListener('htmx:afterSwap', function(evt) {
              formatDurations(evt.detail.target);
              formatRelativeTimes(evt.detail.target);
              formatDurationBetween(evt.detail.target);
            });
          });
        </script>
      </head>
      <body class="min-h-screen bg-base-200">
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
