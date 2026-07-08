#!/usr/bin/env bash
# Regenerates build/dmg-background.png from build/dmg-background.html.
# Only needed when you edit the HTML — the PNG itself is committed and
# consumed directly by electron-builder's "dmg.background" config.
set -euo pipefail

cd "$(dirname "$0")/../build"

CHROME=""
for candidate in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"; do
  if [ -x "$candidate" ]; then
    CHROME="$candidate"
    break
  fi
done

if [ -z "$CHROME" ]; then
  echo "No Chromium-based browser found to render the DMG background. Install Google Chrome and retry." >&2
  exit 1
fi

"$CHROME" --headless --disable-gpu --screenshot="dmg-background.png" \
  --window-size=660,420 "file://$(pwd)/dmg-background.html"

echo "Wrote build/dmg-background.png"
