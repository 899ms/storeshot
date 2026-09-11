import { randomUUID } from "node:crypto";
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
  // Reject absurd bodies before parsing: a corrupt client must never be able
  // to clobber the project file or fill the disk.
  const MAX_PROJECT_BYTES = 10 * 1024 * 1024;
  const declared = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > MAX_PROJECT_BYTES) {
    return NextResponse.json({ ok: false, error: "Project too large (>10MB)" }, { status: 413 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!isProjectShape(body)) {
    return NextResponse.json(
      { ok: false, error: "Invalid project shape (need slidesByDevice object + string[] locales)" },
      { status: 400 },
    );
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
    if (Buffer.byteLength(pretty, "utf8") > MAX_PROJECT_BYTES) {
      return NextResponse.json({ ok: false, error: "Project too large (>10MB)" }, { status: 413 });
    }
    // Atomic write so readers never see a torn file.
    const target = projectFileFor(dir);
    const tmp = `${target}.tmp-${randomUUID()}`;
    try {
      await fs.writeFile(tmp, pretty, "utf8");
      await fs.rename(tmp, target);
    } catch (e) {
      await fs.unlink(tmp).catch(() => {});
      throw e;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

function isProjectShape(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const b = body as Record<string, unknown>;
  if (!b.slidesByDevice || typeof b.slidesByDevice !== "object" || Array.isArray(b.slidesByDevice)) {
    return false;
  }
  if (!Array.isArray(b.locales) || !b.locales.every((l) => typeof l === "string")) {
    return false;
  }
  return true;
}
