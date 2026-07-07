HOST ?= 127.0.0.1
PORT ?= 8123

# URL do catálogo que o Helper vai usar. Local por padrão (precisa do `make run_local` no ar).
CATALOG_URL ?= http://$(HOST):$(PORT)/catalog.json
BIN_DIR := $(HOME)/.ulanzideck-store/bin
BIN := $(BIN_DIR)/ulanzideck-store-helper

.PHONY: run_local catalog helper_local install_helper uninstall_helper

# Sobe o site localmente em http://127.0.0.1:8123 (sem build, igual à Hostinger).
run_local:
	@echo "Site em http://$(HOST):$(PORT)  (Ctrl+C para parar)"
	php -S $(HOST):$(PORT) -t public_html

# Regenera public_html/catalog.json a partir do registry (precisa de gh logado).
catalog:
	GH_TOKEN=$$(gh auth token) node scripts/build-catalog.mjs

# Sobe o Helper em foreground apontando pro catálogo local, instalando numa pasta
# de teste e sem reiniciar o Ulanzi Studio (só pra experimentar, não persiste).
helper_local:
	cd helper && \
	HELPER_CATALOG_URL=$(CATALOG_URL) \
	HELPER_PLUGINS_DIR=/tmp/ulanzideck-fake-plugins \
	HELPER_SKIP_RESTART=1 \
	go run . run

# Instala o Helper DE VERDADE na sua máquina: compila, registra o LaunchAgent
# (residente, sobe sozinho) apontando pro catálogo local, e passa a instalar na
# pasta real do UlanziDeck. Requer `make run_local` no ar para os plugins.
install_helper:
	@mkdir -p $(BIN_DIR)
	cd helper && go build -o "$(BIN)" .
	HELPER_CATALOG_URL=$(CATALOG_URL) "$(BIN)" install-agent
	@echo ""
	@echo "Helper instalado e rodando. Catálogo: $(CATALOG_URL)"
	@echo "Deixe o site no ar com 'make run_local' para instalar plugins."

# Remove o LaunchAgent do Helper.
uninstall_helper:
	-"$(BIN)" uninstall-agent
	@echo "Helper removido. (binário em $(BIN_DIR) pode ser apagado)"
