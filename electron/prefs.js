"use strict";
// StoreShot persistent shell prefs (window bounds, last export dir, recents).
// Plain JSON next to storeshot-bookmarks.json. All reads tolerate a missing
// or corrupt file; all writes are best-effort and never throw.

const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const MAX_RECENTS = 8;

function prefsFile() {
  return path.join(app.getPath("userData"), "storeshot-prefs.json");
}

function defaults() {
  return { bounds: null, lastExportDir: null, recents: [] };
}

function readPrefs() {
  try {
    const raw = JSON.parse(fs.readFileSync(prefsFile(), "utf8"));
    const out = defaults();
    if (raw && typeof raw === "object") {
      if (raw.bounds && typeof raw.bounds === "object") out.bounds = raw.bounds;
      if (typeof raw.lastExportDir === "string" && raw.lastExportDir) {
        out.lastExportDir = raw.lastExportDir;
      }
      if (Array.isArray(raw.recents)) {
        out.recents = raw.recents.filter((p) => typeof p === "string").slice(0, MAX_RECENTS);
      }
    }
    return out;
  } catch {
    return defaults();
  }
}

function writePrefs(prefs) {
  try {
    fs.mkdirSync(path.dirname(prefsFile()), { recursive: true });
    fs.writeFileSync(prefsFile(), JSON.stringify(prefs, null, 2));
  } catch {
    // Non-fatal: worst case the window opens at the default size next launch.
  }
}

/** Merge a partial prefs object over the stored one. */
function updatePrefs(patch) {
  const prefs = readPrefs();
  writePrefs({ ...prefs, ...patch });
  return readPrefs();
}

/** Move path to the front of recents (capped). Returns the new list. */
function touchRecent(dir) {
  if (typeof dir !== "string" || !dir) return readPrefs().recents;
  const prefs = readPrefs();
  prefs.recents = [dir, ...prefs.recents.filter((p) => p !== dir)].slice(0, MAX_RECENTS);
  writePrefs(prefs);
  return prefs.recents;
}

module.exports = { MAX_RECENTS, readPrefs, updatePrefs, touchRecent };
