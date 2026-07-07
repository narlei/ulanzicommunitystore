package main

import (
	"net/url"
	"os"
	"strings"
)

const (
	helperVersion = "0.1.0"

	// Faixa de portas em 127.0.0.1 onde o helper tenta escutar. O site varre a mesma faixa.
	portBase  = 39273
	portCount = 5

	// App do UlanziDeck a reiniciar após instalar/remover.
	ulanziAppName = "Ulanzi Studio"
)

// URL do catalog.json publicado (fonte de verdade para o modo registry).
// Sobrescreva com HELPER_CATALOG_URL para dev/local.
const defaultCatalogURL = "https://ulanzipluginstore.narlei.com/catalog.json"

func catalogURL() string {
	if v := os.Getenv("HELPER_CATALOG_URL"); v != "" {
		return v
	}
	return defaultCatalogURL
}

// devMode libera instalar repos fora do registry (para o dev testar o próprio plugin).
func devMode() bool {
	v := strings.ToLower(os.Getenv("HELPER_DEV_MODE"))
	return v == "1" || v == "true" || v == "yes"
}

// allowedOrigins: origens de browser autorizadas a falar com o helper.
// Sempre inclui a origem que serve o catálogo + o que estiver em HELPER_ALLOWED_ORIGINS.
// Origens loopback (localhost/127.0.0.1, qualquer porta) são sempre liberadas (dev).
func explicitAllowedOrigins() map[string]bool {
	set := map[string]bool{}
	if u, err := url.Parse(catalogURL()); err == nil && u.Scheme != "" && u.Host != "" {
		set[u.Scheme+"://"+u.Host] = true
	}
	for _, o := range strings.Split(os.Getenv("HELPER_ALLOWED_ORIGINS"), ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			set[o] = true
		}
	}
	return set
}

func isLoopbackOrigin(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := u.Hostname()
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

// isAllowedOrigin decide se uma origem de browser pode acionar o helper.
func isAllowedOrigin(origin string) bool {
	if origin == "" {
		return false
	}
	if isLoopbackOrigin(origin) {
		return true
	}
	return explicitAllowedOrigins()[origin]
}
