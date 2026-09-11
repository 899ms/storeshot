import { describe, expect, it } from "vitest";
import {
  coerceLocalized,
  exportFolderForLocale,
  getLocaleFlag,
  isRtlLocale,
  pickText,
  resolveScreenshot,
  writeLocalized,
} from "./locale";

describe("exportFolderForLocale", () => {
  it("maps sl to sl-SI on Apple, keeps sl on Google Play", () => {
    expect(exportFolderForLocale("sl", "apple")).toBe("sl-SI");
    expect(exportFolderForLocale("sl", "google")).toBe("sl");
  });

  it("never exports the en/es source languages on either store", () => {
    for (const store of ["apple", "google"] as const) {
      expect(exportFolderForLocale("en", store)).toBeNull();
      expect(exportFolderForLocale("es", store)).toBeNull();
    }
  });

  it("maps Play-expanded codes and passes Apple codes through", () => {
    expect(exportFolderForLocale("he", "google")).toBe("iw-IL");
    expect(exportFolderForLocale("he", "apple")).toBe("he");
    expect(exportFolderForLocale("zh-Hans", "google")).toBe("zh-CN");
    expect(exportFolderForLocale("zh-Hant", "google")).toBe("zh-TW");
    expect(exportFolderForLocale("es-MX", "google")).toBe("es-419");
    expect(exportFolderForLocale("de-DE", "apple")).toBe("de-DE");
    expect(exportFolderForLocale("de-DE", "google")).toBe("de-DE");
    expect(exportFolderForLocale("en-US", "apple")).toBe("en-US");
  });
});

describe("getLocaleFlag", () => {
  it("returns direct flags and derives region flags", () => {
    expect(getLocaleFlag("de-DE")).toBe("🇩🇪");
    expect(getLocaleFlag("sl")).toBe("🇸🇮");
  });

  it("returns empty string when no region can be determined", () => {
    expect(getLocaleFlag("xyz")).toBe("");
    expect(getLocaleFlag("en-001")).toBe("");
  });
});

describe("isRtlLocale", () => {
  it("detects RTL locales", () => {
    expect(isRtlLocale("ar-SA")).toBe(true);
    expect(isRtlLocale("he")).toBe(true);
  });

  it("treats LTR locales as LTR", () => {
    expect(isRtlLocale("en")).toBe(false);
    expect(isRtlLocale("de-DE")).toBe(false);
    expect(isRtlLocale("zh-Hans")).toBe(false);
  });
});

describe("pickText", () => {
  it("prefers the direct locale, then en, then first non-empty", () => {
    expect(pickText({ en: "Hello", de: "Hallo" }, "de")).toBe("Hallo");
    expect(pickText({ en: "Hello" }, "de")).toBe("Hello");
    expect(pickText({ fr: "Bonjour" }, "de")).toBe("Bonjour");
    expect(pickText({}, "de")).toBe("");
    expect(pickText(undefined, "de")).toBe("");
  });
});

describe("writeLocalized", () => {
  it("sets values and deletes keys on empty string", () => {
    expect(writeLocalized({ en: "Hi" }, "de", "Hallo")).toEqual({ en: "Hi", de: "Hallo" });
    expect(writeLocalized({ en: "Hi", de: "Hallo" }, "de", "")).toEqual({ en: "Hi" });
  });
});

describe("resolveScreenshot", () => {
  it("replaces {locale} placeholders and passes the rest through", () => {
    expect(resolveScreenshot("a/{locale}/b.png", "de")).toBe("a/de/b.png");
    expect(resolveScreenshot("a/b.png", "de")).toBe("a/b.png");
    expect(resolveScreenshot("data:abc", "de")).toBe("data:abc");
    expect(resolveScreenshot("", "de")).toBe("");
    expect(resolveScreenshot(undefined, "de")).toBe("");
  });
});

describe("coerceLocalized", () => {
  it("wraps strings, passes objects, blanks garbage", () => {
    expect(coerceLocalized("Hi")).toEqual({ en: "Hi" });
    expect(coerceLocalized({ de: "Hallo" })).toEqual({ de: "Hallo" });
    expect(coerceLocalized(null)).toEqual({});
    expect(coerceLocalized(42)).toEqual({});
  });
});
