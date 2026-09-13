// StoreShot MCP server — local stdio JSON-RPC 2.0 (newline-delimited).
//
// Run: bun src/mcp/server.ts   (or: bun run mcp)
// Logs go to stderr ONLY — stdout carries protocol frames (MCP stdio rule).
// Every file op is gated by an explicit absolute workspace path.

import { EXPORT_TARGETS } from "../lib/export-options";
import type { ProjectState } from "../lib/types";
import { buildExportPlan, runRenderExport } from "./export";
import { listUploads, loadProject, McpError, saveProject, storeUpload } from "./project-io";
import { runProviderTranslation } from "./translate-job";
import {
  addSlide,
  copySlides,
  deleteSlide,
  getProjectSummary,
  lintDeck,
  listSlides,
  previewExportPaths,
  previewTranslation,
  renameSlide,
  reorderSlides,
  resolveDevice,
  setBackground,
  setLayout,
  setLocales,
  setScreenshot,
  updateCopy,
} from "./tools";

const SERVER_VERSION = "0.1.0";

type Json = unknown;
type Handler = (params: Record<string, Json>) => Promise<Json> | Json;

function needWs(params: Record<string, Json>): string {
  if (typeof params.workspace !== "string" || !params.workspace.trim()) {
    throw new McpError("workspace (absolute path) is required");
  }
  return params.workspace;
}

async function needProject(params: Record<string, Json>): Promise<{ ws: string; state: ProjectState }> {
  const ws = needWs(params);
  const state = await loadProject(ws);
  if (!state) throw new McpError("No project file in this workspace yet (open it in StoreShot once first)");
  return { ws, state };
}

