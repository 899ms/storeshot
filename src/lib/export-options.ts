export type TargetPlatform = "ios";

export type ExportTarget = {
  id: string;
  platform: TargetPlatform;
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
  singleSlideId?: string | null;
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
): string {
  const num = String(slideIndex + 1).padStart(2, "0");
  const filename = `${num}-${layoutName}.png`;

  if (preset === "fastlane") {
    // fastlane deliver structure: fastlane/screenshots/<locale>/<device>-<num>.png
    return `fastlane/screenshots/${locale}/${target.fastlaneDeviceName}-${num}.png`;
  }

  if (preset === "flat") {
    return `${target.id}_${locale}_${filename}`;
  }

  // standard preset: apple/device/locale/01-layout.png
  return `${target.subfolder}/${locale}/${filename}`;
}
