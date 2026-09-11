# Implementation Plan: StoreShot Electron (macOS)

## Overview

Ship the screenshots editor as the **StoreShot** macOS desktop app
(`com.storeshot.app`): embedded Next standalone server inside Electron,
native workspace picker (MAS Powerbox requirement), unsigned + notarized
`.dmg`, and a Mac App Store target. Windows/Linux and the private update
server are explicitly deferred. All work happens on macOS; repo is private.

## Architecture Decisions

- Embedded Next standalone server (`output: "standalone"`) started from
  Electron via `utilityProcess` (Electron's Node runtime), window on
  `http://127.0.0.1:<free-port>` — zero app-code changes, no system Node.
- Native folder picker replaces the server-side folder browser (MAS sandbox
  Powerbox grants only flow through native dialogs).
- One `package.json`, plain-JS `electron/main.js` + `preload.js`, no TS step.
- Updater code wired with a configurable feed URL but dormant (no server yet).
- Icons generated from user-supplied `build/icon-master.png` (1024×1024)
  via `iconutil`/`sips` script (macOS only).

## Task List

### Phase 1: Foundation
- [ ] Task 1: Standalone server output + parity verification
- [ ] Task 2: Electron shell (main, preload, window, scripts, deps)
- [ ] Task 3: Native workspace picker (Powerbox-ready)

### Checkpoint: Foundation
- [ ] Unsigned mac build launches, edits, saves, exports one PNG
- [ ] Dev web workflow untouched

### Phase 2: macOS packaging
- [x] Task 4: electron-builder dmg config + icon generation (placeholder icon via build/placeholder-icon.py + pack-icns.py; swap icon-master.png before signing)
- [x] Task 5: Auto-updater wiring (electron/updater.js, dormant until STORESHOT_UPDATE_FEED_URL is set)

### Checkpoint: Packaging
- [x] Unsigned .app verified (unpacked server, icon, com.storeshot.app identity); dmg assembly runs on a Mac outside the sandbox

### Phase 3: Apple signing
- [x] Task 6 prep: entitlements (build/entitlements.mac.plist) + steps in build/macos-signing.md — sign/notarize on user machine
- [x] Task 7 prep: mas config + sandbox entitlements + submission notes — .pkg verify on user machine

### Checkpoint: Complete
- [ ] Gatekeeper-clean dmg; sandboxed MAS pkg; submission package ready (runs on user machine; see tasks/todo.md)

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| MAS review rejects loopback-server architecture | High | Native picker + minimal entitlements + review notes; static-export fallback deferred |
| Sandbox breaks workspace writes post-MAS | High | Bookmark persistence verified before submission docs |
| Icon master not provided | Med | Placeholder icon unblocks all build work; swap before signing |
| utilityProcess + Next standalone quirks | Med | Free-port probe + single-instance lock + error page |

## Open Questions (resolved)
- Identity: StoreShot / com.storeshot.app — locked
- Icon: real artwork supplied as build/icon-master.png (2048×2048 PNG, white background per user) — baked into icon.icns and the .app bundle
- Scope: macOS only (Windows/Linux deferred); private repo (no CI publishing)
- Updates: wire dormant, private server later
