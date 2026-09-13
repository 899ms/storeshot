// Copy screens from one device deck onto another. Pure project math:
// the editor, empty-state CTA, and MCP tool all call copySlidesToDevices.
//
// Geometry is adapted, not pixel-perfect. Built-in caption/device transforms
// are dropped so destination layout defaults size frames for that canvas.
// Overlay text is scaled independently in X/Y; absolute font sizes scale by
// min(sx, sy). The user nudges what still looks off.

import { effectiveCanvas } from "./constants";
import { nid as defaultNid } from "./defaults";
import type {
  CaptionTextStyle,
  Device,
  ElementTransform,
  ProjectState,
  ScreenBackground,
  Slide,
  TextElement,
} from "./types";

export type CopySlidesMode = "append" | "replace";

export class CopySlidesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CopySlidesError";
  }
}

const DEVICES: Device[] = ["phone", "tablet", "desktop"];

function isDevice(value: unknown): value is Device {
  return typeof value === "string" && (DEVICES as string[]).includes(value);
}

function cloneBackground(bg: ScreenBackground | undefined): ScreenBackground | undefined {
  if (!bg) return undefined;
  if (bg.kind === "mesh") return { ...bg, colors: [...bg.colors] };
  return { ...bg };
}

function cloneCaptionStyle(style: CaptionTextStyle | undefined): CaptionTextStyle | undefined {
  if (!style) return undefined;
  return { ...style };
}

function cloneTransform(t: ElementTransform): ElementTransform {
  return { ...t };
}

/** Deep-copy a slide with new ids. Geometry is unchanged. */
export function cloneSlide(src: Slide, nextId: () => string = defaultNid): Slide {
  const copy: Slide = {
    ...src,
    id: nextId(),
    label: { ...src.label },
    headline: { ...src.headline },
    labelStyle: cloneCaptionStyle(src.labelStyle),
    headlineStyle: cloneCaptionStyle(src.headlineStyle),
    background: cloneBackground(src.background),
  };
  if (src.transforms) {
    copy.transforms = Object.fromEntries(
      Object.entries(src.transforms)
        .filter((entry): entry is [string, ElementTransform] => !!entry[1])
        .map(([key, value]) => [key, cloneTransform(value)]),
    );
  }
  if (src.textElements) {
    copy.textElements = src.textElements.map(
      (element): TextElement => ({
        ...element,
        id: nextId(),
        text: { ...element.text },
        transform: cloneTransform(element.transform),
      }),
    );
  }
  return copy;
}

function scaleTransform(t: ElementTransform, sx: number, sy: number): ElementTransform {
  return {
    ...t,
    x: t.x * sx,
    y: t.y * sy,
    width: Math.max(1, t.width * sx),
    height: Math.max(1, t.height * sy),
  };
}

function scaleFontSize(size: number | undefined, s: number): number | undefined {
  if (typeof size !== "number" || !Number.isFinite(size)) return undefined;
  return Math.max(1, Math.round(size * s));
}

function scaleCaptionStyle(
  style: CaptionTextStyle | undefined,
  s: number,
): CaptionTextStyle | undefined {
  if (!style) return undefined;
  const fontSize = scaleFontSize(style.fontSize, s);
  if (fontSize === undefined) return { ...style };
  return { ...style, fontSize };
}

/**
 * Drop built-in transforms (dest layout defaults apply) and scale overlay
 * text + absolute caption font sizes onto a destination canvas.
 */
export function adaptSlideGeometry(
  slide: Slide,
  from: { w: number; h: number },
  to: { w: number; h: number },
): Slide {
  const sx = from.w > 0 ? to.w / from.w : 1;
  const sy = from.h > 0 ? to.h / from.h : 1;
  const sFont = Math.min(sx, sy);
  return {
    ...slide,
    transforms: undefined,
    labelStyle: scaleCaptionStyle(slide.labelStyle, sFont),
    headlineStyle: scaleCaptionStyle(slide.headlineStyle, sFont),
    textElements: slide.textElements?.map((element) => ({
      ...element,
      transform: scaleTransform(element.transform, sx, sy),
      fontSize: scaleFontSize(element.fontSize, sFont) ?? element.fontSize,
    })),
  };
}

export type CopySlidesOpts = {
  from: Device;
  to: Device[];
  mode: CopySlidesMode;
  slideIds?: string[];
  nid?: () => string;
};

export type CopySlidesResult = {
  state: ProjectState;
  copied: number;
  targets: Device[];
  firstSlideId: string | null;
};

/** Other device with the most screens, or null if every other deck is empty. */
export function richestOtherDevice(
  decks: Record<Device, Slide[] | undefined>,
  current: Device,
): { device: Device; count: number } | null {
  let best: { device: Device; count: number } | null = null;
  for (const device of DEVICES) {
    if (device === current) continue;
    const count = decks[device]?.length ?? 0;
    if (count === 0) continue;
    if (!best || count > best.count) best = { device, count };
  }
  return best;
}

function uniqueDevices(list: Device[]): Device[] {
  const seen = new Set<Device>();
  const out: Device[] = [];
  for (const d of list) {
    if (seen.has(d)) continue;
    seen.add(d);
    out.push(d);
  }
  return out;
}

/** Copy screens from one device deck onto one or more others. */
export function copySlidesToDevices(state: ProjectState, opts: CopySlidesOpts): CopySlidesResult {
  if (!isDevice(opts.from)) throw new CopySlidesError("from must be phone|tablet|desktop");
  if (!Array.isArray(opts.to) || opts.to.length === 0) {
    throw new CopySlidesError("to must be a non-empty device list");
  }
  if (opts.mode !== "append" && opts.mode !== "replace") {
    throw new CopySlidesError("mode must be append|replace");
  }
  for (const d of opts.to) {
    if (!isDevice(d)) throw new CopySlidesError("to must be phone|tablet|desktop");
  }
  const targets = uniqueDevices(opts.to);
  if (targets.includes(opts.from)) {
    throw new CopySlidesError("cannot copy a device onto itself");
  }

  const sourceDeck = state.slidesByDevice[opts.from] || [];
  let sources: Slide[];
  if (opts.slideIds && opts.slideIds.length > 0) {
    sources = opts.slideIds.map((id) => {
      const slide = sourceDeck.find((s) => s.id === id);
      if (!slide) throw new CopySlidesError(`Unknown slide id: ${id}`);
      return slide;
    });
  } else {
    sources = sourceDeck;
  }
  if (sources.length === 0) throw new CopySlidesError("source deck has no screens to copy");

  const nextId = opts.nid ?? defaultNid;
  const fromCanvas = effectiveCanvas(opts.from, state.canvasSizes);
  const decks: ProjectState["slidesByDevice"] = { ...state.slidesByDevice };
  let firstSlideId: string | null = null;

  for (const target of targets) {
    const toCanvas = effectiveCanvas(target, state.canvasSizes);
    const clones = sources.map((src) =>
      adaptSlideGeometry(cloneSlide(src, nextId), fromCanvas, toCanvas),
    );
    if (!firstSlideId) firstSlideId = clones[0]?.id ?? null;
    const existing = decks[target] || [];
    decks[target] = opts.mode === "replace" ? clones : [...existing, ...clones];
  }

  return {
    state: { ...state, slidesByDevice: decks },
    copied: sources.length,
    targets,
    firstSlideId,
  };
}
