## v0.1.5 — 2026-07-07

### Added
- `LICENSE` file (MIT) at the repo root.
- Store and plugin-submission screenshots (`docs/screenshot-store.png`, `docs/screenshot-submit.png`), now used in the README.
- GitHub Release body is now read from `release_notes.md` in the `release-app.yml` workflow.
- `afterPack` hook (`apps/store-desktop/scripts/afterPack.cjs`) that ad-hoc signs the macOS app (`codesign --sign -`) after build, avoiding the "damaged app" warning on Apple Silicon when there's no Apple Developer certificate.

### Fixed
- macOS builds without an Apple certificate are now ad-hoc signed (`identity: null`, `hardenedRuntime: false`, `gatekeeperAssess: false` in electron-builder), fixing Gatekeeper rejecting the app on Apple Silicon Macs.

### Changed
- README rewritten: badges, "Why" section, download instructions, plugin publishing guide, and project structure with direct links to folders.
- README dev commands migrated from `npm run ...` to `Makefile` targets (`make run`, `make app`, `make typecheck`, `make catalog`, `make catalog_validate`, `make release`, `make marketing`, `make version`).
- The `catalog` target in the `Makefile` now checks for an authenticated GitHub token (`gh auth token`) before building the catalog, with an error message pointing to `gh auth login`.
- `apps/store-desktop/package.json` gained a `repository` field and `owner`/`repo` in the electron-builder publish config, pointing to `narlei/ulanzipluginstore`.
