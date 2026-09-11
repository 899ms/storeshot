"use strict";
// StoreShot Electron shell (macOS-first).
//
// Production: forks the Next standalone server (.next/standalone/server.js,
// built by `npm run build`) in a utilityProcess (Electron's Node runtime —
// no system Node needed), probes a free loopback port, and loads it in the
// main window. Development (unpacked): loads the dev server instead.
//
// Security posture: no nodeIntegration, contextIsolation on, sandbox on.
// Renderer code is the existing Next app unchanged.

const { app, BrowserWindow, dialog, ipcMain, nativeTheme, net, Notification, shell, utilityProcess } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const updater = require("./updater");
const { buildMenu } = require("./menu");
const { readPrefs, updatePrefs, touchRecent } = require("./prefs");

const APP_TITLE = "StoreShot";
const DEV_URL = process.env.ELECTRON_START_URL || "http://localhost:3000";
const SERVER_TIMEOUT_MS = 30000;

let mainWindow = null;
let serverChild = null;
let serverPort = 0;
// Last successfully downloaded export (absolute path) — drives the
// "Reveal Last Export in Finder" menu item and Dock entry.
let lastExportFile = null;
// Dirty-document state as last reported by the renderer (N4).
let windowDirty = false;
// Set while a close is deferred for a renderer save flush (N4 quit guard).
let closingAfterFlush = false;
let flushTimer = null;

const IS_MAC = process.platform === "darwin";
const FLUSH_TIMEOUT_MS = 3000;

function standaloneServerEntry() {
  // Unpacked dev runs from the repo; packaged runs from the asar archive.
  // utilityProcess.fork cannot reliably boot a script from inside app.asar,
  // so the standalone server is listed under asarUnpack in package.json and
  // lives in app.asar.unpacked once packaged — prefer whichever exists.
  const packed = path.join(__dirname, "..", ".next", "standalone", "server.js");
  if (fs.existsSync(packed)) return packed;
  return packed.replace("app.asar", "app.asar.unpacked");
}

async function findFreePort() {
  const net = require("node:net");
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

async function waitForServer(port) {
  const url = `http://127.0.0.1:${port}/`;
  const deadline = Date.now() + SERVER_TIMEOUT_MS;
  // net.fetch bypasses proxies and respects Electron's net stack.
  while (Date.now() < deadline) {
    try {
      const res = await net.fetch(url, { method: "HEAD" });
      if (res.ok || res.status < 500) return;
    } catch {
      // Not up yet — keep polling.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Next server did not become ready on port ${port} within ${SERVER_TIMEOUT_MS}ms`);
}

function startPackagedServer(port) {
  const entry = standaloneServerEntry();
  if (!fs.existsSync(entry)) {
    throw new Error(
      `Next standalone server not found at ${entry}. ` +
        "Rebuild with `npm run build` before packaging.",
    );
  }
  const child = utilityProcess.fork(entry, [], {
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
    },
    serviceName: "storeshot-next-server",
  });
  child.on("exit", (code) => {
    serverChild = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog
        .showMessageBox(mainWindow, {
          type: "error",
          title: APP_TITLE,
          message: "The local server stopped unexpectedly.",
          detail: `Exit code ${code}. Restart the app to try again.`,
          buttons: ["Quit"],
          defaultId: 0,
        })
        .then(() => app.quit())
        .catch(() => app.quit());
    }
  });
  return child;
}

async function resolveBaseUrl() {
  if (!app.isPackaged) return DEV_URL;
  serverPort = await findFreePort();
  serverChild = startPackagedServer(serverPort);
  await waitForServer(serverPort);
  return `http://127.0.0.1:${serverPort}`;
}

// --- Native menu + Dock menu (N1/N5/N8) --------------------------------------
const HELP_URLS = new Set([
  "https://appstoreconnect.apple.com",
  "https://play.google.com/console",
]);

function sendMenuAction(action, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("storeshot:menu-action", action, payload);
  }
}

