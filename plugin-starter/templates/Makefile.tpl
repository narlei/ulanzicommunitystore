PLUGIN_ID     := {{PLUGIN_ID}}.ulanziPlugin
INSTALL_BASE  := $(HOME)/Library/Application Support/Ulanzi/UlanziDeck/Plugins
INSTALL_DIR   := $(INSTALL_BASE)/$(PLUGIN_ID)
DIST_DIR      := dist
ZIP           := $(DIST_DIR)/$(PLUGIN_ID).zip
APP_NAME      := Ulanzi Studio

.PHONY: help package install restart clean bump_major bump_minor bump_patch

help:
	@echo "Available targets:"
	@echo "  make package     - Build a distributable ZIP at $(ZIP)"
	@echo "  make install     - Sync plugin + restart $(APP_NAME)"
	@echo "  make restart     - Restart $(APP_NAME) only"
	@echo "  make clean       - Remove $(DIST_DIR)/"
	@echo "  make bump_patch  - Bump patch version"

package: clean
	@mkdir -p $(DIST_DIR)
	@zip -r "$(ZIP)" "$(PLUGIN_ID)" -x "*.DS_Store"
	@echo "✅ $(ZIP) created."

install:
	@echo "→ Installing $(PLUGIN_ID) to $(INSTALL_DIR)..."
	@mkdir -p "$(INSTALL_BASE)"
	@rm -rf "$(INSTALL_DIR)"
	@ln -s "$(CURDIR)/$(PLUGIN_ID)" "$(INSTALL_DIR)"
	@$(MAKE) restart

APP_PROC      := /Applications/$(APP_NAME).app/

restart:
	@echo "→ Restarting $(APP_NAME)..."
	@osascript -e 'tell application "$(APP_NAME)" to quit' >/dev/null 2>&1 || true
	@for i in 1 2 3 4 5; do \
		pgrep -f "$(APP_PROC)" >/dev/null 2>&1 || break; \
		sleep 1; \
	done
	@pkill -f "$(APP_PROC)" >/dev/null 2>&1 || true
	@sleep 1
	@open -a "$(APP_NAME)" || echo "⚠️ Could not open $(APP_NAME). Please start it manually."

clean:
	@rm -rf $(DIST_DIR)

bump_major bump_minor bump_patch:
	@TYPE=$$(echo $@ | sed s/bump_//); \
	cd $(PLUGIN_ID) && npm version $$TYPE --no-git-tag-version --silent 2>/dev/null || echo "No package.json found inside plugin folder."; \
	node -e "\
		const fs = require('fs'); \
		const path = '$(PLUGIN_ID)/manifest.json'; \
		const m = JSON.parse(fs.readFileSync(path)); \
		const parts = m.Version.split('.'); \
		if ('$$TYPE' === 'major') { parts[0] = parseInt(parts[0]) + 1; parts[1] = 0; parts[2] = 0; } \
		else if ('$$TYPE' === 'minor') { parts[1] = parseInt(parts[1]) + 1; parts[2] = 0; } \
		else { parts[2] = parseInt(parts[2]) + 1; } \
		m.Version = parts.join('.'); \
		fs.writeFileSync(path, JSON.stringify(m, null, 2) + '\n'); \
		console.log('Bumped manifest.json to ' + m.Version); \
	"
