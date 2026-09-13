import { describe, expect, it } from "vitest";
import {
  alignRect,
  buildSnapTargets,
  loadSnap,
  snapDrag,
  snapThresholdForScale,
} from "./snap";

describe("buildSnapTargets", () => {
  it("includes screen edges and center in deck-global space", () => {
    const { v, h } = buildSnapTargets({ screenOrigins: [100], cW: 200, cH: 400, others: [], guides: [] });
    expect(v.map((l) => l.pos)).toEqual([100, 200, 300]);
    expect(h.map((l) => l.pos)).toEqual([0, 200, 400]);
    expect(v.every((l) => l.source === "canvas")).toBe(true);
  });

  it("covers every screen origin and dedups shared edges", () => {
    const { v } = buildSnapTargets({ screenOrigins: [0, 1000], cW: 1000, cH: 1000, others: [], guides: [] });
    // 0, 500, 1000(shared), 1500, 2000 — the shared edge keeps one line.
    expect(v.map((l) => l.pos)).toEqual([0, 500, 1000, 1500, 2000]);
  });

  it("adds sibling edges/centers and splits guides by axis", () => {
    const { v, h } = buildSnapTargets({
      screenOrigins: [0],
      cW: 1000,
      cH: 1000,
      others: [{ x: 10, y: 20, width: 100, height: 60 }],
      guides: [
        { axis: "v", pos: 500 },
        { axis: "h", pos: 600 },
      ],
    });
    expect(v.map((l) => l.pos)).toContain(10);
    expect(v.map((l) => l.pos)).toContain(60);
    expect(v.map((l) => l.pos)).toContain(110);
    expect(v.map((l) => l.pos)).toContain(500);
    expect(h.map((l) => l.pos)).toContain(20);
    expect(h.map((l) => l.pos)).toContain(50);
    expect(h.map((l) => l.pos)).toContain(80);
    expect(h.map((l) => l.pos)).toContain(600);
  });

  it("skips degenerate siblings and non-finite guides", () => {
    const { v, h } = buildSnapTargets({
      screenOrigins: [0],
      cW: 100,
      cH: 100,
      others: [
        { x: 5, y: 5, width: 0, height: 10 },
        { x: NaN, y: 0, width: 10, height: 10 },
      ],
      guides: [{ axis: "v", pos: NaN }],
    });
    // Only the 3 canvas lines per axis survive.
    expect(v).toHaveLength(3);
    expect(h).toHaveLength(3);
  });
});

describe("snapThresholdForScale", () => {
  it("holds ~5 screen px across zoom levels", () => {
    expect(snapThresholdForScale(1)).toBe(5);
    expect(snapThresholdForScale(0.2)).toBe(25);
    expect(snapThresholdForScale(0.5)).toBe(10);
  });

  it("clamps extremes and degrades safely", () => {
    expect(snapThresholdForScale(0.05)).toBe(48);
    expect(snapThresholdForScale(10)).toBe(4);
    expect(snapThresholdForScale(0)).toBe(5);
    expect(snapThresholdForScale(NaN)).toBe(5);
  });

  it("custom thresholds still gate snapping", () => {
    const targets = buildSnapTargets({ screenOrigins: [0], cW: 1000, cH: 1000, others: [], guides: [] });
    // 20px from the left edge: snaps at fit-zoom gravity, ignores at 8px.
    // (At fit zoom ≈0.2 the old fixed 8 canvas px were ≈1.6 screen px.)
    expect(snapDrag({ x: 20, y: 50, width: 100, height: 100 }, targets.v, targets.h, 25).x).toBe(0);
    expect(snapDrag({ x: 20, y: 50, width: 100, height: 100 }, targets.v, targets.h, 8).x).toBe(20);
  });
});

describe("snapDrag", () => {
  const targets = buildSnapTargets({ screenOrigins: [0], cW: 1000, cH: 1000, others: [], guides: [] });

  it("snaps the left edge to the canvas left edge", () => {
    const r = snapDrag({ x: 5, y: 300, width: 100, height: 100 }, targets.v, targets.h);
    expect(r.x).toBe(0);
    expect(r.lines).toContainEqual({ axis: "v", pos: 0, source: "canvas" });
  });

  it("snaps centers to the canvas center", () => {
    // Center at 505 vs canvas center 500: within threshold.
    const r = snapDrag({ x: 455, y: 450, width: 100, height: 100 }, targets.v, targets.h);
    expect(r.x).toBe(450);
    expect(r.y).toBe(450);
  });

  it("leaves rects alone outside the threshold", () => {
    const r = snapDrag({ x: 50, y: 50, width: 100, height: 100 }, targets.v, targets.h);
    expect(r.x).toBe(50);
    expect(r.y).toBe(50);
    expect(r.lines).toEqual([]);
  });

  it("prefers the nearest target per axis", () => {
    const { v, h } = buildSnapTargets({
      screenOrigins: [0],
      cW: 1000,
      cH: 1000,
      others: [{ x: 200, y: 0, width: 100, height: 100 }],
      guides: [],
    });
    // Right edge at 207: 7px from sibling left (200), farther from canvas lines.
    const r = snapDrag({ x: 107, y: 50, width: 100, height: 100 }, v, h);
    expect(r.x).toBe(100);
    expect(r.lines).toContainEqual({ axis: "v", pos: 200, source: "element" });
  });

  it("snaps to guides", () => {
    const { v, h } = buildSnapTargets({
      screenOrigins: [0],
      cW: 1000,
      cH: 1000,
      others: [],
      guides: [{ axis: "v", pos: 700 }],
    });
    const r = snapDrag({ x: 696, y: 50, width: 100, height: 100 }, v, h);
    expect(r.x).toBe(700);
    expect(r.lines).toContainEqual({ axis: "v", pos: 700, source: "guide" });
  });
});

describe("alignRect", () => {
  const rect = { x: 10, y: 20, width: 100, height: 60 };

  it("aligns horizontally within the screen", () => {
    expect(alignRect(rect, 1000, 2000, "left")).toEqual({ x: 0, y: 20 });
    expect(alignRect(rect, 1000, 2000, "center-h")).toEqual({ x: 450, y: 20 });
    expect(alignRect(rect, 1000, 2000, "right")).toEqual({ x: 900, y: 20 });
  });

  it("aligns vertically within the screen", () => {
    expect(alignRect(rect, 1000, 2000, "top")).toEqual({ x: 10, y: 0 });
    expect(alignRect(rect, 1000, 2000, "middle")).toEqual({ x: 10, y: 970 });
    expect(alignRect(rect, 1000, 2000, "bottom")).toEqual({ x: 10, y: 1940 });
  });
});

describe("loadSnap", () => {
  it("defaults to on outside the browser", () => {
    expect(loadSnap()).toBe(true);
  });
});
