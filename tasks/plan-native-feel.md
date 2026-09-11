# Implementation Plan: Native Feel for StoreShot (macOS)

## Overview

Make the packaged StoreShot app stop feeling like a web page in a box.
The renderer already speaks "native" where it can (Cmd+S handler, theme
flash guard in `src/app/layout.tsx`, defensive `window.storeshot` bridge in
`src/lib/export-notify.ts`). The gap is all in the Electron shell:
`electron/main.js` is a bare `BrowserWindow` with no menu, default titlebar,
no window restore, no dirty-document state, and no OS integrations — and the
in-flight Dock progress work (renderer side in `src/lib/export-notify.ts` +
`export-notify.test.ts`, typings in `src/storeshot.d.ts`) still needs its
main-process half.

Order is fail-fast and vertical: land the in-flight work first, then the
foundation every Mac user expects (menu, window chrome), then document-model
behavior (dirty dot, recents), then one-at-a-time OS integrations. Each task
leaves both targets working: packaged Electron AND plain `bun dev` web
(every bridge call must no-op when `window.storeshot` is absent — the
existing `export-notify.ts` pattern).

Explicitly out of scope (locked by `tasks/plan-electron.md`): update server,
Windows/Linux, actual sign/notarize (runs on user machine).

## Architecture Decisions

- Menu uses Electron `role`s for Edit (undo/redo/cut/copy/paste/select-all)
  so text fields get correct behavior for free; app actions (Save, Export,
  Settings, workspace switching) go through one `storeshot:onMenuAction`
  subscription in preload, reusing the defensive-bridge pattern.
- Window bounds persist as plain JSON in `app.getPath("userData")` next to
  `storeshot-bookmarks.json` — no new dependency (no electron-store).
- `titlebarStyle: "hiddenInset"` with renderer-side top padding guarded by
  `window.storeshot?.platform === "darwin"` so web layout is untouched.
- Dark-mode flash avoided by syncing `backgroundColor` + a small
  `nativeTheme` listener; renderer theme stays source of truth.
- All file-dialog work uses `dialog` (Powerbox-compatible for MAS);
  renderer keeps its current browser-dialog fallback.

## Task List

### Phase 0: Land in-flight work

- [ ] Task N0: Dock progress + notification main-process wiring

### Checkpoint: In-flight landed
- [ ] Export shows determinate Dock progress, clears at end, notifies on done
- [ ] `bun dev` web build unaffected (bridge absent → silent no-op)

### Phase 1: Foundation (menu + window chrome)

- [ ] Task N1: Native app menu with roles
- [ ] Task N2: Window chrome (hiddenInset, theme sync, bounds restore)
- [ ] Task N3: Renderer menu-action bridge + wiring

### Checkpoint: Foundation
- [ ] Cmd+Z/X/C/V/A work in every text field; File→Save/Export match toolbar
- [ ] No white flash in dark mode; traffic lights clear the toolbar; bounds restore
- [ ] `bun dev` layout pixel-identical (darwin-only guards)

### Phase 2: Document model

- [ ] Task N4: Dirty state (edited dot, title, quit guard)
- [ ] Task N5: Recent workspaces (Dock menu, Open Recent)

### Checkpoint: Document model
- [ ] Close dot appears with unsaved changes; title shows workspace name
- [ ] Workspace reopens from Dock menu / Open Recent

### Phase 3: OS integration polish

- [ ] Task N6: Reveal in Finder + native ZIP save dialog
- [ ] Task N7: Spellcheck context menu
- [ ] Task N8: About panel + Help links

### Checkpoint: Complete
- [ ] All acceptance criteria met; packaged app verified on user machine
- [ ] Web workflow untouched; MAS entitlements unchanged

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dock-progress renderer/main signature drift (`export-notify.ts` vs `preload.js`) | Med | N0 aligns `storeshot.d.ts` as the contract, covered by `export-notify.test.ts` |
| hiddenInset traffic lights overlap toolbar buttons | Med | N2 adds darwin-only top/left padding; verify at minimum window width (1024) |
| Menu accelerators double-fire with renderer Cmd+S handler | Low | N3 keeps renderer handler as fallback only when bridge absent |
| MAS sandbox blocks Notification / save dialog | Low | Both are Powerbox/sandbox-safe APIs; verify in sandboxed `.pkg` pass |
| Scope creep into update server / signing | Low | Explicitly deferred to `tasks/plan-electron.md` E5–E7 |

## Open Questions (resolved during build)

- ZIP save location: remember last export folder — YES, implemented in N6
  (`lastExportDir` in `userData/storeshot-prefs.json`, global not per-workspace).
- File→Export opens the dialog — confirmed, implemented in N3.

## Parallelization Opportunities

- Safe to parallelize after N0: N1+N2 (both touch `main.js` — coordinate, do not parallelize); N5, N7, N8 are independent of each other once N1's menu file exists.
- Must be sequential: N1 → N3 (bridge needs menu action names); N2 → N4 (title/dirty needs chrome work); everything → packaged-verify checkpoint.
