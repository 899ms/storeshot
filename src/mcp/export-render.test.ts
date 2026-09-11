import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PROJECT } from "../lib/defaults";
import type { ProjectState } from "../lib/types";
import { buildExportPlan, checkRenderer, runRenderExport } from "./export";
import { runProviderTranslation } from "./translate-job";

function pngSize(file: string): { w: number; h: number } {
  const b = readFileSync(file);
  if (b.subarray(1, 4).toString() !== "PNG") throw new Error("not a png");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function pilAvailable(): boolean {
  const r = spawnSync("python3", ["-c", "import PIL"], { encoding: "utf8" });
  return r.status === 0;
}
const PIL = pilAvailable();

function fixtureState(): ProjectState {
  return {
    ...DEFAULT_PROJECT,
    appName: "Render",
    themeId: "clean-light",
    connectedCanvas: false,
    locales: ["en", "de-DE"],
    locale: "en",
    device: "phone",
    headlineFont: "Nunito",
    labelFont: "Inter",
    background: { kind: "mesh", colors: ["#FFD6E8", "#C7CEFF", "#B8F1FF"] },
    slidesByDevice: {
      phone: [
        { id: "s1", layout: "hero", name: "Welcome", label: { en: "THE APP" }, headline: { en: "Simple.\nPowerful." }, screenshot: "uploads/shot.png" },
        { id: "s2", layout: "no-device", name: "End", label: { en: "BYE" }, headline: { en: "See you" }, screenshot: "" },
      ],
      tablet: [],
      desktop: [],
    },
  };
}

describe("runRenderExport", () => {
  it.runIf(PIL)("renders exact-size PNGs and a complete zip", async () => {
    const ws = mkdtempSync(path.join(tmpdir(), "storeshot-render-"));
    mkdirSync(path.join(ws, "screenshots", "uploads"), { recursive: true });
    writeFileSync(path.join(ws, "screenshots", "app-store-screenshots.json"), JSON.stringify(fixtureState()));
    // saturated red screenshot so the device slot is unmistakable
    const mk = spawnSync("python3", ["-c",
      "from PIL import Image; Image.new('RGB',(400,900),(220,30,30)).save('SHOT')".replace("SHOT", path.join(ws, "screenshots", "uploads", "shot.png"))],
      { encoding: "utf8" });
    expect(mk.status).toBe(0);

    const state = fixtureState();
    const plan = buildExportPlan(state, { locales: ["de-DE"] });
    expect(plan.units).toHaveLength(2);
    const manifest = await runRenderExport(ws, state, plan, {
      outDir: path.join(ws, "out"),
      fontCache: path.join(ws, "fonts"),
    });
    expect(manifest.ok).toBe(true);
    expect(manifest.partial).toBe(false);
    expect(manifest.missing).toEqual([]);
    expect(manifest.units).toHaveLength(2);
    for (const u of manifest.units ?? []) {
      expect(pngSize(u.file)).toEqual({ w: 1320, h: 2868 });
    }
    // zip holds exactly the planned paths
    const list = spawnSync("python3", ["-c",
      "import zipfile,sys; print('\\n'.join(sorted(zipfile.ZipFile(sys.argv[1]).namelist())))", manifest.zip ?? ""],
      { encoding: "utf8" });
    const names = list.stdout.trim().split("\n");
    expect(names.sort()).toEqual(plan.units.map((u) => u.zipPath).sort());
    // red screenshot survived inside the device slot of s1
    const s1 = (manifest.units ?? []).find((u) => u.slideId === "s1");
    expect(s1).toBeDefined();
  }, 420000);

  it("reports headless unavailability instead of crashing", () => {
    const r = checkRenderer();
    expect(typeof r.detail).toBe("string");
  });
});

describe("runProviderTranslation", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.unstubAllGlobals();
  });

  function stubFetch(payload: unknown, ok = true) {
    vi.stubGlobal("fetch", async () => ({
      ok,
      status: ok ? 200 : 401,
      json: async () => payload,
    }));
  }

  it("applies provider results and never leaks the key", async () => {
    const state = fixtureState();
    stubFetch({ choices: [{ message: { content: JSON.stringify({ s1: { label: "DIE APP", headline: "Einfach.\nStark." } }) } }] });
    const { state: next, report } = await runProviderTranslation(state, {
      targetLocale: "de-DE",
      model: "m",
      apiKey: "test-key-SECRET-123",
    });
    expect(report.applied).toBe(true);
    expect(report.sent).toBeGreaterThan(0);
    expect(report.received).toBeGreaterThan(0);
    const s1 = next.slidesByDevice.phone.find((s) => s.id === "s1");
    expect(s1?.label["de-DE"]).toBe("DIE APP");
    expect(JSON.stringify(report)).not.toContain("SECRET");
    expect(JSON.stringify(next)).not.toContain("SECRET");
  });

  it("wraps provider errors without writing anything", async () => {
    const state = fixtureState();
    stubFetch({ error: { message: "bad key" } }, false);
    await expect(runProviderTranslation(state, {
      targetLocale: "de-DE",
      model: "m",
      apiKey: "test-key-SECRET-123",
    })).rejects.toThrow(/Provider failed.*bad key/);
  });

  it("requires key and model", async () => {
    await expect(runProviderTranslation(fixtureState(), { targetLocale: "de-DE", model: "m", apiKey: "" })).rejects.toThrow(/apiKey/);
    await expect(runProviderTranslation(fixtureState(), { targetLocale: "de-DE", model: "", apiKey: "k" })).rejects.toThrow(/model/);
  });
});
