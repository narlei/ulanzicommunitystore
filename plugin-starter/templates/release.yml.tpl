name: release-plugin

# Publishes a GitHub Release automatically whenever the plugin's manifest.json
# changes on the default branch (i.e. a version bump landed via merge). The
# Ulanzi Community Store picks the release up on its next catalog build.
on:
  push:
    branches: ['{{DEFAULT_BRANCH}}']
    paths:
      - '*.ulanziPlugin/manifest.json'
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version (defaults to manifest Version, e.g. 1.0.0)'
        required: false

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Resolve version from manifest
        id: meta
        run: |
          dir=$(ls -d *.ulanziPlugin 2>/dev/null | head -1)
          if [ -z "$dir" ]; then echo "No .ulanziPlugin folder at the repository root" >&2; exit 1; fi
          version="${{ github.event.inputs.version }}"
          version="${version#v}"
          if [ -z "$version" ]; then version=$(jq -r .Version "$dir/manifest.json"); fi
          echo "version=$version" >> "$GITHUB_OUTPUT"

      - name: Check if release already exists
        id: check
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          if gh release view "v${{ steps.meta.outputs.version }}" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
            echo "exists=true" >> "$GITHUB_OUTPUT"
            echo "Release v${{ steps.meta.outputs.version }} already exists — skipping."
          else
            echo "exists=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Build plugin zip(s)
        if: steps.check.outputs.exists == 'false'
        run: |
          found=0
          for dir in *.ulanziPlugin; do
            [ -d "$dir" ] || continue
            echo "Packaging $dir"
            zip -r "${dir}.zip" "$dir" -x "*.DS_Store"
            found=1
          done
          if [ "$found" = "0" ]; then
            echo "No .ulanziPlugin directory found at the repository root" >&2
            exit 1
          fi

      - name: Create GitHub Release
        if: steps.check.outputs.exists == 'false'
        env:
          GH_TOKEN: ${{ github.token }}
          VERSION: ${{ steps.meta.outputs.version }}
        run: |
          gh release create "v$VERSION" \
            --repo "$GITHUB_REPOSITORY" \
            --title "v$VERSION" \
            --generate-notes \
            --latest \
            *.ulanziPlugin.zip
