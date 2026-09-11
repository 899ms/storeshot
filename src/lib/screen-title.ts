import type { Slide } from "./types";

/** 1-based index prefix, always 2 digits: 01, 02, ... */
export function screenIndexPrefix(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/** Raw display title (unslugified). Falls back to layout label-ish default. */
export function screenDisplayName(slide: Slide, fallback = "Screen"): string {
  const raw = (slide.name ?? "").trim();
  return raw || fallback;
}

/** Full Figma-style canvas label: "01 — Welcome". */
export function screenCanvasLabel(slide: Slide, index: number, fallback = "Screen"): string {
  return `${screenIndexPrefix(index)} — ${screenDisplayName(slide, fallback)}`;
}

/**
 * Filename-safe slug for exports. Lowercase, [^a-z0-9]+ -> "-", truncated
 * to 40 chars. Falls back to "screen" so the layout suffix keeps it unique
 * alongside the index prefix.
 */
export function slugifyScreenTitle(name: string | undefined): string {
  const slug = (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40)
    .replace(/(-$)/g, "");
  return slug || "screen";
}
