// StoreShot MCP tools — pure project operations (no fs, no network).
//
// Every writer returns a NEW ProjectState; the stdio layer persists it via
// project-io.saveProject. Validation mirrors the editor: localized fields
// via locale.writeLocalized, backgrounds via storage.cleanBackground rules,
// export paths via export-options.buildExportZipPath.

import { buildExportZipPath, EXPORT_TARGETS, type FolderPreset } from "../lib/export-options";
import { exportFolderForLocale, writeLocalized, type StoreKind } from "../lib/locale";
import { CopySlidesError, copySlidesToDevices, type CopySlidesMode } from "../lib/copy-slides";
import { newSlide } from "../lib/defaults";
import { slugifyScreenTitle } from "../lib/screen-title";
import type { Device, ProjectState, ScreenBackground, Slide, SlideLayout } from "../lib/types";
import { McpError } from "./project-io";

const HEX = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
const LAYOUTS: SlideLayout[] = ["hero", "device-bottom", "device-top", "two-devices", "no-device", "static"];

const DEVICES: Device[] = ["phone", "tablet", "desktop"];
const LEGACY_DEVICE: Record<string, Device> = { iphone: "phone", ipad: "tablet" };

export function resolveDevice(input: unknown, fallback: unknown): Device {
  const raw = input == null ? fallback : input;
  if (typeof raw === "string" && (DEVICES as string[]).includes(raw)) return raw as Device;
  if (typeof raw === "string" && raw in LEGACY_DEVICE) return LEGACY_DEVICE[raw];
  throw new McpError("device must be phone|tablet|desktop");
}

function deviceSlides(state: ProjectState, device: unknown): { device: Device; slides: Slide[] } {
  const dev = resolveDevice(device, state.device);
  const slides = state.slidesByDevice[dev] ?? [];
  return { device: dev, slides };
}

function findSlide(slides: Slide[], slideId: unknown): Slide {
  const s = slides.find((x) => x.id === slideId);
  if (!s) throw new McpError(`Unknown slide id: ${String(slideId)}`);
  return s;
}

function setDeviceSlides(state: ProjectState, device: Device, slides: Slide[]): ProjectState {
  return { ...state, slidesByDevice: { ...state.slidesByDevice, [device]: slides } };
}

export function getProjectSummary(state: ProjectState) {
  return {
    appName: state.appName,
    device: state.device,
    connectedCanvas: state.connectedCanvas,
    locales: state.locales,
    locale: state.locale,
    themeId: state.themeId,
    headlineFont: state.headlineFont,
    labelFont: state.labelFont,
    slideCounts: {
      phone: state.slidesByDevice.phone?.length ?? 0,
      tablet: state.slidesByDevice.tablet?.length ?? 0,
      desktop: state.slidesByDevice.desktop?.length ?? 0,
    },
  };
}

export function listSlides(state: ProjectState, device?: unknown) {
  const { device: dev, slides } = deviceSlides(state, device);
  return {
    device: dev,
    slides: slides.map((s, i) => ({
      index: i,
      id: s.id,
      name: s.name ?? "",
      layout: s.layout,
      label: s.label,
      headline: s.headline,
      screenshot: s.screenshot,
      screenshotSecondary: s.screenshotSecondary ?? null,
      background: s.background ?? null,
      textElementIds: (s.textElements ?? []).map((t) => t.id),
    })),
  };
}

export function previewExportPaths(
  state: ProjectState,
  opts: { targets?: unknown; locales?: unknown; slideIds?: unknown; preset?: unknown; store?: unknown; device?: unknown },
) {
  const { slides } = deviceSlides(state, opts.device);
  const preset: FolderPreset = opts.preset === "fastlane" || opts.preset === "flat" ? opts.preset : "standard";
  const store: StoreKind = opts.store === "google" ? "google" : "apple";
  const wantedTargets = Array.isArray(opts.targets) && opts.targets.length > 0 ? opts.targets.map(String) : EXPORT_TARGETS.map((t) => t.id);
  const wantedLocales = Array.isArray(opts.locales) && opts.locales.length > 0 ? opts.locales.map(String) : state.locales;
  const picked = Array.isArray(opts.slideIds) && opts.slideIds.length > 0
    ? (opts.slideIds.map(String).map((id) => slides.find((s) => s.id === id)).filter(Boolean) as Slide[])
    : slides;
  const paths: string[] = [];
  const skipped: string[] = [];
  for (const targetId of wantedTargets) {
    const target = EXPORT_TARGETS.find((t) => t.id === targetId);
    if (!target) throw new McpError(`Unknown export target: ${targetId}`);
    for (const locale of wantedLocales) {
      const folder = exportFolderForLocale(locale, store);
      if (folder === null) {
        skipped.push(`${targetId}/${locale} (source-only locale, never exported)`);
        continue;
      }
      picked.forEach((slide, i) => {
        paths.push(buildExportZipPath(target, folder, slides.indexOf(slide), slide.layout, preset, i + 1, slugifyScreenTitle(slide.name)));
      });
    }
  }
  return { preset, store, count: paths.length, paths, skipped };
}

