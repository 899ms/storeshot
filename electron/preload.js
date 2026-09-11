"use strict";
// StoreShot preload: the only bridge between the renderer and Electron.
// contextIsolation stays on; the page gets a tiny versioned API and nothing else.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("storeshot", {
  platform: process.platform,
  versions: {
    app: "0.1.0",
  },
  /** Open the native workspace folder picker. Resolves to an absolute path or null. */
  pickWorkspace: () => ipcRenderer.invoke("storeshot:pick-workspace"),
});
