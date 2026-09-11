import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT } from "../lib/defaults";
import type { ProjectState } from "../lib/types";
import { isProjectShape, loadProject, McpError, saveProject, storeUpload } from "./project-io";
import {
  addSlide,
  deleteSlide,
  lintDeck,
  listSlides,
  previewExportPaths,
  previewTranslation,
  reorderSlides,
  setBackground,
  setLocales,
  setScreenshot,
  updateCopy,
} from "./tools";

function state(): ProjectState {
  return {
    ...DEFAULT_PROJECT,
    locales: ["en", "de-DE"],
    locale: "en",
    device: "phone",
    slidesByDevice: { phone: [], tablet: [], desktop: [] },
  };
}

describe("mcp tools", () => {
  it("adds a slide and updates en copy", () => {
    const s0 = state();
    const { state: s1, slideId } = addSlide(s0, { layout: "hero", name: "Welcome" });
    expect(s1.slidesByDevice.phone).toHaveLength(1);
    const s2 = updateCopy(s1, { slideId, field: "headline", locale: "en", value: "Hello\nWorld" });
    expect(listSlides(s2).slides[0].headline).toEqual({ en: "Hello\nWorld" });
  });

  it("rejects static label edits and bad layouts", () => {
    const { state: s1, slideId } = addSlide(state(), { layout: "static" });
    expect(() => updateCopy(s1, { slideId, field: "label", locale: "en", value: "x" })).toThrow(McpError);
    expect(() => updateCopy(s1, { slideId, field: "text:nope", locale: "en", value: "x" })).toThrow(McpError);
  });

  it("reorders and deletes with confirm guard", () => {
    let s = state();
    const a = addSlide(s, {}); s = a.state;
    const b = addSlide(s, {}); s = b.state;
    expect(() => deleteSlide(s, { slideId: b.slideId })).toThrow(McpError);
    s = reorderSlides(s, { orderedIds: [b.slideId, a.slideId] });
    expect(s.slidesByDevice.phone[0].id).toBe(b.slideId);
    s = deleteSlide(s, { slideId: b.slideId, confirm: true });
    expect(s.slidesByDevice.phone).toHaveLength(1);
  });

  it("validates locales and backgrounds", () => {
    expect(() => setLocales(state(), { locales: ["de-DE"] })).toThrow(McpError);
    expect(() => setLocales(state(), { locales: ["en", "fr-FR"] })).toThrow(McpError);
    const s = setLocales(state(), { locales: ["en", "fr-FR"], confirm: true });
    expect(s.locales).toEqual(["en", "fr-FR"]);
    expect(() => setBackground(state(), { kind: "mesh", colors: ["red"] })).toThrow(McpError);
    const b = setBackground(state(), { kind: "mesh", colors: ["#ffffff", "#000000"] });
    expect(b.background).toMatchObject({ kind: "mesh" });
  });

  it("rejects inline screenshot data urls", () => {
    const { state: s1, slideId } = addSlide(state(), {});
    expect(() => setScreenshot(s1, { slideId, path: "data:image/png;base64,xx" })).toThrow(McpError);
    const s2 = setScreenshot(s1, { slideId, path: "uploads/abc.png" });
    expect(s2.slidesByDevice.phone[0].screenshot).toBe("uploads/abc.png");
  });

  it("lints missing copy and previews translation + export paths", () => {
    const { state: s1, slideId } = addSlide(state(), { name: "Welcome" });
    const s1b = updateCopy(s1, { slideId, field: "headline", locale: "de-DE", value: "Hallo" });
    const s2 = updateCopy(s1b, { slideId, field: "headline", locale: "en", value: "" });
    const lint = lintDeck(s2);
    expect(lint.issues.some((i) => i.field === "headline")).toBe(true);
    const prev = previewTranslation(s2, { targetLocale: "de-DE", sourceLocale: "en" });
    expect(prev.pendingUnits).toBeGreaterThan(0);
    const paths = previewExportPaths(s2, { locales: ["en", "de-DE"], preset: "standard", store: "apple" });
    expect(paths.count).toBeGreaterThan(0);
    expect(paths.paths[0]).toMatch(/\.png$/);
  });
});

describe("mcp project-io", () => {
  it("rejects bad shapes and relative workspaces", async () => {
    expect(isProjectShape({})).toBe(false);
    expect(isProjectShape({ slidesByDevice: {}, locales: ["en"] })).toBe(true);
    await expect(loadProject("relative/path")).rejects.toThrow();
  });

  it("migrates legacy iphone/ipad decks on load", async () => {
    const ws = mkdtempSync(path.join(tmpdir(), "storeshot-legacy-"));
    const { promises: fs } = await import("node:fs");
    await fs.mkdir(path.join(ws, "screenshots"), { recursive: true });
    const slide = { id: "s1", layout: "hero", name: "Hi", label: { en: "L" }, headline: { en: "H" }, screenshot: "" };
    await fs.writeFile(
      path.join(ws, "screenshots", "app-store-screenshots.json"),
      JSON.stringify({ appName: "Old", locales: ["en"], locale: "en", device: "iphone", slidesByDevice: { iphone: [slide], ipad: [] } }),
    );
    const back = await loadProject(ws);
    expect(back?.device).toBe("phone");
    expect(back?.slidesByDevice.phone).toHaveLength(1);
    // legacy device names still accepted as input
    expect(listSlides(back as ProjectState, "iphone").device).toBe("phone");
  });

  it("round-trips save/load and stores uploads", async () => {
    const ws = mkdtempSync(path.join(tmpdir(), "storeshot-mcp-"));
    const s = state();
    await saveProject(ws, s);
    const back = await loadProject(ws);
    expect(back?.locales).toEqual(["en", "de-DE"]);
    const p = await storeUpload(ws, "data:image/png;base64,iVBORw0KGgo=");
    expect(p).toMatch(/^uploads\/[0-9a-f]{16}\.png$/);
    await expect(storeUpload(ws, "data:image/gif;base64,xx")).rejects.toThrow(McpError);
  });
});
