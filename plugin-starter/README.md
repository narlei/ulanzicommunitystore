# Ulanzi Plugin Starter Kit

The official starter kit for bootstrapping plugins for the Ulanzi Deck and Dial devices, ready to publish on the **Ulanzi Community Store**.

This kit scaffolds a complete, working plugin structure in seconds, including a `Makefile` for local installation and a GitHub Actions workflow to automatically release updates.

## 🚀 Quick Start

To create a new plugin, run the following command in the directory where you want your project to live:

```bash
npx github:narlei/ulanzicommunitystore/plugin-starter init
```

> **Requirements:** You must have [Node.js](https://nodejs.org) installed on your machine to use `npx`. If you get a "command not found" error, download and install Node.js first.

### What it generates

The CLI will ask you a few questions (Name, Description, Device Type) and instantly generate:

- 📂 `com.<you>.<plugin>.ulanziPlugin/`: The actual plugin folder with `manifest.json`, `app.js` and `pi/`.
- ⚙️ `Makefile`: Comes with `make install` (installs to Ulanzi Studio), `make restart` and `make package`.
- 🤖 `.github/workflows/release.yml`: Automatically builds and publishes your plugin when you push a version tag.
- 🛍️ `store.json`: Ready to be submitted to the Community Store.
- 📚 `ulanzi_plugin_example/`: A clone of the official Ulanzi SDK for you to use as reference.
- 🧠 `.claude/`: An AI Skill folder. If you use AI assistants like Claude, Cursor or Gemini, they will automatically read this skill to understand how Ulanzi plugins work.

## 🛠️ Development Workflow

Once your plugin is generated:

1. Write your logic inside `app.js` and configure your settings UI in `pi/index.html`.
2. Run `make install` to test the plugin locally. This will symlink your plugin folder to the Ulanzi Deck Plugins directory and automatically restart the Ulanzi Studio app (macOS).
3. Check the `ulanzi_plugin_example/` directory if you need inspiration or want to see how the official examples are built.

## 📦 Publishing

1. Commit your changes and push them to GitHub.
2. Create and push a tag (e.g. `git tag v1.0.0` && `git push origin v1.0.0`). The included GitHub Action will automatically create a Release with the compiled `.zip` file.
3. Submit your plugin to the Ulanzi Community Store by pasting your GitHub repo URL in the "Publish" section of the store.