export type CopyField = "label" | "headline" | `text:${string}`;

export function updateCopy(
  state: ProjectState,
  args: { slideId: unknown; field: unknown; locale: unknown; value: unknown; device?: unknown },
): ProjectState {
  const { device, slides } = deviceSlides(state, args.device);
  const slide = findSlide(slides, args.slideId);
  if (typeof args.locale !== "string" || !args.locale.trim()) throw new McpError("locale is required");
  if (typeof args.value !== "string") throw new McpError("value must be a string");
  if (typeof args.field !== "string" || !args.field) throw new McpError("field is required (label|headline|text:<id>)");
  const locale = (args.locale as string).trim();
  const value = args.value as string;
  const next: Slide = { ...slide };
  if (args.field === "label" || args.field === "headline") {
    if (slide.layout === "static") throw new McpError("Static screens carry no label/headline");
    next[args.field] = writeLocalized(slide[args.field], locale, value);
  } else if (args.field.startsWith("text:")) {
    const id = args.field.slice("text:".length);
    if (!id) throw new McpError("text element id is required");
    const els = slide.textElements ?? [];
    if (!els.some((e) => e.id === id)) throw new McpError(`Unknown text element: ${id}`);
    next.textElements = els.map((e) => (e.id === id ? { ...e, text: writeLocalized(e.text, locale, value) } : e));
  } else {
    throw new McpError("field must be label|headline|text:<id>");
  }
  return setDeviceSlides(state, device, slides.map((s) => (s.id === slide.id ? next : s)));
}

export function addSlide(state: ProjectState, args: { device?: unknown; layout?: unknown; name?: unknown }): { state: ProjectState; slideId: string } {
  const { device, slides } = deviceSlides(state, args.device);
  const layout: SlideLayout = typeof args.layout === "string" && (LAYOUTS as string[]).includes(args.layout) ? (args.layout as SlideLayout) : "device-bottom";
  const slide = newSlide(layout);
  if (typeof args.name === "string" && args.name.trim()) slide.name = args.name.trim().slice(0, 80);
  return { state: setDeviceSlides(state, device, [...slides, slide]), slideId: slide.id };
}

export function renameSlide(state: ProjectState, args: { slideId: unknown; name: unknown; device?: unknown }): ProjectState {
  const { device, slides } = deviceSlides(state, args.device);
  const slide = findSlide(slides, args.slideId);
  if (typeof args.name !== "string" || !args.name.trim()) throw new McpError("name is required");
  const next = { ...slide, name: args.name.trim().slice(0, 80) };
  return setDeviceSlides(state, device, slides.map((s) => (s.id === slide.id ? next : s)));
}

export function setLayout(state: ProjectState, args: { slideId: unknown; layout: unknown; device?: unknown }): ProjectState {
  const { device, slides } = deviceSlides(state, args.device);
  const slide = findSlide(slides, args.slideId);
  if (typeof args.layout !== "string" || !(LAYOUTS as string[]).includes(args.layout)) {
    throw new McpError(`layout must be one of ${LAYOUTS.join("|")}`);
  }
  const next = { ...slide, layout: args.layout as SlideLayout };
  return setDeviceSlides(state, device, slides.map((s) => (s.id === slide.id ? next : s)));
}

