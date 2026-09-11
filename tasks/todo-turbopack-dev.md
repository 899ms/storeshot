# Turbopack Dev-Only — Task List

Tracked here (not `tasks/todo.md`) because `tasks/todo.md` already tracks Electron/audit work. Index: full detail in `tasks/plan-turbopack-dev.md`.

## Task 1: Add `dev:turbo` script and verify it boots

**Description:** Add `"dev:turbo": "next dev --turbopack"` to `package.json` without touching `dev`, `build`, `start`, or `dist:mac`, then boot it and confirm the app serves on :3000.

**Acceptance criteria:**
- [ ] `package.json` diff adds only the `dev:turbo` line
- [ ] `npm run dev:turbo` serves the app at `http://localhost:3000` with no `next.config.mjs` changes

**Verification:**
- [ ] Tests pass: n/a (no code change; `npm run typecheck` optional sanity)
- [ ] Build succeeds: n/a — explicitly do NOT run `next build --turbopack`
- [ ] Manual check: page loads via browser at :3000, console shows no fatal errors

**Dependencies:** None

**Files likely touched:**
- `package.json`

**Estimated scope:** XS (1 file)

## Task 2: Verify VSCode background task detects turbo ready-state

**Description:** Run the existing `dev server (background)` task (`npm run dev`) against `dev:turbo` output and confirm the `Ready in` problemMatcher still resolves; patch the pattern only if observed output proves it wrong.

**Acceptance criteria:**
- [ ] Real `dev:turbo` startup output captured (first 30 lines)
- [ ] Background task either resolves unmodified or gets a minimal observed-output-based pattern fix

**Verification:**
- [ ] Tests pass: n/a
- [ ] Build succeeds: n/a
- [ ] Manual check: VSCode task shows running / ready, no stuck "starting" state

**Dependencies:** Task 1

**Files likely touched:**
- `.vscode/tasks.json` (only if output proves it needed)

**Estimated scope:** S (1 file, conditional edit)

## Checkpoint: After Tasks 1-2

- [ ] `npm run dev:turbo` boots and VSCode task tracks it
- [ ] `npm run dev` still works untouched
- [ ] Review with human before Electron integration

## Task 3: Verify Electron dev shell + full debug compound against turbo server

**Description:** With the turbo dev server running, launch `StoreShot: Electron Main (dev)` and then the `StoreShot: Electron (full debug)` compound; confirm the window loads and both debugger targets attach.

**Acceptance criteria:**
- [ ] Electron window loads turbo-served app with no `did-fail-load` dialog
- [ ] Main-process breakpoints hit; renderer attach on port 9222 connects

**Verification:**
- [ ] Tests pass: n/a
- [ ] Build succeeds: n/a
- [ ] Manual check: set one main-process breakpoint + one renderer breakpoint, both hit

**Dependencies:** Tasks 1-2

**Files likely touched:**
- None (launch config already supports this; `.vscode/launch.json` edit only if proven broken)

**Estimated scope:** S (0-1 files)

## Task 4: Smoke-test editor core flows under turbo, decide on default `dev`

**Description:** Exercise the real editor under the turbo server (open project, drag/resize, HMR edit of a component, one PNG export path) and record the decision: keep `dev:turbo` opt-in or flip default `dev` to `--turbopack`.

**Acceptance criteria:**
- [ ] HMR reflects a component edit without full reload or state loss beyond baseline behavior
- [ ] No new console errors vs. webpack `dev` for the same flows
- [ ] Decision recorded in `tasks/plan-turbopack-dev.md` (opt-in vs. flip)

**Verification:**
- [ ] Tests pass: `npm run test` (vitest) unchanged
- [ ] Build succeeds: `npm run build` (webpack) still green — packaging path untouched
- [ ] Manual check: core editor flows work identically under both servers

**Dependencies:** Task 3

**Files likely touched:**
- `tasks/plan-turbopack-dev.md` (decision note)
- `package.json` (only if decision is to flip `dev`)

**Estimated scope:** M (test + decision, 1-2 files)

## Checkpoint: Complete

- [ ] All acceptance criteria met
- [ ] `git diff` shows no changes to `build`, `dist:mac`, `next.config.mjs`, or Electron shell
- [ ] Ready for review — human approves opt-in vs. flip before any follow-up
