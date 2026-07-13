HOST ?= 127.0.0.1
PORT ?= 8123
# plugin-starter: patch | minor | major (or an explicit semver like 1.3.0)
BUMP ?= patch

.PHONY: run install app build typecheck catalog catalog_validate release marketing version publish-plugin-starter

run:
	npm install
	npm run sync:version
	node scripts/ensure-electron.mjs
	@test -n "$$(gh auth token 2>/dev/null)" || (echo "GitHub token nao encontrado. Rode: gh auth login" && exit 1)
	GH_TOKEN=$$(gh auth token) CATALOG_STRICT=1 npm run catalog:build
	npm run typecheck
	npm run app:build
	npm run app:open

install:
	npm install

app:
	npm run sync:version
	npm run app

build:
	npm run build

typecheck:
	npm run typecheck

catalog:
	@test -n "$$(gh auth token 2>/dev/null)" || (echo "GitHub token nao encontrado. Rode: gh auth login" && exit 1)
	GH_TOKEN=$$(gh auth token) npm run catalog:build

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

# Bump plugin-starter/package.json and publish to npm (public).
# Does not commit — commit the version bump afterwards if you want it tracked.
#
#   make publish-plugin-starter
#   make publish-plugin-starter BUMP=minor
#   make publish-plugin-starter BUMP=major
#   make publish-plugin-starter BUMP=1.3.0
#   make publish-plugin-starter OTP=123456
publish-plugin-starter:
	@set -e; \
	cd plugin-starter; \
	old=$$(node -p "require('./package.json').version"); \
	npm version $(BUMP) --no-git-tag-version; \
	new=$$(node -p "require('./package.json').version"); \
	echo "📦 Bumped ulanzi-plugin-starter $$old → $$new"; \
	npm publish --access public $(if $(OTP),--otp=$(OTP),); \
	echo "✅ Published ulanzi-plugin-starter@$$new"; \
	echo "   Remember to commit plugin-starter/package.json if needed."
