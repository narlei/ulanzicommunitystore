# Downloads and launches the latest Ulanzi Community Store installer for Windows.
#
#   irm https://raw.githubusercontent.com/narlei/ulanzicommunitystore/main/install.ps1 | iex
#
# Prefer this on native PowerShell/cmd. If you have Git Bash, you can also use:
#
#   curl -fsSL https://raw.githubusercontent.com/narlei/ulanzicommunitystore/main/install.sh | bash
#
$ErrorActionPreference = 'Stop'

$repo = 'narlei/ulanzicommunitystore'
$url = "https://github.com/$repo/releases/latest/download/UlanziPluginStore.exe"
$out = Join-Path $env:TEMP 'UlanziPluginStore.exe'

Write-Host "Detected Windows."
Write-Host "Downloading $url"
Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing

Write-Host "Launching Windows installer..."
Write-Host "Complete the installer wizard to finish setup."
Start-Process -FilePath $out
