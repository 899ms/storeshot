import { DEFAULT_LOCALE } from "./locale";
import { PROJECT_SCHEMA_VERSION } from "./constants";
import type { Device, ProjectState, Slide } from "./types";

export function nid(): string {
  return "s_" + Math.random().toString(36).slice(2, 9);
}

function en(text: string): Record<string, string> {
  return { en: text };
}

export function makeStarterSlides(): Slide[] {
  return [
    {
      id: nid(),
      layout: "hero",
      label: en("THE ALL-IN-ONE APP"),
      headline: en("Simple.\nPowerful.\nYours."),
      screenshot: "/screenshots/apple/iphone/{locale}/01.png",
    },
    {
      id: nid(),
      layout: "device-bottom",
      label: en("SMART WORKFLOW"),
      headline: en("Focus on what\nmatters most."),
      screenshot: "/screenshots/apple/iphone/{locale}/05.png",
    },
    {
      id: nid(),
      layout: "device-bottom",
      label: en("POWERFUL TOOLS"),
      headline: en("Everything you need,\nright at hand."),
      screenshot: "/screenshots/apple/iphone/{locale}/02.png",
    },
    {
      id: nid(),
      layout: "device-bottom",
      label: en("REAL-TIME SYNC"),
      headline: en("Seamless across\nevery device."),
      screenshot: "/screenshots/apple/iphone/{locale}/03.png",
    },
    {
      id: nid(),
      layout: "device-top",
      label: en("DETAILED INSIGHTS"),
      headline: en("Track progress with\nclarity."),
      screenshot: "/screenshots/apple/iphone/{locale}/04.png",
      inverted: true,
    },
    {
      id: nid(),
      layout: "hero",
      label: en("GET STARTED TODAY"),
      headline: en("Available now\non the App Store."),
      screenshot: "/screenshots/apple/iphone/{locale}/06.png",
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
  appIcon: "/app-icon.png",
  slidesByDevice: {
    iphone: makeStarterSlides(),
  },
};

export function newSlide(layout: Slide["layout"] = "device-bottom"): Slide {
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
