import { describe, expect, it } from "vitest";
import { buildExportZipPath, getExportTargetById } from "./export-options";

describe("getExportTargetById", () => {
  it("resolves known targets and undefined for unknown", () => {
    expect(getExportTargetById("ios-phone-69")?.w).toBe(1320);
    expect(getExportTargetById("nope")).toBeUndefined();
  });

  it("resolves legacy iphone/ipad target ids", () => {
    expect(getExportTargetById("ios-iphone-69")?.id).toBe("ios-phone-69");
    expect(getExportTargetById("ios-ipad-13")?.id).toBe("ios-tablet-13");
  });
});

describe("buildExportZipPath", () => {
  const target = getExportTargetById("ios-phone-69")!;

  it("numbers by deck index by default", () => {
    expect(buildExportZipPath(target, "de-DE", 0, "hero", "standard")).toBe(
      "apple/phone-6.9/de-DE/01-hero.png",
    );
    expect(buildExportZipPath(target, "sl-SI", 11, "hero", "standard")).toBe(
      "apple/phone-6.9/sl-SI/12-hero.png",
    );
  });

  it("numbers by selection position when provided (no gaps)", () => {
    expect(buildExportZipPath(target, "de-DE", 4, "device-bottom", "standard", 2)).toBe(
      "apple/phone-6.9/de-DE/02-device-bottom.png",
    );
  });

  it("builds fastlane and flat paths with the folder code", () => {
    expect(buildExportZipPath(target, "sl", 0, "hero", "fastlane")).toBe(
      "fastlane/screenshots/sl/iPhone 16 Pro Max-01.png",
    );
    expect(buildExportZipPath(target, "sl", 0, "hero", "flat")).toBe(
      "ios-phone-69_sl_01-hero.png",
    );
  });

  it("includes the slugified screen title as 01-title-layout", () => {
    expect(buildExportZipPath(target, "de-DE", 0, "hero", "standard", 1, "welcome")).toBe(
      "apple/phone-6.9/de-DE/01-welcome-hero.png",
    );
    expect(
      buildExportZipPath(target, "de-DE", 4, "device-bottom", "standard", 2, "my-feature"),
    ).toBe("apple/phone-6.9/de-DE/02-my-feature-device-bottom.png");
    expect(buildExportZipPath(target, "sl", 0, "hero", "flat", 1, "welcome")).toBe(
      "ios-phone-69_sl_01-welcome-hero.png",
    );
    expect(buildExportZipPath(target, "sl", 0, "hero", "fastlane", 1, "welcome")).toBe(
      "fastlane/screenshots/sl/iPhone 16 Pro Max-01-welcome.png",
    );
  });

  it("builds desktop paths", () => {
    const desktop = getExportTargetById("mac-desktop-2880")!;
    expect(buildExportZipPath(desktop, "en-US", 0, "hero", "standard", 1, "welcome")).toBe(
      "apple/desktop/en-US/01-welcome-hero.png",
    );
  });
});
