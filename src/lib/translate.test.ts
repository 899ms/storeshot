import { describe, expect, it } from "vitest";
import { countPendingUnits, countSentUnits, findSourceSkips } from "./translate";
import type { Slide } from "./types";

function slide(overrides: Partial<Slide> & { id: string }): Slide {
  return {
    layout: "device-bottom",
    label: {},
    headline: {},
    screenshot: "",
    ...overrides,
  };
}

const deck: Slide[] = [
  slide({ id: "a", label: { en: "Label" }, headline: { en: "Head" } }),
  // en empty but es filled: must be skipped, never sent as English.
  slide({ id: "b", label: { es: "Etiqueta" }, headline: { en: "Head" } }),
  slide({
    id: "c",
    layout: "static",
    headline: { es: "Solo" },
    textElements: [
      {
        id: "t1",
        text: { en: "Overlay" },
        transform: { x: 0, y: 0, width: 10, height: 10 },
      },
      {
        id: "t2",
        text: { fr: "Texte" },
        transform: { x: 0, y: 0, width: 10, height: 10 },
      },
    ],
  }),
];

describe("findSourceSkips", () => {
  it("reports fields with text elsewhere but nothing in the source", () => {
    expect(findSourceSkips(deck, "en")).toEqual([
      { slideId: "b", field: "label" },
      { slideId: "c", field: "text:t2" },
    ]);
  });

  it("reports nothing when the source is complete", () => {
    expect(findSourceSkips([deck[0]], "en")).toEqual([]);
  });
});

describe("countSentUnits / countPendingUnits", () => {
  it("never counts fallback text as source units", () => {
    // a: label+headline, b: headline only, c: t1 only (overwrite mode).
    expect(countSentUnits(deck, "en", "de")).toBe(4);
    // Pending (no overwrite) counts the same here since targets are empty.
    expect(countPendingUnits(deck, "en", "de")).toBe(4);
  });

  it("excludes already-filled targets unless overwriting", () => {
    const filled: Slide[] = [
      slide({ id: "a", label: { en: "L", de: "X" }, headline: { en: "H", de: "Y" } }),
    ];
    expect(countPendingUnits(filled, "en", "de")).toBe(0);
    expect(countSentUnits(filled, "en", "de")).toBe(2);
  });
});
