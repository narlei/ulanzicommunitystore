## v1.4.0 — 2026-07-22

### Added

- **Ulanzi Studio creator portal as an opt-in catalog source.** A new *Show Ulanzi Studio creator portal* toggle in Settings lists plugins published on `ugc.ulanzistudio.com` alongside community and official ones. It surfaces 21 plugins the official product feed cannot expose — their archives are stored under a content hash with no plugin id in the filename — 15 of which reach the store for the first time, including MIDI, VTube Studio, Streamlabs Desktop, DaVinci Resolve, Elgato Key Light, HA Hub, Microsoft 365 Actions and Windows Cockpit. Entries also carry real screenshots, long descriptions and localized titles, which the official feed returns empty.
- **Source filter.** Narrow the store to Community, Official or Ulanzi portal entries. Only appears once more than one catalog is active.
- **Filters popover.** Platform, device, category and source now live behind a single *Filters* control with an active-filter count, keeping the bar readable in every language.
- **Smarter search.** Whitespace splits the query into independent terms that must all match, so `claude narlei` finds a plugin named Claude published by narlei even though the words are not adjacent. Matching now spans name, description, long description, author, plugin id, repository, category and tags, and ignores accents — `acao` finds *Ação*.
- **Catalog cache.** The Ulanzi catalogs are cached on disk for an hour, so reopening the store is instant instead of waiting on their CDN. A *Clear and refresh* action in Settings discards it on demand and narrates each step through a toast.
- **Loading skeletons** for screenshots on the plugin detail page, replacing the blank gap while images decode.
- New community plugins: Codex (dahliasan), Window Switcher, Apple Shortcuts and Run AppleScript (narlei).

### Fixed

- Screenshots opened from the detail page now scale up to fill the window. Images smaller than the viewport previously rendered at their natural size, which for most portal screenshots meant a thumbnail floating in a large dark frame.
- Clicking the empty area around a lightbox image closes it again.
- Plugin artwork degrades through cover, then screenshots, then a placeholder instead of rendering a broken-image glyph. Three of the portal's cover URLs point at CDN objects that no longer exist.
- The category filter no longer lists the same entry twice. The community registry publishes lowercase slugs (`tools`) while the Ulanzi feeds publish labels (`Tools`), which produced two identically-labelled options that each matched only their own source. Categories that existed only in lowercase — Devtools, Productivity, Creator, Smart Home — returned no results at all and now work.
- Social cards for a just-published plugin no longer serve a stale image.

### Changed

- **Filter bar reorganized:** search anchors the left and grows to fill the available width; sort and filters are pinned right.
- **Faster catalog loading.** The three sources are fetched in parallel instead of waiting on the community catalog first, portal list pages are requested together, and each plugin flows from id probe to detail fetch on its own rather than waiting for every probe to finish — roughly 45% off a cold load, on top of the cache.
- Community registry entries always take precedence over Ulanzi ones on id collisions, so a plugin published in both places keeps its repository, changelog and security scan.
- A failed catalog fetch now falls back to the expired cache rather than dropping the source from the store entirely.
- Portuguese interface strings are now correctly accented across all 206 entries.

### Security

- **adm-zip upgraded to 0.6.0** (GHSA-xcpc-8h2w-3j85). A crafted ZIP could trigger a 4 GB allocation in the library the store uses to unpack downloaded plugin archives. Downloads remain restricted to GitHub and Ulanzi hosts, and archives are still validated before extraction.
- Resolved transitive `brace-expansion` and `fast-uri` advisories. Both are build tooling and never shipped in the app.

### Internal

- Added ESLint with the two React Hooks rules, reported on every pull request without gating the build. They cover a class of bug the type checker cannot see: a hook whose dependency array omits a value it reads type-checks cleanly and simply stops recomputing.
