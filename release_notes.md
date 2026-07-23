## v1.5.0 — 2026-07-23

### Changed

- **Publishing a plugin no longer requires a fork.** The *Send plugin* tab used to hand you a GitHub "new file" link and rely on GitHub forking the store repository for you. When that did not happen, you landed on *"You need to fork this repository to propose changes"*, the request came back `422`, and the app reported a generic *"An unexpected error occurred"* with no way forward. The button now opens a pre-filled submission issue instead: paste nothing, fork nothing, touch no git. A bot validates your repository and opens the registry Pull Request on your behalf, crediting you as co-author of the commit.
- **The validation you already saw now runs twice, in the right places.** The same checks the store runs on registry Pull Requests — repository reachable, latest release carrying a `*.ulanziPlugin.zip` asset, `manifest.json` present and well-formed, `store.json` valid with every referenced image actually existing — run on the issue before any Pull Request is created. If something is off, the bot comments exactly what to fix; edit the issue and it revalidates immediately. Submitting a plugin that is already in the registry is recognized and closed with an explanation rather than opening a duplicate.

### Added

- **A "Publish a plugin" issue template**, reachable from the app, from the website's *Publish* section, or directly from the repository's issue chooser. The app and the site still validate your repository in advance and fill the form in for you, so the flow you already knew is unchanged up to the final click.

### Internal

- Registry Pull Request validation accepts `/revalidate` from a maintainer comment and a manual run with a Pull Request number. Pull Requests opened with the Actions token do not trigger workflows, so bot-authored submissions carry their validation report in the Pull Request body and can be re-checked on demand.
- Issue bodies are untrusted input and are never interpolated into a shell command: a parser reads the body from the environment and emits only a strict `owner/repo` slug, which is all the rest of the workflow consumes.
- The manual fork-and-Pull-Request path stays documented for anyone who prefers it.
