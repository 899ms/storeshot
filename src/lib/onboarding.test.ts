import { describe, expect, it } from "vitest";
import { buildSampleDeck, isUntouchedDeck, SAMPLE_IMAGES } from "./onboarding";
import { makeStarterSlides } from "./defaults";

describe("isUntouchedDeck", () => {
  it("treats the starter deck as untouched", () => {
    expect(isUntouchedDeck(makeStarterSlides())).toBe(true);
    expect(isUntouchedDeck([])).toBe(true);
  });

  it("treats any real content as touched", () => {
    const [first, ...rest] = makeStarterSlides();
    expect(isUntouchedDeck([{ ...first, screenshot: "uploads/a.png" }, ...rest])).toBe(false);
    expect(
      isUntouchedDeck([
        { ...first, textElements: [{ id: "x", text: {}, transform: { x: 0, y: 0, width: 1, height: 1 } }] },
        ...rest,
      ]),
    ).toBe(false);
    expect(isUntouchedDeck([{ ...first, transforms: { caption: { x: 0, y: 0, width: 1, height: 1 } } }, ...rest])).toBe(
      false,
    );
    expect(isUntouchedDeck(makeStarterSlides(), "uploads/icon.png")).toBe(false);
  });
});

describe("buildSampleDeck", () => {
  it("fills screenshot slots with bundled samples, preserving ids", () => {
    const slides = makeStarterSlides();
    const next = buildSampleDeck(slides);
    expect(next).toHaveLength(slides.length);
    for (const [i, s] of next.entries()) {
      expect(s.screenshot).toBe(SAMPLE_IMAGES[i % SAMPLE_IMAGES.length]);
      expect(s.id).toBe(slides[i].id);
    }
    // Untouched apart from screenshots: originals stay pristine.
    expect(slides.every((s) => !s.screenshot)).toBe(true);
  });
});