const TOOLS: { name: string; description: string; inputSchema: Record<string, Json> }[] = [
  { name: "get_project", description: "Read deck summary (counts, locales, device, fonts).", inputSchema: { type: "object", properties: { workspace: { type: "string" } }, required: ["workspace"] } },
  { name: "list_slides", description: "List slides with copy and screenshot paths.", inputSchema: { type: "object", properties: { workspace: { type: "string" }, device: { type: "string" } }, required: ["workspace"] } },
  { name: "list_locales", description: "List project locales and active locale.", inputSchema: { type: "object", properties: { workspace: { type: "string" } }, required: ["workspace"] } },
  { name: "list_uploads", description: "List files in screenshots/uploads/.", inputSchema: { type: "object", properties: { workspace: { type: "string" } }, required: ["workspace"] } },
  { name: "preview_export_paths", description: "Compute export ZIP paths (no rendering).", inputSchema: { type: "object", properties: { workspace: { type: "string" } } , required: ["workspace"]} },
  { name: "update_copy", description: "Set label/headline/text:<id> copy for a locale.", inputSchema: { type: "object", properties: { workspace: { type: "string" }, slideId: { type: "string" }, field: { type: "string" }, locale: { type: "string" }, value: { type: "string" } }, required: ["workspace", "slideId", "field", "locale", "value"] } },
  { name: "add_slide", description: "Append a slide.", inputSchema: { type: "object", properties: { workspace: { type: "string" }, layout: { type: "string" }, name: { type: "string" } }, required: ["workspace"] } },
  { name: "rename_slide", description: "Rename a screen.", inputSchema: { type: "object", properties: { workspace: { type: "string" }, slideId: { type: "string" }, name: { type: "string" } }, required: ["workspace", "slideId", "name"] } },
  { name: "set_layout", description: "Change a slide layout.", inputSchema: { type: "object", properties: { workspace: { type: "string" }, slideId: { type: "string" }, layout: { type: "string" } }, required: ["workspace", "slideId", "layout"] } },
  { name: "reorder_slides", description: "Reorder deck (all ids, new order).", inputSchema: { type: "object", properties: { workspace: { type: "string" }, orderedIds: { type: "array" } }, required: ["workspace", "orderedIds"] } },
  { name: "delete_slide", description: "Delete a slide (needs confirm:true).", inputSchema: { type: "object", properties: { workspace: { type: "string" }, slideId: { type: "string" }, confirm: { type: "boolean" } }, required: ["workspace", "slideId"] } },
  { name: "copy_slides", description: "Copy screens from one device onto another (elements included; layout adapted). Replace needs confirm:true.", inputSchema: { type: "object", properties: { workspace: { type: "string" }, from: { type: "string" }, to: { type: "array" }, mode: { type: "string" }, slideIds: { type: "array" }, confirm: { type: "boolean" } }, required: ["workspace", "from", "to"] } },
  { name: "set_locales", description: "Replace locale list (must keep en; removals need confirm:true).", inputSchema: { type: "object", properties: { workspace: { type: "string" }, locales: { type: "array" } }, required: ["workspace", "locales"] } },
  { name: "set_background", description: "Set project or per-slide background (theme|mesh|image).", inputSchema: { type: "object", properties: { workspace: { type: "string" }, kind: { type: "string" } }, required: ["workspace", "kind"] } },
  { name: "set_screenshot", description: "Point a slide at an uploads/... path (upload_image first).", inputSchema: { type: "object", properties: { workspace: { type: "string" }, slideId: { type: "string" }, path: { type: "string" } }, required: ["workspace", "slideId", "path"] } },
  { name: "upload_image", description: "Store a data: PNG/JPG into screenshots/uploads/.", inputSchema: { type: "object", properties: { workspace: { type: "string" }, dataUrl: { type: "string" } }, required: ["workspace", "dataUrl"] } },
  { name: "lint_deck", description: "Report missing copy/screenshots.", inputSchema: { type: "object", properties: { workspace: { type: "string" } }, required: ["workspace"] } },
  { name: "preview_translation", description: "Count untranslated units for a target locale (agent translates, then update_copy).", inputSchema: { type: "object", properties: { workspace: { type: "string" }, targetLocale: { type: "string" } }, required: ["workspace", "targetLocale"] } },
  { name: "export_manifest", description: "Plan a headless export (units, zip paths, skips) without rendering.", inputSchema: { type: "object", properties: { workspace: { type: "string" } }, required: ["workspace"] } },
  { name: "render_export", description: "Headless PNG+ZIP export via the built-in renderer (needs python3+PIL). Writes under screenshots/exports/.", inputSchema: { type: "object", properties: { workspace: { type: "string" } }, required: ["workspace"] } },
  { name: "translate_locale", description: "Translate the current-device deck via your OpenRouter-compatible provider. apiKey is per-call only and never stored.", inputSchema: { type: "object", properties: { workspace: { type: "string" }, targetLocale: { type: "string" }, model: { type: "string" }, apiKey: { type: "string" } }, required: ["workspace", "targetLocale", "model", "apiKey"] } },
];

