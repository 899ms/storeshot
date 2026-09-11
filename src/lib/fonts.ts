"use client";

// Curated Google Fonts catalog + runtime loader. next/font can't serve
// user-picked families (build-time only), so caption fonts load via the
// Google Fonts CSS API at runtime. Everything stays client-side: <link>
// tags are injected idempotently and fonts awaited via the Font Loading API
// (with a timeout so offline exports never hang).

export type CuratedFont = {
  family: string;
  weights: number[];
  blurb: string;
};

export const CURATED_FONTS: CuratedFont[] = [
  { family: "Inter", weights: [400, 500, 600, 700, 800], blurb: "Clean UI sans" },
  { family: "Nunito", weights: [400, 600, 700, 800, 900], blurb: "Rounded friendly sans" },
  { family: "Roboto", weights: [400, 500, 700, 900], blurb: "Android system sans" },
  { family: "Open Sans", weights: [400, 600, 700, 800], blurb: "Neutral readable sans" },
  { family: "Lato", weights: [400, 700, 900], blurb: "Warm humanist sans" },
  { family: "Montserrat", weights: [400, 600, 700, 800], blurb: "Geometric headlines" },
  { family: "Poppins", weights: [400, 500, 600, 700], blurb: "Geometric modern sans" },
  { family: "Raleway", weights: [400, 600, 700, 800], blurb: "Elegant thin-to-bold" },
  { family: "Nunito Sans", weights: [400, 600, 700, 800], blurb: "Nunito's text sibling" },
  { family: "PT Sans", weights: [400, 700], blurb: "Compact UI sans" },
  { family: "Lora", weights: [400, 500, 600, 700], blurb: "Literary serif" },
  { family: "Merriweather", weights: [400, 700, 900], blurb: "Sturdy reading serif" },
  { family: "Playfair Display", weights: [400, 600, 700, 800], blurb: "High-contrast display serif" },
  { family: "Oswald", weights: [400, 500, 600, 700], blurb: "Condensed poster sans" },
  { family: "Bebas Neue", weights: [400], blurb: "Tall display caps" },
  { family: "Anton", weights: [400], blurb: "Heavy poster sans" },
  { family: "Archivo", weights: [400, 600, 700, 800], blurb: "Grotesque workhorse" },
  { family: "Work Sans", weights: [400, 600, 700], blurb: "Friendly grotesque" },
  { family: "DM Sans", weights: [400, 500, 700], blurb: "Geometric UI sans" },
  { family: "DM Serif Display", weights: [400], blurb: "Editorial serif" },
  { family: "Manrope", weights: [400, 500, 600, 700, 800], blurb: "Modern geometric sans" },
  { family: "Outfit", weights: [400, 500, 600, 700], blurb: "Rounded tech sans" },
  { family: "Plus Jakarta Sans", weights: [400, 500, 600, 700, 800], blurb: "Warm modern sans" },
  { family: "Sora", weights: [400, 600, 700, 800], blurb: "Distinctive display sans" },
  { family: "Space Grotesk", weights: [400, 500, 600, 700], blurb: "Quirky tech sans" },
  { family: "Urbanist", weights: [400, 600, 700, 800], blurb: "Geometric minimal sans" },
  { family: "Figtree", weights: [400, 500, 600, 700], blurb: "Friendly UI sans" },
  { family: "Public Sans", weights: [400, 600, 700, 800], blurb: "Government-grade sans" },
  { family: "Source Sans 3", weights: [400, 600, 700], blurb: "Adobe's UI sans" },
  { family: "Rubik", weights: [400, 500, 600, 700], blurb: "Rounded playful sans" },
];

export function curatedWeights(family: string): number[] {
  return CURATED_FONTS.find((f) => f.family === family)?.weights ?? [400, 700];
}

function cssHref(families: { family: string; weights: number[] }[]): string {
  const params = families
    .map((f) => `family=${f.family.replace(/ /g, "+")}:wght@${f.weights.join(";")}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

const injected = new Set<string>();

function injectLink(id: string, href: string) {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  // Required so html-to-image can read cssRules for font embedding during
  // export. Without it the stylesheet is opaque and snapshots silently fall
  // back to system fonts (plus a console error from embed-webfonts).
  // fonts.googleapis.com serves CORS headers, so anonymous mode works.
  link.crossOrigin = "anonymous";
  link.href = href;
  document.head.appendChild(link);
}

// Drop font links injected before crossorigin support — they'd stay opaque
// and keep breaking font embedding in exports.
function removeLegacyFontLinks() {
  if (typeof document === "undefined") return;
  document.querySelectorAll('link[id^="caption-font"]').forEach((el) => {
    if (el.getAttribute("crossorigin") !== "anonymous") el.remove();
  });
}

// Settle document.fonts with a timeout so offline/slow exports never hang.
export async function fontsReadyWithTimeout(timeoutMs = 6000): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.ready) return;
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {
    // Fallback fonts render instead.
  }
}

// Load one family (idempotent) and wait until it's usable, with a timeout so
// offline machines never hang the editor or an export.
export async function ensureFontLoaded(family: string, timeoutMs = 6000): Promise<void> {
  if (typeof document === "undefined") return;
  const name = (family || "").trim() || "Inter";
  removeLegacyFontLinks();
  if (!injected.has(name)) {
    injected.add(name);
    injectLink(
      `caption-font-${name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`,
      cssHref([{ family: name, weights: curatedWeights(name) }]),
    );
  }
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`400 32px "${name}"`),
        document.fonts.load(`700 32px "${name}"`),
      ]),
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {
    // Offline or blocked — canvas falls back to the system stack.
  }
}

export async function ensureFontsLoaded(families: string[]): Promise<void> {
  await Promise.all(families.map((f) => ensureFontLoaded(f)));
}

// font-family value for canvas text: chosen family with a safe fallback stack.
export function fontStack(family: string): string {
  const name = (family || "").trim() || "Inter";
  return `"${name}", "Inter", system-ui, sans-serif`;
}
