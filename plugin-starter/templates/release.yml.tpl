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

      - name: Build plugin zip(s)
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
        uses: softprops/action-gh-release@v2
        with:
          files: '*.ulanziPlugin.zip'
          generate_release_notes: true
