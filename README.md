# Ulanzi Plugin Store

Desktop app and registry for the unofficial Ulanzi Deck/Dial plugin store.

This repo now treats the Electron app as the product. The Hostinger site is only a
manual marketing upload, and the catalog is published automatically through GitHub Pages.

## Structure

| Path | Purpose |
| --- | --- |
| `apps/store-desktop/` | Electron + React + TypeScript + Vite desktop app. |
| `apps/marketing-site/` | Static HTML/CSS marketing site for manual Hostinger upload. |
| `packages/catalog/` | Catalog types, registry validation, and `catalog.json` builder. |
| `registry/plugins/` | Source of truth for approved plugin repos. |
| `VERSION` | Official app release version. Changing it on `main` triggers app release. |

## Development

```bash
npm install
npm run app
```

Useful commands:

```bash
npm run typecheck
npm run app:build
GH_TOKEN=$(gh auth token) npm run catalog:build
npm run catalog:validate
make marketing
```

By default, the app loads a local generated catalog:

```text
dist/catalog/catalog.json
```

Generate it with:

```bash
GH_TOKEN=$(gh auth token) npm run catalog:build
```

Override the catalog source with:

```bash
STORE_CATALOG_FILE=/absolute/path/catalog.json npm run app
STORE_CATALOG_URL=https://example.com/catalog.json npm run app
```

## Releases

`VERSION` is the release source of truth. When it changes on `main`, GitHub Actions builds
and publishes a release with:

- macOS `.dmg`
- macOS `.zip`
- Windows `.exe`

The first pipeline intentionally builds unsigned artifacts. The Electron Builder config is
kept compatible with future signing/notarization secrets.

## Catalog

`catalog.json` is generated, not versioned. The registry entries in `registry/plugins/*.json`
are the source of truth. The publishing workflow is ready for GitHub Pages, but the desktop app
can stay on a local catalog while the repository is private.

## Security Model

The app installs only plugins from the official catalog by default. Developer Mode is reserved
for future manual installs. ZIP extraction validates plugin IDs and entry paths before writing
to the Ulanzi plugins folder.
