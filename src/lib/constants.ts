import type { Device, Orientation, SlideLayout, Theme, ThemeId } from "./types";

// ---------- Canvas dimensions (design at largest required resolution) ----------
export const CANVAS: Record<Device, { w: number; h: number }> = {
  iphone: { w: 1320, h: 2868 },
  ipad: { w: 2064, h: 2752 },
};

// ---------- Export sizes per device ----------
export type ExportSize = { label: string; w: number; h: number };

export const EXPORT_SIZES: Record<Device, ExportSize[]> = {
  iphone: [{ label: '6.9" (1320 × 2868)', w: 1320, h: 2868 }],
  ipad: [{ label: '13" (2064 × 2752)', w: 2064, h: 2752 }],
};

export function supportsLandscape(_device?: Device): boolean {
  return false;
}

export function getExportSizes(device: Device = "iphone", _orientation?: Orientation): ExportSize[] {
  return EXPORT_SIZES[device] || EXPORT_SIZES.iphone;
}

// ---------- Frame aspect ratios ----------
// Outer frame ratio, incl. bezel. Backed out of the 6.9" screen aspect
// (1320/2868) and the bezel insets in device-frames.tsx (95.2% wide,
// 97.7% tall): 0.46025 / (0.952/0.977) ≈ 0.47234 ≈ 425/900. This makes the
// inner screen slot exactly 6.9" aspect so screenshots show fully.
export const MK_RATIO = 425 / 900;

// Outer frame ratio, incl. bezel. Backed out of the 13" iPad screen aspect
// (2064/2752) and the bezel insets of IPad in device-frames.tsx (94.8% wide,
// 96.0% tall): 0.75 / (0.948/0.96) ≈ 0.7595. Inner slot is exactly 13" aspect.
export const IPAD_MK_RATIO = 0.7595;

// ---------- Width formula helpers ----------
export function phoneW(cW: number, cH: number, clamp = 0.84) {
  return Math.min(clamp, 0.72 * (cH / cW) * MK_RATIO);
}
export function phoneWSmall(cW: number, cH: number) {
  return phoneW(cW, cH, 0.66);
}
export function tabletW(cW: number, cH: number, clamp = 0.8) {
  return Math.min(clamp, 0.72 * (cH / cW) * IPAD_MK_RATIO);
}
export function tabletWSmall(cW: number, cH: number) {
  return tabletW(cW, cH, 0.62);
}

// ---------- Themes ----------
export const DEFAULT_THEME_ID: ThemeId = "clean-light";

export const THEMES: Record<string, Theme> = {
  "clean-light": {
    id: "clean-light",
    name: "Clean Light",
    bg: "#F6F1EA",
    bgAlt: "#171717",
    fg: "#171717",
    fgAlt: "#F6F1EA",
    accent: "#5B7CFA",
    muted: "#6B7280",
  },
  "dark-bold": {
    id: "dark-bold",
    name: "Dark Bold",
    bg: "#0B1020",
    bgAlt: "#F8FAFC",
    fg: "#F8FAFC",
    fgAlt: "#0B1020",
    accent: "#8B5CF6",
    muted: "#94A3B8",
  },
  "warm-editorial": {
    id: "warm-editorial",
    name: "Warm Editorial",
    bg: "#F7E8DA",
    bgAlt: "#2B1D17",
    fg: "#2B1D17",
    fgAlt: "#F7E8DA",
    accent: "#D97706",
    muted: "#7C5A47",
  },
  "ocean-fresh": {
    id: "ocean-fresh",
    name: "Ocean Fresh",
    bg: "#E0F2FE",
    bgAlt: "#0C4A6E",
    fg: "#0C4A6E",
    fgAlt: "#E0F2FE",
    accent: "#0284C7",
    muted: "#475569",
  },
  "bloom-roast": {
    id: "bloom-roast",
    name: "Bloom Roast",
    bg: "#F2ECE2",
    bgAlt: "#24352F",
    fg: "#1D2420",
    fgAlt: "#FFF7EA",
    accent: "#B8794A",
    muted: "#65736B",
  },
  "visaz-brand": {
    id: "visaz-brand",
    name: "Visaz Dark",
    bg: "#0D0D0D",
    bgAlt: "#F8FAFC",
    fg: "#FFFFFF",
    fgAlt: "#0D0D0D",
    accent: "#E58E26",
    muted: "#9CA3AF",
  },
};

export function themeById(themeId: string | undefined): Theme {
  return THEMES[themeId || ""] || THEMES[DEFAULT_THEME_ID];
}

export function hasTheme(themeId: string | undefined): boolean {
  return !!themeId && !!THEMES[themeId];
}

export const STORAGE_KEY = "app-store-screenshots:project:v1";
export const PROJECT_SCHEMA_VERSION = 2;

export const DEVICE_LABEL: Record<Device, string> = {
  iphone: "iPhone",
  ipad: "iPad",
};

// Friendly labels for slide layouts (used in dropdowns)
export const LAYOUT_LABEL: Record<SlideLayout, string> = {
  hero: "Hero",
  "device-bottom": "Device bottom",
  "device-top": "Device top",
  "two-devices": "Two devices",
  "no-device": "No device",
  static: "Static image",
};

// Short description shown under each layout name
export const LAYOUT_HINT: Record<SlideLayout, string> = {
  hero: "Headline above, device at bottom",
  "device-bottom": "Headline top, device anchored below",
  "device-top": "Flipped — device on top",
  "two-devices": "Layered back + front phones",
  "no-device": "Big standalone headline",
  static: "Full-bleed image, no frames or text",
};
