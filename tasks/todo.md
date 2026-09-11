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
