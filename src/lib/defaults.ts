import { DEFAULT_LOCALE } from "./locale";
import { PROJECT_SCHEMA_VERSION } from "./constants";
import type { Device, ProjectState, Slide } from "./types";

export function nid(): string {
  return "s_" + Math.random().toString(36).slice(2, 9);
}

// Default caption typefaces (Google Fonts family names).
export const DEFAULT_HEADLINE_FONT = "Nunito";
export const DEFAULT_LABEL_FONT = "Inter";

// Default screen background: the theme gradient.
export const DEFAULT_BACKGROUND = { kind: "theme" } as const;

function en(text: string): Record<string, string> {
  return { en: text };
}

export function makeStarterSlides(device: Device = "iphone"): Slide[] {
  // Text-only starters — all imagery comes from the user via the screenshot
  // pickers and is stored in the workspace's `screenshots/` folder.
  void device;
  return [
    {
      id: nid(),
      layout: "hero",
      label: en("THE ALL-IN-ONE APP"),
      headline: en("Simple.\nPowerful.\nYours."),
      screenshot: "",
    },
    {
      id: nid(),
      layout: "device-bottom",
      label: en("SMART WORKFLOW"),
      headline: en("Focus on what\nmatters most."),
      screenshot: "",
    },
    {
      id: nid(),
      layout: "device-bottom",
      label: en("POWERFUL TOOLS"),
      headline: en("Everything you need,\nright at hand."),
      screenshot: "",
    },
    {
      id: nid(),
      layout: "device-bottom",
      label: en("REAL-TIME SYNC"),
      headline: en("Seamless across\nevery device."),
      screenshot: "",
    },
    {
      id: nid(),
      layout: "device-top",
      label: en("DETAILED INSIGHTS"),
      headline: en("Track progress with\nclarity."),
      screenshot: "",
      inverted: true,
    },
    {
      id: nid(),
      layout: "hero",
      label: en("GET STARTED TODAY"),
      headline: en("Available now\non the App Store."),
      screenshot: "",
    },
  ];
}

export const DEFAULT_PROJECT: ProjectState = {
  schemaVersion: PROJECT_SCHEMA_VERSION,
  appName: "Visaz",
  themeId: "visaz-brand",
  connectedCanvas: true,
  locales: ["en", "es"],
  locale: DEFAULT_LOCALE,
  device: "iphone",
  orientation: "portrait",
  headlineFont: DEFAULT_HEADLINE_FONT,
  labelFont: DEFAULT_LABEL_FONT,
  background: { ...DEFAULT_BACKGROUND },
  slidesByDevice: {
    iphone: makeStarterSlides("iphone"),
    ipad: makeStarterSlides("ipad"),
  },
};

// A blank project for a workspace we haven't worked in before: no slides, no
// app icon, no sample imagery — everything the user sees comes from their own
// workspace's `screenshots/` folder once they add it.
export function makeEmptyProject(): ProjectState {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    appName: "",
    themeId: DEFAULT_PROJECT.themeId,
    connectedCanvas: true,
    locales: ["en"],
    locale: "en",
    device: "iphone",
    orientation: "portrait",
    headlineFont: DEFAULT_HEADLINE_FONT,
    labelFont: DEFAULT_LABEL_FONT,
    background: { ...DEFAULT_BACKGROUND },
    slidesByDevice: { iphone: [], ipad: [] },
  };
}

export function newSlide(layout: Slide["layout"] = "device-bottom"): Slide {
  // Static screens carry no localizable text — translations ignore them.
  if (layout === "static") {
    return { id: nid(), layout, label: {}, headline: {}, screenshot: "" };
  }
  return {
    id: nid(),
    layout,
    label: en("NEW"),
    headline: en("Edit this\nheadline."),
    screenshot: "",
  };
}

export function detectPlatform(_device?: Device): "ios" {
  return "ios";
}
