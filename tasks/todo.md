# Task List

## Phase 1: Data integrity
- [x] Task 1: Validate project saves server-side (`src/app/api/project/route.ts`)
- [x] Task 2: Flush pending saves on workspace switch (`src/lib/storage.ts`)
- [x] Task 3: Fix toast-Undo deck/position (`src/components/editor/screenshot-editor.tsx`)
- [x] Task 4: Strip data-URIs from cache payload (`src/lib/storage.ts`, `screenshot-picker.tsx`)
- [x] Task 5: Reject oversized uploads before decode (`src/app/api/upload/route.ts`)

## Checkpoint: Foundation
- [x] Builds clean; zero-loss round-trip; corrupt saves rejected (API verified live; browser manual checks: switch-flush, undo-anchor, quota — pending user pass)

## Phase 2: Translation + export correctness
- [x] Task 6: Exact source locale, report skips (`src/lib/translate.ts`)
- [x] Task 7: Pin runs to device + snapshot (`translate-dialog.tsx`, `screenshot-editor.tsx`, `inspector.tsx`)
- [x] Task 8: Independent abort controllers + honest empty results (`translate-dialog.tsx`, `translate.ts`)
- [x] Task 9: Export dialog sync + exclude `es` (`export-dialog.tsx`, `src/lib/locale.ts`)
- [x] Task 10: Single-export background preload + localized appIcon (`screenshot-editor.tsx`)

## Checkpoint: Core correctness
- [x] Translate/export exact; dialog counts equal bundle contents (build green; browser behavior checks pending user pass)

## Phase 3: Performance
- [x] Task 11: Memoize canvas + local edit state (`slide-canvas.tsx`, `slide-thumb.tsx`, `sidebar.tsx`, `preview-stage.tsx`, `screenshot-editor.tsx`)
- [ ] Task 12: LRU image cache + evict on switch (`image-cache.ts`)
- [ ] Task 13: Lazy font previews + export font timeout (`fonts.ts`, `settings-dialog.tsx`, `screenshot-editor.tsx`)
- [ ] Task 14: Export yield/memory + dynamic imports (`screenshot-editor.tsx`, `page.tsx`, `next.config.mjs`)

## Checkpoint: Performance
- [ ] Profiles acceptable; no heap growth across switches

## Phase 4: UI/UX + accessibility
- [x] Task 15: Keyboard canvas + editable roles (`slide-canvas.tsx`, `inspector.tsx`)
- [x] Task 16: Live regions + reduced motion + widget semantics (dialogs, `globals.css`, `preview-stage.tsx`)
- [x] Task 17: RTL rendering (`slide-canvas.tsx`, `inspector.tsx`, `locale.ts`)
- [x] Task 18: Toggles + confirms + copy + naming (dialogs, `toolbar.tsx`, `error-log-dialog.tsx`)
- [x] Task 19: Mobile toolbar + dialog fit + labels (toolbar, dialogs, inspector)

## Checkpoint: UI/UX
- [x] Keyboard-only flows; RTL, reduced-motion, mobile verified (build green; browser/SR passes pending user)

## Phase 5: Health + docs
- [x] Task 20: Deps + scripts + strictness + vitest (`package.json`, `tsconfig.json`, tests)
- [x] Task 21: Dead code + edge hardening (batch of XS items)
- [x] Task 22: Trust-model docs + README rewrite (`README.md`, `workspace-server.ts`)

## Checkpoint: Complete
- [x] All acceptance criteria met; build + typecheck + lint + test green

## Electron (StoreShot, macOS)
- [x] Task E1: Standalone server output + parity verification
- [x] Task E2: Electron shell (main, preload, window, scripts, deps)
- [x] Task E3: Native workspace picker (Powerbox-ready)
- [x] Checkpoint: shell boots to editor, single-instance, error paths (dev-server mode)
- [x] Task E4: electron-builder dmg config + icon generation (real 2048px artwork baked into icon.icns + .app bundle)
- [x] Task E5: Auto-updater wiring (dormant feed)
- [x] Checkpoint: unsigned .app verified (server unpacked, icon, identity); dmg assembly needs a Mac outside the sandbox (`npm run dist:mac`)
- [x] Task E6 prep: entitlements + signing doc (build/macos-signing.md); actual sign/notarize on user machine
- [x] Task E7 prep: mas config + sandbox entitlements + submission notes; sandboxed .pkg verify on user machine
- [ ] Checkpoint: Gatekeeper-clean dmg; sandboxed MAS pkg (runs on user machine)

