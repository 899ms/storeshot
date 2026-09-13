// Multi-element arrange operations (Figma align-to-selection + distribute
// spacing). Pure geometry in screen-local canvas px so the contract stays
// unit-tested; the editor resolves element rects and commits the results.

import type { AlignMode } from "./snap";
import type { ElementTransform } from "./types";

export type ArrangeRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ArrangeAxis = "x" | "y";

/** Union bounds of a non-empty rect list. */
export function unionBounds(rects: ArrangeRect[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Align every rect within their shared union bounds (Figma multi-select
 * align). Returns the new origin per id; sizes are preserved.
 */
export function alignRectsToBounds(
  rects: ArrangeRect[],
  mode: AlignMode,
): { id: string; x: number; y: number }[] {
  if (rects.length === 0) return [];
  const b = unionBounds(rects);
  return rects.map((r) => {
    switch (mode) {
      case "left":
        return { id: r.id, x: b.x, y: r.y };
      case "center-h":
        return { id: r.id, x: b.x + (b.width - r.width) / 2, y: r.y };
      case "right":
        return { id: r.id, x: b.x + b.width - r.width, y: r.y };
      case "top":
        return { id: r.id, x: r.x, y: b.y };
      case "middle":
        return { id: r.id, x: r.x, y: b.y + (b.height - r.height) / 2 };
      case "bottom":
        return { id: r.id, x: r.x, y: b.y + b.height - r.height };
    }
  });
}

/**
 * Distribute spacing evenly along one axis (Figma distribute). The outermost
 * rects keep their positions; middles are re-spaced so every gap is equal.
 * With fewer than 3 rects there is nothing to move.
 */
export function distributeRects(
  rects: ArrangeRect[],
  axis: ArrangeAxis,
): { id: string; x: number; y: number }[] {
  if (rects.length < 3) {
    return rects.map((r) => ({ id: r.id, x: r.x, y: r.y }));
  }
  const size = axis === "x" ? "width" : "height";
  const sorted = [...rects].sort((a, b) => a[axis] - b[axis]);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const spanStart = first[axis] + first[size];
  const spanEnd = last[axis];
  const middleSize = sorted.slice(1, -1).reduce((n, r) => n + r[size], 0);
  const gap = (spanEnd - spanStart - middleSize) / (sorted.length - 1);
  let cursor = spanStart + gap;
  return sorted.map((r) => {
    if (r.id === first.id) return { id: r.id, x: r.x, y: r.y };
    if (r.id === last.id) return { id: r.id, x: r.x, y: r.y };
    const next = axis === "x" ? { id: r.id, x: cursor, y: r.y } : { id: r.id, x: r.x, y: cursor };
    cursor += r[size] + gap;
    return next;
  });
}

/** Merge arrange origins back into full transforms (rotation/z preserved). */
export function applyOrigins(
  current: Map<string, ElementTransform>,
  origins: { id: string; x: number; y: number }[],
): Map<string, ElementTransform> {
  const next = new Map(current);
  for (const o of origins) {
    const cur = next.get(o.id);
    if (cur) next.set(o.id, { ...cur, x: o.x, y: o.y });
  }
  return next;
}
