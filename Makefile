HOST ?= 127.0.0.1
PORT ?= 8123

.PHONY: run install app build typecheck catalog catalog_validate release marketing version

run:
	npm install
	node scripts/ensure-electron.mjs
	@test -n "$$(gh auth token 2>/dev/null)" || (echo "GitHub token nao encontrado. Rode: gh auth login" && exit 1)
	GH_TOKEN=$$(gh auth token) CATALOG_STRICT=1 npm run catalog:build
	npm run typecheck
	npm run app:build
	npm run app:open

install:
	npm install

app:
	npm run app

build:
	npm run build

typecheck:
	npm run typecheck

catalog:
	npm run catalog:build

catalog_validate:
	npm run catalog:validate

release:
	npm run sync:version
	npm run app:dist

marketing:
	@echo "Marketing site: apps/marketing-site/index.html"
	python3 -m http.server $(PORT) --bind $(HOST) --directory apps/marketing-site

version:
	@cat VERSION
