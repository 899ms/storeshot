import type { Device } from "./types";

// Draggable ruler guides (Figma-style). Positions are canvas px, so they stay
// glued to the deck across zoom. Guides are editor chrome: rendered only in
// PreviewStage, never exported, persisted per workspace + device.

export type GuideAxis = "h" | "v";

export type Guide = {
  id: string;
  /** "h" = horizontal line (moves in Y), "v" = vertical line (moves in X). */
  axis: GuideAxis;
  /** Position in canvas px. */
  pos: number;
};

const GUIDES_KEY = "screenshots.guides";
const MAX_GUIDES = 100;

export function guideKey(workspaceKey: string | null, device: Device): string {
  return `${GUIDES_KEY}:${workspaceKey ?? "__none"}::${device}`;
}

/** Validate unknown JSON into guides. Pure so the contract stays unit-tested. */
export function parseGuides(value: unknown): Guide[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (g): g is Guide =>
        typeof g === "object" &&
        g !== null &&
        typeof (g as Guide).id === "string" &&
        ((g as Guide).axis === "h" || (g as Guide).axis === "v") &&
        Number.isFinite((g as Guide).pos),
    )
    .slice(0, MAX_GUIDES);
}

// Pre-rename device names mapped to their current Device value.
const LEGACY_DEVICE_ALIASES: Record<string, Device> = {
  iphone: "phone",
  ipad: "tablet",
};

/**
 * Older storage keys that may hold guides worth adopting, newest first:
 * workspace-scoped keys with pre-rename device names, then the original
 * device-only keys from before workspace scoping. Pure for testability.
 */
export function legacyGuideKeys(workspaceKey: string | null, device: Device): string[] {
  const keys: string[] = [];
  for (const [oldName, mapped] of Object.entries(LEGACY_DEVICE_ALIASES)) {
    if (mapped === device && workspaceKey) {
      keys.push(`${GUIDES_KEY}:${workspaceKey}::${oldName}`);
    }
  }
  const oldName = Object.entries(LEGACY_DEVICE_ALIASES).find(
    ([, mapped]) => mapped === device,
  )?.[0];
  if (oldName) keys.push(`${GUIDES_KEY}:${oldName}`);
  return keys;
}

export function loadGuides(workspaceKey: string | null, device: Device): Guide[] {
  if (typeof window === "undefined") return [];
  const read = (key: string): Guide[] | null => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw == null ? null : parseGuides(JSON.parse(raw));
    } catch {
      // Corrupt storage — treat as absent and keep looking
      return null;
    }
  };
  try {
    // A present key always wins — even an explicit [] (user deleted guides).
    const direct = read(guideKey(workspaceKey, device));
    if (direct !== null) return direct;
    // One-time adoption of guides saved under older keys. Adopted guides are
    // written to the new key and the legacy key removed, so this runs once.
    for (const legacy of legacyGuideKeys(workspaceKey, device)) {
      const found = read(legacy);
      if (found && found.length > 0) {
        try {
          window.localStorage.setItem(
            guideKey(workspaceKey, device),
            JSON.stringify(found),
          );
          window.localStorage.removeItem(legacy);
        } catch {
          // storage unavailable — guides still work in-memory
        }
        return found;
      }
    }
    return [];
  } catch {
    return [];
  }
}

export function saveGuides(
  workspaceKey: string | null,
  device: Device,
  guides: Guide[],
) {
  try {
    window.localStorage.setItem(
      guideKey(workspaceKey, device),
      JSON.stringify(guides.slice(0, MAX_GUIDES)),
    );
  } catch {
    // storage unavailable (private mode etc.) — guides still work in-memory
  }
}
