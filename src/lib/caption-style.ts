import type { CaptionTextStyle, Slide } from "./types";

// Long-standing caption defaults (mirror slide-canvas renderCaption so old
// projects resolve pixel-identically when no overrides are set).
export const DEFAULT_LABEL_SIZE_FACTOR = 0.028;
export const DEFAULT_LABEL_WEIGHT = 600;
export const DEFAULT_HEADLINE_SIZE_FACTOR = 0.092;
export const DEFAULT_HEADLINE_WEIGHT = 700;

export type ResolvedCaptionStyle = {
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  color: string;
};

/** Resolve label typography: per-slide override wins, else the default. */
export function resolveLabelStyle(
  slide: Pick<Slide, "labelStyle">,
  unit: number,
  defaultFamily: string,
  defaultColor: string,
): ResolvedCaptionStyle {
  const o = slide.labelStyle;
  return {
    fontSize: o?.fontSize ?? unit * DEFAULT_LABEL_SIZE_FACTOR,
    fontWeight: o?.fontWeight ?? DEFAULT_LABEL_WEIGHT,
    fontFamily: o?.fontFamily ?? defaultFamily,
    color: o?.color ?? defaultColor,
  };
}

/** Resolve headline typography: per-slide override wins, else the default. */
export function resolveHeadlineStyle(
  slide: Pick<Slide, "headlineStyle">,
  unit: number,
  defaultFamily: string,
  defaultColor: string,
): ResolvedCaptionStyle {
  const o = slide.headlineStyle;
  return {
    fontSize: o?.fontSize ?? unit * DEFAULT_HEADLINE_SIZE_FACTOR,
    fontWeight: o?.fontWeight ?? DEFAULT_HEADLINE_WEIGHT,
    fontFamily: o?.fontFamily ?? defaultFamily,
    color: o?.color ?? defaultColor,
  };
}

/** Merge a single caption-style field; undefined clears back to default. */
export function patchCaptionStyle(
  current: CaptionTextStyle | undefined,
  patch: Partial<CaptionTextStyle>,
): CaptionTextStyle | undefined {
  const next = { ...current, ...patch };
  if (
    next.fontSize === undefined &&
    next.fontWeight === undefined &&
    next.fontFamily === undefined &&
    next.color === undefined
  ) {
    return undefined;
  }
  return next;
}

/** Collect every non-default font family a slide uses (caption + overlays). */
export function slideFontFamilies(slide: Pick<Slide, "labelStyle" | "headlineStyle" | "textElements">): string[] {
  const out = new Set<string>();
  for (const style of [slide.labelStyle, slide.headlineStyle]) {
    if (style?.fontFamily) out.add(style.fontFamily);
  }
  for (const el of slide.textElements ?? []) {
    if (el.fontFamily) out.add(el.fontFamily);
  }
  return [...out];
}
