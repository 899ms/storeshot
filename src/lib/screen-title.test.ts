import { describe, expect, it } from "vitest";
import { screenCanvasLabel, screenIndexPrefix, slugifyScreenTitle } from "./screen-title";
import type { Slide } from "./types";

function slide(name?: string): Slide {
  return { id: "s_1", layout: "hero", name, label: {}, headline: {}, screenshot: "" };
}

describe("screenIndexPrefix", () => {
  it("always pads to 2 digits", () => {
    expect(screenIndexPrefix(0)).toBe("01");
    expect(screenIndexPrefix(11)).toBe("12");
  });
});

describe("screenCanvasLabel", () => {
  it("prefixes the index before the title", () => {
    expect(screenCanvasLabel(slide("Welcome"), 0)).toBe("01 — Welcome");
    expect(screenCanvasLabel(slide(""), 2)).toBe("03 — Screen");
  });
});

describe("slugifyScreenTitle", () => {
  it("slugifies titles for filenames", () => {
    expect(slugifyScreenTitle("Welcome")).toBe("welcome");
    expect(slugifyScreenTitle("My Feature 2!")).toBe("my-feature-2");
    expect(slugifyScreenTitle("")).toBe("screen");
    expect(slugifyScreenTitle(undefined)).toBe("screen");
  });
});
