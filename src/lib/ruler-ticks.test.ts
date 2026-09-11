import { describe, expect, it } from "vitest";
import { chooseStep, ticksForRange } from "./ruler-ticks";

describe("chooseStep", () => {
  it("picks readable label spacing per zoom", () => {
    expect(chooseStep(1)).toBe(100);
    expect(chooseStep(2)).toBe(50);
    expect(chooseStep(0.2)).toBe(500);
    expect(chooseStep(0.05)).toBe(2000);
  });

  it("falls back to scale-1 behavior on bad input", () => {
    expect(chooseStep(0)).toBe(100);
    expect(chooseStep(NaN)).toBe(100);
  });
});

describe("ticksForRange", () => {
  it("aligns ticks to the step", () => {
    expect(ticksForRange(0, 250, 100)).toEqual([0, 100, 200]);
    expect(ticksForRange(-30, 120, 50)).toEqual([0, 50, 100]);
  });

  it("rejects bad input", () => {
    expect(ticksForRange(10, 0, 50)).toEqual([]);
    expect(ticksForRange(0, 100, 0)).toEqual([]);
  });
});
