# UlanziDeck Store

Loja **não-oficial e ágil** de plugins para Ulanzi Deck e Ulanzi Dial. Devs publicam
apontando o repositório; a loja lê o `manifest.json` e a release mais nova sozinha, e todo
update vira detecção automática.

> Projeto independente e não-oficial. Não é afiliado, endossado ou mantido pela Ulanzi.

## Como funciona

```
┌───────────────┐   fetch catalog.json   ┌──────────────────────┐
│  Site (PHP)   │ ─────────────────────► │  registry/ (PR)      │
│  public_html/ │                        │  → GitHub Action gera │
│               │   fetch 127.0.0.1      │    catalog.json       │
│   catálogo    │ ◄───────────────────►  └──────────────────────┘
└──────┬────────┘     (Helper local)
       │ botão Instalar
       ▼
┌───────────────┐   baixa release .zip do GitHub, extrai na pasta
│ Helper (Go)   │   ~/Library/Application Support/Ulanzi/UlanziDeck/Plugins
│ daemon local  │   e reinicia o Ulanzi Studio
└───────────────┘
```

Um navegador não pode escrever na pasta de Plugins, então um **Helper local** (binário Go
residente, servidor em `127.0.0.1`) faz a instalação. O site conversa com ele por HTTP local.

## Componentes

| Pasta | O quê |
|-------|-------|
| `public_html/` | Site PHP+HTML (sem build). Deploy Hostinger via push na `main`. |
| `registry/plugins/*.json` | Fonte da verdade. Dev abre PR com `{ "repo": "owner/repo" }`. |
| `scripts/build-catalog.mjs` | Gera `public_html/catalog.json` lendo os repos via API do GitHub. |
| `helper/` | Daemon Go: `/ping`, `/install`, `/installed`, `/status`, `/uninstall`. |
| `.github/workflows/` | `build-catalog` (regenera o catálogo) e `release-helper` (binários). |

## Desenvolvimento

```bash
# catálogo
GH_TOKEN=$(gh auth token) node scripts/build-catalog.mjs

# site
php -S 127.0.0.1:8123 -t public_html

# helper (aponta pro catálogo local, instala numa pasta de teste, sem reiniciar o app)
cd helper
HELPER_CATALOG_URL=http://127.0.0.1:8123/catalog.json \
HELPER_PLUGINS_DIR=/tmp/fake-plugins HELPER_SKIP_RESTART=1 \
  go run . run
```

### Variáveis do Helper

| Env | Efeito |
|-----|--------|
| `HELPER_CATALOG_URL` | URL do `catalog.json` (padrão: domínio da loja). |
| `HELPER_PLUGINS_DIR` | Sobrescreve a pasta de Plugins (testes/CI). |
| `HELPER_SKIP_RESTART` | Não reinicia o Ulanzi Studio (testes/CI). |
| `HELPER_DEV_MODE` | Permite instalar repos fora do registry (dev testando o próprio plugin). |
| `HELPER_ALLOWED_ORIGINS` | Origens extras autorizadas (além do domínio da loja e loopback). |

## Roadmap

- **MVP (feito):** registry + catálogo + site + Helper macOS + detecção de update.
- **Fase 2:** Windows, notificação proativa de updates, template repo + skill de IA de
  publicação, instaladores assinados/notarizados.

## Publicar um plugin

Veja [`registry/README.md`](registry/README.md).
