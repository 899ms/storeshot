import { describe, expect, it } from "vitest";
import {
  guideKey,
  legacyGuideKeys,
  loadGuides,
  parseGuides,
  saveGuides,
} from "./guides";

describe("guideKey", () => {
  it("scopes guides per workspace and device", () => {
    expect(guideKey("/ws/a", "phone")).toBe("screenshots.guides:/ws/a::phone");
    expect(guideKey("/ws/b", "phone")).not.toBe(guideKey("/ws/a", "phone"));
    expect(guideKey("/ws/a", "tablet")).not.toBe(guideKey("/ws/a", "phone"));
    expect(guideKey(null, "phone")).toBe("screenshots.guides:__none::phone");
  });
});

describe("parseGuides", () => {
  it("accepts well-formed guides and drops junk", () => {
    expect(
      parseGuides([
        { id: "g1", axis: "h", pos: 10 },
        { id: "g2", axis: "v", pos: -5 },
      ]),
    ).toEqual([
      { id: "g1", axis: "h", pos: 10 },
      { id: "g2", axis: "v", pos: -5 },
    ]);
    expect(
      parseGuides([
        null,
        "nope",
        { id: 1, axis: "h", pos: 10 },
        { id: "g3", axis: "diagonal", pos: 10 },
        { id: "g4", axis: "h", pos: NaN },
      ]),
    ).toEqual([]);
  });

  it("rejects non-arrays and caps the count", () => {
    expect(parseGuides(null)).toEqual([]);
    expect(parseGuides({})).toEqual([]);
    const many = Array.from({ length: 150 }, (_, i) => ({
      id: `g${i}`,
      axis: "h",
      pos: i,
    }));
    expect(parseGuides(many)).toHaveLength(100);
  });
});

describe("legacyGuideKeys", () => {
  it("prefers workspace-scoped old names, then device-only keys", () => {
    expect(legacyGuideKeys("/ws/a", "phone")).toEqual([
      "screenshots.guides:/ws/a::iphone",
      "screenshots.guides:iphone",
    ]);
    expect(legacyGuideKeys("/ws/a", "tablet")).toEqual([
      "screenshots.guides:/ws/a::ipad",
      "screenshots.guides:ipad",
    ]);
  });

  it("has no legacy keys for devices without old names", () => {
    expect(legacyGuideKeys("/ws/a", "desktop")).toEqual([]);
    expect(legacyGuideKeys(null, "phone")).toEqual(["screenshots.guides:iphone"]);
  });
});

describe("loadGuides", () => {
  it("returns no guides outside the browser", () => {
    expect(loadGuides("/ws/a", "phone")).toEqual([]);
  });
});

describe("saveGuides", () => {
  it("never throws outside the browser", () => {
    expect(() =>
      saveGuides("/ws/a", "phone", [{ id: "g_1", axis: "v", pos: 120 }]),
    ).not.toThrow();
  });
});