/** Menu actions handled natively; everything else goes to the renderer. */
function dispatchMenuAction(action, payload) {
  switch (action) {
    case "reveal-last-export":
      if (lastExportFile) shell.showItemInFolder(lastExportFile);
      return;
    case "open-help-url":
      if (typeof payload === "string" && HELP_URLS.has(payload)) {
        void shell.openExternal(payload);
      }
      return;
    case "clear-recents":
      updatePrefs({ recents: [] });
      refreshMenus();
      return;
    default:
      sendMenuAction(action, payload);
  }
}

function refreshMenus() {
  const { recents } = readPrefs();
  try {
    const { Menu } = require("electron");
    Menu.setApplicationMenu(buildMenu({ dispatch: dispatchMenuAction, recents, lastExportFile }));
  } catch {
    // Menu is cosmetic — the renderer toolbar carries the same actions.
  }
  if (IS_MAC) {
    try {
      const { Menu } = require("electron");
      const dockTemplate = [
        { label: "Open Workspace…", click: () => sendMenuAction("open-workspace-picker") },
        { type: "separator" },
        ...recents
          .slice(0, 5)
          .map((dir) => ({ label: dir, click: () => sendMenuAction("open-workspace-path", dir) })),
      ];
      if (lastExportFile) {
        dockTemplate.push({ type: "separator" });
        dockTemplate.push({
          label: "Reveal Last Export in Finder",
          click: () => shell.showItemInFolder(lastExportFile),
        });
      }
      app.dock.setMenu(Menu.buildFromTemplate(dockTemplate));
    } catch {
      // Dock menu is cosmetic.
    }
  }
}

// --- Quit guard: flush a pending autosave before the window closes (N4) ------
function requestRendererFlush() {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = null;
      resolve();
    };
    flushTimer = setTimeout(done, FLUSH_TIMEOUT_MS);
    pendingFlushDone = done;
    sendMenuAction("request-flush");
  });
}

// Resolves the in-flight flush wait when the renderer finishes saving.
let pendingFlushDone = null;

function createWindow(baseUrl) {
  const stored = readPrefs().bounds;
  const bounds =
    stored && Number.isFinite(stored.width) && Number.isFinite(stored.height)
      ? { width: stored.width, height: stored.height, x: stored.x, y: stored.y }
      : { width: 1440, height: 900 };
  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 1024,
    minHeight: 640,
    title: APP_TITLE,
    // Rendered before the page paints; follows the OS theme so dark-mode
    // launches never flash white (N2). The renderer theme stays authoritative.
    backgroundColor: nativeTheme.shouldUseDarkMode ? "#1c1c22" : "#f4f4f6",
    // Full-bleed content with inset traffic lights (N2). The renderer adds
    // matching left padding to the toolbar on darwin shell builds only.
    ...(IS_MAC ? { titleBarStyle: "hiddenInset" } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
    show: false,
  });
  if (stored && stored.maximized) mainWindow.maximize();

  let boundsTimer = null;
  const saveBoundsSoon = () => {
    if (boundsTimer) clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      boundsTimer = null;
      if (!mainWindow || mainWindow.isDestroyed()) return;
      try {
        const b = mainWindow.getBounds();
        updatePrefs({ bounds: { ...b, maximized: mainWindow.isMaximized() } });
      } catch {
        // Best-effort only.
      }
    }, 500);
  };
  mainWindow.on("resized", saveBoundsSoon);
  mainWindow.on("moved", saveBoundsSoon);

  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });

  // Flush-then-close: never lose keystrokes younger than the autosave
  // debounce when the user quits mid-edit.
  mainWindow.on("close", (event) => {
    if (closingAfterFlush || !windowDirty) return;
    event.preventDefault();
    void requestRendererFlush().then(() => {
      closingAfterFlush = true;
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
      else app.quit();
    });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    windowDirty = false;
    closingAfterFlush = false;
  });

  attachSpellcheckMenu(mainWindow);
  attachDownloadHandling(mainWindow);

  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    dialog
      .showMessageBox(mainWindow, {
        type: "error",
        title: APP_TITLE,
        message: "Could not load the editor.",
        detail: `${desc} (${code}) — ${url}`,
        buttons: ["Retry", "Quit"],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0 && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.reload();
        } else {
          app.quit();
        }
      })
      .catch(() => app.quit());
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow.loadURL(baseUrl);
}

