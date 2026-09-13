# Task List: Copy Screens Across Devices

Plan: `tasks/plan-copy-across-devices.md`

Commands: `npm run test` · `npm run typecheck` · `npm run lint` · `npm run build`

---

## Phase 1: Foundation

## Task 1: Pure clone + geometry adapt

**Description:** Add `src/lib/copy-slides.ts` with `cloneSlide` (deep copy, new ids, same geometry) and `adaptSlideGeometry` (drop built-in `transforms`, scale overlay text + absolute caption `fontSize` to a destination canvas).

**Acceptance criteria:**
- [x] `cloneSlide` returns a new slide id, new text-element ids, and no shared nested object identity with the source
- [x] `adaptSlideGeometry` sets `transforms` to `undefined` and scales overlay geometry by `sx`/`sy` and `fontSize` by `min(sx,sy)`
- [x] Rotation, flip, zIndex, screenshot paths, layout, name, inverted, and localized copy are preserved

**Verification:**
- [x] Tests pass: `npm run test -- src/lib/copy-slides.test.ts`
- [x] Build succeeds: `npm run typecheck`

**Dependencies:** None

**Files likely touched:**
- `src/lib/copy-slides.ts`
- `src/lib/copy-slides.test.ts`

**Estimated scope:** Small: 1-2 files

---

## Task 2: `copySlidesToDevices` project operation

**Description:** Copy all (or listed) slides from one device onto one or more others with `mode: "append" | "replace"`. Use `effectiveCanvas`. Inject `nid` for tests.

**Acceptance criteria:**
- [x] Append concatenates clones; replace overwrites; multi-target writes every dest in one returned `ProjectState`
- [x] Source deck is unchanged; `firstSlideId` is the first clone on the first target
- [x] Unknown `slideIds`, empty source, or `from === to` throw

**Verification:**
- [x] Tests pass: `npm run test -- src/lib/copy-slides.test.ts`
- [x] Build succeeds: `npm run typecheck`

**Dependencies:** Task 1

**Files likely touched:**
- `src/lib/copy-slides.ts`
- `src/lib/copy-slides.test.ts`

**Estimated scope:** Small: 1-2 files

---

## Checkpoint: Foundation

- [x] `npm run test` green for `copy-slides.test.ts`
- [x] Typecheck clean

---

## Phase 2: Core UX

## Task 3: Copy screens dialog

**Description:** `CopyScreensDialog` — source read-only, dest checkboxes, All/This radio, replace vs append when dest is non-empty. Calls `onCopy(opts)`.

**Acceptance criteria:**
- [x] Renders source label, dest counts; disables submit with no dest / this-screen with no active slide
- [x] Replace/append hidden when every checked dest is empty
- [x] `onCopy` receives `{ from, to, mode, slideIds?: [activeId] }`

**Dependencies:** Task 2

**Files likely touched:**
- `src/components/editor/copy-screens-dialog.tsx`

**Estimated scope:** Small: 1 file

---

## Task 4: Wire dialog, toolbar, empty-state CTA, switch-device + toast

**Description:** Dynamic import from editor. Toolbar overflow **Copy screens to…**. One `setState`, switch device, toast. Empty canvas **Copy from {Device} (N)**.

**Acceptance criteria:**
- [x] Phone → Tablet appends, switches toolbar, shows first clone
- [x] Cmd+Z restores dest decks and previous device
- [x] Empty dest CTA when another deck is filled; overflow disabled when current deck empty

**Dependencies:** Task 3

**Files likely touched:**
- `src/components/editor/screenshot-editor.tsx`
- `src/components/editor/toolbar.tsx`

**Estimated scope:** Medium: 3 files

---

## Checkpoint: Core UX

- [x] Core user flow wired end-to-end (unit-tested copy; UI in editor)
- [x] Undo uses existing history (one setState)

---

## Phase 3: Polish

## Task 5: MCP `copy_slides` tool

**Description:** Expose `copySlidesToDevices`. Replace requires `confirm: true`.

**Acceptance criteria:**
- [x] Append writes clones and returns `{ copied, firstSlideId, targets }`
- [x] Replace without confirm throws; UI and MCP share the lib

**Dependencies:** Task 2

**Files likely touched:**
- `src/mcp/tools.ts`
- `src/mcp/server.ts`
- `src/mcp/tools.test.ts`

**Estimated scope:** Medium: 3 files

---

## Task 6: Shortcuts copy + replace-label + empty/disabled edges

**Description:** Shortcuts list the menu action. Replace submit is destructive. Busy disables copy.

**Acceptance criteria:**
- [x] Shortcuts dialog mentions the overflow action
- [x] Replace submit is destructive; append is default
- [x] Copy blocked while export/translate busy

**Dependencies:** Task 4

**Files likely touched:**
- `src/components/editor/shortcuts-dialog.tsx`
- `src/components/editor/copy-screens-dialog.tsx`
- `src/components/editor/toolbar.tsx`

**Estimated scope:** Small: 2-3 files

---

## Checkpoint: Complete

- [x] All acceptance criteria met
- [x] `npm run test` + `npm run typecheck` + `npm run lint` + `npm run build` green
- [ ] Manual browser pass: Phone deck with overlay text → copy to Tablet (empty) and Desktop (append + replace) → undo
- [x] Ready for review
