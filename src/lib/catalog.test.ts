import { describe, expect, it } from "vitest";
import { CURATED_FONTS, curatedWeights, fontStack } from "./fonts";
import { MESH_PRESETS } from "./mesh-presets";
import { formatErrorLog } from "./error-log";

const HEX = /^#[0-9a-fA-F]{6}$/;

describe("font catalog", () => {
  it("holds 30 unique families with sane weights", () => {
    expect(CURATED_FONTS).toHaveLength(30);
    const families = CURATED_FONTS.map((f) => f.family);
    expect(new Set(families).size).toBe(30);
    for (const f of CURATED_FONTS) {
      expect(f.weights.length).toBeGreaterThan(0);
      for (const w of f.weights) expect(w % 100).toBe(0);
    }
  });

  it("resolves weights with a fallback and builds stacks", () => {
    expect(curatedWeights("Nunito")).toContain(800);
    expect(curatedWeights("Nope")).toEqual([400, 700]);
    expect(fontStack("Nunito")).toBe('"Nunito", "Inter", system-ui, sans-serif');
    expect(fontStack("")).toContain('"Inter"');
    expect(fontStack("  ")).toContain('"Inter"');
  });
});

describe("mesh presets", () => {
  it("holds 50 named presets, 25 light + 25 dark, all valid hex", () => {
    expect(MESH_PRESETS).toHaveLength(50);
    expect(MESH_PRESETS.filter((p) => p.tone === "light")).toHaveLength(25);
    expect(MESH_PRESETS.filter((p) => p.tone === "dark")).toHaveLength(25);
    const names = MESH_PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(50);
    for (const p of MESH_PRESETS) {
      expect(p.colors).toHaveLength(3);
      for (const c of p.colors) expect(c).toMatch(HEX);
    }
  });
});

describe("formatErrorLog", () => {
  it("renders entries with time, source, message, and detail", () => {
    const text = formatErrorLog([
      { id: "e1", time: 1700000000000, source: "export", message: "boom", detail: "x: y" },
    ]);
    expect(text).toContain("export");
    expect(text).toContain("boom");
    expect(text).toContain("x: y");
    expect(text).toMatch(/\[20\d\d-/);
  });

  it("renders empty logs as empty string", () => {
    expect(formatErrorLog([])).toBe("");
  });
});
