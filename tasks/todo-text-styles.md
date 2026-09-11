# Tasks: Global Text Styles

## Task 1: Global text model + resolution
**Description:** Add `GlobalTextStyle` type and thread a `global` param through `resolveLabelStyle`/`resolveHeadlineStyle` (override → global → builtin), with unit tests.
**Acceptance criteria:**
- [ ] `ProjectState.headlineText?/labelText?` typed; resolvers honor override → global → builtin for weight/sizeFactor/color
- [ ] Undefined global renders exactly as before (pixel-identical)
**Verification:**
- [ ] Tests pass: `npx vitest run caption-style`
- [ ] Build succeeds: `npm run build`
**Dependencies:** None
**Files likely touched:**
- `src/lib/types.ts`
- `src/lib/caption-style.ts`
- `src/lib/caption-style.test.ts` (new)
**Estimated scope:** Small

## Task 2: Storage migration + backfill
**Description:** Sanitize + backfill globals in `mergeWithDefaults` so legacy projects load unchanged.
**Acceptance criteria:**
- [ ] Valid globals survive round-trip; garbage/partial values fall back to undefined
- [ ] Legacy project without globals renders unchanged
**Verification:**
- [ ] Tests pass: `npm run test`
**Dependencies:** Task 1
**Files likely touched:**
- `src/lib/storage.ts`
**Estimated scope:** XS

## Checkpoint: After Tasks 1-2
- [ ] All tests pass
- [ ] Typecheck clean

## Task 3: Settings Text tab + editor wiring
**Description:** Replace Fonts tab with Text tab (Headline/Label sections: family picker, weight, size % + px preview, color + Auto/Reset, live preview); wire state in `screenshot-editor.tsx`.
**Acceptance criteria:**
- [ ] Fonts tab gone; Text tab shows both sections with all controls + previews
- [ ] Edits persist to project state and survive reload
**Verification:**
- [ ] Manual check: change each control, reload, confirm persistence
**Dependencies:** Tasks 1-2
**Files likely touched:**
- `src/components/editor/settings-dialog.tsx`
- `src/components/editor/screenshot-editor.tsx`
**Estimated scope:** Medium

## Task 4: Render + inspector wiring
**Description:** Thread globals into canvas `Caption` and inspector defaults/Reset so screens follow globals unless overridden.
**Acceptance criteria:**
- [ ] Override-less screens update when globals change; overrides still win; Reset clears to global
**Verification:**
- [ ] Manual check + `npm run build`
**Dependencies:** Task 3
**Files likely touched:**
- `src/components/editor/slide-canvas.tsx`
- `src/components/editor/inspector.tsx`
**Estimated scope:** Medium

## Checkpoint: Complete
- [ ] `npm run typecheck`, `lint`, `test`, `build` all clean
- [ ] Manual: set global Headline style, confirm deck-wide update + per-screen override win