export function reorderSlides(state: ProjectState, args: { orderedIds: unknown; device?: unknown }): ProjectState {
  const { device, slides } = deviceSlides(state, args.device);
  if (!Array.isArray(args.orderedIds) || args.orderedIds.length !== slides.length) {
    throw new McpError("orderedIds must list every slide id exactly once");
  }
  const ids = args.orderedIds.map(String);
  if (new Set(ids).size !== ids.length) throw new McpError("orderedIds contains duplicates");
  const byId = new Map(slides.map((s) => [s.id, s]));
  const next = ids.map((id) => {
    const s = byId.get(id);
    if (!s) throw new McpError(`Unknown slide id: ${id}`);
    return s;
  });
  return setDeviceSlides(state, device, next);
}

export function deleteSlide(state: ProjectState, args: { slideId: unknown; device?: unknown; confirm?: unknown }): ProjectState {
  if (args.confirm !== true) throw new McpError("Refusing without {confirm:true} (destructive)");
  const { device, slides } = deviceSlides(state, args.device);
  findSlide(slides, args.slideId);
  return setDeviceSlides(state, device, slides.filter((s) => s.id !== args.slideId));
}

export function copySlides(
  state: ProjectState,
  args: { from?: unknown; to?: unknown; mode?: unknown; slideIds?: unknown; confirm?: unknown },
) {
  const from = resolveDevice(args.from, state.device);
  const toRaw = args.to;
  const toList = Array.isArray(toRaw) ? toRaw : toRaw != null ? [toRaw] : [];
  const to = toList.map((d) => resolveDevice(d, undefined));
  let mode: CopySlidesMode;
  if (args.mode == null || args.mode === "append") mode = "append";
  else if (args.mode === "replace") mode = "replace";
  else throw new McpError("mode must be append|replace");
  if (mode === "replace" && args.confirm !== true) {
    throw new McpError("Replace needs {confirm:true} (destructive)");
  }
  const slideIds = Array.isArray(args.slideIds) ? args.slideIds.map(String) : undefined;
  try {
    return copySlidesToDevices(state, { from, to, mode, slideIds });
  } catch (err) {
    if (err instanceof CopySlidesError) throw new McpError(err.message);
    throw err;
  }
}

export function setLocales(state: ProjectState, args: { locales: unknown; confirm?: unknown }): ProjectState {
  if (!Array.isArray(args.locales) || args.locales.length === 0 || !args.locales.every((l) => typeof l === "string" && l.trim())) {
    throw new McpError("locales must be a non-empty string[]");
  }
  const locales = [...new Set(args.locales.map((l) => (l as string).trim()))];
  if (!locales.includes("en")) throw new McpError("locales must include en (editing source)");
  const removed = state.locales.filter((l) => !locales.includes(l));
  if (removed.length > 0 && args.confirm !== true) {
    throw new McpError(`Removing locales ${removed.join(",")} needs {confirm:true}`);
  }
  const locale = locales.includes(state.locale) ? state.locale : locales[0];
  return { ...state, locales, locale };
}

export function setBackground(
  state: ProjectState,
  args: { kind: unknown; colors?: unknown; src?: unknown; slideId?: unknown; device?: unknown; opacity?: unknown; blur?: unknown; angle?: unknown },
): ProjectState {
  const style: { opacity?: number; blur?: number; angle?: number } = {};
  if (args.opacity !== undefined) {
    if (typeof args.opacity !== "number" || args.opacity < 0 || args.opacity > 1) throw new McpError("opacity must be 0..1");
    style.opacity = args.opacity;
  }
  if (args.blur !== undefined) {
    if (typeof args.blur !== "number" || args.blur < 0 || args.blur > 40) throw new McpError("blur must be 0..40");
    style.blur = args.blur;
  }
  if (args.angle !== undefined) {
    if (typeof args.angle !== "number" || args.angle < 0 || args.angle > 360) throw new McpError("angle must be 0..360");
    style.angle = args.angle;
  }
  let bg: ScreenBackground;
  if (args.kind === "theme") bg = { kind: "theme", ...style };
  else if (args.kind === "mesh") {
    if (!Array.isArray(args.colors) || args.colors.length < 2 || args.colors.length > 4) {
      throw new McpError("mesh needs 2..4 colors");
    }
    for (const c of args.colors) {
      if (typeof c !== "string" || !HEX.test(c.trim())) throw new McpError(`Bad hex color: ${String(c)}`);
    }
    bg = { kind: "mesh", colors: (args.colors as string[]).map((c) => c.trim()), ...style };
  } else if (args.kind === "image") {
    if (typeof args.src !== "string" || !args.src.trim()) throw new McpError("image needs a src path");
    if (args.src.startsWith("data:")) throw new McpError("Inline data: images are never persisted (upload first)");
    bg = { kind: "image", src: args.src.trim(), ...style };
  } else {
    throw new McpError("kind must be theme|mesh|image");
  }
  if (args.slideId !== undefined) {
    const { device, slides } = deviceSlides(state, args.device);
    const slide = findSlide(slides, args.slideId);
    const next = { ...slide, background: bg };
    return setDeviceSlides(state, device, slides.map((s) => (s.id === slide.id ? next : s)));
  }
  return { ...state, background: bg };
}

