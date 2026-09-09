import { promises as fs } from "node:fs";
import path from "node:path";

// Server-side workspace helpers. A workspace is any user-chosen absolute
// directory; the app keeps all of its own data inside a `screenshots/`
// subfolder of the workspace (`screenshots/app-store-screenshots.json` and
// `screenshots/uploads/`), so the rest of the user's project is untouched.

export const PROJECT_FILENAME = "app-store-screenshots.json";
export const UPLOADS_DIRNAME = "uploads";
export const SCREENSHOTS_DIRNAME = "screenshots";

export function resolveWorkspaceDir(ws: unknown): string {
  if (typeof ws !== "string" || !ws.trim()) {
    throw new Error("Missing workspace path");
  }
  if (ws.includes("\0")) {
    throw new Error("Invalid workspace path");
  }
  const normalized = path.normalize(ws.trim());
  if (!path.isAbsolute(normalized)) {
    throw new Error("Workspace path must be absolute");
  }
  return normalized;
}

export function screenshotsDirFor(wsDir: string): string {
  return path.join(wsDir, SCREENSHOTS_DIRNAME);
}

export function projectFileFor(wsDir: string): string {
  return path.join(wsDir, SCREENSHOTS_DIRNAME, PROJECT_FILENAME);
}

/** Legacy location (pre-scoped layout): project file at the workspace root. */
export function legacyProjectFileFor(wsDir: string): string {
  return path.join(wsDir, PROJECT_FILENAME);
}

export function uploadsDirFor(wsDir: string): string {
  return path.join(wsDir, SCREENSHOTS_DIRNAME, UPLOADS_DIRNAME);
}

/** Legacy location (pre-scoped layout): uploads at the workspace root. */
export function legacyUploadsDirFor(wsDir: string): string {
  return path.join(wsDir, UPLOADS_DIRNAME);
}

/** Resolve a workspace-relative file (e.g. `uploads/abc.png`), rejecting escapes. */
export function resolveWorkspaceFile(wsDir: string, rel: unknown): string {
  if (typeof rel !== "string" || !rel.trim() || rel.includes("\0")) {
    throw new Error("Invalid file path");
  }
  const normalized = path.normalize(rel.trim().replace(/^[/\\]+/, ""));
  if (normalized === "." || normalized.startsWith("..") || path.isAbsolute(normalized)) {
    throw new Error("File path escapes workspace");
  }
  return path.join(wsDir, normalized);
}

export async function ensureWorkspaceDir(wsDir: string): Promise<void> {
  const stat = await fs.stat(wsDir).catch(() => null);
  if (!stat) {
    await fs.mkdir(wsDir, { recursive: true });
    return;
  }
  if (!stat.isDirectory()) {
    throw new Error("Workspace path is not a directory");
  }
}

/** Ensure the workspace's `screenshots/` data folder exists. */
export async function ensureScreenshotsDir(wsDir: string): Promise<void> {
  await ensureWorkspaceDir(wsDir);
  await fs.mkdir(screenshotsDirFor(wsDir), { recursive: true });
}
