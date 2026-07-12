## v0.2.0 — 2026-07-08

### Added
- `install.sh`, a one-line installer (`curl -fsSL .../install.sh | bash`) that downloads the latest macOS `.zip` release and installs it to `/Applications`. Since curl downloads aren't tagged with the `com.apple.quarantine` attribute, Gatekeeper never blocks the app — no security prompts on first launch.
- Packaged builds now default to the published GitHub Pages catalog (`https://narlei.github.io/ulanzicommunitystore/catalog.json`) when `STORE_CATALOG_URL` isn't set, so the app works out of the box without manual configuration.
- `apps/store-desktop/scripts/render-dmg-background.sh`, a headless-Chrome script that regenerates `build/dmg-background.png` from `build/dmg-background.html`, replacing the previous Electron-based renderer.
- Custom DMG installer layout (`dmg.background`, `dmg.window`, `dmg.contents` in electron-builder config) with a proper app-to-Applications drag target.
- Predictable release artifact names (`UlanziPluginStore-mac.zip`, `UlanziPluginStore.dmg`, `UlanziPluginStore.exe`) via electron-builder `artifactName` overrides.

### Changed
- DMG background banner reworked: repositioned/resized, and copy translated to English with updated first-launch instructions (System Settings → Privacy & Security → "Open Anyway"), since right-click → Open no longer offers a Gatekeeper bypass on recent macOS versions.
- README rewritten with the recommended `install.sh` one-liner as the primary macOS install path, plus a manual `.dmg` fallback documenting the System Settings route and the `xattr -cr` quarantine workaround.

### Removed
- `apps/store-desktop/scripts/render-dmg-background.mjs`, replaced by the headless-Chrome shell script.
