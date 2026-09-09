export type TargetPlatform = "ios" | "android";

export type ExportTarget = {
  id: string;
  platform: TargetPlatform;
  platformName: string;
  name: string;
  description: string;
  w: number;
  h: number;
  category: "iphone" | "ipad" | "android-phone" | "android-tablet" | "android-promo";
  subfolder: string;
  fastlaneDeviceName: string;
  badge?: string;
  recommended?: boolean;
  defaultSelected?: boolean;
};

export const EXPORT_TARGETS: ExportTarget[] = [
  // --- iOS / Apple App Store ---
  {
    id: "ios-iphone-69",
    platform: "ios",
    platformName: "Apple App Store",
    name: "iPhone 6.9\" (16 Pro Max / 15 Pro Max)",
    description: "1320 × 2868 · Primary App Store Size",
    w: 1320,
    h: 2868,
    category: "iphone",
    subfolder: "ios/iphone-6.9",
    fastlaneDeviceName: "iPhone 16 Pro Max",
    badge: "Required",
    recommended: true,
    defaultSelected: true,
  },
  {
    id: "ios-iphone-65",
    platform: "ios",
    platformName: "Apple App Store",
    name: "iPhone 6.5\" (11 Pro Max / XS Max / Plus)",
    description: "1242 × 2688 · Legacy Display Size",
    w: 1242,
    h: 2688,
    category: "iphone",
    subfolder: "ios/iphone-6.5",
    fastlaneDeviceName: "iPhone 11 Pro Max",
    badge: "Legacy",
    recommended: false,
    defaultSelected: false,
  },
  {
    id: "ios-ipad-13",
    platform: "ios",
    platformName: "Apple App Store",
    name: "iPad Pro 13\" / 12.9\"",
    description: "2064 × 2752 · iPad App Store Size",
    w: 2064,
    h: 2752,
    category: "ipad",
    subfolder: "ios/ipad-13",
    fastlaneDeviceName: "iPad Pro (12.9-inch) (6th generation)",
    badge: "iPad",
    recommended: false,
    defaultSelected: false,
  },

  // --- Android / Google Play Store ---
  {
    id: "android-phone",
    platform: "android",
    platformName: "Google Play Store",
    name: "Android Phone (FHD+ 9:20)",
    description: "1080 × 2400 · Google Play Phone Size",
    w: 1080,
    h: 2400,
    category: "android-phone",
    subfolder: "android/phone",
    fastlaneDeviceName: "phoneScreenshots",
    badge: "Play Store",
    recommended: true,
    defaultSelected: true,
  },
  {
    id: "android-tablet-10",
    platform: "android",
    platformName: "Google Play Store",
    name: "Android 10\" Tablet",
    description: "1600 × 2560 · Google Play Tablet Size",
    w: 1600,
    h: 2560,
    category: "android-tablet",
    subfolder: "android/tablet-10",
    fastlaneDeviceName: "tenInchScreenshots",
    badge: "Tablet",
    recommended: false,
    defaultSelected: false,
  },
  {
    id: "android-feature-graphic",
    platform: "android",
    platformName: "Google Play Store",
    name: "Play Store Feature Graphic Banner",
    description: "1024 × 500 · Required Promotional Banner",
    w: 1024,
    h: 500,
    category: "android-promo",
    subfolder: "android/feature-graphic",
    fastlaneDeviceName: "featureGraphic",
    badge: "Banner",
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
    if (target.platform === "ios") {
      // fastlane deliver structure: fastlane/screenshots/<locale>/<device>-<num>.png
      return `fastlane/screenshots/${locale}/${target.fastlaneDeviceName}-${num}.png`;
    }
    // fastlane supply structure: fastlane/metadata/android/<locale>/images/<type>/<num>.png
    return `fastlane/metadata/android/${locale}/images/${target.fastlaneDeviceName}/${num}.png`;
  }

  if (preset === "flat") {
    return `${target.platform}_${target.id}_${locale}_${filename}`;
  }

  // standard preset: platform/device/locale/01-layout.png
  return `${target.subfolder}/${locale}/${filename}`;
}
