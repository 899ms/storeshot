# macOS signing & Mac App Store (Tasks E6/E7)

## E6 — Signed + notarized dmg

1. Swap in the real icon: replace `build/icon-master.png` (currently a
   placeholder — DO NOT SHIP it), then `./build/make-icon.sh`.
2. In `package.json`, remove `"identity": null` from `build.mac` so
   electron-builder uses your Developer ID Application certificate.
3. Notarize via environment (electron-builder picks these up automatically):
   `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` (your
   10-character Team ID from the Apple Developer portal).
4. `npm run dist:mac` → Gatekeeper-clean, notarized dmg in `dist/`.

## E7 — Mac App Store target

- Config is in `package.json` (`build.mas`) with sandbox entitlements in
  `build/entitlements.mas.plist`. Workspace access survives sandbox restarts
  via the security-scoped bookmark store (`electron/main.js`).
- `npm run dist:mas` → `.pkg` in `dist/` for App Store Connect.
- Before submitting: verify in the sandboxed build that picking a workspace,
  editing, saving, and exporting all work (Powerbox grants only flow through
  the native picker — already the only path in the Electron shell), and add
  review notes explaining the loopback server architecture.
