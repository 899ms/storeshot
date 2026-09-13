# Contributing to StoreShot

Thanks for picking this up. Small, focused PRs merge fastest.

## Ground rules

- **Correctness first, then maintainability.** Prefer boring solutions; delete
  weightless code; no drive-by refactors or new abstractions "while you're at it".
- **Clean cutover.** Migrate every caller; no shims, aliases, or deprecated paths.
- **Second conventions are prohibited.** Reuse the existing pattern in the file
  you're touching.

## Workflow

1. Fork, branch from `main`, keep the diff tight.
2. Before modifying an exported symbol, check its callsites so none are missed.
3. Verify before you push:
   ```bash
   bun run typecheck   # tsc --noEmit
   bun run lint        # eslint src
   bun run test        # vitest run
   bun run build       # Next.js production build
   ```
4. Tests earn their place only where a plausible bug would fail them — behavior,
   boundaries, invariants, real errors. No implementation-assertion or padding tests.

## What to work on

- Open issues labeled `good first issue` are scoped and reviewed quickly.
- Bug reports should include: what you did, what you expected, what happened,
  and the session error-log entry (toolbar bug icon → copy) if one exists.

## Commit messages

Conventional style: `feat:`, `fix:`, `docs:`, `chore:` … — one logical change
per commit, present tense ("add X", not "added X").

## Security

Don't open public issues for vulnerabilities — see [SECURITY.md](SECURITY.md).
