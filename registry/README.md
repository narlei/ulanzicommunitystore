# Community Registry — How to Submit a Plugin

This folder is the **source of truth** for the Ulanzi Community Store. Each file
`plugins/<owner>__<repo>.json` represents a published plugin — anyone can add theirs
with a Pull Request, and every new GitHub Release ships to users automatically.

> **Easy way:** the **Submit Plugin** tab in the app (or the *Publish* section at
> [narlei.github.io/ulanzipluginstore](https://narlei.github.io/ulanzipluginstore/#publish))
> validates your repository, generates this file, and opens the Pull Request for you in one click.
> The steps below are the equivalent manual process.

To submit yours:

1. Fork this repository.
2. Create `plugins/<owner>__<repo>.json` with the minimum:

   ```json
   { "repo": "your-username/your-repo" }
   ```

   The filename should be the `owner` and `repo` separated by `__` (two underscores),
   replacing any `/` with `__`. Example: `narlei/ulanzideck_ticktick` →
   `narlei__ulanzideck_ticktick.json`.

3. Open a Pull Request. Once approved and merged, a GitHub Action reads the `manifest.json`,
   the `store.json` (optional) and the **latest release** from your repo, and publishes the plugin to the store
   automatically. Every new release becomes an update detected by the store.

## What Your Repo Needs

- A folder `com.<you>.<plugin>.ulanziPlugin/` with `manifest.json` (standard from the
  [official Ulanzi SDK](https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK)).
- A **GitHub Release** whose asset is `com.<you>.<plugin>.ulanziPlugin.zip`
  (the zip of the plugin folder from the root). The store template already includes an Action that does this.
- Optional: a `store.json` at the root of your repo with cover image, screenshots, long description, device
  types, and tags. Without it, the store falls back to the `Description` from the manifest.

### `store.json` (optional)

```json
{
  "cover": "resources/cover.png",
  "screenshots": ["resources/banner1.png", "resources/banner2.png"],
  "longDescription": "A longer description in Markdown or plain text.",
  "deviceTypes": ["deck", "dial"],
  "tags": ["productivity", "timer"]
}
```

Image paths are relative to the root of your repo.