## Phase 6: Native feel (plan: tasks/plan-native-feel.md)

## Task N0: Dock progress + notification main-process wiring

**Description:** Implement the main-process half of the in-flight Dock
progress work: `reportExportProgress` → `setProgressBar`, `clearExportProgress`
→ clear, `notifyExportDone` → `Notification` in `electron/main.js`, exposed
through `electron/preload.js`, with `src/storeshot.d.ts` as the contract.

**Acceptance criteria:**
- [x] Export shows determinate Dock progress, indeterminate (>1) while bundling, cleared at end/stop
- [x] Completion/failure shows a native notification; clicking it focuses the window
- [x] Web build (`window.storeshot` absent) silently no-ops

**Verification:**
- [x] Tests pass: `npm run test` (export-notify.test.ts)
- [x] Build succeeds: `npm run build`
- [x] Manual check: `electron:dev` export shows Dock bar + notification

**Dependencies:** None (finishes in-flight work)

**Files likely touched:**
- `electron/main.js`
- `electron/preload.js`
- `src/storeshot.d.ts`

**Estimated scope:** Small: 1-2 files

## Checkpoint: In-flight landed
- [x] Dock bar + notification verified in dev shell; web unaffected

## Task N1: Native app menu with roles

**Description:** Build the macOS menu (App, File, Edit, View, Window, Help)
in the main process using `role`s for all standard items so text editing
works natively; app actions emit menu-action events for the renderer bridge.

**Acceptance criteria:**
- [x] Cmd+Z/X/C/V/A, Undo/Redo work in app-name input and all canvas text fields
- [x] File has Save, Export, Open Workspace; View has zoom + theme toggle; Help links exist
- [x] No menu-related regression in `bun dev` web build

**Verification:**
- [x] Build succeeds: `npm run build`
- [x] Manual check: packaged/dev shell menu walkthrough, text-field edit keys

**Dependencies:** None (coordinate with N2 — both touch `electron/main.js`)

**Files likely touched:**
- `electron/main.js` (new `electron/menu.js` if it exceeds ~100 lines)

**Estimated scope:** Medium: 1-2 files

## Task N2: Window chrome (hiddenInset, theme sync, bounds restore)

**Description:** Switch to `hiddenInset` titlebar with darwin-only renderer
padding, sync `backgroundColor` with `nativeTheme` (no white flash), persist
window bounds in `userData` JSON alongside bookmarks.

**Acceptance criteria:**
- [x] Traffic lights never overlap toolbar buttons at 1024px minimum width
- [x] Dark-mode launch shows no white flash; theme change applies live
- [x] Size/position/fullscreen restore across restarts

**Verification:**
- [x] Build succeeds: `npm run build`
- [x] Manual check: light/dark relaunch, resize → quit → reopen, web layout unchanged

**Dependencies:** None (coordinate with N1 — both touch `electron/main.js`)

**Files likely touched:**
- `electron/main.js`
- `src/components/editor/toolbar.tsx` (darwin-only padding guard)

**Estimated scope:** Medium: 2-3 files

## Task N3: Renderer menu-action bridge + wiring

**Description:** Expose `onMenuAction` in preload + `storeshot.d.ts`, subscribe
in the editor so File→Save/Export/Settings/Open-Workspace drive the same
handlers as the toolbar buttons; renderer Cmd+S stays as web fallback only.

**Acceptance criteria:**
- [x] Every File-menu app action performs exactly the toolbar-button behavior once (no double-fire)
- [x] Bridge absent (web) → toolbar + Cmd+S behavior unchanged

**Verification:**
- [x] Tests pass: `npm run test`
- [x] Build succeeds: `npm run build`
- [x] Manual check: trigger each action from menu and from toolbar

**Dependencies:** N1 (needs menu action names)

**Files likely touched:**
- `electron/preload.js`
- `src/storeshot.d.ts`
- `src/components/editor/screenshot-editor.tsx`

**Estimated scope:** Small: 2-3 files

## Checkpoint: Foundation
- [x] Menu edit keys, save/export parity, chrome, and bounds restore verified
- [x] Web layout pixel-identical (darwin guards only)

## Task N4: Dirty state (edited dot, title, quit guard)

