import { describe, expect, it } from "vitest";
import { buildExportZipPath, getExportTargetById } from "./export-options";

describe("getExportTargetById", () => {
  it("resolves known targets and undefined for unknown", () => {
    expect(getExportTargetById("ios-iphone-69")?.w).toBe(1320);
    expect(getExportTargetById("nope")).toBeUndefined();
  });
});

describe("buildExportZipPath", () => {
  const target = getExportTargetById("ios-iphone-69")!;

  it("numbers by deck index by default", () => {
    expect(buildExportZipPath(target, "de-DE", 0, "hero", "standard")).toBe(
      "apple/iphone-6.9/de-DE/01-hero.png",
    );
    expect(buildExportZipPath(target, "sl-SI", 11, "hero", "standard")).toBe(
      "apple/iphone-6.9/sl-SI/12-hero.png",
    );
  });

  it("numbers by selection position when provided (no gaps)", () => {
    expect(buildExportZipPath(target, "de-DE", 4, "device-bottom", "standard", 2)).toBe(
      "apple/iphone-6.9/de-DE/02-device-bottom.png",
    );
  });

  it("builds fastlane and flat paths with the folder code", () => {
    expect(buildExportZipPath(target, "sl", 0, "hero", "fastlane")).toBe(
      "fastlane/screenshots/sl/iPhone 16 Pro Max-01.png",
    );
    expect(buildExportZipPath(target, "sl", 0, "hero", "flat")).toBe(
      "ios-iphone-69_sl_01-hero.png",
    );
  });

  it("includes the slugified screen title as 01-title-layout", () => {
    expect(buildExportZipPath(target, "de-DE", 0, "hero", "standard", 1, "welcome")).toBe(
      "apple/iphone-6.9/de-DE/01-welcome-hero.png",
    );
    expect(
      buildExportZipPath(target, "de-DE", 4, "device-bottom", "standard", 2, "my-feature"),
    ).toBe("apple/iphone-6.9/de-DE/02-my-feature-device-bottom.png");
    expect(buildExportZipPath(target, "sl", 0, "hero", "flat", 1, "welcome")).toBe(
      "ios-iphone-69_sl_01-welcome-hero.png",
    );
    expect(buildExportZipPath(target, "sl", 0, "hero", "fastlane", 1, "welcome")).toBe(
      "fastlane/screenshots/sl/iPhone 16 Pro Max-01-welcome.png",
    );
  });
});
