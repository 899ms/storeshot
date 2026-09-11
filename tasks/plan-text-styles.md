# Implementation Plan: Global Text Styles + Settings Relayout

## Overview
Project-wide Headline/Label text defaults (weight, size factor, color) editable in a new Settings Text tab, resolving as per-screen override → global → builtin. Overlays stay independent; family stays in existing headlineFont/labelFont.

## Architecture Decisions
- `GlobalTextStyle = { fontWeight?, sizeFactor?, color? }` on ProjectState as `headlineText?`/`labelText?`; family remains in `headlineFont`/`labelFont` (no migration risk, picker reuse).
- Sizes are canvas-relative factors (unit = min(canvasW, canvasH)); dialog shows live px preview at Phone size.
- Colors default to Auto (theme accent for Label, fg for Headline); picker sets explicit override with Reset.
- Single Text tab replaces Fonts tab; Headline + Label sections each with family/weight/size/color + live preview.
- Undefined global = builtin path → pixel-identical legacy renders.

## Task List
### Phase 1: Foundation
- [ ] Task 1: Global text model + resolution (+ tests)
- [ ] Task 2: Storage migration + backfill
### Checkpoint 1
- [ ] typecheck, focused tests, pixel-identical legacy render
### Phase 2: UI
- [ ] Task 3: Settings Text tab + editor wiring
- [ ] Task 4: Render + inspector wiring
### Checkpoint 2
- [ ] typecheck, lint, full tests, build, manual global-style check
### Phase 3: Parity (optional follow-up)
- [ ] Task 5: Headless export parity (export.ts job + render.py)

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Weight invalid for new family | Med | Snap via existing snapWeight pattern |
| Factor extremes break layout | Low | Clamp 0.005–0.30, slider + numeric agree |
| Old projects shift pixels | High | Undefined global = builtin path; tests |

## Open Questions
- None blocking. Possible follow-up: Label size driving overlay default size.
