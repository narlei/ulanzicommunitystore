package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// Registro simples pluginId -> repo, para o /installed conseguir dizer a origem
// e o /update-all saber onde buscar a nova release. Fica em ~/.ulanzideck-store/installs.json.

var recordsMu sync.Mutex

func recordsPath() string {
	return filepath.Join(stateDir(), "installs.json")
}

func loadRecords() map[string]string {
	recordsMu.Lock()
	defer recordsMu.Unlock()
	m := map[string]string{}
	b, err := os.ReadFile(recordsPath())
	if err != nil {
		return m
	}
	_ = json.Unmarshal(b, &m)
	return m
}

func saveRecord(pluginID, repo string) {
	if repo == "" {
		return
	}
	recordsMu.Lock()
	defer recordsMu.Unlock()
	m := map[string]string{}
	if b, err := os.ReadFile(recordsPath()); err == nil {
		_ = json.Unmarshal(b, &m)
	}
	m[pluginID] = repo
	_ = ensureDir(stateDir())
	if b, err := json.MarshalIndent(m, "", "  "); err == nil {
		_ = os.WriteFile(recordsPath(), b, 0o644)
	}
}

func removeRecord(pluginID string) {
	recordsMu.Lock()
	defer recordsMu.Unlock()
	m := map[string]string{}
	if b, err := os.ReadFile(recordsPath()); err == nil {
		_ = json.Unmarshal(b, &m)
	}
	delete(m, pluginID)
	if b, err := json.MarshalIndent(m, "", "  "); err == nil {
		_ = os.WriteFile(recordsPath(), b, 0o644)
	}
}
