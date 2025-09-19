import { readFileSync } from "node:fs";
import { html, raw } from "hono/html";
import Prism from "prismjs";

// Load additional language support
import "prismjs/components/prism-json.js";
import "prismjs/components/prism-log.js";
import "prismjs/components/prism-bash.js";
import "prismjs/components/prism-javascript.js";
import "prismjs/components/prism-typescript.js";

// Load Prism dark theme CSS - Okaidia has a darker background
const prismThemePath = require.resolve("prismjs/themes/prism-okaidia.min.css");
const prismTheme = readFileSync(prismThemePath, "utf-8");

export type CodeBlockProps = {
  code: string;
  language?: "json" | "log" | "javascript" | "typescript" | "bash" | "text";
  className?: string;
};

export function CodeBlock({
  code,
  language = "text",
  className = "",
}: CodeBlockProps) {
  let highlightedCode: string;
  let displayCode = code;

  // Format JSON if needed
  if (language === "json") {
    try {
      const parsed = JSON.parse(code);
      displayCode = JSON.stringify(parsed, null, 2);
    } catch {
      // If not valid JSON, display as-is
    }
  }

  // Determine the actual language for Prism
  const prismLang = language === "text" ? "plaintext" : language;

  // Highlight the code
  const grammar = Prism.languages[prismLang] || Prism.languages.plaintext;
  if (grammar) {
    highlightedCode = Prism.highlight(displayCode, grammar, prismLang);
  } else {
    // Fallback to escaping HTML
    highlightedCode = displayCode
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Inject Prism theme CSS
  const prismStyles = html`<style>${prismTheme}</style>`;

  return html`
    ${prismStyles}
    <div class="relative group ${className} min-w-0">
      <div class="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          class="btn btn-xs btn-ghost bg-gray-700 hover:bg-gray-600 text-gray-300"
          onclick="navigator.clipboard.writeText(this.closest('.group').querySelector('pre').textContent)"
          title="Copy to clipboard"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
      <div class="overflow-x-auto rounded-lg border border-gray-800" style="width: 100%; max-width: 100%;">
        <pre class="p-4 m-0 text-sm" style="background: #272822; color: #f8f8f2; width: 100%; min-width: max-content;"><code class="language-${prismLang} whitespace-pre">${raw(highlightedCode)}</code></pre>
      </div>
    </div>
  `;
}