const toolHandlers: Record<string, Handler> = {
  get_project: async (p) => getProjectSummary((await needProject(p)).state),
  list_slides: async (p) => listSlides((await needProject(p)).state, p.device),
  list_locales: async (p) => {
    const { state } = await needProject(p);
    return { locales: state.locales, locale: state.locale };
  },
  list_uploads: async (p) => ({ uploads: await listUploads(needWs(p)) }),
  preview_export_paths: async (p) => previewExportPaths((await needProject(p)).state, p),
  update_copy: async (p) => {
    const { ws, state } = await needProject(p);
    const next = updateCopy(state, p as { slideId: unknown; field: unknown; locale: unknown; value: unknown; device?: unknown });
    await saveProject(ws, next);
    return { ok: true };
  },
  add_slide: async (p) => {
    const { ws, state } = await needProject(p);
    const { state: next, slideId } = addSlide(state, p);
    await saveProject(ws, next);
    return { ok: true, slideId };
  },
  rename_slide: async (p) => {
    const { ws, state } = await needProject(p);
    await saveProject(ws, renameSlide(state, p as { slideId: unknown; name: unknown; device?: unknown }));
    return { ok: true };
  },
  set_layout: async (p) => {
    const { ws, state } = await needProject(p);
    await saveProject(ws, setLayout(state, p as { slideId: unknown; layout: unknown; device?: unknown }));
    return { ok: true };
  },
  reorder_slides: async (p) => {
    const { ws, state } = await needProject(p);
    await saveProject(ws, reorderSlides(state, p as { orderedIds: unknown; device?: unknown }));
    return { ok: true };
  },
  delete_slide: async (p) => {
    const { ws, state } = await needProject(p);
    await saveProject(ws, deleteSlide(state, p as { slideId: unknown; device?: unknown; confirm?: unknown }));
    return { ok: true };
  },
  copy_slides: async (p) => {
    const { ws, state } = await needProject(p);
    const result = copySlides(state, p);
    await saveProject(ws, result.state);
    return { ok: true, copied: result.copied, firstSlideId: result.firstSlideId, targets: result.targets };
  },
  set_locales: async (p) => {
    const { ws, state } = await needProject(p);
    await saveProject(ws, setLocales(state, p as { locales: unknown; confirm?: unknown }));
    return { ok: true };
  },
  set_background: async (p) => {
    const { ws, state } = await needProject(p);
    await saveProject(
      ws,
      setBackground(state, p as { kind: unknown; colors?: unknown; src?: unknown; slideId?: unknown; device?: unknown; opacity?: unknown; blur?: unknown; angle?: unknown }),
    );
    return { ok: true };
  },
  set_screenshot: async (p) => {
    const { ws, state } = await needProject(p);
    await saveProject(ws, setScreenshot(state, p as { slideId: unknown; path: unknown; secondary?: unknown; device?: unknown }));
    return { ok: true };
  },
  upload_image: async (p) => ({ path: await storeUpload(needWs(p), p.dataUrl) }),
  lint_deck: async (p) => lintDeck((await needProject(p)).state, p.device),
  preview_translation: async (p) => previewTranslation((await needProject(p)).state, p as { targetLocale: unknown; sourceLocale?: unknown; device?: unknown }),
  export_manifest: async (p) => {
    const { state } = await needProject(p);
    const plan = buildExportPlan(state, p);
    return {
      device: plan.device,
      preset: plan.preset,
      store: plan.store,
      connected: plan.connected,
      canvas: plan.canvas,
      totalUnits: plan.units.length,
      zipPaths: plan.units.map((u) => u.zipPath),
      skipped: plan.skipped,
      warnings: plan.warnings,
    };
  },
  render_export: async (p) => {
    const { ws, state } = await needProject(p);
    const plan = buildExportPlan(state, p);
    const manifest = await runRenderExport(ws, state, plan, { outDir: p.outDir });
    if (!manifest.ok) throw new McpError(`Render failed: ${manifest.error ?? "unknown error"}`);
    return {
      zip: manifest.zip,
      outDir: manifest.outDir,
      rendered: manifest.units?.length ?? 0,
      files: (manifest.units ?? []).map((u) => ({ zipPath: u.zipPath, file: u.file, w: u.w, h: u.h })),
      missing: manifest.missing ?? [],
      partial: manifest.partial ?? false,
      warnings: [...plan.warnings, ...(manifest.warnings ?? [])],
    };
  },
  translate_locale: async (p) => {
    const { ws, state } = await needProject(p);
    const { state: next, report } = await runProviderTranslation(state, {
      targetLocale: p.targetLocale,
      sourceLocale: p.sourceLocale,
      device: p.device,
      baseUrl: p.baseUrl,
      model: p.model,
      apiKey: p.apiKey,
      overwrite: p.overwrite,
      timeoutMs: p.timeoutMs,
    });
    if (report.applied) await saveProject(ws, next);
    return report;
  },
};

function uriFor(ws: string, rest: string): string {
  return `storeshot://${encodeURIComponent(ws)}/${rest}`;
}

function parseUri(uri: unknown): { ws: string; rest: string } {
  if (typeof uri !== "string" || !uri.startsWith("storeshot://")) throw new McpError("Bad resource URI");
  const body = uri.slice("storeshot://".length);
  const slash = body.indexOf("/");
  if (slash < 0) throw new McpError("Bad resource URI");
  return { ws: decodeURIComponent(body.slice(0, slash)), rest: body.slice(slash + 1) };
}

