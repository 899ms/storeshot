# Security Policy

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a vulnerability

**Do not open a public issue.** Instead, open a
[private security advisory](https://github.com/stackwares/storeshot/security/advisories/new)
or email `nemoryoliver@gmail.com`.

Include: what you did, what you expected, what happened, and the app/error-log
details if available. Expect an initial response within 7 days.

## Scope notes

StoreShot is a **local-only tool by design**: the `/api/*` endpoints and the
MCP server accept absolute workspace paths with no authentication. They are
meant for `localhost` / stdio use only — **do not expose the server beyond
localhost and do not run it for multiple users**. Reports in this area are
welcome, but "local process can reach the local API" is the documented trust
model, not a vulnerability. AI provider keys live in browser `localStorage`
and are sent only to your configured provider.
