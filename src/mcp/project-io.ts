// StoreShot MCP file layer — workspace-gated project load/save + uploads.
//
// Mirrors the guards in src/app/api/project/route.ts (shape + 10MB cap,
// atomic tmp+rename) and src/app/api/upload/route.ts (PNG/JPG, 8MB cap,
// hash-named files). No network, no auth: stdin/stdio local use only.

import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  ensureScreenshotsDir,
  legacyProjectFileFor,
  projectFileFor,
  resolveWorkspaceDir,
  uploadsDirFor,
} from "../lib/workspace-server";
import type { ProjectState } from "../lib/types";

export const MAX_PROJECT_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export class McpError extends Error {}

export function workspaceDir(ws: unknown): string {
  // Single choke point: absolute paths only, NUL rejected (see workspace-server).
  return resolveWorkspaceDir(ws);
}

export function isProjectShape(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const b = body as Record<string, unknown>;
  if (!b.slidesByDevice || typeof b.slidesByDevice !== "object" || Array.isArray(b.slidesByDevice)) {
    return false;
  }
  if (!Array.isArray(b.locales) || !b.locales.every((l) => typeof l === "string")) return false;
  return true;
}

const LEGACY_DECKS: Record<string, string[]> = {
  phone: ["phone", "iphone"],
  tablet: ["tablet", "ipad"],
  desktop: ["desktop"],
};

/** Normalize raw file data the way the editor's mergeWithDefaults does:
 *  legacy iphone/ipad deck keys and device values migrate forward. Saving
 *  the normalized form matches what the app itself writes back. */
export function normalizeProjectData(parsed: Record<string, unknown>): ProjectState {
  const rawDecks = parsed.slidesByDevice as Record<string, unknown>;
  const decks: Record<string, unknown> = {};
  for (const [device, keys] of Object.entries(LEGACY_DECKS)) {
    for (const key of keys) {
      if (Array.isArray(rawDecks[key])) {
        decks[device] = rawDecks[key];
        break;
      }
    }
  }
  const rawDevice = parsed.device as string | undefined;
  const device = rawDevice === "tablet" || rawDevice === "ipad"
    ? "tablet"
    : rawDevice === "desktop"
      ? "desktop"
      : "phone";
  return { ...(parsed as object), slidesByDevice: decks, device } as ProjectState;
}

export async function loadProject(ws: string): Promise<ProjectState | null> {
  const dir = workspaceDir(ws);
  for (const file of [projectFileFor(dir), legacyProjectFileFor(dir)]) {
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!isProjectShape(parsed)) throw new McpError(`Project file has invalid shape: ${file}`);
      return normalizeProjectData(parsed as Record<string, unknown>);
    } catch (e) {
      if (e instanceof McpError) throw e;
      if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
      if (e instanceof SyntaxError) throw new McpError(`Project file is not valid JSON: ${file}`);
      throw e;
    }
  }
  return null;
}

export async function saveProject(ws: string, state: unknown): Promise<void> {
  if (!isProjectShape(state)) {
    throw new McpError("Invalid project shape (need slidesByDevice object + string[] locales)");
  }
  const pretty = JSON.stringify(state, null, 2) + "\n";
  if (Buffer.byteLength(pretty, "utf8") > MAX_PROJECT_BYTES) {
    throw new McpError("Project too large (>10MB)");
  }
  const dir = workspaceDir(ws);
  await ensureScreenshotsDir(dir);
  const target = projectFileFor(dir);
  const tmp = `${target}.tmp-${randomUUID()}`;
  try {
    await fs.writeFile(tmp, pretty, "utf8");
    await fs.rename(tmp, target);
  } catch (e) {
    await fs.unlink(tmp).catch(() => {});
    throw e;
  }
}

export async function listUploads(ws: string): Promise<string[]> {
  const dir = workspaceDir(ws);
  const abs = uploadsDirFor(dir);
  try {
    const entries = await fs.readdir(abs);
    return entries.filter((f) => f.endsWith(".png") || f.endsWith(".jpg")).sort();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
};

function parseDataUrl(dataUrl: string): { mime: string; bytes: Buffer } {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new McpError("Unsupported data URL (want data:<mime>;base64,...)");
  return { mime: m[1].toLowerCase(), bytes: Buffer.from(m[2], "base64") };
}

/** Store a data-URL image in screenshots/uploads/, same rules as /api/upload. */
export async function storeUpload(ws: string, dataUrl: unknown): Promise<string> {
  if (typeof dataUrl !== "string" || !dataUrl) throw new McpError("Missing dataUrl");
  if (dataUrl.length > 12 * 1024 * 1024) throw new McpError("Image too large (>8MB)");
  const parsed = parseDataUrl(dataUrl);
  const ext = MIME_EXT[parsed.mime];
  if (!ext) throw new McpError(`Unsupported mime: ${parsed.mime} (png/jpg only)`);
  if (parsed.bytes.byteLength > MAX_IMAGE_BYTES) throw new McpError("Image too large (>8MB)");
  const dir = workspaceDir(ws);
  const absDir = uploadsDirFor(dir);
  const hash = createHash("sha1").update(parsed.bytes).digest("hex").slice(0, 16);
  const filename = `${hash}.${ext}`;
  await fs.mkdir(absDir, { recursive: true });
  const absFile = path.join(absDir, filename);
  try {
    await fs.access(absFile);
  } catch {
    await fs.writeFile(absFile, parsed.bytes);
  }
  return `uploads/${filename}`;
}
