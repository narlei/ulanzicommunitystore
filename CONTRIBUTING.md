# Contributing to Ulanzi Community Store

Thanks for helping grow the community store! This guide covers the app itself — how it's laid out, how to run it, and how releases and security work. If you just want to **publish a plugin**, you don't need any of this: see the [Publish section in the README](README.md#-publish-your-plugin) and the [registry guide](registry/README.md).

## 🏗️ Project Structure

| Path | Purpose |
| --- | --- |
| [`apps/store-desktop/`](apps/store-desktop) | Electron + React + TypeScript + Vite desktop app |
| [`apps/marketing-site/`](apps/marketing-site) | Static marketing site ([ulanzicommunitystore.narlei.com](https://ulanzicommunitystore.narlei.com)) |
| [`packages/catalog/`](packages/catalog) | Catalog types, registry validation, and `catalog.json` builder |
| [`plugin-starter/`](plugin-starter) | The `npx ulanzi-plugin-starter` scaffolding CLI |
| [`registry/plugins/`](registry/plugins) | **Community registry** — source of truth for approved plugin repos |
| [`VERSION`](VERSION) | App release version — changing it on `main` triggers a release |

## 🛠️ Development

Everything goes through the [`Makefile`](Makefile):

```bash
make run    # install deps, build catalog, typecheck, build and open the app
```

Useful targets:

```bash
make app               # launch the app in dev mode
make typecheck         # type-check everything
make catalog           # generate dist/catalog/catalog.json (uses gh auth token)
make catalog_validate  # validate registry entries
make release           # sync version + build distributables
make marketing         # serve the marketing site locally
make version           # print the current app version
```

By default the app loads the locally generated catalog at `dist/catalog/catalog.json`. Override the source when needed:

```bash
STORE_CATALOG_FILE=/absolute/path/catalog.json make app
STORE_CATALOG_URL=https://example.com/catalog.json make app
```

## 📦 Releases

[`VERSION`](VERSION) is the single source of truth. When it changes on `main`, GitHub Actions builds and publishes a release with the macOS `.dmg` + `.zip` and the Windows `.exe`. Artifacts are ad-hoc signed (no Apple Developer account, not notarized).

The catalog (`catalog.json`) is **generated, never versioned**. Registry entries in [`registry/plugins/*.json`](registry/plugins) are the source of truth, published automatically through GitHub Pages.

For how end users install the published artifacts (including the macOS Gatekeeper workaround), see [Install in the README](README.md#-install).

## 🔐 Security Model

- The app installs **only** plugins from the community registry catalog by default.
- ZIP extraction validates plugin IDs and entry paths before writing to the Ulanzi plugins folder.
- Developer Mode is reserved for future manual installs.
- **Daily vulnerability scan** — a scheduled GitHub Action ([`security-scan.yml`](.github/workflows/security-scan.yml)) scans every repo in the [community registry](registry/plugins) once a day with [Trivy](https://github.com/aquasecurity/trivy), looking for known-vulnerable dependencies and leaked secrets. Findings are posted to the run summary and to a single rolling GitHub issue (opened when something is found, closed automatically when everything is clean). Because these are third-party repos, the scan **flags** issues for maintainers to act on — it doesn't modify anyone's code.

> Run it on demand from the **Actions** tab (**Run workflow**) or with `gh workflow run security-scan.yml`.
