// StoreShot headless export bridge — unit planning (mirrors the browser
// exportWithConfig in screenshot-editor.tsx) + python render.py execution.
//
// The browser renders off-screen DOM at canvas size via html-to-image and
// scales to the target size; render.py reproduces the same geometry
// (slide-canvas rects, caption factors, device-frame insets) in PIL at
// canvas size and resizes to the target the same way.

import { spawn, spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { effectiveCanvas, hasTheme, themeById } from "../lib/constants";
import {
  buildExportZipPath,
  getExportTargetById,
  type ExportTarget,
  type FolderPreset,
} from "../lib/export-options";
import { exportFolderForLocale, type StoreKind } from "../lib/locale";
import { slugifyScreenTitle } from "../lib/screen-title";
import type { Device, ProjectState, Slide } from "../lib/types";
import { McpError } from "./project-io";
import { resolveDevice } from "./tools";

const RENDER_PY = path.join(path.dirname(fileURLToPath(import.meta.url)), "render.py");

export type ExportSelection = {
  targets?: unknown;
  locales?: unknown;
  slideIds?: unknown;
  preset?: unknown;
  store?: unknown;
  device?: unknown;
  outDir?: unknown;
};

export type ExportUnit = {
  locale: string;
  folder: string;
  target: ExportTarget;
  slide: Slide;
  slideIndex: number;
  position: number;
  zipPath: string;
};

export type ExportPlan = {
  device: Device;
  preset: FolderPreset;
  store: StoreKind;
  connected: boolean;
  canvas: { w: number; h: number };
  units: ExportUnit[];
  skipped: string[];
  warnings: string[];
};

export function buildExportPlan(state: ProjectState, sel: ExportSelection): ExportPlan {
  const device = resolveDevice(sel.device, state.device);
  const slides = state.slidesByDevice[device] ?? [];
  if (slides.length === 0) throw new McpError(`No ${device} screens to export`);
  const preset: FolderPreset = sel.preset === "fastlane" || sel.preset === "flat" ? sel.preset : "standard";
  const store: StoreKind = sel.store === "google" ? "google" : "apple";

  const hasExplicitTargets = Array.isArray(sel.targets) && sel.targets.length > 0;
  const wantedTargets = hasExplicitTargets
    ? (sel.targets as unknown[]).map(String)
    : [device === "tablet" ? "ios-tablet-13" : device === "desktop" ? "mac-desktop-2880" : "ios-phone-69"];
  const targets = wantedTargets.map((id) => {
    const t = getExportTargetById(id);
    if (!t) throw new McpError(`Unknown export target: ${id}`);
    return t;
  });

  const wantedLocales = Array.isArray(sel.locales) && sel.locales.length > 0
    ? sel.locales.map(String)
    : [...state.locales];
  const locales: { locale: string; folder: string }[] = [];
  const skipped: string[] = [];
  for (const locale of wantedLocales) {
    if (!state.locales.includes(locale)) {
      skipped.push(`${locale} (not in project locales)`);
      continue;
    }
    const folder = exportFolderForLocale(locale, store);
    if (folder === null) {
      skipped.push(`${locale} (source-only locale, never exported)`);
      continue;
    }
    locales.push({ locale, folder });
  }
  if (locales.length === 0) throw new McpError("No exportable locales selected");

  let indices: number[];
  if (Array.isArray(sel.slideIds) && sel.slideIds.length > 0) {
    indices = sel.slideIds.map(String).map((id) => {
      const i = slides.findIndex((s) => s.id === id);
      if (i < 0) throw new McpError(`Unknown slide id: ${id}`);
      return i;
    });
  } else {
    indices = slides.map((_, i) => i);
  }
  const posOf = new Map(indices.map((idx, pos) => [idx, pos + 1]));
  const warnings: string[] = [];
  if (!hasTheme(state.themeId)) {
    warnings.push(`Unknown theme ${state.themeId}, falling back to clean-light`);
  }
  const units: ExportUnit[] = [];
  for (const { locale, folder } of locales) {
    for (const target of targets) {
      for (const slideIdx of indices) {
        const slide = slides[slideIdx];
        units.push({
          locale,
          folder,
          target,
          slide,
          slideIndex: slideIdx,
          position: posOf.get(slideIdx) ?? slideIdx + 1,
          zipPath: buildExportZipPath(
            target, folder, slideIdx, slide.layout, preset,
            posOf.get(slideIdx) ?? slideIdx + 1, slugifyScreenTitle(slide.name),
          ),
        });
      }
    }
  }
  const c = effectiveCanvas(device, state.canvasSizes);
  return { device, preset, store, connected: state.connectedCanvas, canvas: { w: c.w, h: c.h }, units, skipped, warnings };
}

export function checkRenderer(): { ok: boolean; detail: string } {
  const ver = spawnSync("python3", ["--version"], { encoding: "utf8" });
  if (ver.status !== 0) return { ok: false, detail: "python3 not found" };
  const pil = spawnSync("python3", ["-c", "import PIL; print(PIL.__version__)"], { encoding: "utf8" });
  if (pil.status !== 0) return { ok: false, detail: "Python Pillow (PIL) is not installed" };
  return { ok: true, detail: `python3 + PIL ${pil.stdout.trim()}` };
}

export type RenderManifest = {
  ok: boolean;
  zip?: string;
  units?: { zipPath: string; file: string; w: number; h: number; slideId: string }[];
  missing?: string[];
  warnings?: string[];
  partial?: boolean;
  error?: string;
};

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export type RenderRequest = {
  outDir?: unknown;
  fontCache?: unknown;
};

/** Run the full headless export: plan units -> render.py -> ZIP.
 *  Returns the manifest (units/missing mirrors the browser -partial- flow:
 *  failed renders are listed, successes still zip). */
export async function runRenderExport(
  workspace: string,
  state: ProjectState,
  plan: ExportPlan,
  req: RenderRequest = {},
): Promise<RenderManifest & { outDir: string }> {
  const gate = checkRenderer();
  if (!gate.ok) throw new McpError(`Headless rendering unavailable: ${gate.detail}`);
  const outDir = typeof req.outDir === "string" && req.outDir.trim()
    ? req.outDir.trim()
    : path.join(workspace, "screenshots", "exports", stamp());
  await fs.mkdir(outDir, { recursive: true });
  const zipName = `storeshot-${plan.store}-${plan.preset}-${stamp()}.zip`;
  const job = {
    workspace,
    connected: plan.connected,
    outDir,
    zipName,
    fontCache: typeof req.fontCache === "string" && req.fontCache.trim() ? req.fontCache.trim() : undefined,
    project: {
      device: plan.device,
      canvas: plan.canvas,
      headlineFont: state.headlineFont,
      labelFont: state.labelFont,
      background: state.background,
      theme: themeById(state.themeId),
      frames: state.frames ?? {},
    },
    units: plan.units.map((u) => ({
      // Internal locale drives copy + {locale} screenshots (like the
      // browser); zipPath already carries the store folder code.
      locale: u.locale,
      slide: u.slide,
      target: { w: u.target.w, h: u.target.h },
      zipPath: u.zipPath,
    })),
  };
  const jobFile = path.join(outDir, "job.json");
  await fs.writeFile(jobFile, JSON.stringify(job), "utf8");
  const manifest = await new Promise<RenderManifest>((resolve, reject) => {
    const child = spawn("python3", [RENDER_PY, jobFile], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (c) => { out += String(c); });
    child.stderr.on("data", (c) => { err += String(c); });
    child.on("error", (e) => reject(new Error(`renderer spawn failed: ${e.message}`)));
    child.on("close", (code) => {
      try {
        resolve(JSON.parse(out.trim().split("\n").pop() || "{}") as RenderManifest);
      } catch {
        reject(new Error(`renderer produced no manifest (exit ${code}): ${err.slice(0, 500)}`));
      }
    });
  });
  return { ...manifest, outDir };
}
