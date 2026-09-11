"use strict";
// StoreShot dormant auto-updater (Task E5).
//
// No update server exists yet, so this module is intentionally inert: it only
// activates when STORESHOT_UPDATE_FEED_URL is set in the packaged app's
// environment. When a private feed ships, wire the feed URL here (or swap
// this stub for electron-updater) — no main.js changes needed beyond this
// single init() call.

const { app } = require("electron");

let started = false;

function getFeedURL() {
  const url = (process.env.STORESHOT_UPDATE_FEED_URL || "").trim();
  return url || null;
}

function init() {
  if (started || !app.isPackaged) return;
  started = true;
  const feedURL = getFeedURL();
  if (!feedURL) {
    // Dormant: no feed configured. Log once so packaging can verify wiring.
    console.log("[storeshot:update] dormant (STORESHOT_UPDATE_FEED_URL unset)");
    return;
  }
  // A feed is configured but no updater backend is bundled yet — fail loud
  // instead of silently never updating.
  console.warn(`[storeshot:update] feed configured (${feedURL}) but no updater backend is bundled yet`);
}

function isDormant() {
  return getFeedURL() === null;
}

module.exports = { init, isDormant, getFeedURL };
