# Implementation Plan: Copy Screens Across Devices

See the approved plan in this session. Summary:

Copy screens from one device deck onto another (Phone / Tablet / Desktop), including copy, screenshots, overlay text, styles, and backgrounds. Geometry is adapted, not pixel-perfect: built-in caption/device transforms are dropped so destination layout defaults apply; overlay text is scaled to the dest canvas. User nudges what looks off.

**Task list:** `tasks/todo-copy-across-devices.md`

## Architecture Decisions

1. Whole-deck copy is the default; “this screen” is a dialog option.
2. Multi-target in one action; one undo covers every destination.
3. Replace vs append in the dialog; default = Append.
4. Drop built-in transforms; scale overlay text (`sx`/`sy`) and absolute `fontSize` by `min(sx,sy)`.
5. Switch to the first chosen destination after copy.
6. No toast-Undo — Cmd+Z already restores.
7. Pure lib (`src/lib/copy-slides.ts`) is the single source of truth for UI + MCP.
8. No project schema bump.

## Task List

### Phase 1: Foundation
- [x] Task 1: Pure clone + geometry adapt
- [x] Task 2: `copySlidesToDevices`

### Checkpoint: Foundation
- [x] Tests pass, typecheck clean

### Phase 2: Core UX
- [x] Task 3: Copy screens dialog
- [x] Task 4: Wire dialog, toolbar, empty-state CTA

### Checkpoint: Core UX
- [x] End-to-end copy wired; undo is one setState

### Phase 3: Polish
- [x] Task 5: MCP `copy_slides` tool
- [x] Task 6: Shortcuts + replace-label + disabled edges

### Checkpoint: Complete
- [x] All acceptance criteria met
- [x] Ready for review
