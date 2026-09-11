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

const { app, BrowserWindow, dialog, ipcMain, net, utilityProcess } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const updater = require("./updater");

const APP_TITLE = "StoreShot";
const DEV_URL = process.env.ELECTRON_START_URL || "http://localhost:3000";
const SERVER_TIMEOUT_MS = 30000;

let mainWindow = null;
let serverChild = null;
let serverPort = 0;

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

function createWindow(baseUrl) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: APP_TITLE,
    backgroundColor: "#111111",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });

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
