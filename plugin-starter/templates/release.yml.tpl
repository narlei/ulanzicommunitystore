name: release-plugin

on:
  push:
    tags: ['v*']

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build plugin zip
        run: |
          PLUGIN_DIR=$(ls -d *.ulanziPlugin | head -1)
          if [ -z "$PLUGIN_DIR" ]; then
            echo "No .ulanziPlugin directory found" >&2
            exit 1
          fi
          zip -r "${PLUGIN_DIR}.zip" "$PLUGIN_DIR" -x "*.DS_Store"

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: '*.ulanziPlugin.zip'
          generate_release_notes: true
