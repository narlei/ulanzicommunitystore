#!/usr/bin/env bash
# Downloads and installs the latest Ulanzi Community Store for macOS or Windows.
#
#   curl -fsSL https://raw.githubusercontent.com/narlei/ulanzicommunitystore/main/install.sh | bash
#
# macOS: installs the .app to /Applications. Files fetched with curl aren't
# tagged with com.apple.quarantine the way browser downloads are, so Gatekeeper
# never blocks the app — no "unidentified developer" dialog.
#
# Windows (Git Bash / MSYS / Cygwin / WSL): downloads the NSIS .exe and launches
# the installer. For native PowerShell (no bash), use install.ps1 instead:
#
#   irm https://raw.githubusercontent.com/narlei/ulanzicommunitystore/main/install.ps1 | iex
#
set -euo pipefail

REPO="narlei/ulanzicommunitystore"
MAC_URL="https://github.com/$REPO/releases/latest/download/UlanziPluginStore-mac.zip"
WIN_URL="https://github.com/$REPO/releases/latest/download/UlanziPluginStore.exe"

os_family() {
  local uname_s
  uname_s="$(uname -s 2>/dev/null || true)"
  case "$uname_s" in
    Darwin*)
      echo "macos"
      ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "windows"
      ;;
    Linux*)
      # WSL can launch a Windows .exe via interop.
      if [[ -n "${WSL_DISTRO_NAME:-}" ]] || grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; then
        echo "wsl"
      else
        echo "linux"
      fi
      ;;
    *)
      # Some environments only set OS=Windows_NT.
      if [[ "${OS:-}" == "Windows_NT" ]]; then
        echo "windows"
      else
        echo "unknown"
      fi
      ;;
  esac
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

install_macos() {
  need_cmd curl
  need_cmd unzip
  need_cmd find
  need_cmd xattr
  need_cmd open

  local tmp_dir app_path app_name dest
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' EXIT

  echo "Detected macOS."
  echo "Downloading $MAC_URL"
  curl -fsSL "$MAC_URL" -o "$tmp_dir/app.zip"

  echo "Installing to /Applications..."
  unzip -q "$tmp_dir/app.zip" -d "$tmp_dir"

  # Locate the app bundle inside the zip instead of hardcoding its name, so
  # installs keep working across releases even if the product name changes
  # (e.g. the Plugin Store → Community Store rebrand).
  app_path="$(find "$tmp_dir" -maxdepth 1 -name "*.app" -print -quit)"
  if [[ -z "$app_path" ]]; then
    echo "No .app bundle found in the downloaded archive." >&2
    exit 1
  fi
  app_name="$(basename "$app_path")"
  dest="/Applications/$app_name"

  # Remove both the current and the pre-rebrand install, if present.
  rm -rf "$dest" "/Applications/Ulanzi Plugin Store.app" "/Applications/Ulanzi Community Store.app"
  mv "$app_path" "$dest"

  # Defensive — curl downloads aren't quarantined, but strip the attribute
  # in case a future step in the chain (or a re-run) adds one.
  xattr -cr "$dest"

  echo "Installed. Launching ${app_name%.app}..."
  open "$dest"
}

# Convert a Unix-style path to a Windows path when possible (Git Bash / WSL).
to_win_path() {
  local path="$1"
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$path"
  elif command -v wslpath >/dev/null 2>&1; then
    wslpath -w "$path"
  else
    # Best-effort fallback (Git Bash often accepts /c/... paths).
    echo "$path"
  fi
}

launch_windows_exe() {
  local exe_path="$1"
  local win_path
  win_path="$(to_win_path "$exe_path")"

  # Prefer a real Windows launcher so the installer UI is not tied to this shell.
  if command -v cmd.exe >/dev/null 2>&1; then
    cmd.exe /c start "" "$win_path"
  elif command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "Start-Process -FilePath '$win_path'"
  else
    "$exe_path" &
  fi
}

download_and_run_windows_installer() {
  need_cmd curl

  local label="$1"
  local tmp_dir installer
  tmp_dir="$(mktemp -d)"
  # Don't delete the .exe on EXIT before the installer process can read it —
  # leave it in the temp dir; the OS will clean it later, or the next run overwrites.
  installer="$tmp_dir/UlanziPluginStore.exe"

  echo "Detected $label."
  echo "Downloading $WIN_URL"
  curl -fsSL "$WIN_URL" -o "$installer"

  # On WSL, put the installer on the Windows filesystem when possible so
  # Start-Process / cmd start can open it without interop path quirks.
  if [[ "$label" == "WSL" ]] && command -v wslpath >/dev/null 2>&1; then
    local win_temp win_installer
    win_temp="$(cmd.exe /c "echo %TEMP%" 2>/dev/null | tr -d '\r')"
    if [[ -n "$win_temp" ]]; then
      win_installer="$(wslpath -u "$win_temp")/UlanziPluginStore.exe"
      cp "$installer" "$win_installer"
      installer="$win_installer"
    fi
  fi

  echo "Launching Windows installer..."
  echo "Complete the installer wizard to finish setup."
  launch_windows_exe "$installer"
}

main() {
  case "$(os_family)" in
    macos)
      install_macos
      ;;
    windows)
      download_and_run_windows_installer "Windows"
      ;;
    wsl)
      download_and_run_windows_installer "WSL"
      ;;
    linux)
      echo "Linux is not supported yet. Download a desktop build from:" >&2
      echo "  https://github.com/$REPO/releases/latest" >&2
      exit 1
      ;;
    *)
      echo "Unsupported platform: $(uname -s 2>/dev/null || echo unknown)" >&2
      echo "Supported: macOS, Windows (Git Bash / MSYS / Cygwin), WSL." >&2
      echo "On Windows PowerShell, use:" >&2
      echo "  irm https://raw.githubusercontent.com/narlei/ulanzicommunitystore/main/install.ps1 | iex" >&2
      exit 1
      ;;
  esac
}

main "$@"