async function readResource(uri: unknown): Promise<{ contents: { uri: string; mimeType: string; text: string }[] }> {
  const { ws, rest } = parseUri(uri);
  const state = await loadProject(ws);
  if (!state) throw new McpError("No project file in this workspace yet");
  const text = (v: Json) => JSON.stringify(v, null, 2);
  if (rest === "project") return { contents: [{ uri: String(uri), mimeType: "application/json", text: text(state) }] };
  if (rest === "locales") return { contents: [{ uri: String(uri), mimeType: "application/json", text: text({ locales: state.locales, locale: state.locale }) }] };
  if (rest === "export-targets") return { contents: [{ uri: String(uri), mimeType: "application/json", text: text(EXPORT_TARGETS) }] };
  if (rest === "uploads") return { contents: [{ uri: String(uri), mimeType: "application/json", text: text({ uploads: await listUploads(ws) }) }] };
  if (rest === "lint") return { contents: [{ uri: String(uri), mimeType: "application/json", text: text(lintDeck(state)) }] };
  if (rest === "translation-status") {
    const status = state.locales
      .filter((l) => l !== "en")
      .map((l) => {
        const prev = previewTranslation(state, { targetLocale: l });
        return { locale: l, pendingUnits: prev.pendingUnits };
      });
    return { contents: [{ uri: String(uri), mimeType: "application/json", text: text({ status }) }] };
  }
  if (rest === "slides/phone" || rest === "slides/tablet" || rest === "slides/desktop" || rest === "slides/iphone" || rest === "slides/ipad") {
    const key = rest.split("/")[1];
    const device = key === "iphone" ? "phone" : key === "ipad" ? "tablet" : key;
    return { contents: [{ uri: String(uri), mimeType: "application/json", text: text(listSlides(state, device)) }] };
  }
  throw new McpError(`Unknown resource: ${rest} (project|slides/phone|slides/tablet|slides/desktop|locales|export-targets|uploads|lint|translation-status)`);
}

const PROMPTS = [
  { name: "new-locale-deck", description: "Scaffold copy tasks for a new locale from en (agent translates, then update_copy)." },
  { name: "locale-launch-checklist", description: "Pre-export QA checklist for a locale." },
  { name: "aso-copy-review", description: "Review en source copy for store style." },
  { name: "screenshot-brief", description: "Art-direction brief for producing per-screen screenshots (pairs with image-gen tools)." },
];

async function getPrompt(name: unknown, args: Record<string, Json>): Promise<{ messages: { role: string; content: { type: string; text: string } }[] }> {
  const ws = typeof args.workspace === "string" ? args.workspace : "";
  const state = ws ? await loadProject(ws) : null;
  if (name === "new-locale-deck") {
    const target = typeof args.targetLocale === "string" ? args.targetLocale : "<locale>";
    const prev = state ? previewTranslation(state, { targetLocale: target }) : null;
    return { messages: [{ role: "user", content: { type: "text", text: `Add locale ${target} with set_locales (confirm if removing any), then fill ${prev ? prev.pendingUnits : "?"} pending units via update_copy. Keep ALL-CAPS styling, preserve \\n and {locale}.` } }] };
  }
  if (name === "locale-launch-checklist") {
    const target = typeof args.targetLocale === "string" ? args.targetLocale : "<locale>";
    return { messages: [{ role: "user", content: { type: "text", text: `Before exporting ${target}: 1) lint_deck 2) preview_translation 3) preview_export_paths 4) fix gaps via update_copy. Never export en/es source-only locales.` } }] };
  }
  if (name === "aso-copy-review") {
    const slides = state ? listSlides(state).slides.map((s) => `${s.name}: ${(s.headline as Record<string, string>).en ?? ""}`).join("\n") : "(open a workspace first)";
    return { messages: [{ role: "user", content: { type: "text", text: `Review these headlines for punchy App Store style:\n${slides}` } }] };
  }
  if (name === "screenshot-brief") {
    let device: "phone" | "tablet" | "desktop" = "phone";
    try {
      device = resolveDevice(typeof args.device === "string" ? args.device : undefined, "phone");
    } catch {
      device = "phone";
    }
    const dims = device === "tablet" ? "2064x2752" : device === "desktop" ? "2880x1800" : "1320x2868";
    const brief = state
      ? listSlides(state, device).slides.map((s, i) => {
          const shot = typeof s.screenshot === "string" && s.screenshot ? s.screenshot : "(MISSING — generate this one)";
          return `${i + 1}. ${s.name} [${s.layout}]: ${(s.headline as Record<string, string>).en ?? ""} — shot: ${shot}`;
        }).join("\n")
      : "(open a workspace first)";
    return { messages: [{ role: "user", content: { type: "text", text: `Produce ${device} screenshots at exactly ${dims}px${device === "desktop" ? " (landscape)" : " (portrait)"}. One per screen; UIs must be legible at full bleed since frames crop with object-fit:cover from the top:\n${brief}\nStore finished files with upload_image, then point each screen at its file with set_screenshot.` } }] };
  }
  throw new McpError(`Unknown prompt: ${String(name)}`);
}

