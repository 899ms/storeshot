# What changed and why?


## Verification

- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run test`
- [ ] `bun run build` (if touching build, Electron, or export paths)

## Checklist

- [ ] One logical change; every caller migrated (no shims/aliases)
- [ ] Follows the existing pattern in touched files
- [ ] Tests only where a plausible bug would fail them
