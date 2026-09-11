import type { StoreKind } from "./locale";

export type ExportTarget = {
  id: string;
  platform: "ios" | "mac";
  platformName: string;
  name: string;
  description: string;
  w: number;
  h: number;
  category: "phone" | "tablet" | "desktop";
  subfolder: string;
  fastlaneDeviceName: string;
  badge?: string;
  recommended?: boolean;
  defaultSelected?: boolean;
};

export const EXPORT_TARGETS: ExportTarget[] = [
  {
    id: "ios-phone-69",
    platform: "ios",
    platformName: "Apple App Store",
    name: "Phone 6.9\" (16 Pro Max / 15 Pro Max)",
    description: "1320 × 2868 · Required for App Store",
    w: 1320,
    h: 2868,
    category: "phone",
    subfolder: "apple/phone-6.9",
    fastlaneDeviceName: "iPhone 16 Pro Max",
    badge: "Required",
    recommended: true,
    defaultSelected: true,
  },
  {
    id: "ios-tablet-13",
    platform: "ios",
    platformName: "Apple App Store",
    name: "Tablet Pro 13\" / 12.9\"",
    description: "2064 × 2752 · Tablet Pro Display Size",
    w: 2064,
    h: 2752,
    category: "tablet",
    subfolder: "apple/tablet-13",
    fastlaneDeviceName: "iPad Pro (12.9-inch) (6th generation)",
    badge: "Tablet",
    recommended: false,
    defaultSelected: false,
  },
  {
    id: "mac-desktop-2880",
    platform: "mac",
    platformName: "Mac App Store",
    name: "Desktop (Mac App Store)",
    description: "2880 × 1800 · Required for Mac App Store",
    w: 2880,
    h: 1800,
    category: "desktop",
    subfolder: "apple/desktop",
    fastlaneDeviceName: "Desktop",
    badge: "Required",
    recommended: false,
    defaultSelected: false,
  },
];

export type FolderPreset = "standard" | "fastlane" | "flat";

export type ExportConfig = {
  selectedTargetIds: string[];
  selectedLocales: string[];
  selectedSlideIds: string[];
  folderPreset: FolderPreset;
  store: StoreKind;
};

const LEGACY_TARGET_IDS: Record<string, string> = {
  "ios-iphone-69": "ios-phone-69",
  "ios-ipad-13": "ios-tablet-13",
};

export function getExportTargetById(id: string): ExportTarget | undefined {
  return (
    EXPORT_TARGETS.find((t) => t.id === id) ??
    EXPORT_TARGETS.find((t) => t.id === LEGACY_TARGET_IDS[id])
  );
}

export function buildExportZipPath(
  target: ExportTarget,
  locale: string,
  slideIndex: number,
  layoutName: string,
  preset: FolderPreset,
  // 1-based position within the selected set. Defaults to deck order; pass
  // the selection position so deselected screens leave no numbering gaps.
  position1Based: number = slideIndex + 1,
  // Slugified screen title (see slugifyScreenTitle). Empty = legacy layout-only name.
  titleSlug = "",
): string {
  const num = String(position1Based).padStart(2, "0");
  const filename = titleSlug ? `${num}-${titleSlug}-${layoutName}.png` : `${num}-${layoutName}.png`;

  if (preset === "fastlane") {
    // fastlane deliver structure: fastlane/screenshots/<locale>/<device>-<num>[-title].png
    const suffix = titleSlug ? `-${titleSlug}` : "";
    return `fastlane/screenshots/${locale}/${target.fastlaneDeviceName}-${num}${suffix}.png`;
  }

  if (preset === "flat") {
    const base = titleSlug ? `${num}-${titleSlug}-${layoutName}` : `${num}-${layoutName}`;
    return `${target.id}_${locale}_${base}.png`;
  }

  // standard preset: apple/device/locale/01-title-layout.png
  return `${target.subfolder}/${locale}/${filename}`;
}
