## v1.2.1 — 2026-07-15

### Changed

- The security banner in the plugin detail sheet is now a compact **Scan** cell in the stats bar (next to version, downloads, stars and devices). Clicking it expands the full security panel; when the scan found issues, the panel is always visible and the cell shows the issue count. The wording stays factual about the scan result ("Clean") rather than asserting the plugin is safe.
- The public security report page now credits each plugin's maintainer with a link to their GitHub profile.
- Security scan reports with findings now @-mention the affected plugin maintainers (deduped), so they get notified directly.

### Internal

- GitHub Actions in all workflows bumped to their latest versions.
