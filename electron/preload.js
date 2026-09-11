"use strict";
// StoreShot preload: the only bridge between the renderer and Electron.
// contextIsolation stays on; the page gets a tiny versioned API and nothing else.

const { contextBridge, ipcRenderer } = require("electron");

/** Subscribe to main→renderer menu actions. Returns an unsubscribe function. */
function onMenuAction(callback) {
  const listener = (_event, action, payload) => {
    try {
      callback(action, payload);
    } catch {
      // A menu handler must never break the bridge for other subscribers.
    }
  };
  ipcRenderer.on("storeshot:menu-action", listener);
  return () => ipcRenderer.removeListener("storeshot:menu-action", listener);
}

/** Subscribe to export-saved events. Returns an unsubscribe function. */
function onExportSaved(callback) {
  const listener = (_event, payload) => {
    const path = payload && typeof payload.path === "string" ? payload.path : "";
    if (!path) return;
    try {
      callback(path);
    } catch {
      // Cosmetic channel — never fatal.
    }
  };
  ipcRenderer.on("storeshot:export-saved", listener);
  return () => ipcRenderer.removeListener("storeshot:export-saved", listener);
}

contextBridge.exposeInMainWorld("storeshot", {
  platform: process.platform,
  versions: {
    app: "0.1.0",
  },
  /** Open the native workspace folder picker. Resolves to an absolute path or null. */
  pickWorkspace: () => ipcRenderer.invoke("storeshot:pick-workspace"),
  /**
   * Dock progress for exports: 0..1 determinate, >1 indeterminate.
   * Fire-and-forget; safe to call from tight render loops.
   */
  reportExportProgress: (fraction) => ipcRenderer.send("storeshot:export-progress", fraction),
  /** Clear the Dock progress bar. */
  clearExportProgress: () => ipcRenderer.send("storeshot:export-progress", -1),
  /** Show a native completion notification. */
  notifyExportDone: (title, body) =>
    ipcRenderer.send("storeshot:export-done", { title, body }),
  /** Subscribe to native menu actions (save, export, open-settings, …). */
  onMenuAction,
  /** Report dirty-document state for the close dot + quit guard. */
  setDocumentState: (state) => ipcRenderer.send("storeshot:document-state", state),
  /** Acknowledge a quit-guard save flush so the window may close. */
  ackFlush: () => ipcRenderer.send("storeshot:flush-ack"),
  /** Report the active workspace so recents/Dock stay in sync. */
  reportWorkspace: (dir) => ipcRenderer.send("storeshot:report-workspace", dir),
  /** Reveal a file or folder in Finder. Resolves false for unusable input. */
  revealPath: (target) => ipcRenderer.invoke("storeshot:reveal-path", target),
  /** Fired with the absolute path when a native export download completes. */
  onExportSaved,
});
