# 🚀 Publish a Plugin — Step by Step

Get your Deck or Dial plugin onto the [Ulanzi Community Store](https://ulanzicommunitystore.narlei.com). It takes a few minutes, and **every GitHub Release you ship afterwards becomes an automatic update for every user**.

Copy the commands, paste them in your terminal, done. Pick the track that matches you:

- 🆕 [**I'm starting from scratch**](#-track-a--starting-from-scratch)
- ♻️ [**I already have a plugin repo**](#-track-b--i-already-have-a-plugin)

> Publishing here doesn't lock you in — the same plugin can (and should!) also go to the official Ulanzi Studio Marketplace. The Community Store is the fast lane where it can live and evolve while you iterate.

---

## ✅ Before you start

You'll need:

- [**Node.js**](https://nodejs.org) — to run `npx` (check with `node -v`).
- A **GitHub account**.
- [**GitHub CLI**](https://cli.github.com) (`gh`) — optional but recommended. When installed and logged in, the starter can create your repo and push for you.

```bash
# quick check that everything is ready
node -v          # any recent version is fine
gh auth status   # optional — should say "Logged in"
```

---

## 🆕 Track A — Starting from scratch

### 1. Scaffold the plugin

Run this in the folder where you want your project to live:

```bash
npx ulanzi-plugin-starter@latest init
```

It asks a few questions (Name, Description, Deck or Dial) and generates a complete, working plugin: the `com.<you>.<plugin>.ulanziPlugin/` folder, a `Makefile`, the release workflow, and a `store.json`. If `gh` is authenticated, it can also create the GitHub repo and push the first commit for you.

### 2. Write your logic and test locally

```bash
# edit app.js (your logic) and pi/index.html (settings UI), then:
make install     # symlinks the plugin into Ulanzi Studio and restarts it (macOS)
```

### 3. Ship a release

Commit, then push a version tag. The bundled GitHub Action builds the `.zip` and creates the Release automatically:

```bash
git add -A && git commit -m "First version"
git push
git tag v1.0.0
git push origin v1.0.0
```

### 4. Submit to the store

Paste your repo URL (`https://github.com/<you>/<repo>`) into either:

- the **Send plugin** tab inside the desktop app, or
- the [**Publish section on the website**](https://ulanzicommunitystore.narlei.com/#publish).

It validates your repo and opens a pre-filled submission issue — **you don't need to fork anything**.
A bot re-runs the validation on the issue and opens the registry Pull Request for you.
**Once it's merged, you're live.** 🎉

Prefer to skip the app? Open the [**Publish a plugin** issue](https://github.com/narlei/ulanzicommunitystore/issues/new?template=plugin_submission.yml) directly.

---

## ♻️ Track B — I already have a plugin

You don't have to rebuild anything. Run the starter **inside your existing repo** and it adapts it for the store without touching your source code:

```bash
cd your-plugin-repo
npx ulanzi-plugin-starter@latest init
```

Depending on your layout, it will:

- add the store files (`store.json`, `Makefile`, release workflow) if your `com.<you>.<plugin>.ulanziPlugin/` folder is already at the repo root, or
- offer to **hoist** a nested plugin folder to the root, or
- offer to **wrap** a loose `manifest.json` into a proper plugin folder.

It shows the exact plan and asks before changing anything — review with `git diff` afterwards.

**Only need the store listing file?** If your repo already builds and releases fine and you just want the optional store metadata (cover, screenshots, tags):

```bash
cd your-plugin-repo
npx ulanzi-plugin-starter@latest store
```

Then ship a release and submit — same as [steps 3 and 4 above](#3-ship-a-release).

---

## 📦 What your repo needs

Whichever track you took, a valid plugin repo has:

1. **A plugin folder at the root** — `com.<you>.<plugin>.ulanziPlugin/` containing a `manifest.json` (standard from the [official Ulanzi SDK](https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK)).
2. **A GitHub Release** whose asset is `com.<you>.<plugin>.ulanziPlugin.zip` (the zip of that folder). The bundled release workflow does this for you on every tag.
3. **Optional — `store.json` at the root** for a richer store page:

   ```json
   {
     "cover": "resources/cover.png",
     "screenshots": ["resources/banner1.png", "resources/banner2.png"],
     "longDescription": "A longer description in Markdown or plain text.",
     "deviceTypes": ["deck", "dial"],
     "tags": ["productivity", "timer"]
   }
   ```

   Image paths are relative to the repo root. Without `store.json`, the store falls back to the `Description` from your manifest.

---

## 🏷️ Show off your badge

Once your plugin is listed, add this to your plugin's README:

```markdown
[![Available on Ulanzi Community Store](https://raw.githubusercontent.com/narlei/ulanzicommunitystore/main/docs/badges/ulanzi-community-store.svg)](https://ulanzicommunitystore.narlei.com)
```

Shield-style and shields.io variants live in [`docs/badges/`](docs/badges/README.md).

---

## 📚 Going deeper

- [**Plugin Starter Kit**](plugin-starter/README.md) — everything the `npx` command generates and every flag.
- [**Community Registry guide**](registry/README.md) — the manual PR process, if you'd rather not use the app.
- [**Official Ulanzi SDK**](https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK) — the plugin API reference.

Stuck? [Open an issue](https://github.com/narlei/ulanzicommunitystore/issues) — happy to help.
