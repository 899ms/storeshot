import type { StoreKind } from "./locale";

export type ExportTarget = {
  id: string;
  platform: "ios";
  platformName: string;
  name: string;
  description: string;
  w: number;
  h: number;
  category: "iphone" | "ipad";
  subfolder: string;
  fastlaneDeviceName: string;
  badge?: string;
  recommended?: boolean;
  defaultSelected?: boolean;
};

export const EXPORT_TARGETS: ExportTarget[] = [
  {
    id: "ios-iphone-69",
    platform: "ios",
    platformName: "Apple App Store",
    name: "iPhone 6.9\" (16 Pro Max / 15 Pro Max)",
    description: "1320 × 2868 · Required for App Store",
    w: 1320,
    h: 2868,
    category: "iphone",
    subfolder: "apple/iphone-6.9",
    fastlaneDeviceName: "iPhone 16 Pro Max",
    badge: "Required",
    recommended: true,
    defaultSelected: true,
  },
  {
    id: "ios-ipad-13",
    platform: "ios",
    platformName: "Apple App Store",
    name: "iPad Pro 13\" / 12.9\"",
    description: "2064 × 2752 · iPad Pro Display Size",
    w: 2064,
    h: 2752,
    category: "ipad",
    subfolder: "apple/ipad-13",
    fastlaneDeviceName: "iPad Pro (12.9-inch) (6th generation)",
    badge: "iPad",
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

export function getExportTargetById(id: string): ExportTarget | undefined {
  return EXPORT_TARGETS.find((t) => t.id === id);
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
