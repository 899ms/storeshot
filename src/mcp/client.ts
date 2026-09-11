// Minimal generic MCP client (stdio, newline-delimited JSON-RPC 2.0).
//
// Library use: spawn any MCP stdio server and call its tools/resources.
// CLI use:    bun src/mcp/client.ts --cmd <program...> [--timeout ms]
//               --list tools|resources|prompts
//               --tool <name> --args '<json>'
//               --resource '<uri>'
//               --prompt <name> --args '<json>'
// Everything after --cmd up to the next known flag is the server command.
// Result JSON goes to stdout; diagnostics to stderr.

import { spawn, type ChildProcess } from "node:child_process";

export type Json = unknown;

const KNOWN_FLAGS = new Set(["--cmd", "--timeout", "--list", "--tool", "--args", "--resource", "--prompt"]);

export class McpClient {
  private proc: ChildProcess;
  private buf = "";
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: Json) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private timeoutMs: number;

  private constructor(proc: ChildProcess, timeoutMs: number) {
    this.proc = proc;
    this.timeoutMs = timeoutMs;
    proc.stdout?.setEncoding("utf8");
    proc.stdout?.on("data", (c) => this.onData(String(c)));
    proc.stderr?.setEncoding("utf8");
    proc.stderr?.on("data", (c) => process.stderr.write(`[server] ${c}`));
    proc.on("exit", (code) => {
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new Error(`server exited (code ${code})`));
      }
      this.pending.clear();
    });
  }

  static spawn(command: string[], opts: { timeoutMs?: number; env?: Record<string, string> } = {}): McpClient {
    if (command.length === 0) throw new Error("--cmd needs a program");
    const proc = spawn(command[0], command.slice(1), {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...opts.env },
    });
    return new McpClient(proc, opts.timeoutMs ?? 60000);
  }

  private onData(chunk: string) {
    this.buf += chunk;
    let nl: number;
    while ((nl = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, nl).trim();
      this.buf = this.buf.slice(nl + 1);
      if (!line) continue;
      let msg: { id?: number; result?: Json; error?: { message?: string } };
      try {
        msg = JSON.parse(line) as typeof msg;
      } catch {
        continue;
      }
      if (typeof msg.id !== "number") continue;
      const p = this.pending.get(msg.id);
      if (!p) continue;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(msg.error.message || "MCP error"));
      else p.resolve(msg.result ?? null);
    }
  }

  request(method: string, params: Record<string, Json> = {}): Promise<Json> {
    const id = this.nextId++;
    return new Promise<Json>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timed out: ${method}`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.proc.stdin?.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  async initialize(): Promise<Json> {
    const res = await this.request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "storeshot-mcp-client", version: "0.1.0" } });
    this.proc.stdin?.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    return res;
  }

  toolsList(): Promise<Json> { return this.request("tools/list"); }
  toolsCall(name: string, args: Record<string, Json>): Promise<Json> {
    return this.request("tools/call", { name, arguments: args });
  }
  resourcesList(): Promise<Json> { return this.request("resources/list"); }
  resourcesRead(uri: string): Promise<Json> { return this.request("resources/read", { uri }); }
  promptsList(): Promise<Json> { return this.request("prompts/list"); }
  promptsGet(name: string, args: Record<string, Json> = {}): Promise<Json> {
    return this.request("prompts/get", { name, arguments: args });
  }

  close() {
    this.proc.stdin?.end();
    this.proc.kill();
  }
}

function parseArgs(argv: string[]): { cmd: string[]; timeout: number; mode: { list?: string; tool?: string; args?: string; resource?: string; prompt?: string } } {
  const mode: { list?: string; tool?: string; args?: string; resource?: string; prompt?: string } = {};
  let cmd: string[] = [];
  let timeout = 120000;
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "--cmd") {
      i++;
      cmd = [];
      while (i < argv.length && !KNOWN_FLAGS.has(argv[i])) cmd.push(argv[i++]);
    } else if (a === "--timeout") {
      timeout = Number(argv[++i]);
      i++;
    } else if (a === "--list" || a === "--tool" || a === "--args" || a === "--resource" || a === "--prompt") {
      mode[a.slice(2) as "list"] = argv[++i] ?? "";
      i++;
    } else {
      i++;
    }
  }
  return { cmd, timeout, mode };
}

async function main() {
  const { cmd, timeout, mode } = parseArgs(process.argv.slice(2));
  if (cmd.length === 0) {
    process.stderr.write("usage: client.ts --cmd <program...> [--timeout ms] (--list tools|resources|prompts | --tool <n> --args '<json>' | --resource '<uri>' | --prompt <n> [--args '<json>'])\n");
    process.exit(2);
  }
  const client = McpClient.spawn(cmd, { timeoutMs: timeout });
  try {
    await client.initialize();
    let out: Json;
    const args = mode.args ? (JSON.parse(mode.args) as Record<string, Json>) : {};
    if (mode.list === "tools") out = await client.toolsList();
    else if (mode.list === "resources") out = await client.resourcesList();
    else if (mode.list === "prompts") out = await client.promptsList();
    else if (mode.tool) out = await client.toolsCall(mode.tool, args);
    else if (mode.resource) out = await client.resourcesRead(mode.resource);
    else if (mode.prompt) out = await client.promptsGet(mode.prompt, args);
    else throw new Error("nothing to do (see usage)");
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  } catch (e) {
    process.stderr.write(`mcp client error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  } finally {
    client.close();
  }
}

const isCli = process.argv[1]?.endsWith("client.ts") ?? false;
if (isCli) void main();

export default McpClient;
