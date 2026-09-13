import { describe, expect, it } from "vitest";
import { CANVAS } from "./constants";
import {
  adaptSlideGeometry,
  cloneSlide,
  CopySlidesError,
  copySlidesToDevices,
  richestOtherDevice,
} from "./copy-slides";
import { DEFAULT_PROJECT } from "./defaults";
import type { ProjectState, Slide, TextElement } from "./types";

function slide(partial: Partial<Slide> = {}): Slide {
  return {
    id: "src",
    layout: "device-bottom",
    name: "Welcome",
    label: { en: "NEW", de: "NEU" },
    headline: { en: "Hello" },
    screenshot: "uploads/a.png",
    screenshotSecondary: "uploads/b.png",
    inverted: true,
    transforms: {
      caption: { x: 10, y: 20, width: 100, height: 50, rotation: 15, zIndex: 4 },
      device: { x: 40, y: 80, width: 200, height: 400, flipH: true },
    },
    labelStyle: { fontSize: 20, fontWeight: 600, color: "#fff" },
    headlineStyle: { fontWeight: 800 },
    textElements: [
      {
        id: "t1",
        text: { en: "Badge" },
        transform: { x: 100, y: 200, width: 300, height: 80, rotation: 10, zIndex: 6 },
        fontSize: 40,
        fontWeight: 700,
        align: "center",
      },
    ],
    background: { kind: "mesh", colors: ["#111111", "#222222"], opacity: 0.8 },
    ...partial,
  };
}

function seqIds(ids: string[]): () => string {
  let i = 0;
  return () => {
    const id = ids[i];
    if (!id) throw new Error(`id factory exhausted at ${i}`);
    i += 1;
    return id;
  };
}

function project(partial: Partial<ProjectState> = {}): ProjectState {
  return {
    ...DEFAULT_PROJECT,
    device: "phone",
    slidesByDevice: { phone: [slide()], tablet: [], desktop: [] },
    ...partial,
  };
}

describe("cloneSlide", () => {
  it("deep-copies with new ids and no shared nested identity", () => {
    const src = slide();
    const copy = cloneSlide(src, seqIds(["s2", "t2"]));
    expect(copy.id).toBe("s2");
    expect(copy.id).not.toBe(src.id);
    expect(copy.textElements?.[0].id).toBe("t2");
    expect(copy.label).toEqual(src.label);
    expect(copy.label).not.toBe(src.label);
    expect(copy.headline).not.toBe(src.headline);
    expect(copy.transforms).toEqual(src.transforms);
    expect(copy.transforms).not.toBe(src.transforms);
    expect(copy.transforms?.caption).not.toBe(src.transforms?.caption);
    expect(copy.textElements?.[0].text).not.toBe(src.textElements?.[0].text);
    expect(copy.textElements?.[0].transform).not.toBe(src.textElements?.[0].transform);
    expect(copy.background).toEqual(src.background);
    expect(copy.background).not.toBe(src.background);
    if (copy.background?.kind === "mesh" && src.background?.kind === "mesh") {
      expect(copy.background.colors).not.toBe(src.background.colors);
    }
    copy.label.en = "CHANGED";
    expect(src.label.en).toBe("NEW");
  });
});

describe("adaptSlideGeometry", () => {
  it("drops built-in transforms and scales overlay text + caption fontSize", () => {
    const src = slide();
    const adapted = adaptSlideGeometry(src, { w: 1000, h: 2000 }, { w: 2000, h: 1000 });
    expect(adapted.transforms).toBeUndefined();
    expect(adapted.layout).toBe(src.layout);
    expect(adapted.screenshot).toBe(src.screenshot);
    expect(adapted.screenshotSecondary).toBe(src.screenshotSecondary);
    expect(adapted.inverted).toBe(true);
    expect(adapted.name).toBe("Welcome");
    expect(adapted.label).toEqual(src.label);
    // sx=2, sy=0.5, sFont=0.5
    const text = adapted.textElements?.[0] as TextElement;
    expect(text.transform).toMatchObject({ x: 200, y: 100, width: 600, height: 40, rotation: 10, zIndex: 6 });
    expect(text.fontSize).toBe(20);
    expect(adapted.labelStyle?.fontSize).toBe(10);
    expect(adapted.labelStyle?.fontWeight).toBe(600);
    expect(adapted.headlineStyle?.fontWeight).toBe(800);
    expect(adapted.headlineStyle?.fontSize).toBeUndefined();
  });
});

