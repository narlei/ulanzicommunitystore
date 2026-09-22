## v1.6.1 — 2026-09-22

### Fixed

- **On Windows, restarting Ulanzi Studio no longer closes the Community Store.** The restart looked for any running process with "Ulanzi" in its path — which also matches the store's own Electron main, renderer and GPU processes — so installing a plugin could shut the store down instead of the Studio. It now ignores anything running from the store's own install folder.
- **On Windows, the Studio is found even when its executable isn't named exactly `Ulanzi Studio.exe`.** The previous lookup matched the process name exactly, came back empty on those installs, and the restart silently did nothing. The Studio's whole process tree is now terminated by pid rather than by image name.

### Changed

- **The GitHub star prompt asks earlier and is harder to miss.** It now appears after two installed plugins instead of three, and floats in the bottom corner alongside the toasts instead of sitting above the plugin list, where it was easy to scroll straight past.
- **"Not now" snoozes the star prompt for seven days instead of silencing it forever**, and the prompt gives up for good after three declines. An accidental dismissal no longer costs the invitation permanently.
- The star prompt was redesigned and its wording rewritten in all three languages to explain why a star matters to the project.
