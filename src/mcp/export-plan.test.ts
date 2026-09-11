import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT } from "../lib/defaults";
import type { ProjectState } from "../lib/types";
import { buildExportPlan, checkRenderer } from "./export";
import { McpError } from "./project-io";

function state(): ProjectState {
  return {
    ...DEFAULT_PROJECT,
    appName: "Plan",
    locales: ["en", "sl", "de-DE"],
    locale: "en",
    device: "phone",
    slidesByDevice: {
      phone: [
        { id: "a", layout: "hero", name: "Welcome", label: { en: "HI" }, headline: { en: "Ho" }, screenshot: "" },
        { id: "b", layout: "device-bottom", name: "Work", label: { en: "W" }, headline: { en: "Wo" }, screenshot: "" },
        { id: "c", layout: "no-device", name: "End", label: { en: "E" }, headline: { en: "En" }, screenshot: "" },
      ],
      tablet: [],
      desktop: [],
    },
  };
}

describe("buildExportPlan", () => {
  it("numbers by selection position without gaps", () => {
    const plan = buildExportPlan(state(), { slideIds: ["a", "c"] });
    expect(plan.units).toHaveLength(4); // 2 slides x 2 exportable locales (en skipped)
    const names = plan.units.map((u) => u.zipPath);
    expect(names.filter((n) => n.includes("/01-"))).toHaveLength(2);
    expect(names.filter((n) => n.includes("/02-"))).toHaveLength(2);
    expect(names.some((n) => n.includes("/03-"))).toBe(false);
  });

  it("uses store folder codes and skips source-only locales", () => {
    const apple = buildExportPlan(state(), {});
    expect(apple.skipped.some((s) => s.startsWith("en"))).toBe(true);
    expect(apple.units.some((u) => u.zipPath.includes("/sl-SI/"))).toBe(true);
    const google = buildExportPlan(state(), { store: "google" });
    expect(google.units.some((u) => u.zipPath.includes("/sl/"))).toBe(true);
    expect(google.units.some((u) => u.zipPath.includes("sl-SI"))).toBe(false);
  });

  it("rejects unknown targets and slides", () => {
    expect(() => buildExportPlan(state(), { targets: ["nope"] })).toThrow(McpError);
    expect(() => buildExportPlan(state(), { slideIds: ["zzz"] })).toThrow(McpError);
    expect(() => buildExportPlan(state(), { locales: ["en"] })).toThrow(McpError);
  });

  it("picks the device deck and canvas", () => {
    const plan = buildExportPlan({ ...state(), device: "phone" }, { device: "phone" });
    expect(plan.canvas).toEqual({ w: 1320, h: 2868 });
    expect(plan.device).toBe("phone");
  });

  it("honors canvas size overrides and blocks desktop without targets", () => {
    const plan = buildExportPlan(state(), {});
    expect(plan.canvas.w).toBe(1320);
    const custom = buildExportPlan(
      { ...state(), canvasSizes: { phone: { w: 1290, h: 2796 } } },
      {},
    );
    expect(custom.canvas).toEqual({ w: 1290, h: 2796 });
    const d = { ...state(), device: "desktop" as const, slidesByDevice: { phone: [], tablet: [], desktop: [{ id: "x", layout: "hero" as const, name: "D", label: {}, headline: {}, screenshot: "" }] } };
    const dp = buildExportPlan(d, { locales: ["de-DE"] });
    expect(dp.device).toBe("desktop");
    expect(dp.units).toHaveLength(1);
    expect(dp.units[0].zipPath).toContain("apple/desktop/de-DE/");
    expect(dp.units[0].target.w).toBe(2880);
  });
});

describe("checkRenderer", () => {
  it("reports a shaped availability result", () => {
    const r = checkRenderer();
    expect(typeof r.ok).toBe("boolean");
    expect(typeof r.detail).toBe("string");
  });
});
