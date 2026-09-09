"use client";
import * as React from "react";

// Active workspace: an absolute directory chosen by the user, or null for the
// default workspace (repo root, legacy behavior). Module-level so non-hook
// code (image-cache) can resolve asset URLs; a tiny subscription keeps React
// in sync without prop drilling.

const ACTIVE_KEY = "screenshots.active-workspace";
const RECENTS_KEY = "screenshots.workspace-recents";
const MAX_RECENTS = 8;

let active: string | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function readStored(): string | null {
  try {
    const raw = window.localStorage.getItem(ACTIVE_KEY);
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

function ensureInit() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  active = readStored();
}

function emit() {
  for (const l of listeners) l();
}

export function getActiveWorkspace(): string | null {
  ensureInit();
  return active;
}

export function setActiveWorkspace(path: string | null) {
  ensureInit();
  active = path && path.trim() ? path : null;
  try {
    if (active) window.localStorage.setItem(ACTIVE_KEY, active);
    else window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // ignore storage failures
  }
  emit();
}

export function useActiveWorkspace(): string | null {
  ensureInit();
  return React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => active,
    () => null,
  );
}

export function workspaceName(ws: string | null): string {
  if (!ws) return "Choose workspace";
  const parts = ws.replace(/[/\\]+$/, "").split(/[/\\]/);
  return parts[parts.length - 1] || ws;
}

export function getRecentWorkspaces(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

export function touchRecentWorkspace(path: string) {
  try {
    const next = [path, ...getRecentWorkspaces().filter((p) => p !== path)].slice(0, MAX_RECENTS);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
}

export function removeRecentWorkspace(path: string) {
  try {
    window.localStorage.setItem(
      RECENTS_KEY,
      JSON.stringify(getRecentWorkspaces().filter((p) => p !== path)),
    );
  } catch {
    // ignore storage failures
  }
}

// Map a stored screenshot path to a fetchable URL. Absolute/stock paths and
// data URLs pass through; workspace-relative `uploads/…` paths resolve
// through the file endpoint of the given (or active) workspace — or of the
// default workspace when none is active.
export function assetUrl(stored: string, ws?: string | null): string {
  if (!stored || stored.startsWith("data:") || stored.startsWith("/")) return stored;
  const activeWs = ws !== undefined ? ws : getActiveWorkspace();
  if (!activeWs) return `/api/workspaces/files?rel=${encodeURIComponent(stored)}`;
  return `/api/workspaces/files?ws=${encodeURIComponent(activeWs)}&rel=${encodeURIComponent(stored)}`;
}

export function isWorkspaceRelativePath(stored: string | undefined): boolean {
  return !!stored && !stored.startsWith("data:") && !stored.startsWith("/");
}
