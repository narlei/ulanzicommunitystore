package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// catalogPlugin é o subconjunto do catalog.json que o helper precisa para instalar.
type catalogPlugin struct {
	ID          string `json:"id"`
	Repo        string `json:"repo"`
	Version     string `json:"version"`
	DownloadURL string `json:"downloadUrl"`
}

type catalogDoc struct {
	Plugins []catalogPlugin `json:"plugins"`
}

var httpClient = &http.Client{Timeout: 30 * time.Second}

func fetchCatalog() (*catalogDoc, error) {
	req, _ := http.NewRequest("GET", catalogURL(), nil)
	req.Header.Set("User-Agent", "ulanzideck-store-helper/"+helperVersion)
	res, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("não consegui baixar o catálogo: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return nil, fmt.Errorf("catálogo respondeu HTTP %d", res.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	if err != nil {
		return nil, err
	}
	var doc catalogDoc
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil, fmt.Errorf("catálogo inválido: %w", err)
	}
	return &doc, nil
}

// resolvePlugin encontra o plugin a instalar a partir do slug do repo.
// Modo registry: precisa estar no catálogo. Modo dev: resolve direto do GitHub.
func resolvePlugin(repo string) (*catalogPlugin, error) {
	repo = strings.TrimSpace(repo)
	if !strings.Contains(repo, "/") {
		return nil, fmt.Errorf("repo inválido (esperado owner/repo)")
	}

	doc, err := fetchCatalog()
	if err == nil {
		for i := range doc.Plugins {
			if strings.EqualFold(doc.Plugins[i].Repo, repo) {
				return &doc.Plugins[i], nil
			}
		}
	}

	if !devMode() {
		if err != nil {
			return nil, fmt.Errorf("repo fora do registry e catálogo indisponível: %w", err)
		}
		return nil, errNotInRegistry
	}

	// Dev-mode: resolve a release mais nova direto na API do GitHub.
	return resolveFromGitHub(repo)
}

var errNotInRegistry = fmt.Errorf("repo não está no registry da loja")

type ghRelease struct {
	TagName string `json:"tag_name"`
	Assets  []struct {
		Name string `json:"name"`
		URL  string `json:"browser_download_url"`
	} `json:"assets"`
}

func resolveFromGitHub(repo string) (*catalogPlugin, error) {
	url := "https://api.github.com/repos/" + repo + "/releases/latest"
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "ulanzideck-store-helper/"+helperVersion)
	req.Header.Set("Accept", "application/vnd.github+json")
	res, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return nil, fmt.Errorf("GitHub respondeu HTTP %d para %s", res.StatusCode, repo)
	}
	var rel ghRelease
	if err := json.NewDecoder(res.Body).Decode(&rel); err != nil {
		return nil, err
	}
	for _, a := range rel.Assets {
		if strings.HasSuffix(a.Name, ".ulanziPlugin.zip") {
			id := strings.TrimSuffix(a.Name, ".zip")
			return &catalogPlugin{
				ID:          id,
				Repo:        repo,
				Version:     strings.TrimPrefix(rel.TagName, "v"),
				DownloadURL: a.URL,
			}, nil
		}
	}
	return nil, fmt.Errorf("release mais nova de %s não tem asset *.ulanziPlugin.zip", repo)
}
