import type { Slide } from "./types";

// First-run onboarding state + sample-deck helpers. The seen-flag is global
// (not per workspace) so a second workspace never re-triggers the wizard.

const SEEN_KEY = "screenshots.onboarding.seen";

export const SAMPLE_IMAGES = [
  "/onboarding/sample-1.png",
  "/onboarding/sample-2.png",
  "/onboarding/sample-3.png",
  "/onboarding/sample-4.png",
  "/onboarding/sample-5.png",
] as const;

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function hasSeenOnboarding(): boolean {
  return storage()?.getItem(SEEN_KEY) === "1";
}

export function markOnboardingSeen(): void {
  try {
    storage()?.setItem(SEEN_KEY, "1");
  } catch {
    // Non-fatal: worst case the wizard shows once more.
  }
}

export function clearOnboardingSeen(): void {
  try {
    storage()?.removeItem(SEEN_KEY);
  } catch {
    // Non-fatal.
  }
}

// A deck is "untouched" when no real user content exists anywhere in it:
// no screenshots, no overlay texts, no geometry tweaks, no background or
// caption-style overrides, no app icon. Used alongside the seen-flag so a
// returning user with real content is never interrupted (e.g. cleared
// storage), while a fresh starter deck still qualifies.
export function isUntouchedDeck(slides: Slide[], appIcon?: string): boolean {
  if (appIcon) return false;
  if (slides.length === 0) return true;
  return slides.every(
    (s) =>
      !s.screenshot &&
      !s.screenshotSecondary &&
      (s.textElements ?? []).length === 0 &&
      s.transforms === undefined &&
      s.background === undefined &&
      s.labelStyle === undefined &&
      s.headlineStyle === undefined,
  );
}

// Fill every slide's screenshot slot with a bundled sample image (cycled),
// preserving ids and all other fields so save/undo/export behave normally.
export function buildSampleDeck(slides: Slide[]): Slide[] {
  return slides.map((s, i) => ({
    ...s,
    screenshot: SAMPLE_IMAGES[i % SAMPLE_IMAGES.length],
  }));
}
