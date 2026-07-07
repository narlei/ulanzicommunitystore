package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"runtime"
)

type server struct {
	jobs *jobStore
}

func newServer() *server {
	return &server{jobs: newJobStore()}
}

func (s *server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/ping", s.withCORS(s.handlePing))
	mux.HandleFunc("/installed", s.withCORS(s.handleInstalled))
	mux.HandleFunc("/install", s.withCORS(s.handleInstall))
	mux.HandleFunc("/status", s.withCORS(s.handleStatus))
	mux.HandleFunc("/uninstall", s.withCORS(s.handleUninstall))
	return mux
}

// withCORS aplica a política de origem e responde preflight.
func (s *server) withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if origin != "" {
			// Requisição de browser: só passa se a origem for autorizada.
			if !isAllowedOrigin(origin) {
				http.Error(w, "origin não autorizada", http.StatusForbidden)
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Max-Age", "600")
			// Private Network Access (Chrome): páginas https públicas chamando o
			// loopback exigem este header no preflight, senão a request é bloqueada.
			if r.Header.Get("Access-Control-Request-Private-Network") == "true" {
				w.Header().Set("Access-Control-Allow-Private-Network", "true")
			}
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func (s *server) handlePing(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]any{
		"ok":            true,
		"helperVersion": helperVersion,
		"os":            runtime.GOOS,
		"devMode":       devMode(),
	})
}

func (s *server) handleInstalled(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]any{"plugins": listInstalled()})
}

func (s *server) handleInstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "método não permitido", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Repo string `json:"repo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Repo == "" {
		writeJSON(w, 400, map[string]string{"error": "campo 'repo' obrigatório"})
		return
	}

	cp, err := resolvePlugin(body.Repo)
	if err != nil {
		if errors.Is(err, errNotInRegistry) {
			writeJSON(w, 403, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, 502, map[string]string{"error": err.Error()})
		return
	}

	j := s.jobs.create()
	go installPlugin(s.jobs, j.ID, cp)
	writeJSON(w, 202, map[string]string{"jobId": j.ID})
}

func (s *server) handleStatus(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("job")
	j, ok := s.jobs.get(id)
	if !ok {
		writeJSON(w, 404, map[string]string{"error": "job não encontrado"})
		return
	}
	writeJSON(w, 200, j)
}

func (s *server) handleUninstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "método não permitido", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		PluginID string `json:"pluginId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.PluginID == "" {
		writeJSON(w, 400, map[string]string{"error": "campo 'pluginId' obrigatório"})
		return
	}
	if err := uninstallPlugin(body.PluginID); err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}
