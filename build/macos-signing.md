# macOS signing & notarization

Signed DMGs are built **locally** on a Mac with the Developer ID certificate
in the login keychain. Public GitHub Releases are published from those local
builds — not from CI.

## What users get

1. Download `StoreShot-<version>.dmg` from GitHub Releases
2. Open the DMG, drag **StoreShot** to Applications
3. Launch — no right-click / “unidentified developer” dance

## Required Apple assets (on your Mac)

| Asset | Where it lives |
| ----- | -------------- |
| **Developer ID Application** certificate (not “Apple Development”) | Keychain Access → My Certificates, or [developer.apple.com](https://developer.apple.com/account/resources/certificates/list) |
| **Team ID** (10 characters) | [developer.apple.com/account](https://developer.apple.com/account) → Membership |
| **Notarization credentials** | App Store Connect API key (**preferred**) *or* Apple ID + app-specific password |

Never commit `.p12`, `.p8`, `.cer`, provisioning profiles, or passwords.

## Local signed build (preferred)

Certificate must be in the login keychain, then either:

**App Store Connect API key (preferred):**

```bash
export APPLE_API_KEY=/absolute/path/AuthKey_XXXXXXXXXX.p8
export APPLE_API_KEY_ID=XXXXXXXXXX
export APPLE_API_ISSUER=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export APPLE_TEAM_ID=XXXXXXXXXX
npm run dist:mac:universal
```

**Or Apple ID + app-specific password:**

```bash
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
npm run dist:mac:universal
```

Produces `dist/StoreShot-*.dmg` (arm64) or universal via `dist:mac:universal`.

Verify before uploading:

```bash
APP_PATH=$(find dist -maxdepth 3 -type d -name "StoreShot.app" | head -n1)
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
spctl --assess --type execute --verbose=2 "$APP_PATH"
xcrun stapler validate "$APP_PATH"
```

## Publishing a release

```bash
# package.json version must match the tag
npm version 0.2.0 --no-git-tag-version
git add package.json
git commit -m "chore: release v0.2.0"
git tag v0.2.0
git push origin main v0.2.0
```

Upload the local DMG (and optional `latest-mac.yml` / `.blockmap` if you use
electron-builder publish metadata) on the GitHub Release page for that tag:

```bash
gh release create v0.2.0 dist/*.dmg --generate-notes
```

## Local smoke test (unsigned)

Without a Developer ID certificate, electron-builder skips signing and
notarization — fine for local smoke tests, **not** for distribution:

```bash
npm run dist:mac
```

## Mac App Store (separate path)

- Config lives under `build.mas` in `package.json`; sandbox entitlements in
  `build/entitlements.mas.plist`.
- `npm run dist:mas` produces a `.pkg` for App Store Connect.
- Before submitting: verify in the sandboxed build that picking a workspace,
  editing, saving, and exporting all work, and add review notes explaining
  the loopback server architecture.

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `identity not found` | Developer ID Application cert missing from login keychain, or wrong `.p12` password if you import one manually |
| Notarization skipped | Missing `APPLE_TEAM_ID` + (API key or Apple ID) env vars |
| `spctl` rejects the app | Notarization failed or ticket not stapled — check local notarytool output |
| Users see “damaged” | Uploaded an unsigned/local smoke build — only ship notarized DMGs |
| Icon still placeholder | Replace `build/icon-master.png` and run `./build/make-icon.sh` before tagging |