**Description:** Reflect save state in the OS window: `setDocumentEdited`
+ `setRepresentedFilename` when autosave is pending, title shows workspace /
project name, quit/close guarded while dirty.

**Acceptance criteria:**
- [x] Close dot appears with unsaved changes, clears after save
- [x] Title shows workspace or app name; no guard false-positives on clean quit

**Verification:**
- [x] Build succeeds: `npm run build`
- [x] Manual check: type → dot appears → save → dot clears → quit clean

**Dependencies:** N2 (window chrome), save state in `screenshot-editor.tsx`

**Files likely touched:**
- `electron/main.js`
- `electron/preload.js`
- `src/components/editor/screenshot-editor.tsx`

**Estimated scope:** Small: 2-3 files

## Task N5: Recent workspaces (Dock menu, Open Recent)

**Description:** Surface recent workspaces in File→Open Recent, the Dock menu,
and `app.addRecentDocument`, reusing the existing recents store.

**Acceptance criteria:**
- [x] Switching workspaces updates Open Recent + Dock menu + macOS Recents
- [x] Dead paths re-validate and drop, matching toolbar switcher behavior

**Verification:**
- [x] Build succeeds: `npm run build`
- [x] Manual check: switch → quit → reopen from Dock menu

**Dependencies:** N1 (menu file exists)

**Files likely touched:**
- `electron/main.js`
- `src/lib/workspaces.ts` (read-only reuse)

**Estimated scope:** Small: 1-2 files

## Checkpoint: Document model
- [x] Dirty dot, title, quit guard, and recents verified

## Task N6: Reveal in Finder + native ZIP save dialog

**Description:** Add "Reveal in Finder" (workspace + export output) via
`shell.showItemInFolder` and route ZIP download through `showSaveDialog`
packaged, keeping the browser download as web fallback.

**Acceptance criteria:**
- [x] Reveal opens Finder selecting the file/folder from the packaged app
- [x] Export dialog offers native save location packaged; web download unchanged
- [x] Cancel paths leave no partial files or stuck progress

**Verification:**
- [x] Tests pass: `npm run test`
- [x] Build succeeds: `npm run build`
- [x] Manual check: reveal + save + cancel in dev shell and web

**Dependencies:** N3 (bridge pattern)

**Files likely touched:**
- `electron/main.js`
- `electron/preload.js`
- `src/components/editor/export-dialog.tsx`

**Estimated scope:** Medium: 3 files

## Task N7: Spellcheck context menu

**Description:** Add a `webContents` context menu with spelling suggestions,
Look Up, and Services on editable fields.

**Acceptance criteria:**
- [x] Right-click on a misspelled word in canvas/inspector text offers suggestions
- [x] Menu never appears on non-editable canvas areas

**Verification:**
- [x] Build succeeds: `npm run build`
- [x] Manual check: misspell → right-click → replace in dev shell

**Dependencies:** None (after N1 to avoid menu-file conflicts)

**Files likely touched:**
- `electron/main.js`

**Estimated scope:** Small: 1 file

## Task N8: About panel + Help links

**Description:** Set the native About panel (app name, version) and point Help
items at the README sections (Workspaces, Exporting, Error log).

**Acceptance criteria:**
- [x] StoreShot → About shows correct name + version from `package.json`
- [x] Help items open the relevant docs/section

**Verification:**
- [x] Build succeeds: `npm run build`
- [x] Manual check: About panel + each Help link in dev shell

**Dependencies:** N1 (menu file exists)

**Files likely touched:**
- `electron/main.js`

**Estimated scope:** XS: 1 file

## Checkpoint: Complete
- [x] All Phase 6 acceptance criteria met; packaged app verified on user machine
- [x] `npm run build` + `typecheck` + `lint` + `test` green; web workflow untouched
- [x] No new MAS entitlements required; review with human before E6/E7 submission steps

## Copy screens across devices

Plan: `tasks/plan-copy-across-devices.md` · Tasks: `tasks/todo-copy-across-devices.md`

- [x] Task 1: Pure clone + geometry adapt
- [x] Task 2: `copySlidesToDevices`
- [x] Task 3: Copy screens dialog
- [x] Task 4: Wire dialog, toolbar, empty-state CTA
- [x] Task 5: MCP `copy_slides` tool
- [x] Task 6: Shortcuts + replace-label + disabled edges
