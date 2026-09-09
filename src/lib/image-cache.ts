"use client";
// Pre-loads images as base64 data URIs so html-to-image exports without
// non-deterministic image fetch races. Always use img(path) in render.
//
// Cache keys are resolved fetch URLs (see lib/workspaces), so the same
// workspace-relative path in different workspaces never collides.

import { assetUrl } from "./workspaces";

const cache = new Map<string, string>();
const failed = new Set<string>();

async function fetchAsDataUrl(path: string): Promise<string | null> {
  try {
    const resp = await fetch(assetUrl(path));
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function preloadImages(
  paths: string[],
  options: { retryFailed?: boolean } = {},
): Promise<void> {
  await Promise.all(
    paths
      .filter(Boolean)
      .filter((p) => {
        const key = assetUrl(p);
        return !cache.has(key) && (options.retryFailed || !failed.has(key));
      })
      .map(async (p) => {
        const key = assetUrl(p);
        const data = await fetchAsDataUrl(p);
        if (data) {
          cache.set(key, data);
          failed.delete(key);
        } else {
          failed.add(key);
        }
      }),
  );
}

export function img(path: string | undefined): string {
  if (!path) return "";
  if (path.startsWith("data:")) return path;
  const key = assetUrl(path);
  if (failed.has(key)) return "";
  // Uncached: return the resolved URL so the browser fetches the right file
  // (workspace-relative paths resolve through the workspace file endpoint).
  return cache.get(key) || key;
}

export function setImage(path: string, dataUrl: string) {
  const key = path.startsWith("data:") ? path : assetUrl(path);
  cache.set(key, dataUrl);
  failed.delete(key);
}

export function didFail(path: string | undefined): boolean {
  if (!path) return false;
  if (path.startsWith("data:")) return false;
  return failed.has(assetUrl(path));
}
