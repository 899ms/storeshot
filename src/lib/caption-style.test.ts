import { describe, expect, it } from "vitest";
import {
  DEFAULT_HEADLINE_SIZE_FACTOR,
  DEFAULT_HEADLINE_WEIGHT,
  DEFAULT_LABEL_SIZE_FACTOR,
  DEFAULT_LABEL_WEIGHT,
  resolveHeadlineStyle,
  resolveLabelStyle,
} from "./caption-style";

const UNIT = 1000;

describe("resolveLabelStyle", () => {
  it("falls back to builtins when nothing is set (pixel-identical legacy)", () => {
    expect(resolveLabelStyle({}, UNIT, "Inter", "#accent")).toEqual({
      fontSize: UNIT * DEFAULT_LABEL_SIZE_FACTOR,
      fontWeight: DEFAULT_LABEL_WEIGHT,
      fontFamily: "Inter",
      color: "#accent",
    });
  });

  it("applies globals when no per-slide override exists", () => {
    expect(
      resolveLabelStyle({}, UNIT, "Inter", "#accent", {
        fontWeight: 800,
        sizeFactor: 0.05,
        color: "#123456",
      }),
    ).toEqual({ fontSize: UNIT * 0.05, fontWeight: 800, fontFamily: "Inter", color: "#123456" });
  });

  it("prefers per-slide overrides over globals", () => {
    expect(
      resolveLabelStyle(
        { labelStyle: { fontSize: 42, fontWeight: 400, color: "#fff" } },
        UNIT,
        "Inter",
        "#accent",
        { fontWeight: 800, sizeFactor: 0.05, color: "#123456" },
      ),
    ).toEqual({ fontSize: 42, fontWeight: 400, fontFamily: "Inter", color: "#fff" });
  });
});

describe("resolveHeadlineStyle", () => {
  it("falls back to builtins when nothing is set (pixel-identical legacy)", () => {
    expect(resolveHeadlineStyle({}, UNIT, "Nunito", "#fg")).toEqual({
      fontSize: UNIT * DEFAULT_HEADLINE_SIZE_FACTOR,
      fontWeight: DEFAULT_HEADLINE_WEIGHT,
      fontFamily: "Nunito",
      color: "#fg",
    });
  });

  it("applies globals when no per-slide override exists", () => {
    expect(
      resolveHeadlineStyle({}, UNIT, "Nunito", "#fg", {
        fontWeight: 900,
        sizeFactor: 0.12,
        color: "#654321",
      }),
    ).toEqual({ fontSize: UNIT * 0.12, fontWeight: 900, fontFamily: "Nunito", color: "#654321" });
  });

  it("prefers per-slide overrides over globals", () => {
    expect(
      resolveHeadlineStyle(
        { headlineStyle: { fontWeight: 400 } },
        UNIT,
        "Nunito",
        "#fg",
        { fontWeight: 900, sizeFactor: 0.12, color: "#654321" },
      ),
    ).toEqual({
      fontSize: UNIT * 0.12,
      fontWeight: 400,
      fontFamily: "Nunito",
      color: "#654321",
    });
  });
});
