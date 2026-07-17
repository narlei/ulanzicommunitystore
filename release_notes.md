## v1.3.0 — 2026-07-17

### Added

- Social-share banners: plugin pages now generate an og:image banner (with rasterized plugin icons) so links shared on social media and chat apps show a rich preview instead of a plain link.
- The desktop app can now log install/catalog/submission failures to disk and offers an **Open logs** action in Settings, so users can share technical details when reporting issues.
- New plugins in the catalog: GitHub Repo Stats, Internet Speed Test, macOS Controls, and YouTube Channel Stats.

### Fixed

- Banner font rendering on CI now uses static Inter faces with measured text widths, fixing incorrect font weights and glyph overflow on the server-generated images.
- og:image URLs are now cache-busted with a content hash, so social platforms pick up updated banners instead of serving a stale cached image.
- Plugin install no longer fails on harmless macOS zip metadata (`__MACOSX`, `.DS_Store`) bundled in some release archives.

### Changed

- Plugin install validation errors are now more descriptive (invalid plugin id, untrusted download URL, unexpected zip structure) to make failures easier to diagnose.
- Shared plugin links now serve through `index.php` (server-side OG tags) instead of the static HTML page.
- Electron bumped to 43.1.1 (latest stable patch).

### Internal

- Security scan workflow always installs the latest Trivy instead of a pinned version.
