// Renderer helpers for the Electron shell bridge (window.storeshot).
// Every export here is a safe no-op on plain web builds where the bridge is
// absent — the packaged app and `bun dev` share all call sites.

export type MenuActionHandler = (action: string, payload?: unknown) => void;

const THEME_KEY = "screenshots-color-theme";

/** True only inside the packaged Electron shell (never plain web). */
export function isShell(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.storeshot &&
    typeof window.storeshot.pickWorkspace === "function"
  );
}

/** True inside the macOS shell, where the hiddenInset titlebar applies. */
export function isMacShell(): boolean {
  return isShell() && window.storeshot?.platform === "darwin";
}

export function onMenuAction(handler: MenuActionHandler): () => void {
  try {
    return window.storeshot?.onMenuAction(handler) ?? (() => {});
  } catch {
    return () => {};
  }
}

export function setDocumentState(dirty: boolean, title: string): void {
  try {
    window.storeshot?.setDocumentState({ dirty, title });
  } catch {
    // Cosmetic channel — never break editing.
  }
}

export function ackFlush(): void {
  try {
    window.storeshot?.ackFlush();
  } catch {
    // The main process times out and closes anyway.
  }
}

export function reportWorkspace(dir: string | null): void {
  try {
    window.storeshot?.reportWorkspace(dir);
  } catch {
    // Recents sync is cosmetic.
  }
}

/** Reveal a file/folder in Finder. Returns false outside the shell. */
export async function revealPath(target: string): Promise<boolean> {
  try {
    return (await window.storeshot?.revealPath(target)) ?? false;
  } catch {
    return false;
  }
}

// Last export path reported by the main process after a native save-dialog
// download completes. Toast actions read it lazily at click time because the
// download finishes after the success toast is already on screen.
let lastExportPath: string | null = null;

export function getLastExportPath(): string | null {
  return lastExportPath;
}

let trackingExports = false;

/**
 * Start recording main-process export-saved events into lastExportPath.
 * Idempotent — call once from the editor root. No-op outside the shell.
 */
export function trackExportSaves(): void {
  if (trackingExports) return;
  trackingExports = true;
  onExportSaved(() => {});
}

/** Reveal the most recent export, if the main process has reported one. */
export function revealLastExport(): void {
  if (lastExportPath) void revealPath(lastExportPath);
}

export function onExportSaved(callback: (path: string) => void): () => void {
  try {
    return (
      window.storeshot?.onExportSaved((path: string) => {
        lastExportPath = path;
        callback(path);
      }) ?? (() => {})
    );
  } catch {
    return () => {};
  }
}

function applyTheme(dark: boolean): void {
  document.documentElement.classList.toggle("dark", dark);
  try {
    window.localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {
    // Private mode etc. — theme still applies for the session.
  }
  window.dispatchEvent(new CustomEvent<boolean>("storeshot:theme-changed", { detail: dark }));
}

export function toggleTheme(): void {
  applyTheme(!document.documentElement.classList.contains("dark"));
}
