"use strict";
// StoreShot application menu (macOS-first).
//
// Standard editing/zoom/window behavior comes from Electron `role`s so text
// fields get Undo/Redo/Cut/Copy/Paste/Select-All for free. App actions
// (save, export, settings, …) dispatch through the `dispatch` callback the
// caller provides — main.js forwards them to the renderer or handles them
// natively (see N3/N5/N6/N8).

const { Menu, app } = require("electron");

const IS_MAC = process.platform === "darwin";

/**
 * @param {{ dispatch: (action: string, payload?: unknown) => void,
 *           recents: string[], lastExportFile: string | null }} opts
 */
function buildMenu({ dispatch, recents, lastExportFile }) {
  const recentItems =
    recents.length > 0
      ? recents.map((dir) => ({
          label: dir,
          click: () => dispatch("open-workspace-path", dir),
        }))
      : [{ label: "No Recent Workspaces", enabled: false }];

  const fileMenu = {
    label: "File",
    submenu: [
      { label: "Open Workspace…", accelerator: "CmdOrCtrl+O", click: () => dispatch("open-workspace-picker") },
      { label: "Open Recent", submenu: [...recentItems, { type: "separator" }, { label: "Clear Menu", click: () => dispatch("clear-recents") }] },
      { type: "separator" },
      { label: "Reveal Workspace in Finder", click: () => dispatch("reveal-workspace") },
      {
        label: "Reveal Last Export in Finder",
        enabled: !!lastExportFile,
        click: () => dispatch("reveal-last-export"),
      },
      { type: "separator" },
      { label: "Save", accelerator: "CmdOrCtrl+S", click: () => dispatch("save") },
      { label: "Export…", accelerator: "CmdOrCtrl+E", click: () => dispatch("export") },
      { type: "separator" },
      IS_MAC ? { role: "close" } : { role: "quit" },
    ],
  };

  // Undo/Redo dispatch to the renderer instead of using `role`s: the editor
  // owns Cmd+Z for canvas history outside text fields, and a role accelerator
  // would swallow the keystroke before the page ever sees it. Cut/Copy/Paste
  // stay roles — the renderer binds nothing on those keys.
  const editMenu = {
    label: "Edit",
    submenu: [
      { label: "Undo", accelerator: "CmdOrCtrl+Z", click: () => dispatch("undo") },
      { label: "Redo", accelerator: "CmdOrCtrl+Shift+Z", click: () => dispatch("redo") },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "pasteAndMatchStyle" },
      { role: "delete" },
      { role: "selectAll" },
      { type: "separator" },
      ...(IS_MAC ? [{ role: "speechMenu" }] : []),
    ],
  };

  const viewMenu = {
    label: "View",
    submenu: [
      { role: "zoomIn", accelerator: "CmdOrCtrl+Plus" },
      { role: "zoomOut", accelerator: "CmdOrCtrl+-" },
      { role: "resetZoom", accelerator: "CmdOrCtrl+0" },
      { type: "separator" },
      { label: "Toggle Theme", click: () => dispatch("toggle-theme") },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  };

  const windowMenu = IS_MAC
    ? { label: "Window", submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "front" }] }
    : { role: "windowMenu" };

  const helpMenu = {
    role: "help",
    submenu: [
      { label: "Error Log", click: () => dispatch("open-error-log") },
      { label: "Settings…", accelerator: "CmdOrCtrl+,", click: () => dispatch("open-settings") },
      { type: "separator" },
      { label: "App Store Connect", click: () => dispatch("open-help-url", "https://appstoreconnect.apple.com") },
      { label: "Google Play Console", click: () => dispatch("open-help-url", "https://play.google.com/console") },
    ],
  };

  const template = [fileMenu, editMenu, viewMenu, windowMenu, helpMenu];
  if (IS_MAC) {
    template.unshift({
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }
  return Menu.buildFromTemplate(template);
}

module.exports = { buildMenu };