export function setScreenshot(
  state: ProjectState,
  args: { slideId: unknown; path: unknown; secondary?: unknown; device?: unknown },
): ProjectState {
  const { device, slides } = deviceSlides(state, args.device);
  const slide = findSlide(slides, args.slideId);
  if (typeof args.path !== "string" || !args.path.trim()) throw new McpError("path is required");
  const p = args.path.trim();
  if (p.startsWith("data:")) throw new McpError("Inline data: images are never persisted (use upload_image first)");
  if (p.includes("\0") || p === "." || p.startsWith("..")) throw new McpError("Invalid screenshot path");
  const next: Slide = { ...slide, screenshot: p };
  if (args.secondary !== undefined) {
    if (typeof args.secondary !== "string") throw new McpError("secondary must be a string path");
    next.screenshotSecondary = args.secondary.trim() || undefined;
  }
  return setDeviceSlides(state, device, slides.map((s) => (s.id === slide.id ? next : s)));
}

export type LintIssue = { slideId: string | null; field: string; message: string };

export function lintDeck(state: ProjectState, device?: unknown): { device: string; issues: LintIssue[] } {
  const { device: dev, slides } = deviceSlides(state, device);
  const issues: LintIssue[] = [];
  for (const slide of slides) {
    const hasAny = (v: Partial<Record<string, string>> | undefined) => Object.values(v ?? {}).some((x) => x && x.trim());
    if (slide.layout !== "static") {
      if (!(slide.label?.en || "").trim() && hasAny(slide.label)) {
        issues.push({ slideId: slide.id, field: "label", message: "Has translations but empty en source" });
      }
      if (!(slide.headline?.en || "").trim() && hasAny(slide.headline)) {
        issues.push({ slideId: slide.id, field: "headline", message: "Has translations but empty en source" });
      }
    }
    if (!slide.screenshot.trim() && slide.layout !== "no-device") {
      issues.push({ slideId: slide.id, field: "screenshot", message: "No screenshot set" });
    }
    for (const el of slide.textElements ?? []) {
      if (!(el.text?.en || "").trim() && hasAny(el.text)) {
        issues.push({ slideId: slide.id, field: `text:${el.id}`, message: "Has translations but empty en source" });
      }
    }
  }
  return { device: dev, issues };
}

/** Translation preview for agents: what still needs copy per locale (no provider keys involved). */
export function previewTranslation(state: ProjectState, args: { targetLocale: unknown; sourceLocale?: unknown; device?: unknown }) {
  if (typeof args.targetLocale !== "string" || !args.targetLocale.trim()) throw new McpError("targetLocale is required");
  const target = args.targetLocale.trim();
  const source = typeof args.sourceLocale === "string" && args.sourceLocale.trim() ? args.sourceLocale.trim() : "en";
  const { slides } = deviceSlides(state, args.device);
  let pending = 0;
  const missing: { slideId: string; fields: string[] }[] = [];
  for (const slide of slides) {
    const fields: string[] = [];
    if (slide.layout !== "static") {
      if ((slide.label?.[source] || "").trim() && !(slide.label?.[target] || "").trim()) fields.push("label");
      if ((slide.headline?.[source] || "").trim() && !(slide.headline?.[target] || "").trim()) fields.push("headline");
    }
    for (const el of slide.textElements ?? []) {
      if ((el.text?.[source] || "").trim() && !(el.text?.[target] || "").trim()) fields.push(`text:${el.id}`);
    }
    if (fields.length > 0) {
      pending += fields.length;
      missing.push({ slideId: slide.id, fields });
    }
  }
  return { source, target, pendingUnits: pending, missing };
}
