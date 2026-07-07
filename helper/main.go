package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const launchAgentLabel = "com.narlei.ulanzideck-store-helper"

func main() {
	cmd := "run"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}
	switch cmd {
	case "run":
		runServer()
	case "install-agent":
		if err := installLaunchAgent(); err != nil {
			fmt.Fprintln(os.Stderr, "erro:", err)
			os.Exit(1)
		}
		fmt.Println("LaunchAgent instalado e carregado.")
	case "uninstall-agent":
		if err := uninstallLaunchAgent(); err != nil {
			fmt.Fprintln(os.Stderr, "erro:", err)
			os.Exit(1)
		}
		fmt.Println("LaunchAgent removido.")
	case "version":
		fmt.Println("ulanzideck-store-helper", helperVersion)
	default:
		fmt.Fprintf(os.Stderr, "uso: %s [run|install-agent|uninstall-agent|version]\n", os.Args[0])
		os.Exit(2)
	}
}

// bindLoopback tenta escutar na faixa de portas, só em 127.0.0.1.
func bindLoopback() (net.Listener, int, error) {
	for i := 0; i < portCount; i++ {
		port := portBase + i
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		if err == nil {
			return ln, port, nil
		}
	}
	return nil, 0, fmt.Errorf("nenhuma porta livre em %d..%d", portBase, portBase+portCount-1)
}

func runServer() {
	ln, port, err := bindLoopback()
	if err != nil {
		fmt.Fprintln(os.Stderr, "erro:", err)
		os.Exit(1)
	}
	// grava a porta ativa (diagnóstico; o site varre a faixa de qualquer forma)
	_ = ensureDir(stateDir())
	_ = os.WriteFile(filepath.Join(stateDir(), "port"), []byte(fmt.Sprintf("%d", port)), 0o644)

	srv := newServer()
	fmt.Printf("UlanziDeck Store Helper v%s ouvindo em http://127.0.0.1:%d (devMode=%v)\n",
		helperVersion, port, devMode())
	if err := http.Serve(ln, srv.routes()); err != nil {
		fmt.Fprintln(os.Stderr, "servidor parou:", err)
		os.Exit(1)
	}
}

// ---- LaunchAgent (macOS) --------------------------------------------------

func launchAgentPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Library", "LaunchAgents", launchAgentLabel+".plist")
}

func installLaunchAgent() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	exe, _ = filepath.Abs(exe)

	plist := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>%s</string>
    <key>ProgramArguments</key>
    <array>
        <string>%s</string>
        <string>run</string>
    </array>
%s    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>
`, launchAgentLabel, exe, launchAgentEnvXML())

	path := launchAgentPath()
	if err := ensureDir(filepath.Dir(path)); err != nil {
		return err
	}
	if err := os.WriteFile(path, []byte(plist), 0o644); err != nil {
		return err
	}
	// recarrega (ignora erro de "not loaded")
	_ = runCmd("launchctl", "unload", path)
	return runCmd("launchctl", "load", path)
}

// launchAgentEnvXML embute no plist as variáveis de config presentes no ambiente
// no momento do install-agent (o LaunchAgent roda destacado do shell).
func launchAgentEnvXML() string {
	keys := []string{"HELPER_CATALOG_URL", "HELPER_DEV_MODE", "HELPER_ALLOWED_ORIGINS", "HELPER_PLUGINS_DIR"}
	var b strings.Builder
	present := false
	for _, k := range keys {
		v := os.Getenv(k)
		if v == "" {
			continue
		}
		if !present {
			b.WriteString("    <key>EnvironmentVariables</key>\n    <dict>\n")
			present = true
		}
		fmt.Fprintf(&b, "        <key>%s</key>\n        <string>%s</string>\n", k, xmlEscape(v))
	}
	if present {
		b.WriteString("    </dict>\n")
	}
	return b.String()
}

func xmlEscape(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	return s
}

func uninstallLaunchAgent() error {
	path := launchAgentPath()
	_ = runCmd("launchctl", "unload", path)
	return os.Remove(path)
}
