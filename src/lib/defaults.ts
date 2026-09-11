import { DEFAULT_LOCALE } from "./locale";
import { PROJECT_SCHEMA_VERSION } from "./constants";
import { MESH_PRESETS } from "./mesh-presets";
import type { Device, ProjectState, ScreenBackground, Slide } from "./types";

export function nid(): string {
  return "s_" + Math.random().toString(36).slice(2, 9);
}

// Default caption typefaces (Google Fonts family names).
export const DEFAULT_HEADLINE_FONT = "Nunito";
export const DEFAULT_LABEL_FONT = "Inter";

// A random pastel mesh preset — used as the background for new workspaces
// so every fresh deck starts with a distinct look.
export function randomMeshBackground(): ScreenBackground {
  const preset = MESH_PRESETS[Math.floor(Math.random() * MESH_PRESETS.length)];
  return { kind: "mesh", colors: [...preset.colors] };
}

function en(text: string): Record<string, string> {
  return { en: text };
}

export function makeStarterSlides(_device: Device = "phone"): Slide[] {
  // Text-only starters — all imagery comes from the user via the screenshot
  // pickers and is stored in the workspace's `screenshots/` folder.
  return [
    {
      id: nid(),
      layout: "hero",
      name: "Welcome",
      label: en("THE ALL-IN-ONE APP"),
      headline: en("Simple.\nPowerful.\nYours."),
      screenshot: "",
    },
    {
      id: nid(),
      layout: "device-bottom",
      name: "Workflow",
      label: en("SMART WORKFLOW"),
      headline: en("Focus on what\nmatters most."),
      screenshot: "",
    },
    {
      id: nid(),
      layout: "device-bottom",
      name: "Tools",
      label: en("POWERFUL TOOLS"),
      headline: en("Everything you need,\nright at hand."),
      screenshot: "",
    },
    {
      id: nid(),
      layout: "device-bottom",
      name: "Sync",
      label: en("REAL-TIME SYNC"),
      headline: en("Seamless across\nevery device."),
      screenshot: "",
    },
    {
      id: nid(),
      layout: "device-top",
      name: "Insights",
      label: en("DETAILED INSIGHTS"),
      headline: en("Track progress with\nclarity."),
      screenshot: "",
      inverted: true,
    },
    {
      id: nid(),
      layout: "hero",
      name: "Get started",
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
  device: "phone",
  headlineFont: DEFAULT_HEADLINE_FONT,
  labelFont: DEFAULT_LABEL_FONT,
  background: randomMeshBackground(),
  slidesByDevice: {
    phone: makeStarterSlides("phone"),
    tablet: makeStarterSlides("tablet"),
    desktop: makeStarterSlides("desktop"),
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
    device: "phone",
    headlineFont: DEFAULT_HEADLINE_FONT,
    labelFont: DEFAULT_LABEL_FONT,
    background: randomMeshBackground(),
    slidesByDevice: { phone: [], tablet: [], desktop: [] },
  };
}

export function newSlide(layout: Slide["layout"] = "device-bottom"): Slide {
  // Static screens carry no localizable text — translations ignore them.
  if (layout === "static") {
    return { id: nid(), layout, name: "Screen", label: {}, headline: {}, screenshot: "" };
  }
  return {
    id: nid(),
    layout,
    name: "Screen",
    label: en("NEW"),
    headline: en("Edit this\nheadline."),
    screenshot: "",
  };
}

export function detectPlatform(device?: Device): "ios" | "mac" {
  return device === "desktop" ? "mac" : "ios";
}
