import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT } from "../lib/defaults";

const ROOT = process.cwd();

function seedWorkspace(): string {
  const ws = mkdtempSync(path.join(tmpdir(), "storeshot-cli-"));
  mkdirSync(path.join(ws, "screenshots"), { recursive: true });
  writeFileSync(
    path.join(ws, "screenshots", "app-store-screenshots.json"),
    JSON.stringify({ ...DEFAULT_PROJECT, appName: "Cli", locales: ["en"], locale: "en", device: "phone" }),
  );
  return ws;
}

function call(args: string[], input?: string): { status: number; stdout: string; stderr: string } {
  const r = spawnSync("bun", ["src/mcp/client.ts", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    input,
    timeout: 120000,
  });
  return { status: r.status ?? 1, stdout: String(r.stdout ?? ""), stderr: String(r.stderr ?? "").slice(0, 500) };
}

describe("mcp client CLI", () => {
  it("lists tools on the storeshot server", () => {
    const r = call(["--cmd", "bun", "src/mcp/server.ts", "--list", "tools"]);
    expect(r.status).toBe(0);
    const tools = (JSON.parse(r.stdout) as { tools: { name: string }[] }).tools.map((t) => t.name);
    expect(tools).toContain("get_project");
    expect(tools).toContain("render_export");
    expect(tools).toContain("translate_locale");
  });

  it("calls a tool end to end through two processes", () => {
    const ws = seedWorkspace();
    const r = call(["--cmd", "bun", "src/mcp/server.ts", "--tool", "get_project", "--args", JSON.stringify({ workspace: ws })]);
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout) as { content: { text: string }[] };
    expect(JSON.parse(out.content[0].text) as { appName: string }).toMatchObject({ appName: "Cli" });
  });
});