// --- Spellcheck context menu (N7) -------------------------------------------
// Right-clicking a misspelled word in any editable field offers up to three
// suggestions plus "Add to spelling dictionary"; elsewhere the menu carries
// the standard clipboard entries only.
function attachSpellcheckMenu(win) {
  win.webContents.on("context-menu", (_event, params) => {
    const { Menu } = require("electron");
    const template = [];
    if (params.misspelledWord && params.dictionarySuggestions) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 3)) {
        template.push({
          label: suggestion,
          click: (item, focused) => {
            if (focused) focused.replaceMisspelling(suggestion);
          },
        });
      }
      template.push({ type: "separator" });
      template.push({
        label: "Add to spelling dictionary",
        click: (_item, focused) => {
          if (focused) {
            focused.session.addWordToSpellCheckerDictionary(params.misspelledWord);
          }
        },
      });
      template.push({ type: "separator" });
    }
    if (params.isEditable) {
      template.push({ role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" });
    } else {
      template.push({ role: "copy" });
    }
    Menu.buildFromTemplate(template).popup({ window: win });
  });
}

// --- Native export save dialog + last-folder memory (N6) --------------------
// Every download in this app is an export (PNG or ZIP bundle). Packaged runs
// route it through a native save dialog defaulting to the last export folder;
// the web build keeps its plain browser download.
function attachDownloadHandling(win) {
  const ses = win.webContents.session;
  ses.on("will-download", async (event, item) => {
    const filename = item.getFilename() || "storeshot-export";
    const { lastExportDir } = readPrefs();
    const startDir =
      lastExportDir && fs.existsSync(lastExportDir) ? lastExportDir : app.getPath("downloads");
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: "Save export",
        defaultPath: path.join(startDir, filename),
        filters: filename.endsWith(".png")
          ? [{ name: "PNG image", extensions: ["png"] }]
          : [{ name: "ZIP archive", extensions: ["zip"] }],
      });
      if (canceled || !filePath) {
        item.cancel();
        return;
      }
      item.setSavePath(filePath);
    } catch {
      // Fall back to the default download location on dialog failure.
    }
    item.once("done", (_e, state) => {
      if (state !== "completed") return;
      const savePath = item.getSavePath();
      if (!savePath) return;
      lastExportFile = savePath;
      updatePrefs({ lastExportDir: path.dirname(savePath) });
      refreshMenus();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("storeshot:export-saved", { path: savePath });
      }
    });
  });
}

// --- Native workspace picker (Powerbox-ready for the Mac App Store) --------
// Directory access persists via security-scoped bookmarks: under the MAS
// sandbox these are the only handles that survive restarts. Outside the
// sandbox the bookmark store is simply unused.
function bookmarksFile() {
  return path.join(app.getPath("userData"), "storeshot-bookmarks.json");
}

function readBookmarks() {
  try {
    return JSON.parse(fs.readFileSync(bookmarksFile(), "utf8"));
  } catch {
    return {};
  }
}

function writeBookmarks(bookmarks) {
  try {
    fs.mkdirSync(path.dirname(bookmarksFile()), { recursive: true });
    fs.writeFileSync(bookmarksFile(), JSON.stringify(bookmarks, null, 2));
  } catch {
    // Non-fatal: worst case the user re-picks the folder next launch.
  }
}

