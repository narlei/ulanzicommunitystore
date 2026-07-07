<div align="center">

<img src="apps/marketing-site/assets/app-icon.png" alt="Ulanzi Plugin Store icon" width="128" />

# Ulanzi Plugin Store

**The unofficial plugin store for Ulanzi Deck & Dial.**
Discover, install, and update community plugins — in one click, on macOS and Windows.

[![Latest release](https://img.shields.io/github/v/release/narlei/ulanzipluginstore?label=download&color=2dd4bf)](https://github.com/narlei/ulanzipluginstore/releases/latest)
[![Build](https://img.shields.io/github/actions/workflow/status/narlei/ulanzipluginstore/ci.yml?branch=main&label=build)](https://github.com/narlei/ulanzipluginstore/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-8b5cf6)](https://github.com/narlei/ulanzipluginstore/releases/latest)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-2dd4bf.svg)](#-publish-your-plugin)

[**🌐 Website**](https://ulanzipluginstore.narlei.com) · [**⬇️ Download**](https://github.com/narlei/ulanzipluginstore/releases/latest) · [**🚀 Publish your plugin**](https://narlei.github.io/ulanzipluginstore/#publish) · [**🧩 Browse the registry**](registry/README.md)

<img src="docs/screenshot-store.png" alt="Ulanzi Plugin Store — store screen" width="850" />

</div>

---

## ✨ Why

The Ulanzi Deck and Dial are great hardware — but there was no central place to find, install, and keep community plugins up to date. The Ulanzi Plugin Store fixes that:

- 🛍️ **One-click install** — browse the catalog and install straight into your Ulanzi plugins folder.
- 🔄 **Automatic updates** — every new GitHub Release of a plugin becomes an update in the store.
- 🌍 **Multilingual** — English, Português, and 中文 out of the box.
- 🔐 **Safe by default** — only plugins from the reviewed catalog are installable; ZIPs are validated before anything touches your disk.
- 🖥️ **Native desktop app** — Electron + React + TypeScript, for macOS and Windows.

> **Note** — This is an unofficial, community-driven project. It is not affiliated with or endorsed by Ulanzi.

## ⬇️ Download

Grab the latest build from the [**releases page**](https://github.com/narlei/ulanzipluginstore/releases/latest):

| Platform | Artifact |
| --- | --- |
| 🍎 macOS | `.dmg` / `.zip` |
| 🪟 Windows | `.exe` (NSIS installer) |

Or visit the website: [**ulanzipluginstore.narlei.com**](https://ulanzipluginstore.narlei.com)

## 🚀 Publish Your Plugin

Built something cool for your Deck or Dial? Getting it into the store takes minutes.

<div align="center">
<img src="docs/screenshot-submit.png" alt="Ulanzi Plugin Store — Send plugin screen" width="850" />
</div>

**The easy way** — use the **Send plugin** tab in the app, or the [**Publish section on the website**](https://narlei.github.io/ulanzipluginstore/#publish). Paste your GitHub repo URL, and it validates everything and opens the Pull Request for you in one click.

**What your repo needs:**

1. 📦 A `com.<you>.<plugin>.ulanziPlugin/` folder with a `manifest.json` — standard from the [official Ulanzi SDK](https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK).
2. 🏷️ A **GitHub Release** whose asset is `com.<you>.<plugin>.ulanziPlugin.zip`.
3. 🎨 Optional: a `store.json` at the repo root with cover image, screenshots, long description, device types, and tags.

Once your PR is merged, a GitHub Action reads your manifest and latest release and publishes the plugin automatically. **Every new release you ship becomes an update for every user.** Full details in the [registry guide](registry/README.md).

## 🏗️ Project Structure

| Path | Purpose |
| --- | --- |
| [`apps/store-desktop/`](apps/store-desktop) | Electron + React + TypeScript + Vite desktop app |
| [`apps/marketing-site/`](apps/marketing-site) | Static marketing site ([ulanzipluginstore.narlei.com](https://ulanzipluginstore.narlei.com)) |
| [`packages/catalog/`](packages/catalog) | Catalog types, registry validation, and `catalog.json` builder |
| [`registry/plugins/`](registry/plugins) | **Source of truth** for approved plugin repos |
| [`VERSION`](VERSION) | Official app release version — changing it on `main` triggers a release |

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

[`VERSION`](VERSION) is the single source of truth. When it changes on `main`, GitHub Actions builds and publishes a release with the macOS `.dmg` + `.zip` and the Windows `.exe`. Artifacts are ad-hoc signed (no Apple Developer account, not notarized), so macOS Gatekeeper still flags the app as coming from an unidentified developer. To open it the first time:

1. Drag **Ulanzi Plugin Store.app** to `/Applications`.
2. Right-click (or Control-click) the app → **Open** → **Open** again in the dialog. (Double-clicking it directly gets blocked.)

If macOS still says the app is damaged, clear the quarantine flag manually:

```bash
xattr -cr "/Applications/Ulanzi Plugin Store.app"
```

The catalog (`catalog.json`) is generated — never versioned. Registry entries in [`registry/plugins/*.json`](registry/plugins) are the source of truth, published automatically through GitHub Pages.

## 🔐 Security Model

- The app installs **only** plugins from the official catalog by default.
- ZIP extraction validates plugin IDs and entry paths before writing to the Ulanzi plugins folder.
- Developer Mode is reserved for future manual installs.

## 📄 License

[MIT](LICENSE) © [Narlei Moreira](https://github.com/narlei)

---

<div align="center">

**[Website](https://ulanzipluginstore.narlei.com)** · **[Download](https://github.com/narlei/ulanzipluginstore/releases/latest)** · **[Publish a plugin](https://narlei.github.io/ulanzipluginstore/#publish)** · **[Report an issue](https://github.com/narlei/ulanzipluginstore/issues)**

*Unofficial project. Not affiliated with Ulanzi.*

</div>