function result(id: Json, payload: Json) {
  return JSON.stringify({ jsonrpc: "2.0", id, result: payload });
}

function failure(id: Json, code: number, message: string) {
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}

async function dispatch(msg: Record<string, Json>): Promise<string | null> {
  const id = (msg as { id?: Json }).id;
  const method = (msg as { method?: Json }).method;
  if (msg.jsonrpc !== "2.0" || typeof method !== "string") return id === undefined ? null : failure(id ?? null, -32600, "Invalid Request");
  const params = (msg.params ?? {}) as Record<string, Json>;
  try {
    if (method === "initialize") {
      return result(id, { protocolVersion: "2024-11-05", capabilities: { tools: {}, resources: {}, prompts: {} }, serverInfo: { name: "storeshot-mcp", version: SERVER_VERSION } });
    }
    if (method === "ping") return result(id, {});
    if (method === "notifications/initialized" || method.startsWith("notifications/")) return null;
    if (method === "tools/list") return result(id, { tools: TOOLS });
    if (method === "tools/call") {
      const name = (params as { name?: Json }).name;
      if (typeof name !== "string" || !toolHandlers[name]) return failure(id, -32602, `Unknown tool: ${String(name)}`);
      const args = ((params as { arguments?: Json }).arguments ?? {}) as Record<string, Json>;
      try {
        const output = await toolHandlers[name](args);
        return result(id, { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] });
      } catch (e) {
        if (e instanceof McpError) return result(id, { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true });
        throw e;
      }
    }
    if (method === "resources/list") {
      const ws = typeof params.workspace === "string" ? params.workspace : "{workspace}";
      const rest = ["project", "slides/phone", "slides/tablet", "slides/desktop", "locales", "export-targets", "uploads", "lint", "translation-status"];
      return result(id, { resources: rest.map((r) => ({ uri: uriFor(ws, r), name: r, mimeType: "application/json" })) });
    }
    if (method === "resources/read") return result(id, await readResource(params.uri));
    if (method === "prompts/list") return result(id, { prompts: PROMPTS });
    if (method === "prompts/get") return result(id, await getPrompt(params.name, ((params.arguments ?? {}) as Record<string, Json>)));
    return failure(id, -32601, `Method not found: ${method}`);
  } catch (e) {
    if (e instanceof McpError) return failure(id, -32602, e.message);
    return failure(id, -32603, e instanceof Error ? e.message : String(e));
  }
}

async function main() {
  if (process.argv.includes("--help")) {
    process.stderr.write("storeshot-mcp: stdio MCP server. Run: bun src/mcp/server.ts\n");
    return;
  }
  process.stdin.setEncoding("utf8");
  let buf = "";
  for await (const chunk of process.stdin) {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as Json;
        const out = Array.isArray(msg)
          ? (async () => {
              const parts: string[] = [];
              for (const m of msg) {
                const r = await dispatch(m as Record<string, Json>);
                if (r !== null) parts.push(r);
              }
              return parts.length > 0 ? `[${parts.join(",")}]` : null;
            })()
          : dispatch(msg as Record<string, Json>);
        const text = await out;
        if (text !== null) process.stdout.write(text + "\n");
      } catch {
        process.stdout.write(failure(null, -32700, "Parse error") + "\n");
      }
    }
  }
}

void main().catch((e) => {
  process.stderr.write(`storeshot-mcp fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});

