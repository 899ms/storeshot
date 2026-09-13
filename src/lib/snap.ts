// Figma-style drag snapping for the connected canvas editor.
//
// Coordinates are canvas px in deck-global space (screenX included), so the
// same targets work for isolated and connected decks. Guides are stored in
// that space too (see lib/guides.ts + PreviewStage). Pure, so the contract
// stays unit-tested like guides.ts.

export type SnapAxis = "v" | "h";
export type SnapSource = "canvas" | "element" | "guide";

export type SnapLine = {
  /** "v" = vertical line (a shared X), "h" = horizontal line (a shared Y). */
  axis: SnapAxis;
  pos: number;
  source: SnapSource;
};

export type SnapRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SnapGuide = {
  axis: SnapAxis;
  pos: number;
};

/** Max canvas-px gap between a dragged edge/center and a target to snap. */
export const SNAP_THRESHOLD = 8;

/**
 * Figma feels like ~5 screen px of gravity. Canvas px shrink under zoom, so
 * the threshold grows as you zoom out — a fixed canvas-px value is nearly
 * unhittable at fit zoom (≈1.6 screen px) and sloppy at 100%.
 */
export const SNAP_SCREEN_PX = 5;
export const SNAP_MIN_THRESHOLD = 4;
export const SNAP_MAX_THRESHOLD = 48;

export function snapThresholdForScale(scale: number): number {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return Math.min(SNAP_MAX_THRESHOLD, Math.max(SNAP_MIN_THRESHOLD, SNAP_SCREEN_PX / s));
}

const SNAP_KEY = "screenshots.snap";

export function loadSnap(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(SNAP_KEY);
    // Absent = on (Figma parity: snapping defaults to enabled).
    if (raw == null) return true;
    return raw !== "0";
  } catch {
    return true;
  }
}

export function saveSnap(on: boolean) {
  try {
    window.localStorage.setItem(SNAP_KEY, on ? "1" : "0");
  } catch {
    // storage unavailable — snapping still works in-memory
  }
}

/**
 * Collect snap targets for one dragged element. `screenOrigins` holds every
 * screen origin in the drag frame (all screens on a connected deck, just the
 * own screen otherwise) so edges/centers snap per screen Figma-style instead
 * of tracking only the element's origin screen. `others` must exclude the
 * dragged rect itself. All coordinates share one frame (see slide-canvas,
 * which shifts deck-global guides/extras into isolated screen frames).
 */
export function buildSnapTargets(opts: {
  screenOrigins: number[];
  cW: number;
  cH: number;
  others: SnapRect[];
  guides: SnapGuide[];
}): { v: SnapLine[]; h: SnapLine[] } {
  const { screenOrigins, cW, cH, others, guides } = opts;
  const v: SnapLine[] = [];
  const seenV = new Set<number>();
  for (const x of screenOrigins) {
    for (const pos of [x, x + cW / 2, x + cW]) {
      // Adjacent connected screens share an edge — keep one line.
      if (seenV.has(pos)) continue;
      seenV.add(pos);
      v.push({ axis: "v", pos, source: "canvas" });
    }
  }
  const h: SnapLine[] = [
    { axis: "h", pos: 0, source: "canvas" },
    { axis: "h", pos: cH / 2, source: "canvas" },
    { axis: "h", pos: cH, source: "canvas" },
  ];
  for (const o of others) {
    if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) continue;
    if (!(o.width > 0) || !(o.height > 0)) continue;
    v.push(
      { axis: "v", pos: o.x, source: "element" },
      { axis: "v", pos: o.x + o.width / 2, source: "element" },
      { axis: "v", pos: o.x + o.width, source: "element" },
    );
    h.push(
      { axis: "h", pos: o.y, source: "element" },
      { axis: "h", pos: o.y + o.height / 2, source: "element" },
      { axis: "h", pos: o.y + o.height, source: "element" },
    );
  }
  for (const g of guides) {
    if (!Number.isFinite(g.pos)) continue;
    if (g.axis === "v") v.push({ axis: "v", pos: g.pos, source: "guide" });
    else h.push({ axis: "h", pos: g.pos, source: "guide" });
  }
  return { v, h };
}

function bestShift(candidates: number[], lines: SnapLine[], threshold: number): { shift: number; line: SnapLine | null } {
  let best: SnapLine | null = null;
  let bestShift = 0;
  let bestDist = Infinity;
  for (const c of candidates) {
    for (const line of lines) {
      const dist = Math.abs(line.pos - c);
      if (dist <= threshold && dist < bestDist) {
        bestDist = dist;
        bestShift = line.pos - c;
        best = line;
      }
    }
  }
  return { shift: bestShift, line: best };
}

/**
 * Snap a dragged rect's position. Tests the left/center/right (x) and
 * top/center/bottom (y) against the targets and applies the single best
 * shift per axis. Returns the snapped origin plus the lines to render as
 * the red Figma-style indicator.
 */
export function snapDrag(
  moving: SnapRect,
  v: SnapLine[],
  h: SnapLine[],
  threshold = SNAP_THRESHOLD,
): { x: number; y: number; lines: SnapLine[] } {
  const lines: SnapLine[] = [];
  const xCandidates = [moving.x, moving.x + moving.width / 2, moving.x + moving.width];
  const yCandidates = [moving.y, moving.y + moving.height / 2, moving.y + moving.height];
  const bx = bestShift(xCandidates, v, threshold);
  const by = bestShift(yCandidates, h, threshold);
  if (bx.line) lines.push(bx.line);
  if (by.line) lines.push(by.line);
  return { x: moving.x + bx.shift, y: moving.y + by.shift, lines };
}

export type AlignMode = "left" | "center-h" | "right" | "top" | "middle" | "bottom";

/**
 * Align a rect inside its own screen (screen-local coords, origin 0,0 and
 * size cW × cH). Single-element case of Figma align: aligning one layer
 * aligns it to the parent frame. Size is preserved.
 */
export function alignRect(
  rect: SnapRect,
  cW: number,
  cH: number,
  mode: AlignMode,
): { x: number; y: number } {
  switch (mode) {
    case "left":
      return { x: 0, y: rect.y };
    case "center-h":
      return { x: (cW - rect.width) / 2, y: rect.y };
    case "right":
      return { x: cW - rect.width, y: rect.y };
    case "top":
      return { x: rect.x, y: 0 };
    case "middle":
      return { x: rect.x, y: (cH - rect.height) / 2 };
    case "bottom":
      return { x: rect.x, y: cH - rect.height };
  }
}
