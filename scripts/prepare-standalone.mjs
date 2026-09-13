import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const publicSrc = path.join(root, "public");

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error(
    "prepare:standalone: missing .next/standalone/server.js — run `next build` first (output: standalone).",
  );
  process.exit(1);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`prepare:standalone: missing ${path.relative(root, src)}`);
    process.exit(1);
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

// Next standalone does not auto-copy client assets or public/; Electron boots
// server.js from .next/standalone, so they must live next to it.
copyDir(staticSrc, path.join(standalone, ".next", "static"));
copyDir(publicSrc, path.join(standalone, "public"));

console.log("prepare:standalone: copied .next/static and public/ into .next/standalone");
