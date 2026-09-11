# App Store Screenshots — Editor

A Next.js + shadcn/ui editor for generating App Store and Google Play
marketing screenshots. Scaffolded by the `app-store-screenshots` skill.

## Quick start

```bash
bun install
bun dev       # http://localhost:3000
```

Other useful commands: `bun run build`, `bun run typecheck`, `bun run lint`,
`bun test` (vitest, pure-function unit tests).

## What's inside

- **Connected canvas editor** (`src/components/editor/`) — every screen sits on one horizontal canvas, so phones, captions, and other elements can be dragged across screen boundaries and exported as split crops when Connected mode is enabled. Canvas elements are keyboard-operable (Tab to focus, arrows to nudge, Shift for larger steps) and editable text exposes screen-reader names.
- **Screen controls** — drag-to-reorder screens (keyboard supported), click-to-edit text, screenshot drop targets, per-screen layout switcher, dark/light toggle, per-screen background overrides.
- **Device frames** (`src/components/editor/device-frames.tsx`) — iPhone 6.9" vector frame (Dynamic Island, titanium chassis) and iPad 13" vector frame, both with exact screen aspects so screenshots show fully.
- **Auto-save (git-trackable)** — every change is persisted within ~600ms to **`screenshots/app-store-screenshots.json`** inside the active workspace (via `/api/project`) **and** mirrored to `localStorage` as an instant-paint cache (inline `data:` images excluded so one bad paste can't break saves). Commit the workspace's `screenshots/` folder and you can `git clone` to another machine and resume exactly where you left off. A Save button and `Cmd/Ctrl+S` flush immediately.
- **Device decks** — iPhone 6.9" and iPad 13" slide decks live side by side; the toolbar device switcher flips between them and preserves both.
- **One-click export** — bulk PNG export at iPhone 6.9" (1320 × 2868) or iPad 13" (2064 × 2752) using `html-to-image`; each PNG is rendered from the current connected or isolated deck mode. Every unit is tracked by zip path, failed renders retry automatically, and incomplete bundles download as `-partial-` with the full missing list in the error log.

## Workspaces

The toolbar folder button picks the **active workspace**: any folder on your
machine. The app only ever touches `<workspace>/screenshots/` (the project
JSON plus `screenshots/uploads/`). Recent workspaces are remembered in
`localStorage`; switching flushes pending saves first so no keystroke is lost.

## Locales

`Settings → Locales` manages the project's language list (Apple App Store
Connect codes plus UI conveniences). `en` is the editing/translation source
and `es` is legacy source-only — neither is ever exported; the store accepts
`en-US`, `en-GB`, `en-AU`, `en-CA`, `es-ES`, `es-MX` instead. Export folders
follow per-store codes via an App Store / Google Play toggle (e.g. Slovenian
is `sl-SI` on Apple, `sl` on Play).

## Translate

Bring your own OpenRouter-compatible API key (`Settings → Providers`; keys
stay in browser `localStorage` and go only to your provider). Three scopes,
all from `en` and always overwriting: **Translate all locales** (toolbar,
5-way concurrent with per-locale status), **Translate locale** (toolbar,
current locale only), **Translate screen** (right sidebar). Skipped fields
(empty English source) and model-dropped strings are reported, never silently
absorbed. Stopping a bulk run aborts cleanly; per-row runs are independent.

## Fonts

`Settings → Fonts` picks the headline family (default Nunito) and the
label/overlay family (default Inter) from 30 curated Google Fonts with
searchable live previews. Families load at runtime and are awaited before
exports so PNGs match the canvas.

## Backgrounds

Screens default to a random pastel mesh per workspace, overridable per screen
in Screen settings → Background (Theme gradient legacy option removed from
the UI but still rendered for old files). Mesh gradients offer 50 pastel
presets (light/dark), 2–4 custom colors, angle, opacity, and blur; or use an
uploaded image. Overlays and captions follow the label font.

## Error log

The toolbar bug icon opens a session error log (unread badge) fed by save,
export, translation, and uncaught app errors. Entries include timestamps and
details, with one-click copy for bug reports.

## Adding screenshots

Drop a file in the inspector — drag-and-drop or click Pick. The file is sent
to `/api/upload`, hashed, and written to `screenshots/uploads/<hash>.png`
inside the active workspace (PNG/JPG, ≤8MB; oversized bodies are rejected
before decoding). The slide stores the resulting workspace-relative
`uploads/...` path, so commit the workspace's `screenshots/` folder alongside
the project file and the screenshots survive a `git clone`. There are no
bundled sample images — every image comes from you. If upload fails you'll
get an error (images are never persisted inline, which would break saves).

## Exporting

The export dialog picks target devices, screens (gap-free numbering),
locales, target store (App Store / Google Play folder codes), and one of
three folder presets: Standard Store Layout, Fastlane, or Flat ZIP. In
Connected mode, each PNG is clipped from the connected canvas, so an element
that straddles two screens appears split exactly where you placed it. In
Isolated mode, each screen clips its own elements and legacy offscreen
content cannot leak into neighboring exports.