ipcMain.handle("storeshot:pick-workspace", async () => {
  const focused = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(focused ?? undefined, {
    title: "Choose a StoreShot workspace folder",
    properties: ["openDirectory", "createDirectory"],
    securityScopedBookmarks: true,
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const dir = result.filePaths[0];
  const bookmark = Array.isArray(result.bookmarks) ? result.bookmarks[0] : undefined;
  if (typeof bookmark === "string" && bookmark) {
    const all = readBookmarks();
    all[dir] = bookmark;
    writeBookmarks(all);
  }
  return dir;
});

// --- Dirty-document state (N4) ----------------------------------------------
// Fire-and-forget reports from the renderer drive the close dot and the
// quit-guard flush. Never throws: cosmetic channel only.
ipcMain.on("storeshot:document-state", (_event, payload) => {
  const dirty = !!(payload && payload.dirty);
  const title = payload && typeof payload.title === "string" ? payload.title : "";
  windowDirty = dirty;
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.setDocumentEdited(dirty);
      if (title) mainWindow.setTitle(title);
    } catch {
      // Cosmetic only.
    }
  }
});

// Resolves the quit-guard flush wait (N4).
ipcMain.on("storeshot:flush-ack", () => {
  if (pendingFlushDone) pendingFlushDone();
});

// --- Workspace reporting → recents, Dock menu, Open Recent (N5) -------------
ipcMain.on("storeshot:report-workspace", (_event, dir) => {
  if (typeof dir !== "string" || !dir) return;
  touchRecent(dir);
  try {
    app.addRecentDocument(dir);
  } catch {
    // Optional OS nicety — never fatal.
  }
  refreshMenus();
});

// --- Reveal a path in Finder (N6). Returns false for unusable input. --------
ipcMain.handle("storeshot:reveal-path", (_event, target) => {
  if (typeof target !== "string" || !target) return false;
  try {
    shell.showItemInFolder(target);
    return true;
  } catch {
    return false;
  }
});

function setDockProgress(value) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.setProgressBar(value);
  } catch {
    // Cosmetic only — never disturb the export.
  }
}

// --- Native export progress + completion notifications ----------------------
// macOS banners cannot host a progress bar, so progress goes to the Dock
// icon (0..1 determinate, >1 indeterminate, <0 clears) and completion
// arrives as a single system notification. Fire-and-forget: the renderer
// never waits on these.
ipcMain.on("storeshot:export-progress", (_event, value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return;
  // Clamp determinate values; anything above 1 is indeterminate mode.
  const clamped = value < 0 ? -1 : Math.min(value, 2);
  setDockProgress(clamped);
});

ipcMain.on("storeshot:export-done", (_event, payload) => {
  setDockProgress(-1);
  const title = payload && typeof payload.title === "string" ? payload.title : "";
  const body = payload && typeof payload.body === "string" ? payload.body : "";
  if (!title || !body) return;
  if (!Notification.isSupported()) return;
  try {
    const note = new Notification({ title, body });
    note.on("click", () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
    note.show();
  } catch {
    // Cosmetic only — the in-app toast already reported the outcome.
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  try {
    if (serverChild) serverChild.kill();
  } catch {
    // Already gone — nothing to stop.
  }
  serverChild = null;
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app
    .whenReady()
    .then(async () => {
      updater.init();
      // Native About panel (N8): name + version from the packaged app.
      try {
        app.setAboutPanelOptions({
          applicationName: APP_TITLE,
          applicationVersion: app.getVersion(),
        });
      } catch {
        // Older Electron — the default About panel still works.
      }
      refreshMenus();
      // Follow the OS theme so the pre-paint background never flashes (N2).
      nativeTheme.on("updated", () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          try {
            mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkMode ? "#1c1c22" : "#f4f4f6");
          } catch {
            // Cosmetic only.
          }
        }
      });
      const baseUrl = await resolveBaseUrl();
      await createWindow(baseUrl);
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0 && baseUrl) {
          createWindow(baseUrl).catch(() => app.quit());
        }
      });
    })
    .catch((err) => {
      dialog
        .showErrorBox(
          APP_TITLE,
          `Could not start the local server.\n\n${err instanceof Error ? err.message : String(err)}`,
        );
      app.quit();
    });
}
