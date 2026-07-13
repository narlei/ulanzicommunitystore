---
name: ulanzi-plugin-dev
description: How to develop a plugin for Ulanzi Deck & Dial. Use this skill when asked to help with a Ulanzi Plugin development.
---

# Ulanzi Plugin Development Guide

You are working on an Ulanzi Deck/Dial plugin project that was bootstrapped using the Ulanzi Community Store starter kit.

## Project Structure
- `<plugin-id>.ulanziPlugin/`: The actual plugin folder containing `manifest.json`, `app.js` and `pi/` (Property Inspector).
- `store.json`: Used by the community store for the plugin's metadata.
- `Makefile`: Provides commands like `make install`, `make restart`, `make package`.
- `.github/workflows/release.yml`: Automatically builds the plugin zip and creates a GitHub Release when a `v*` tag is pushed.

## Official SDK Example
There is a folder named `ulanzi_plugin_example/` in this project. It is a clone of the official UlanziDeckPlugin-SDK repository. **Always look inside this folder if you need examples on how to implement specific features or understand the API.**

## How to Test
The developer should run `make install` to install the plugin to the correct Ulanzi Plugins folder on macOS and restart the Ulanzi Studio app automatically.

## How to Publish
1. Push the code to GitHub.
2. Push a tag (e.g. `v1.0.0`). The GitHub Action will build and release the ZIP file.
3. Submit the plugin to the [Ulanzi Community Store](https://github.com/narlei/ulanzicommunitystore) by creating a `<owner>__<repo>.json` file inside `registry/plugins/` (or via the App/Website).
