import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { PROJECT_FILENAME, SCREENSHOTS_DIRNAME, resolveWorkspaceDir } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

type Entry = { name: string; path: string; hasProject: boolean };

// Server-driven folder browser for the "Open workspace" dialog. The browser
// File System Access API never reveals absolute paths to the page, so the
// page cannot hand the server a picked folder — instead the server lists
// directories and the dialog navigates them.
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("path");
  let dir: string;
  try {
    dir = raw ? resolveWorkspaceDir(raw) : homedir();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  let canonical: string;
  try {
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) {
      return NextResponse.json({ ok: false, error: "Not a directory" }, { status: 400 });
    }
    canonical = await fs.realpath(dir).catch(() => dir);
  } catch {
    return NextResponse.json({ ok: false, error: "Folder not found" }, { status: 404 });
  }

  let names: string[];
  try {
    names = await fs.readdir(canonical);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    const status = code === "ENOENT" || code === "ENOTDIR" ? 404 : code === "EACCES" || code === "EPERM" ? 403 : 500;
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status },
    );
  }

  const entries: Entry[] = [];
  for (const name of names.sort((a, b) => a.localeCompare(b))) {
    if (name.startsWith(".")) continue;
    const full = path.join(canonical, name);
    try {
      const stat = await fs.stat(full);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }
    let hasProject = false;
    for (const candidate of [
      path.join(full, SCREENSHOTS_DIRNAME, PROJECT_FILENAME),
      path.join(full, PROJECT_FILENAME),
    ]) {
      try {
        await fs.access(candidate);
        hasProject = true;
        break;
      } catch {
        // not a workspace — still selectable
      }
    }
    entries.push({ name, path: full, hasProject });
  }

  return NextResponse.json({
    ok: true,
    path: canonical,
    parent: path.dirname(canonical) === canonical ? null : path.dirname(canonical),
    home: homedir(),
    appRoot: process.cwd(),
    entries,
  });
}

// Create a subfolder (used by the "New folder" action in the dialog).
// POST { parent: string, name: string } → { ok: true, path }
export async function POST(req: Request) {
  let body: { parent?: unknown; name?: unknown };
  try {
    body = (await req.json()) as { parent?: unknown; name?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body?.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ ok: false, error: "Folder name is empty" }, { status: 400 });
  }
  if (/[\\/]/.test(body.name) || body.name.trim() === "." || body.name.trim() === "..") {
    return NextResponse.json({ ok: false, error: "Invalid folder name" }, { status: 400 });
  }
  let dir: string;
  try {
    dir = resolveWorkspaceDir(body.parent);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
  const full = path.join(dir, body.name.trim());
  try {
    await fs.mkdir(full, { recursive: true });
    const canonical = await fs.realpath(full).catch(() => full);
    return NextResponse.json({ ok: true, path: canonical });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
