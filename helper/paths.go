package main

import (
	"os"
	"path/filepath"
)

// pluginsDir é onde o UlanziDeck lê os plugins instalados (macOS).
// Pode ser sobrescrito com HELPER_PLUGINS_DIR (útil para testes/CI e configs futuras).
func pluginsDir() string {
	if v := os.Getenv("HELPER_PLUGINS_DIR"); v != "" {
		return v
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Library", "Application Support", "Ulanzi", "UlanziDeck", "Plugins")
}

// stateDir guarda dados do helper (tmp de download, registro de origem dos plugins).
func stateDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".ulanzideck-store")
}

func ensureDir(p string) error {
	return os.MkdirAll(p, 0o755)
}
