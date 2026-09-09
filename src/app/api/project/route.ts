import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import {
  ensureScreenshotsDir,
  ensureWorkspaceDir,
  legacyProjectFileFor,
  projectFileFor,
  resolveWorkspaceDir,
} from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

function targetFiles(req: Request): string[] {
  const ws = new URL(req.url).searchParams.get("ws");
  if (ws) {
    const dir = resolveWorkspaceDir(ws);
    // Scoped `screenshots/` location first, legacy workspace-root fallback.
    return [projectFileFor(dir), legacyProjectFileFor(dir)];
  }
  return [projectFileFor(process.cwd())];
}

export async function GET(req: Request) {
  let files: string[];
  try {
    files = targetFiles(req);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
  let raw: string | null = null;
  for (const file of files) {
    try {
      raw = await fs.readFile(file, "utf8");
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
        return NextResponse.json(
          { ok: false, error: e instanceof Error ? e.message : String(e) },
          { status: 500 },
        );
      }
    }
  }
  if (raw === null) {
    return NextResponse.json({ ok: true, state: null });
  }
  try {
    return NextResponse.json({ ok: true, state: JSON.parse(raw) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  let dir: string;
  let ws: string | null = null;
  try {
    ws = new URL(req.url).searchParams.get("ws");
    dir = ws ? resolveWorkspaceDir(ws) : process.cwd();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
  try {
    if (ws) await ensureScreenshotsDir(dir);
    else await ensureWorkspaceDir(dir);
    const pretty = JSON.stringify(body, null, 2) + "\n";
    await fs.writeFile(projectFileFor(dir), pretty, "utf8");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
