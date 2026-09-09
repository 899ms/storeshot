import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveWorkspaceDir, screenshotsDirFor } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

const CONTENT_TYPE: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

// Serve a workspace-relative file (e.g. uploads/<hash>.png) for the active
// workspace. Absolute /public paths keep working through static serving;
// only workspace-relative `uploads/…` paths come through here.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  let base: string;
  let legacyBase: string | null;
  let rel: string;
  try {
    const ws = params.get("ws");
    // No `ws` → default workspace (the app folder); files live in its
    // `screenshots/` folder just like any other workspace.
    const dir = ws ? resolveWorkspaceDir(ws) : process.cwd();
    base = dir;
    legacyBase = ws ? dir : null;
    const raw = params.get("rel");
    if (typeof raw !== "string" || !raw.trim() || raw.includes("\0")) {
      throw new Error("Invalid file path");
    }
    const normalized = path.normalize(raw.trim().replace(/^[/\\]+/, ""));
    if (normalized === "." || normalized.startsWith("..") || path.isAbsolute(normalized)) {
      throw new Error("File path escapes workspace");
    }
    rel = normalized;
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
  // Scoped `screenshots/` location first, legacy workspace-root fallback.
  const candidates = legacyBase
    ? [path.join(screenshotsDirFor(base), rel), path.join(legacyBase, rel)]
    : [path.join(screenshotsDirFor(base), rel)];
  let bytes: Buffer | null = null;
  for (const abs of candidates) {
    try {
      bytes = await fs.readFile(abs);
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
  if (!bytes) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  const ext = rel.slice(rel.lastIndexOf(".")).toLowerCase();
  const type = CONTENT_TYPE[ext] || "application/octet-stream";
  return new NextResponse(new Uint8Array(bytes), {
    headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable" },
  });
}
