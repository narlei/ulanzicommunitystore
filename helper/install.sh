#!/bin/bash
# UlanziDeck Store Helper — bootstrap installer (macOS)
# Uso: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/narlei/ulanzipluginstore/main/helper/install.sh)"
set -euo pipefail

GITHUB_REPO="narlei/ulanzipluginstore"
BIN_NAME="ulanzideck-store-helper"
INSTALL_DIR="$HOME/.ulanzideck-store/bin"
BIN_PATH="$INSTALL_DIR/$BIN_NAME"

# ── cores ─────────────────────────────────────────────────────────────────────
tty_bold=''; tty_blue=''; tty_green=''; tty_yellow=''; tty_red=''; tty_reset=''
if [[ -t 1 ]]; then
  tty_bold=$'\033[1m'; tty_blue=$'\033[34m'; tty_green=$'\033[32m'
  tty_yellow=$'\033[33m'; tty_red=$'\033[31m'; tty_reset=$'\033[0m'
fi
step()  { echo "${tty_blue}==>${tty_reset} ${tty_bold}$*${tty_reset}"; }
ok()    { echo "${tty_green}  ✓${tty_reset} $*"; }
warn()  { echo "${tty_yellow}  !${tty_reset} $*"; }
abort() { echo "${tty_red}Erro:${tty_reset} $*" >&2; exit 1; }

# ── preflight ─────────────────────────────────────────────────────────────────
[[ "$(uname)" == "Darwin" ]] || abort "Por enquanto o Helper só suporta macOS."
case "$(uname -m)" in
  arm64)  ARCH="arm64" ;;
  x86_64) ARCH="amd64" ;;
  *)      abort "Arquitetura não suportada: $(uname -m)" ;;
esac
ASSET="${BIN_NAME}-darwin-${ARCH}"

# ── download do binário ───────────────────────────────────────────────────────
step "Baixando o Helper (${ARCH})..."
URL="https://github.com/${GITHUB_REPO}/releases/latest/download/${ASSET}"
HTTP_CODE=$(curl -fsSL -o /dev/null -w "%{http_code}" -L --max-redirs 5 "$URL" 2>/dev/null) || true
[[ "$HTTP_CODE" == "200" ]] || abort "Não consegui baixar $URL (HTTP $HTTP_CODE). A release do Helper já foi publicada?"

mkdir -p "$INSTALL_DIR"
curl -fsSL --progress-bar -L "$URL" -o "$BIN_PATH"
chmod +x "$BIN_PATH"
xattr -dr com.apple.quarantine "$BIN_PATH" 2>/dev/null || true
ok "Instalado em $BIN_PATH"

# ── registra o LaunchAgent (residência + auto-start) ──────────────────────────
step "Registrando o serviço em background..."
"$BIN_PATH" install-agent
ok "Serviço ativo"

echo ""
echo "${tty_bold}${tty_green}UlanziDeck Store Helper instalado!${tty_reset}"
echo "Agora volte pra loja e clique em ${tty_bold}Instalar${tty_reset} em qualquer plugin."
echo "Para remover: ${tty_bold}${BIN_PATH} uninstall-agent${tty_reset} e apague ${INSTALL_DIR%/bin}."
