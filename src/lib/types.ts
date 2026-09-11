export type Device = "iphone" | "ipad";

// Layouts the editor can render. Vary across slides for visual rhythm.
export type SlideLayout =
  | "hero"             // centered device, headline above
  | "device-bottom"    // headline top, device bottom-center
  | "device-top"       // device top, headline bottom (contrast)
  | "two-devices"      // back + front phones, headline above
  | "no-device"        // big headline + decorative blob, no device
  | "static";          // full-bleed image only, no frames or caption (overlay texts allowed)

// Screen background. "theme" is the default gradient + accent blobs derived
// from the active theme; "mesh" is a multi-color mesh gradient; "image" is a
// cover-fit background image (workspace-relative path or data URL).
// Style fields are optional tweaks: opacity dims the layer (0..1), blur
// softens it (px), angle sets the mesh base-gradient direction (degrees).
export type BackgroundStyle = {
  opacity?: number;
  blur?: number;
  angle?: number;
};
export type ScreenBackground = (
  | { kind: "theme" }
  | { kind: "mesh"; colors: string[] }
  | { kind: "image"; src: string }
) & BackgroundStyle;

// Per-element rect in canvas pixel space. Optional rotation in degrees and zIndex.
export type ElementTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;
};

export type BuiltInElementId = "caption" | "device" | "deviceSecondary";
export type TextElementId = `text:${string}`;
export type ElementId = BuiltInElementId | TextElementId;

export type SelectedElement = {
  slideId: string;
  elementId: ElementId;
};

// Per-locale text keyed by locale code (e.g. "en", "de"). A locale is absent
// if the user hasn't typed anything for it; renderers fall back to en (see
// lib/locale.ts). The set of locales a project targets lives on
// ProjectState.locales.
export type LocalizedText = Partial<Record<string, string>>;

export type TextElement = {
  id: string;
  text: LocalizedText;
  transform: ElementTransform;
  fontSize?: number;
  fontWeight?: number;
  /** Google Fonts family name. Absent = project default. */
  fontFamily?: string;
  color?: string;
  align?: "left" | "center" | "right";
};

// Per-slide typographic overrides for the built-in caption (label +
// headline). Every field is optional; the renderer falls back to the
// long-standing hardcoded values so pre-existing projects render
// pixel-identically. Locale-independent, like all other style data.
export type CaptionTextStyle = {
  fontSize?: number;
  fontWeight?: number;
  /** Google Fonts family name. Absent = project default. */
  fontFamily?: string;
  color?: string;
};

export type Slide = {
  id: string;
  layout: SlideLayout;
  label: LocalizedText;       // tiny uppercase caption above headline, per locale
  headline: LocalizedText;    // multi-line; newlines are intentional, per locale
  labelStyle?: CaptionTextStyle;    // typographic overrides; absent = defaults
  headlineStyle?: CaptionTextStyle; // typographic overrides; absent = defaults
  screenshot: string;         // workspace-relative path (e.g. uploads/a.png) or absolute /… — may contain {locale}
  screenshotSecondary?: string; // for two-devices layout — may contain {locale}
  inverted?: boolean;         // dark background variant
  // Per-element overrides; when present, replaces layout default placement.
  transforms?: Partial<Record<BuiltInElementId, ElementTransform>>;
  textElements?: TextElement[];
  // Per-screen background override. Absent = use the project default.
  background?: ScreenBackground;
};

export type ThemeId =
  | "clean-light"
  | "dark-bold"
  | "warm-editorial"
  | "ocean-fresh"
  | "bloom-roast"
  | "visaz-brand";

export type Theme = {
  id: string;
  name: string;
  bg: string;          // primary background
  bgAlt: string;       // inverted background
  fg: string;          // text on bg
  fgAlt: string;       // text on bgAlt
  accent: string;
  muted: string;
};

export type ProjectState = {
  schemaVersion?: number;
  appName: string;
  themeId: string;
  // v1 projects render as isolated screens until the user opts into connected crops.
  connectedCanvas: boolean;
  // Locales this project targets. Drives the toolbar dropdown and bulk export.
  // Single-locale projects ship as ["en"] and hide the locale UI.
  locales: string[];
  locale: string;
  device: Device;
  // Per-device slide decks so platform switching preserves work
  slidesByDevice: Record<Device, Slide[]>;
  // Caption typefaces (Google Fonts family names). Headline defaults to
  // Nunito, the small label above it and overlay text elements to Inter.
  headlineFont: string;
  labelFont: string;
  // Default screen background. Screens can override via Slide.background.
  background: ScreenBackground;
  appIcon?: string;    // workspace-relative path (e.g. uploads/app-icon.png) or absolute /…
};