## Customizing

| Where | What |
|-------|------|
| `src/lib/constants.ts` | Canvas dimensions, export sizes, frame ratios, themes |
| `src/lib/locale.ts` | Locale names, store folder mappings (`exportFolderForLocale`) |
| `src/lib/fonts.ts` | Curated Google Fonts catalog (`CURATED_FONTS`) |
| `src/lib/mesh-presets.ts` | The 50 pastel mesh presets |
| `screenshots/app-store-screenshots.json` | Canonical project file per workspace: app name, current device, connected-canvas mode, locales, fonts, background, slide copy, screenshots, and transforms |
| `src/lib/defaults.ts` | Fallback/reset state used when no project file or local cache exists |
| `src/components/editor/slide-canvas.tsx` | Add new layouts and connected-canvas element rendering |
| `src/components/editor/device-frames.tsx` | Tweak device chrome (bezel radii, camera dots) |
| `src/app/layout.tsx` | Swap the UI font (`next/font/google`) |

## Notes

- Image preloading converts every static path to a base64 data URI before exports run, and export retries paths that were previously missing — this prevents the html-to-image race where some slide screenshots come out black. Failed renders retry automatically and the bundle is verified complete before download.
- Reset via the toolbar's circular arrow icon clears in-memory state and reloads the default screens. To wipe disk state too, delete the workspace's `screenshots/app-store-screenshots.json`.
- **Persistence model** — the canonical state lives in the workspace's `screenshots/app-store-screenshots.json` (git-tracked). On load, the editor reads localStorage first for instant paint, then overwrites with the file contents if present; if the file endpoint is unavailable, autosave is blocked so stale cache cannot overwrite disk. On save, both are written. If you ever see a conflict, the file always wins. Saves are validated server-side (shape + 10MB cap, atomic tmp+rename writes).
- **Migration model** — old project files are upgraded on load (localized text, transforms, backgrounds, fonts backfilled); legacy `orientation` keys are dropped. Pre-v2 projects start isolated until you opt into connected crops.
- **Custom themes** — if a project file references a theme id that is not present in `src/lib/constants.ts`, the editor falls back to `clean-light` and shows a warning. Merge custom `THEMES` entries during in-place upgrades.

## Security model

Local-only tool, document-only by design: the `/api/*` endpoints accept any
absolute workspace path with no authentication, so **do not expose this
server beyond localhost and do not run it for multiple users**. Any local
process can read/write through it. API keys live in browser `localStorage`
and are sent only to your configured AI provider — never to this server, git,
or logs. Uploads accept PNG/JPG only (≤8MB); project saves are shape- and
size-validated.

## MCP server

Opt-in local stdio MCP server (`src/mcp/server.ts`, zero dependencies).
It speaks newline-delimited JSON-RPC 2.0 on stdio (logs on stderr only) and
operates on an explicit absolute workspace path per call.

```bash
bun run mcp
```

Claude Desktop config snippet:

```json
{ "mcpServers": { "storeshot": { "command": "bun", "args": ["src/mcp/server.ts"], "cwd": "/path/to/app-store-screenshots" } } }
```

Tools: `get_project`, `list_slides`, `list_locales`, `list_uploads`,
`preview_export_paths`, `export_manifest`, `render_export` (headless PNG+ZIP,
needs `python3` + Pillow; honors canvas-size overrides and phone/tablet
finishes, desktop included), `update_copy`, `add_slide`, `rename_slide`,
`set_layout`, `reorder_slides`, `delete_slide` (needs `confirm:true`),
`set_locales`, `set_background`, `set_screenshot`, `upload_image` (PNG/JPG
≤8MB), `lint_deck`, `preview_translation`, `translate_locale`
(OpenRouter-compatible provider call; `apiKey` is per-call only — never
stored, logged, or returned). Device names are `phone`/`tablet`/`desktop`
(`iphone`/`ipad` still accepted); legacy project files migrate on load.
Resources: `project`, `slides/phone|tablet|desktop`, `locales`,
`export-targets`, `uploads`, `lint`, `translation-status` under
`storeshot://<workspace>/…`. Prompts: `new-locale-deck`,
`locale-launch-checklist`, `aso-copy-review`, `screenshot-brief` (art
direction for producing screenshots, e.g. via an image-gen MCP server).

Outbound client (talk to any MCP stdio server, including this one):

```bash
bun run mcp:call --cmd bun src/mcp/server.ts --list tools
bun run mcp:call --cmd bun src/mcp/server.ts --tool get_project --args '{"workspace":"/abs/path"}'
```

Same trust model as `/api/*`: localhost/stdio only, absolute workspace
paths, no auth — do not bridge it to the network. Headless renders are a
faithful rasterization (same geometry, copy fallback, and store folder
codes as the Export dialog), not pixel-identical: connected-mode straddles
split on crop like the browser, but canvas chrome (guides, placeholders)
never bakes in, and Google Fonts download on first render with a system
fallback + warning when offline.
