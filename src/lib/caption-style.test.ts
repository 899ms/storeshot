import { describe, expect, it } from "vitest";
import {
  patchCaptionStyle,
  resolveHeadlineStyle,
  resolveLabelStyle,
  slideFontFamilies,
} from "./caption-style";

describe("resolveLabelStyle", () => {
  it("falls back to defaults when no overrides are set", () => {
    const s = resolveLabelStyle({}, 1000, "Inter", "#abc");
    expect(s).toEqual({ fontSize: 28, fontWeight: 600, fontFamily: "Inter", color: "#abc" });
  });

  it("prefers per-slide overrides field by field", () => {
    const s = resolveLabelStyle(
      { labelStyle: { color: "#123", fontFamily: "Lora" } },
      1000,
      "Inter",
      "#abc",
    );
    expect(s).toEqual({ fontSize: 28, fontWeight: 600, fontFamily: "Lora", color: "#123" });
  });
});

describe("resolveHeadlineStyle", () => {
  it("falls back to defaults when no overrides are set", () => {
    const s = resolveHeadlineStyle({}, 1000, "Nunito", "#def");
    expect(s).toEqual({ fontSize: 92, fontWeight: 700, fontFamily: "Nunito", color: "#def" });
  });

  it("prefers per-slide overrides field by field", () => {
    const s = resolveHeadlineStyle(
      { headlineStyle: { fontSize: 120, fontWeight: 900 } },
      1000,
      "Nunito",
      "#def",
    );
    expect(s).toEqual({ fontSize: 120, fontWeight: 900, fontFamily: "Nunito", color: "#def" });
  });
});

describe("patchCaptionStyle", () => {
  it("merges onto the current style and clears back to undefined when empty", () => {
    expect(patchCaptionStyle(undefined, { color: "#123" })).toEqual({ color: "#123" });
    expect(patchCaptionStyle({ color: "#123" }, { color: undefined })).toBeUndefined();
  });
});

describe("slideFontFamilies", () => {
  it("collects caption + overlay families without duplicates", () => {
    expect(
      slideFontFamilies({
        labelStyle: { fontFamily: "Lora" },
        headlineStyle: { fontFamily: "Lora" },
        textElements: [{ id: "a", text: {}, transform: { x: 0, y: 0, width: 1, height: 1 }, fontFamily: "Oswald" }],
      }),
    ).toEqual(["Lora", "Oswald"]);
    expect(slideFontFamilies({})).toEqual([]);
  });
});
