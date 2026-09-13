# macOS signing & notarization

Public GitHub releases are **Developer ID signed + notarized universal DMGs**
(Apple Silicon + Intel). Gatekeeper-clean installs work for anyone who
downloads from the [Releases page](https://github.com/stackwares/storeshot-electron/releases).

## What users get

1. Download `StoreShot-<version>.dmg` from GitHub Releases
2. Open the DMG, drag **StoreShot** to Applications
3. Launch — no right-click / “unidentified developer” dance

## Required Apple assets

| Asset | Where it lives |
| ----- | -------------- |
| **Developer ID Application** certificate (not “Apple Development”) | Keychain Access → My Certificates, or [developer.apple.com](https://developer.apple.com/account/resources/certificates/list) |
| **Team ID** (10 characters) | [developer.apple.com/account](https://developer.apple.com/account) → Membership |
| **Notarization credentials** | App Store Connect API key (**preferred**) *or* Apple ID + app-specific password |

### Export the certificate (once)

On a Mac that already has **Developer ID Application** in the login keychain:

```bash
# Export as .p12 (set your own export password)
security export -t identities -f pkcs12 -P "" -o developer_id_application.p12
# Or: Keychain Access → right-click the identity → Export → .p12

# Base64 for GitHub Secrets (macOS base64 has no -w; Linux needs -w0)
base64 -i developer_id_application.p12 | pbcopy
```

Create the certificate on a machine that does not have it:

1. [Certificates](https://developer.apple.com/account/resources/certificates/list) → **+**
2. **Developer ID Application** (not Development, not Mac App Distribution)
3. Upload the CSR from Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority
4. Download, double-click to install, then export as `.p12` as above

Delete the local `.p12` after uploading the secret — never commit it.

### Notarization credentials (pick one)

**Option A — App Store Connect API key (recommended)**

1. [Users and Access → Keys](https://appstoreconnect.apple.com/access/integrations/api)
2. Generate a key with role **Developer** (or App Manager)
3. Download the `.p8` once
4. Note **Key ID** and **Issuer ID**

```bash
base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy
```

**Option B — Apple ID + app-specific password**

1. [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords
2. Create a password (e.g. label `storeshot-notarize`)
3. Team ID: [developer.apple.com/account](https://developer.apple.com/account) → Membership details

## GitHub repository secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Required | Value |
| ----------- | -------- | ----- |
| `APPLE_CERTIFICATE` | yes | base64 of the Developer ID Application `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | yes | password you set when exporting the `.p12` |
| `APPLE_TEAM_ID` | yes | 10-char Team ID |
| `APPLE_API_KEY` | preferred | base64 of the `.p8` (raw PEM also accepted) |
| `APPLE_API_KEY_ID` | preferred | Key ID from App Store Connect |
| `APPLE_API_ISSUER` | preferred | Issuer UUID from App Store Connect |
| `APPLE_ID` | alternative | Apple ID email (only if not using API key) |
| `APPLE_APP_SPECIFIC_PASSWORD` | alternative | app-specific password (only if not using API key) |
| `KEYCHAIN_PASSWORD` | optional | random string for the CI keychain; auto-generated if omitted |

The release workflow prefers the API key when both methods are present.

## Cutting a release

```bash
# package.json version must match the tag
npm version 0.2.0 --no-git-tag-version
git add package.json bun.lock
git commit -m "chore: release v0.2.0"
git tag v0.2.0
git push origin main v0.2.0
```

CI (`.github/workflows/release.yml`) then:

1. Builds Next standalone + copies `public/` and `.next/static`
2. Builds a **universal** Electron app (arm64 + x64)
3. Signs with Developer ID (hardened runtime)
4. Notarizes + staples the ticket
5. Verifies with `codesign`, `spctl`, and `stapler`
6. Publishes the DMG on the GitHub Release for that tag

You can also run the workflow manually from the **Actions** tab (`workflow_dispatch`)
against an existing tag.

## Local signed build

```bash
# Certificate must be in the login keychain
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
npm run dist:mac:universal   # → dist/StoreShot-*.dmg
```

Or with an API key:

```bash
export APPLE_API_KEY=/absolute/path/AuthKey_XXXXXXXXXX.p8
export APPLE_API_KEY_ID=XXXXXXXXXX
export APPLE_API_ISSUER=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export APPLE_TEAM_ID=XXXXXXXXXX
npm run dist:mac:universal
```

Without a Developer ID certificate in the keychain, electron-builder skips
signing and notarization — fine for local smoke tests, **not** for distribution.

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
| `identity not found` in CI | Secret `APPLE_CERTIFICATE` missing/invalid, or wrong `.p12` password |
| Notarization skipped | Missing `APPLE_TEAM_ID` + (API key or Apple ID) secrets |
| `spctl` rejects the app | Notarization failed or ticket not stapled — check the Release job log for the notarytool output |
| Users see “damaged” | Downloaded from a PR artifact without notarizing — only use tagged Releases |
| Icon still placeholder | Replace `build/icon-master.png` and run `./build/make-icon.sh` before tagging |
