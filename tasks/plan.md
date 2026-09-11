# Implementation Plan: Whole-Project Audit Remediation

## Overview

Systematic remediation of a four-track audit (correctness, performance, UI/UX +
accessibility, code health + security) of the App Store screenshots editor.
Order is fail-fast: data-loss and silent-corruption fixes before performance,
performance before UI polish, polish before hygiene.

Decisions locked with the user: `es` excluded from export like `en`; security
jail is document-only; tests = minimal vitest suite for pure functions.

## Architecture Decisions

- Fix data-loss paths before anything else (server validation, switch flush,
  toast-undo closure).
- Prefer validation + retry over redesign at pipeline edges.
- Performance via isolation (memoization, local edit state, LRU cache), not rewrite.
- Accessibility as a horizontal pass after functional fixes stabilize.
- Verification per task: `npm run build` (+ `typecheck`/`lint`/`test` once added)
  plus a targeted manual check. No full E2E harness.

## Task List

### Phase 1: Data integrity
- [ ] Task 1: Validate project saves server-side
- [ ] Task 2: Flush pending saves on workspace switch
- [ ] Task 3: Fix toast-Undo restoring into wrong deck/position
- [ ] Task 4: Stop inline data-URIs from breaking all saves
- [ ] Task 5: Reject oversized uploads before decoding

### Checkpoint: Foundation
- [ ] Builds clean; label round-trips with zero loss; corrupt saves rejected

### Phase 2: Translation + export correctness
- [ ] Task 6: Translate from exact source locale, never fallback text
- [ ] Task 7: Pin translation runs to device + snapshot
- [ ] Task 8: Separate abort controllers + honest empty results
- [ ] Task 9: Sync export dialog selections + exclude `es` from export
- [ ] Task 10: Preload single-export backgrounds + resolve `{locale}` appIcon

### Checkpoint: Core correctness
- [ ] Translate/export apply exactly where intended; counts equal bundle contents

### Phase 3: Performance
- [ ] Task 11: Stop full-res re-renders on every keystroke (split 11a/11b if needed)
- [ ] Task 12: Cap image cache + evict on workspace switch
- [ ] Task 13: Bound font loading (lazy previews + export timeout)
- [ ] Task 14: Yield + trim export memory, split heavy bundles

### Checkpoint: Performance
- [ ] Typing/scrolling/export profiled acceptable; no heap growth across switches

### Phase 4: UI/UX + accessibility
- [ ] Task 15: Keyboard-operable canvas + named editable text
- [ ] Task 16: Live regions, reduced motion, correct widget semantics
- [ ] Task 17: RTL rendering for ar-SA/he
- [ ] Task 18: Fix double-toggle + confirms + store-aware copy + naming
- [ ] Task 19: Mobile toolbar + dialog fit + label associations

### Checkpoint: UI/UX
- [ ] Keyboard-only flows work; RTL, reduced-motion, mobile verified

### Phase 5: Health + docs
- [ ] Task 20: Dependencies, scripts, strictness + minimal vitest suite
- [ ] Task 21: Remove dead code + harden remaining edges
- [ ] Task 22: Document trust model + rewrite README feature docs

### Checkpoint: Complete
- [ ] All acceptance criteria met; build + typecheck + lint + test green

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Memoization breaks canvas editing (stale closures) | High | DevTools highlight + focus tests gate Task 11; split 11a/11b |
| React 19 RC → stable upgrade breaks libs | High | Upgrade last (Task 20) with export smoke test; pin back on failure |
| RTL changes alter existing LTR exports | Med | RTL scoped per-locale; snapshot-compare one LTR export |
| Scope creep across 22 tasks | Med | Phase checkpoints gate progress |

## Open Questions (resolved)
- Priority: data-loss > correctness > performance > a11y > hygiene — approved
- `es` legacy locale: excluded from export like `en` — approved
- Security jail: document-only — approved
- Tests: minimal vitest for pure functions — approved
