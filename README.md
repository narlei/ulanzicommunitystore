<div align="center">

<img src="apps/marketing-site/assets/app-icon.png" alt="Ulanzi Community Store icon" width="128" />

# Ulanzi Community Store

**The open-source community store for Ulanzi Deck & Dial plugins.**
Publish in minutes, install in one click, update automatically.

[![Download](https://img.shields.io/github/v/release/narlei/ulanzicommunitystore?label=download&color=2dd4bf)](https://github.com/narlei/ulanzicommunitystore/releases/latest)
[![Build](https://img.shields.io/github/actions/workflow/status/narlei/ulanzicommunitystore/ci.yml?branch=main&label=build)](https://github.com/narlei/ulanzicommunitystore/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-8b5cf6)](https://github.com/narlei/ulanzicommunitystore/releases/latest)

[**🌐 Website**](https://ulanzicommunitystore.narlei.com) · [**⬇️ Download**](#-install) · [**🚀 Publish a plugin**](#-publish-your-plugin) · [**🛠️ Contributing**](CONTRIBUTING.md)

<img src="docs/screenshot-store.png" alt="Ulanzi Community Store — store screen" width="850" />

</div>

---

## 💚 What it is

A **community-run, open-source catalog** for Ulanzi Deck & Dial plugins. Anyone can publish a plugin with a Pull Request, and every GitHub Release ships as an instant update to every user.

**It's not a replacement for the official Ulanzi Studio Marketplace — it's the companion fast lane.** The marketplace is where plugins get Ulanzi's review and stamp of approval. The Community Store is where makers ship early, iterate with users, and grow the ecosystem. Your plugin can (and should!) live in both.

- 🚀 **Publish in minutes** — one Pull Request, automated validation, no waiting queue.
- 🔄 **Instant updates** — every new GitHub Release becomes an update in the store.
- 🛍️ **One-click install** — straight into your Ulanzi plugins folder.
- 🌍 **Multilingual** — English, Português, and 中文 out of the box.
- 🔐 **Safe by default** — only reviewed registry plugins are installable; ZIPs are validated before touching your disk.
- 🔓 **100% open source** — the app, the registry, and the pipeline.

> **Note** — Unofficial, community-driven project made by people who love Ulanzi hardware. Not affiliated with, endorsed by, or maintained by Ulanzi. For official plugins and support, see the Ulanzi Studio Marketplace.

## ⬇️ Install

**Recommended — one line, auto-detects your OS:**

```bash
# macOS (Terminal) · Windows (Git Bash / WSL)
curl -fsSL https://raw.githubusercontent.com/narlei/ulanzicommunitystore/main/install.sh | bash
```

```powershell
# Windows (PowerShell) — no bash required
irm https://raw.githubusercontent.com/narlei/ulanzicommunitystore/main/install.ps1 | iex
```

On macOS the script installs the latest `.zip` into `/Applications`. Files fetched with `curl` aren't tagged with `com.apple.quarantine`, so **Gatekeeper never blocks the app** — this is the smoothest path. On Windows it downloads `UlanziPluginStore.exe` and launches the installer.

**Or download manually** from the [releases page](https://github.com/narlei/ulanzicommunitystore/releases/latest) — macOS `.dmg`/`.zip`, or Windows `.exe`. You can also browse from the [website](https://ulanzicommunitystore.narlei.com).

<details>
<summary><b>macOS: opening a manually-downloaded <code>.dmg</code></b> (Gatekeeper workaround)</summary>

<br>

Because a browser-downloaded DMG gets quarantined, Gatekeeper blocks the first launch (the app isn't notarized — no Apple Developer account). To open it:

1. Drag **Ulanzi Community Store.app** to `/Applications` and try to open it — macOS blocks it. That's expected.
2. Go to **System Settings → Privacy & Security**, scroll to Security, and click **Open Anyway**.
3. Try opening again — a new dialog appears with an **Open** button. Click it.

Or just clear the quarantine flag manually:

```bash
xattr -cr "/Applications/Ulanzi Community Store.app"
```

</details>

## 🚀 Publish Your Plugin

Built something for your Deck or Dial? Getting it into the Community Store takes minutes, and every release you ship afterwards reaches your users automatically.

<div align="center">
<img src="docs/screenshot-submit.png" alt="Ulanzi Community Store — Send plugin screen" width="850" />
</div>

**The three-step version:**

```bash
npx ulanzi-plugin-starter@latest init   # 1. scaffold (or adapt an existing repo)
git tag v1.0.0 && git push origin v1.0.0 # 2. ship a release — the workflow builds the .zip
# 3. paste your repo URL in the app's "Send plugin" tab or the website — we open the PR
```

Once your PR is merged, a GitHub Action reads your manifest and latest release and publishes it. **Every new release becomes an update for every user.**

👉 **Full copy-paste walkthrough — from scratch or adapting an existing plugin — in [PUBLISHING.md](PUBLISHING.md).**

## 🛠️ Contributing & Development

Want to hack on the app, understand the project layout, or learn how releases work? See **[CONTRIBUTING.md](CONTRIBUTING.md)** — project structure, dev setup, the `Makefile`, the release pipeline, and the security model.

## 📄 License

[MIT](LICENSE) © [Narlei Moreira](https://github.com/narlei)

---

<div align="center">

**[Website](https://ulanzicommunitystore.narlei.com)** · **[Download](https://github.com/narlei/ulanzicommunitystore/releases/latest)** · **[Publish a plugin](https://ulanzicommunitystore.narlei.com/#publish)** · **[Report an issue](https://github.com/narlei/ulanzicommunitystore/issues)**

*Made with 💚 by the community, for the community. Unofficial project — not affiliated with Ulanzi.*

</div>
