# Implementation Plan: Turbopack for Dev Only

## Overview

Run the Next dev server under Turbopack for a faster inner loop, while keeping production packaging (`next build` → `.next/standalone/server.js` → Electron DMG) on the default webpack bundler. Electron dev is unaffected architecturally — it just loads `http://localhost:3000`, regardless of which bundler serves it.

Saved as `tasks/plan-turbopack-dev.md` (not `tasks/plan.md`) because `tasks/plan.md` / `tasks/todo.md` already hold the Electron + audit plans — overwriting them would destroy existing work.

## Architecture Decisions

- Dev-only switch: add `dev:turbo` (`next dev --turbopack`) alongside existing `dev` (`next dev`). Do not change `build`, `start`, or `dist:mac`.
- A/B first, flip later: verify `dev:turbo` boots, works under Electron, and HMR is stable before even considering making it the default `dev` script.
- VSCode stays compatible: `dev server (background)` background task keys off `Ready in` output. Keep the existing task working; only adjust `beginsPattern` / `endsPattern` if Turbopack output proves different.
- No `next.config.mjs` changes: no custom `webpack:` block exists, `output: "standalone"` and `outputFileTracingRoot` stay as-is for packaging. `experimental.optimizePackageImports` (lucide-react) is harmless under Turbopack.

## Task List

### Phase 1: Opt-in turbo dev server

- [ ] Task 1: Add `dev:turbo` script and verify it boots
- [ ] Task 2: Verify VSCode background task detects turbo ready-state

### Checkpoint: Standalone turbo dev works
- [ ] `npm run dev:turbo` serves the app on :3000 with no config changes
- [ ] Existing `npm run dev` still works untouched

### Phase 2: Electron integration + smoke test

- [ ] Task 3: Verify Electron dev shell + full debug compound against turbo server
- [ ] Task 4: Smoke-test editor core flows under turbo, decide on default `dev`

### Checkpoint: Complete
- [ ] Decision recorded: keep `dev:turbo` opt-in vs. flip default `dev` to `--turbopack`
- [ ] `npm run build` path untouched and still packages

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Turbopack dev output changes ready-line, VSCode task never resolves | Med | Task 2 observes real output first, then patches `endsPattern` only if needed |
| HMR / library quirk under turbo (dnd-kit, react-rnd, html-to-image, radix) | Med | Task 4 smoke-tests the actual editor flows; fallback is plain `npm run dev` |
| Accidental flip of `build` to `--turbopack`, breaking standalone/Electron packaging | High | Scope lock: no `build` / `dist:mac` edits in any task; verify `package.json` diff touches only `dev:turbo` |
| Dev-only drift (turbo hides an error webpack would show) | Low | Final packaged verification stays on webpack `build`; dev stays A/B-able |

## Open Questions

- None blocking.

## Decision (Task 4, recorded 2026-09-11)

Keep `dev:turbo` opt-in; do NOT flip default `dev`. Rationale: `typecheck` clean,
`test` 24/24 green, webpack `build` green, `--turbopack` flag valid on the
installed Next 15 — but live boot of any dev server (turbo or webpack) is
blocked in this sandbox (`listen EPERM` on all ports/hosts, verified for both),
so the turbo-vs-webpack runtime comparison must happen on the user's machine.
Flip `dev` only after `npm run dev:turbo` + Electron full-debug + editor smoke
test pass there. No `tasks.json` / `launch.json` changes were needed or made.

## Parallelization Opportunities

- Tasks 1 → 2 → 3 → 4 are sequential (each needs the prior running server state).
- Safe to parallelize after approval: none — single config file (`package.json`) is the contention point.
