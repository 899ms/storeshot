#!/usr/bin/env node
/**
 * Build a static GitHub Pages site that mirrors the repo README.
 * Output: _site/index.html (plus rewritten asset URLs to raw.githubusercontent.com).
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

const repo = process.env.GITHUB_REPOSITORY || "stackwares/storeshot-electron";
const branch = process.env.GITHUB_REF_NAME && process.env.GITHUB_EVENT_NAME === "push"
  ? process.env.GITHUB_REF_NAME
  : "main";
const token = process.env.GITHUB_TOKEN;
const outDir = path.resolve(process.env.OUT_DIR || "_site");

const apiUrl = `https://api.github.com/repos/${repo}/readme`;
const headers = {
  Accept: "application/vnd.github.html+json",
  "X-GitHub-Api-Version": "2022-11-28",
};
if (token) headers.Authorization = `Bearer ${token}`;

const res = await fetch(apiUrl, { headers });
if (!res.ok) {
  throw new Error(`GitHub README fetch failed: ${res.status} ${await res.text()}`);
}

let html = await res.text();
const rawBase = `https://raw.githubusercontent.com/${repo}/${branch}/`;

html = html
  .replace(/src="(?!(?:https?:)?\/\/)([^"]+)"/g, (_, src) => `src="${rawBase}${src.replace(/^\.?\//, "")}"`)
  .replace(/href="(?!(?:https?:|#|mailto:|\/\/)[^"]*)\.?\/([^"]+\.(?:png|jpe?g|gif|webp|svg))"/gi, (_, p) => `href="${rawBase}${p}"`);

const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>StoreShot — README</title>
  <meta name="description" content="StoreShot README mirrored from GitHub." />
  <link rel="canonical" href="https://stackwares.github.io/storeshot-electron/" />
  <style>
    :root {
      --bg: #ffffff;
      --fg: #1f2328;
      --muted: #656d76;
      --border: #d0d7de;
      --canvas: #f6f8fa;
      --link: #0969da;
      --code-bg: #f6f8fa;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117;
        --fg: #e6edf3;
        --muted: #8d96a0;
        --border: #30363d;
        --canvas: #161b22;
        --link: #4493f8;
        --code-bg: #161b22;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
      font-size: 16px;
      line-height: 1.5;
      color: var(--fg);
      background: var(--bg);
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.65rem 1.25rem;
      border-bottom: 1px solid var(--border);
      background: color-mix(in srgb, var(--bg) 92%, transparent);
      backdrop-filter: blur(8px);
    }
    .topbar a {
      color: var(--fg);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.95rem;
    }
    .topbar a:hover { color: var(--link); }
    .topbar .muted { color: var(--muted); font-weight: 400; font-size: 0.85rem; }
    main {
      width: min(980px, calc(100% - 2rem));
      margin: 0 auto;
      padding: 2rem 0 4rem;
    }
    .status {
      font-size: 0.9rem;
      color: var(--muted);
      margin-bottom: 1.25rem;
    }
    .status a { color: var(--link); }
    .markdown-body img { max-width: 100%; height: auto; border-radius: 6px; }
    .markdown-body h1, .markdown-body h2 {
      padding-bottom: 0.3em;
      border-bottom: 1px solid var(--border);
      line-height: 1.25;
    }
    .markdown-body h3 { line-height: 1.25; margin-top: 1.5em; }
    .markdown-body p, .markdown-body ul, .markdown-body ol { margin: 0 0 1rem; }
    .markdown-body li + li { margin-top: 0.25em; }
    .markdown-body a { color: var(--link); }
    .markdown-body code {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 85%;
      background: var(--code-bg);
      border-radius: 6px;
      padding: 0.15em 0.4em;
    }
    .markdown-body pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 1rem;
      overflow-x: auto;
    }
    .markdown-body pre code {
      background: transparent;
      padding: 0;
      font-size: 85%;
    }
    .markdown-body table {
      border-collapse: collapse;
      width: 100%;
      margin: 0 0 1rem;
      display: block;
      overflow-x: auto;
    }
    .markdown-body th, .markdown-body td {
      border: 1px solid var(--border);
      padding: 0.45rem 0.75rem;
    }
    .markdown-body th { background: var(--canvas); }
    .markdown-body blockquote {
      margin: 0 0 1rem;
      padding: 0 1em;
      color: var(--muted);
      border-left: 0.25em solid var(--border);
    }
  </style>
</head>
<body>
  <header class="topbar">
    <a href="https://github.com/${repo}">${repo}</a>
    <a class="muted" href="https://github.com/${repo}#readme">View on GitHub</a>
  </header>
  <main>
    <p class="status">
      Built from <a href="https://github.com/${repo}/blob/${branch}/README.md">README.md</a>
      on <code>${branch}</code>.
    </p>
    <article class="markdown-body">
${html}
    </article>
  </main>
</body>
</html>
`;

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "index.html"), page, "utf8");
console.log(`Wrote ${path.join(outDir, "index.html")} (${page.length} bytes) from ${apiUrl}`);
