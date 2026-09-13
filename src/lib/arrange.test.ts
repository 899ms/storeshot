import { describe, expect, it } from "vitest";
import {
  alignRectsToBounds,
  applyOrigins,
  distributeRects,
  unionBounds,
} from "./arrange";

const rects = [
  { id: "a", x: 0, y: 0, width: 100, height: 50 },
  { id: "b", x: 200, y: 100, width: 100, height: 50 },
  { id: "c", x: 500, y: 300, width: 100, height: 50 },
];

describe("unionBounds", () => {
  it("covers every rect", () => {
    expect(unionBounds(rects)).toEqual({ x: 0, y: 0, width: 600, height: 350 });
  });
});

describe("alignRectsToBounds", () => {
  it("aligns left edges to the union left", () => {
    expect(alignRectsToBounds(rects, "left")).toEqual([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 0, y: 100 },
      { id: "c", x: 0, y: 300 },
    ]);
  });

  it("centers horizontally within the union", () => {
    expect(alignRectsToBounds(rects, "center-h")).toEqual([
      { id: "a", x: 250, y: 0 },
      { id: "b", x: 250, y: 100 },
      { id: "c", x: 250, y: 300 },
    ]);
  });

  it("aligns bottoms to the union bottom", () => {
    const out = alignRectsToBounds(rects, "bottom");
    expect(out.find((o) => o.id === "a")).toEqual({ id: "a", x: 0, y: 300 });
    expect(out.find((o) => o.id === "c")).toEqual({ id: "c", x: 500, y: 300 });
  });

  it("returns empty for empty input", () => {
    expect(alignRectsToBounds([], "left")).toEqual([]);
  });
});

describe("distributeRects", () => {
  it("equalizes gaps and pins the outermost rects", () => {
    const out = distributeRects(rects, "x");
    const byId = Object.fromEntries(out.map((o) => [o.id, o]));
    // Span 500-100, middle width 100 → gap 150 each side.
    expect(byId.a).toEqual({ id: "a", x: 0, y: 0 });
    expect(byId.b).toEqual({ id: "b", x: 250, y: 100 });
    expect(byId.c).toEqual({ id: "c", x: 500, y: 300 });
  });

  it("distributes vertically", () => {
    const out = distributeRects(rects, "y");
    const byId = Object.fromEntries(out.map((o) => [o.id, o]));
    // Span 300-50, middle height 50 → gap 100 each side.
    expect(byId.a).toEqual({ id: "a", x: 0, y: 0 });
    expect(byId.b).toEqual({ id: "b", x: 200, y: 150 });
    expect(byId.c).toEqual({ id: "c", x: 500, y: 300 });
  });

  it("is a no-op with fewer than 3 rects", () => {
    expect(distributeRects(rects.slice(0, 2), "x")).toEqual([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 200, y: 100 },
    ]);
  });
});

describe("applyOrigins", () => {
  it("merges origins while preserving rotation and zIndex", () => {
    const current = new Map([
      ["a", { x: 0, y: 0, width: 10, height: 10, rotation: 15, zIndex: 7 }],
    ]);
    const next = applyOrigins(current, [{ id: "a", x: 5, y: 6 }]);
    expect(next.get("a")).toEqual({ x: 5, y: 6, width: 10, height: 10, rotation: 15, zIndex: 7 });
  });
});
