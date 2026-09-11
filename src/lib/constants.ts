import type { CanvasSize, Device, SlideLayout, Theme, ThemeId } from "./types";

// ---------- Canvas dimensions (design at largest required resolution) ----------
export const CANVAS: Record<Device, { w: number; h: number }> = {
  phone: { w: 1320, h: 2868 },
  tablet: { w: 2064, h: 2752 },
  desktop: { w: 2880, h: 1800 },
};

/** Effective canvas for a device: user override from Settings → Devices, else built-in default. */
export function effectiveCanvas(
  device: Device,
  overrides?: Partial<Record<Device, CanvasSize>>,
): { w: number; h: number } {
  const fallback = CANVAS[device] ?? CANVAS.phone;
  const custom = overrides?.[device];
  if (
    custom &&
    Number.isFinite(custom.w) &&
    Number.isFinite(custom.h) &&
    custom.w >= 200 &&
    custom.w <= 5000 &&
    custom.h >= 200 &&
    custom.h <= 5000
  ) {
    return { w: Math.round(custom.w), h: Math.round(custom.h) };
  }
  return fallback;
}

// ---------- Export sizes per device ----------
export type ExportSize = { label: string; w: number; h: number };

export const EXPORT_SIZES: Record<Device, ExportSize[]> = {
  phone: [{ label: '6.9" (1320 × 2868)', w: 1320, h: 2868 }],
  tablet: [{ label: '13" (2064 × 2752)', w: 2064, h: 2752 }],
  desktop: [{ label: "Desktop (2880 × 1800)", w: 2880, h: 1800 }],
};

export function getExportSizes(device: Device = "phone", overrides?: Partial<Record<Device, CanvasSize>>): ExportSize[] {
  const c = effectiveCanvas(device, overrides);
  const base = EXPORT_SIZES[device] || EXPORT_SIZES.phone;
  if (c.w === base[0].w && c.h === base[0].h) return base;
  return [{ label: `Custom (${c.w} × ${c.h})`, w: c.w, h: c.h }];
}

// Preset canvas sizes offered in Settings → Devices (first = default).
export const DEVICE_SIZE_PRESETS: Record<Device, { label: string; w: number; h: number }[]> = {
  phone: [
    { label: '6.9" — 1320 × 2868', w: 1320, h: 2868 },
    { label: '6.7" — 1290 × 2796', w: 1290, h: 2796 },
    { label: '6.5" — 1242 × 2688', w: 1242, h: 2688 },
  ],
  tablet: [
    { label: '13" — 2064 × 2752', w: 2064, h: 2752 },
    { label: '12.9" — 2048 × 2732', w: 2048, h: 2732 },
    { label: '11" — 1668 × 2388', w: 1668, h: 2388 },
  ],
  desktop: [
    { label: "Desktop — 2880 × 1800", w: 2880, h: 1800 },
    { label: "Desktop — 2560 × 1600", w: 2560, h: 1600 },
    { label: "Desktop — 1920 × 1080", w: 1920, h: 1080 },
  ],
};

// ---------- Frame aspect ratios ----------
// Outer frame ratio, incl. bezel. Backed out of the 6.9" screen aspect
// (1320/2868) and the bezel insets in device-frames.tsx (95.2% wide,
// 97.7% tall): 0.46025 / (0.952/0.977) ≈ 0.47234 ≈ 425/900. This makes the
// inner screen slot exactly 6.9" aspect so screenshots show fully.
export const MK_RATIO = 425 / 900;

// Outer frame ratio, incl. bezel. Backed out of the 13" tablet screen aspect
// (2064/2752) and the bezel insets of IPad in device-frames.tsx (94.8% wide,
// 96.0% tall): 0.75 / (0.948/0.96) ≈ 0.7595. Inner slot is exactly 13" aspect.
export const IPAD_MK_RATIO = 0.7595;

// Desktop has no bezel — the frame is the canvas itself (16:10).
export const DESKTOP_RATIO = 2880 / 1800;

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
export function desktopW(cW: number, cH: number, clamp = 0.9) {
  return Math.min(clamp, 0.72 * (cH / cW) * DESKTOP_RATIO);
}
export function desktopWSmall(cW: number, cH: number) {
  return desktopW(cW, cH, 0.7);
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
  phone: "Phone",
  tablet: "Tablet",
  desktop: "Desktop",
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
  static: "Full-bleed image + overlay texts",
};
