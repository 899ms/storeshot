import { NextResponse } from "next/server";
import { ensureWorkspaceDir, resolveWorkspaceDir } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

// Validate (and create if missing) a workspace directory.
// POST { path: string } → { ok: true, path: canonical } | { ok: false, error }
export async function POST(req: Request) {
  let body: { path?: unknown };
  try {
    body = (await req.json()) as { path?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  let dir: string;
  try {
    dir = resolveWorkspaceDir(body?.path);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
  try {
    await ensureWorkspaceDir(dir);
    const { realpath } = await import("node:fs/promises");
    const canonical = await realpath(dir).catch(() => dir);
    return NextResponse.json({ ok: true, path: canonical });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

// GET → { ok: true, defaultRoot } so the open dialog can suggest a start path.
export async function GET() {
  return NextResponse.json({ ok: true, defaultRoot: process.cwd() });
}
