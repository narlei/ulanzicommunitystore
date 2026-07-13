# Ulanzi Plugin Starter Kit

The official starter kit for bootstrapping plugins for the Ulanzi Deck and Dial devices, ready to publish on the **Ulanzi Community Store**.

This kit scaffolds a complete, working plugin structure in seconds, including a `Makefile` for local installation and a GitHub Actions workflow to automatically release updates.

## 🚀 Quick Start

To create a new plugin, run the following command in the directory where you want your project to live:

```bash
npx ulanzi-plugin-starter@latest init
```

> **Requirements:** [Node.js](https://nodejs.org) is required to run `npx`. The [GitHub CLI](https://cli.github.com) (`gh`) is optional but recommended — when it's installed and authenticated the kit can create your GitHub repository and push the first commit for you.

### Context-aware

The CLI inspects the folder before asking anything and adapts:

- **Already inside a git repo with a GitHub remote?** It reuses that `owner/repo` for the manifest URL — no repo questions asked.
- **Already have a `*.ulanziPlugin/` folder?** It switches to *adapt mode*: it adds the Store files (Makefile, workflow, `store.json`, AI skill) **without touching your existing source code**.
- **GitHub identity** comes from your authenticated `gh` session, never from your machine's local git config.

### What it generates

The CLI asks a few questions (Name, Description, Device Type) and instantly generates:

- 📂 `com.<you>.<plugin>.ulanziPlugin/`: The actual plugin folder with `manifest.json`, `app.js` and `pi/`.
- ⚙️ `Makefile`: Comes with `make install` (installs to Ulanzi Studio), `make restart` and `make package`.
- 🤖 `.github/workflows/release.yml`: Automatically builds and publishes your plugin when you push a version tag.
- 🛍️ `store.json`: Ready to be submitted to the Community Store.
- 📚 `ulanzi_plugin_example/`: A clone of the official Ulanzi SDK for you to use as reference.
- 🧠 `.claude/`: An AI Skill folder. If you use AI assistants like Claude, Cursor or Gemini, they will automatically read this skill to understand how Ulanzi plugins work.

Optionally, it will `git init` the project, create the GitHub repository via `gh`, and push the initial commit — so you're ready to tag a release immediately.

## ♻️ Adapting an existing plugin

Already have a plugin repo? Run the same command **inside it** and the CLI adapts it for the
Community Store instead of scaffolding from scratch — it detects your setup and does the right thing:

- **Plugin folder already at the repo root** (`com.<you>.<plugin>.ulanziPlugin/`) → adds the
  store files (`store.json`, `Makefile`, release workflow) **without touching your source**.
- **Plugin folder nested** in a subfolder (e.g. `plugin/…`, `plugins/…`) → offers to **hoist** it
  to the repo root, where the store expects it.
- **A loose `manifest.json` at the root** (no plugin folder) → offers to **wrap** your plugin files
  into a `com.<you>.<plugin>.ulanziPlugin/` folder, keeping repo files (`README`, `LICENSE`,
  `.git`, `.github`, `store.json`, `resources/`) at the root. It shows the exact move plan and asks
  before touching anything — review `git diff` afterwards.

The bundled release workflow packages **every** `*.ulanziPlugin/` folder at the root, so
multi-plugin repos are supported too. After adapting, publish with a version tag:
`git tag v1.0.0 && git push origin v1.0.0`.

## 🛠️ Development Workflow

Once your plugin is generated:

1. Write your logic inside `app.js` and configure your settings UI in `pi/index.html`.
2. Run `make install` to test the plugin locally. This will symlink your plugin folder to the Ulanzi Deck Plugins directory and automatically restart the Ulanzi Studio app (macOS).
3. Check the `ulanzi_plugin_example/` directory if you need inspiration or want to see how the official examples are built.

## 📦 Publishing

1. Commit your changes and push them to GitHub.
2. Create and push a tag (e.g. `git tag v1.0.0` && `git push origin v1.0.0`). The included GitHub Action will automatically create a Release with the compiled `.zip` file.
3. Submit your plugin to the Ulanzi Community Store by pasting your GitHub repo URL in the "Publish" section of the store.
4. Optional — after you're listed, add the Community Store badge to your plugin README:

```markdown
[![Available on Ulanzi Community Store](https://raw.githubusercontent.com/narlei/ulanzicommunitystore/main/docs/badges/ulanzi-community-store.svg)](https://ulanzicommunitystore.narlei.com)
```

Variants: [docs/badges](https://github.com/narlei/ulanzicommunitystore/tree/main/docs/badges).
