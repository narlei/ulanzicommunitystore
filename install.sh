#!/usr/bin/env bash
# Downloads and installs the latest Ulanzi Plugin Store build for macOS.
#
#   curl -fsSL https://raw.githubusercontent.com/narlei/ulanzipluginstore/main/install.sh | bash
#
# Files fetched with curl aren't tagged with the com.apple.quarantine
# attribute the way browser downloads are, so Gatekeeper never blocks the
# app — no "unidentified developer" dialog, no System Settings detour.
set -euo pipefail

REPO="narlei/ulanzipluginstore"
APP_NAME="Ulanzi Plugin Store.app"
DEST="/Applications/$APP_NAME"
DOWNLOAD_URL="https://github.com/$REPO/releases/latest/download/UlanziPluginStore-mac.zip"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This installer only supports macOS." >&2
  exit 1
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Downloading $DOWNLOAD_URL"
curl -fsSL "$DOWNLOAD_URL" -o "$TMP_DIR/app.zip"

echo "Installing to /Applications..."
rm -rf "$DEST"
unzip -q "$TMP_DIR/app.zip" -d "$TMP_DIR"
mv "$TMP_DIR/$APP_NAME" "$DEST"

# Defensive — curl downloads aren't quarantined, but strip the attribute
# in case a future step in the chain (or a re-run) adds one.
xattr -cr "$DEST"

echo "Installed. Launching Ulanzi Plugin Store..."
open "$DEST"
