/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  reactStrictMode: false,
  // Self-contained server bundle for the Electron shell (StoreShot):
  // `next build` emits .next/standalone/server.js which Electron boots
  // in-process, so the packaged app needs no system Node and no dev server.
  output: "standalone",
  // Pin the trace root to this project: without it, standalone tracing can
  // anchor at a parent directory and emit a nested Desktop/Screenshots tree
  // instead of server.js.
  outputFileTracingRoot: __dirname,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
