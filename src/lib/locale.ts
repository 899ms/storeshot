import type { LocalizedText } from "./types";

export const DEFAULT_LOCALE = "en";

export const LOCALE_FLAGS: Record<string, string> = {
  en: "🇺🇸",
  es: "🇪🇸",
  "ar-SA": "🇸🇦",
  ca: "🇪🇸",
  cs: "🇨🇿",
  da: "🇩🇰",
  "de-DE": "🇩🇪",
  el: "🇬🇷",
  "en-AU": "🇦🇺",
  "en-CA": "🇨🇦",
  "en-GB": "🇬🇧",
  "en-US": "🇺🇸",
  "es-ES": "🇪🇸",
  "es-MX": "🇲🇽",
  fi: "🇫🇮",
  "fr-CA": "🇨🇦",
  "fr-FR": "🇫🇷",
  he: "🇮🇱",
  hi: "🇮🇳",
  hr: "🇭🇷",
  hu: "🇭🇺",
  id: "🇮🇩",
  it: "🇮🇹",
  ja: "🇯🇵",
  ko: "🇰🇷",
  ms: "🇲🇾",
  "nl-NL": "🇳🇱",
  no: "🇳🇴",
  pl: "🇵🇱",
  "pt-BR": "🇧🇷",
  "pt-PT": "🇵🇹",
  ro: "🇷🇴",
  ru: "🇷🇺",
  sk: "🇸🇰",
  sl: "🇸🇮",
  sv: "🇸🇪",
  th: "🇹🇭",
  tr: "🇹🇷",
  uk: "🇺🇦",
  vi: "🇻🇳",
  "zh-Hans": "🇨🇳",
  "zh-Hant": "🇹🇼",
};

function regionalIndicator(code: string): string {
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((c) => 127397 + c.charCodeAt(0)),
  );
}

// Flag emoji for a locale code. Falls back to the trailing region subtag
// (e.g. "pt-PT" → 🇵🇹); returns "" when no region can be determined.
export function getLocaleFlag(locale: string): string {
  const direct = LOCALE_FLAGS[locale];
  if (direct) return direct;
  const region = locale.split("-").pop() || "";
  if (/^[A-Za-z]{2}$/.test(region)) return regionalIndicator(region);
  return "";
}

export const LOCALE_NAMES: Record<string, string> = {
  en: "English (Default)",
  es: "Spanish (Default)",
  "ar-SA": "Arabic (Saudi Arabia)",
  ca: "Catalan",
  cs: "Czech",
  da: "Danish",
  "de-DE": "German",
  el: "Greek",
  "en-AU": "English (Australia)",
  "en-CA": "English (Canada)",
  "en-GB": "English (UK)",
  "en-US": "English (US)",
  "es-ES": "Spanish (Spain)",
  "es-MX": "Spanish (Mexico)",
  fi: "Finnish",
  "fr-CA": "French (Canada)",
  "fr-FR": "French (France)",
  he: "Hebrew",
  hi: "Hindi",
  hr: "Croatian",
  hu: "Hungarian",
  id: "Indonesian",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  ms: "Malay",
  "nl-NL": "Dutch",
  no: "Norwegian",
  pl: "Polish",
  "pt-BR": "Portuguese (Brazil)",
  "pt-PT": "Portuguese (Portugal)",
  ro: "Romanian",
  ru: "Russian",
  sk: "Slovak",
  sl: "Slovenian",
  sv: "Swedish",
  th: "Thai",
  tr: "Turkish",
  uk: "Ukrainian",
  vi: "Vietnamese",
  "zh-Hans": "Chinese (Simplified)",
  "zh-Hant": "Chinese (Traditional)",
};

export function getLocaleLabel(locale: string): string {
  return LOCALE_NAMES[locale] ? `${locale} · ${LOCALE_NAMES[locale]}` : locale.toUpperCase();
}

// Which store an export bundle is headed to. Apple and Google use
// different locale codes for several languages (e.g. Slovenian is sl-SI
// on App Store Connect but sl on Google Play).
export type StoreKind = "apple" | "google";

// Folders emitted into export bundles follow App Store Connect locale codes,
// which differ from the internal code in a few cases.
const ASC_FOLDER_OVERRIDES: Record<string, string> = {
  sl: "sl-SI",
};

// Google Play store-listing locale codes (BCP-47, per Play Console language
// table, June 2026). Only locales this project supports are listed —
// anything else passes through unchanged.
const GOOGLE_FOLDER_OVERRIDES: Record<string, string> = {
  "ar-SA": "ar",
  cs: "cs-CZ",
  da: "da-DK",
  el: "el-GR",
  // Play has no es-MX listing locale; Mexican Spanish ships under the
  // Latin America aggregate.
  "es-MX": "es-419",
  fi: "fi-FI",
  he: "iw-IL",
  hi: "hi-IN",
  hu: "hu-HU",
  it: "it-IT",
  ja: "ja-JP",
  ko: "ko-KR",
  no: "no-NO",
  pl: "pl-PL",
  ru: "ru-RU",
  sv: "sv-SE",
  tr: "tr-TR",
  "zh-Hans": "zh-CN",
  "zh-Hant": "zh-TW",
};

// Internal source codes that are not valid App Store locales. "en" is the
// editing/translation source only — the store accepts en-US, en-GB, en-AU
// and en-CA instead — so it is never exported.
const NON_STORE_LOCALES = new Set(["en"]);

// Upload folder for a locale on the given store, or null when the locale
// must not be exported.
export function exportFolderForLocale(locale: string, store: StoreKind = "apple"): string | null {
  if (NON_STORE_LOCALES.has(locale)) return null;
  if (store === "google") return GOOGLE_FOLDER_OVERRIDES[locale] ?? locale;
  return ASC_FOLDER_OVERRIDES[locale] ?? locale;
}

// Read the value for `locale` from a localized field. Falls back to en, then to
// the first locale that has a non-empty value, then to empty string. Used by
// the canvas/preview/thumb so switching to a locale the user hasn't filled in
// shows the source copy instead of blanks.
export function pickText(field: LocalizedText | undefined, locale: string): string {
  if (!field) return "";
  const direct = field[locale];
  if (direct && direct.length) return direct;
  const en = field[DEFAULT_LOCALE];
  if (en && en.length) return en;
  for (const k of Object.keys(field)) {
    const v = field[k];
    if (v && v.length) return v;
  }
  return "";
}

// Replace `{locale}` placeholders in a screenshot path. Data URLs and empty
// strings pass through unchanged.
export function resolveScreenshot(path: string | undefined, locale: string): string {
  if (!path) return "";
  if (path.startsWith("data:")) return path;
  if (!path.includes("{locale}")) return path;
  return path.replace(/\{locale\}/g, locale);
}

// Convert legacy `string` headline/label fields to the per-locale shape. Safe
// to call on already-migrated data.
export function coerceLocalized(value: unknown): LocalizedText {
  if (typeof value === "string") return { [DEFAULT_LOCALE]: value };
  if (value && typeof value === "object") return value as LocalizedText;
  return {};
}

// Set or clear the value for `locale` on a localized field. Empty values delete
// the key so the persisted JSON stays free of "" placeholders.
export function writeLocalized(
  field: LocalizedText | undefined,
  locale: string,
  value: string,
): LocalizedText {
  const next: LocalizedText = { ...(field || {}) };
  if (value.length === 0) delete next[locale];
  else next[locale] = value;
  return next;
}
