## v1.2.0 — 2026-07-15

### Added
- **Security scanning surfaced in the store.** Every community plugin repo is scanned daily with Trivy (dependency CVEs + leaked secrets, HIGH/CRITICAL). Each catalog entry now carries a `security` field with the scan status, finding counts, scanner name/version, and the exact commit scanned.
- **Security panel in the app.** The plugin detail view shows the scan result — clean, findings (with critical/high/secret counts), scan error, or not yet scanned — with the scan date, tool, and a link to the full report. Plugin cards show a warning chip when known vulnerabilities were found. Localized in EN/PT/ZH.
- **Public security report page.** A `security.html` report is published on GitHub Pages next to `catalog.json`, with per-plugin anchors deep-linked from the app.
- New community plugin listed in the registry: **narlei/ulanzideck-disk-status**.

### Changed
- The security scan and catalog publishing now run as a single pipeline (`publish-catalog`): scan → build catalog with security data → deploy Pages. The standalone `security-scan` workflow was removed; the rolling security issue is still opened/closed automatically.
- `plugin-starter`'s generated `Makefile` now quits the target app gracefully on `restart` (via AppleScript) before falling back to a force-kill, instead of always force-killing it.
- `validate-registry-pr` now runs on every pull request and skips its check step when no registry files changed, instead of being gated by a path filter.
- Bumped `ulanzi-plugin-starter` to 1.2.3.

### Internal
- Upgraded `actions/upload-pages-artifact` and `actions/deploy-pages` to v5 in the catalog publishing workflow.