describe("copySlidesToDevices", () => {
  it("appends clones onto an empty dest and leaves the source unchanged", () => {
    const src = project();
    const result = copySlidesToDevices(src, {
      from: "phone",
      to: ["tablet"],
      mode: "append",
      nid: seqIds(["n1", "n2"]),
    });
    expect(result.copied).toBe(1);
    expect(result.targets).toEqual(["tablet"]);
    expect(result.firstSlideId).toBe("n1");
    expect(result.state.slidesByDevice.phone).toBe(src.slidesByDevice.phone);
    expect(result.state.slidesByDevice.tablet).toHaveLength(1);
    expect(result.state.slidesByDevice.tablet[0].id).toBe("n1");
    expect(result.state.slidesByDevice.tablet[0].transforms).toBeUndefined();
    expect(result.state.slidesByDevice.tablet[0].screenshot).toBe("uploads/a.png");
    expect(result.state.slidesByDevice.phone[0].id).toBe("src");
  });

  it("replace overwrites dest; append concatenates; multi-target writes every dest", () => {
    const existing: Slide = {
      id: "old",
      layout: "hero",
      label: {},
      headline: {},
      screenshot: "",
    };
    const src = project({
      slidesByDevice: {
        phone: [slide({ id: "a" }), slide({ id: "b", name: "Two" })],
        tablet: [existing],
        desktop: [existing],
      },
    });
    const replaced = copySlidesToDevices(src, {
      from: "phone",
      to: ["tablet", "desktop"],
      mode: "replace",
      nid: seqIds(["t1", "t2", "t3", "t4", "d1", "d2", "d3", "d4"]),
    });
    expect(replaced.state.slidesByDevice.tablet.map((s) => s.id)).toEqual(["t1", "t3"]);
    expect(replaced.state.slidesByDevice.desktop.map((s) => s.id)).toEqual(["d1", "d3"]);
    expect(replaced.firstSlideId).toBe("t1");
    expect(replaced.copied).toBe(2);

    const appended = copySlidesToDevices(src, {
      from: "phone",
      to: ["tablet"],
      mode: "append",
      slideIds: ["b"],
      nid: seqIds(["x1", "x2"]),
    });
    expect(appended.state.slidesByDevice.tablet.map((s) => s.id)).toEqual(["old", "x1"]);
    expect(appended.copied).toBe(1);
  });

  it("uses custom canvas sizes when scaling overlay text", () => {
    const src = project({
      canvasSizes: {
        phone: { w: 1000, h: 2000 },
        tablet: { w: 3000, h: 4000 },
      },
    });
    const result = copySlidesToDevices(src, {
      from: "phone",
      to: ["tablet"],
      mode: "replace",
      nid: seqIds(["n1", "n2"]),
    });
    const text = result.state.slidesByDevice.tablet[0].textElements?.[0];
    // sx=3, sy=2
    expect(text?.transform).toMatchObject({ x: 300, y: 400, width: 900, height: 160 });
    expect(text?.fontSize).toBe(80);
  });

  it("throws on empty source, self-copy, and unknown slide ids", () => {
    expect(() =>
      copySlidesToDevices(project({ slidesByDevice: { phone: [], tablet: [], desktop: [] } }), {
        from: "phone",
        to: ["tablet"],
        mode: "append",
      }),
    ).toThrow(CopySlidesError);
    expect(() =>
      copySlidesToDevices(project(), { from: "phone", to: ["phone"], mode: "append" }),
    ).toThrow(/itself/);
    expect(() =>
      copySlidesToDevices(project(), {
        from: "phone",
        to: ["tablet"],
        mode: "append",
        slideIds: ["missing"],
      }),
    ).toThrow(/Unknown slide id/);
    expect(() =>
      copySlidesToDevices(project(), { from: "phone", to: [], mode: "append" }),
    ).toThrow(/non-empty/);
  });

  it("picks the other device with the most screens", () => {
    expect(
      richestOtherDevice({ phone: [slide()], tablet: [], desktop: [] }, "tablet"),
    ).toEqual({ device: "phone", count: 1 });
    expect(
      richestOtherDevice({ phone: [], tablet: [], desktop: [] }, "phone"),
    ).toBeNull();
  });

  it("scales against built-in canvas sizes by default", () => {
    const src = project();
    const result = copySlidesToDevices(src, {
      from: "phone",
      to: ["desktop"],
      mode: "replace",
      nid: seqIds(["n1", "n2"]),
    });
    const sx = CANVAS.desktop.w / CANVAS.phone.w;
    const sy = CANVAS.desktop.h / CANVAS.phone.h;
    const text = result.state.slidesByDevice.desktop[0].textElements?.[0];
    expect(text?.transform.x).toBeCloseTo(100 * sx);
    expect(text?.transform.y).toBeCloseTo(200 * sy);
  });
});
