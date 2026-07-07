package main

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type installedPlugin struct {
	PluginID string `json:"pluginId"`
	Version  string `json:"version"`
	Repo     string `json:"repo,omitempty"`
}

type manifestDoc struct {
	Name    string `json:"Name"`
	Version string `json:"Version"`
}

// listInstalled varre a pasta de Plugins e lê a versão de cada manifest.json.
func listInstalled() []installedPlugin {
	dir := pluginsDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		return []installedPlugin{}
	}
	records := loadRecords()
	out := []installedPlugin{}
	for _, e := range entries {
		if !e.IsDir() || !strings.HasSuffix(e.Name(), ".ulanziPlugin") {
			continue
		}
		ip := installedPlugin{PluginID: e.Name(), Repo: records[e.Name()]}
		manifestPath := filepath.Join(dir, e.Name(), "manifest.json")
		if b, err := os.ReadFile(manifestPath); err == nil {
			var m manifestDoc
			if json.Unmarshal(b, &m) == nil {
				ip.Version = m.Version
			}
		}
		out = append(out, ip)
	}
	return out
}

// installPlugin executa o fluxo completo e atualiza o job conforme avança.
func installPlugin(jobs *jobStore, jobID string, cp *catalogPlugin) {
	setMsg := func(p int, msg string) {
		jobs.update(jobID, func(j *job) { j.Progress = p; j.Message = msg })
	}
	fail := func(err error) {
		jobs.update(jobID, func(j *job) { j.State = jobError; j.Message = err.Error() })
	}

	if err := ensureDir(stateDir()); err != nil {
		fail(err)
		return
	}
	tmpDir, err := os.MkdirTemp(stateDir(), "install-")
	if err != nil {
		fail(err)
		return
	}
	defer os.RemoveAll(tmpDir)

	// 1) download
	setMsg(10, "Baixando…")
	zipPath := filepath.Join(tmpDir, cp.ID+".zip")
	if err := downloadFile(cp.DownloadURL, zipPath); err != nil {
		fail(fmt.Errorf("download falhou: %w", err))
		return
	}

	// 2) unzip
	setMsg(45, "Extraindo…")
	extractDir := filepath.Join(tmpDir, "unzipped")
	if err := unzip(zipPath, extractDir); err != nil {
		fail(fmt.Errorf("descompactar falhou: %w", err))
		return
	}
	srcPlugin := filepath.Join(extractDir, cp.ID)
	if st, err := os.Stat(srcPlugin); err != nil || !st.IsDir() {
		fail(fmt.Errorf("estrutura inesperada do zip: esperado %s/ na raiz", cp.ID))
		return
	}

	// 3) mover para a pasta de Plugins (substituindo versão antiga)
	setMsg(70, "Instalando…")
	if err := ensureDir(pluginsDir()); err != nil {
		fail(err)
		return
	}
	dest := filepath.Join(pluginsDir(), cp.ID)
	_ = os.RemoveAll(dest)
	if err := os.Rename(srcPlugin, dest); err != nil {
		// fallback: cópia (caso tmp e Plugins estejam em volumes diferentes)
		if err2 := copyTree(srcPlugin, dest); err2 != nil {
			fail(fmt.Errorf("mover falhou: %v / %v", err, err2))
			return
		}
	}

	// 4) tirar quarantine (binários não assinados)
	setMsg(85, "Liberando quarantine…")
	_ = exec.Command("xattr", "-dr", "com.apple.quarantine", dest).Run()

	// 5) registrar origem e reiniciar o app
	saveRecord(cp.ID, cp.Repo)
	setMsg(95, "Reiniciando "+ulanziAppName+"…")
	restartUlanzi()

	jobs.update(jobID, func(j *job) {
		j.State = jobDone
		j.Progress = 100
		j.Message = "Instalado " + cp.ID + " v" + cp.Version
	})
}

func uninstallPlugin(pluginID string) error {
	if pluginID == "" || strings.ContainsAny(pluginID, "/\\") || !strings.HasSuffix(pluginID, ".ulanziPlugin") {
		return fmt.Errorf("pluginId inválido")
	}
	dest := filepath.Join(pluginsDir(), pluginID)
	if err := os.RemoveAll(dest); err != nil {
		return err
	}
	removeRecord(pluginID)
	restartUlanzi()
	return nil
}

// ---- helpers de download/zip/copy ----------------------------------------

func downloadFile(url, dest string) error {
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "ulanzideck-store-helper/"+helperVersion)
	res, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return fmt.Errorf("HTTP %d", res.StatusCode)
	}
	f, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, io.LimitReader(res.Body, 200<<20)) // teto de 200MB
	return err
}

func unzip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()
	for _, f := range r.File {
		// proteção contra zip-slip
		target := filepath.Join(dest, f.Name)
		if !strings.HasPrefix(target, filepath.Clean(dest)+string(os.PathSeparator)) {
			return fmt.Errorf("caminho inseguro no zip: %s", f.Name)
		}
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			rc.Close()
			return err
		}
		_, err = io.Copy(out, rc)
		out.Close()
		rc.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

func copyTree(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(src, path)
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, info.Mode())
		}
		in, err := os.Open(path)
		if err != nil {
			return err
		}
		defer in.Close()
		out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, info.Mode())
		if err != nil {
			return err
		}
		defer out.Close()
		_, err = io.Copy(out, in)
		return err
	})
}

// restartUlanzi reinicia o app do UlanziDeck (best-effort, espelha o install.sh).
// HELPER_SKIP_RESTART=1 desliga (testes/CI).
func restartUlanzi() {
	if os.Getenv("HELPER_SKIP_RESTART") != "" {
		return
	}
	_ = exec.Command("osascript", "-e", fmt.Sprintf("tell application %q to quit", ulanziAppName)).Run()
	time.Sleep(1500 * time.Millisecond)
	_ = exec.Command("pkill", "-f", "/"+ulanziAppName+".app/").Run()
	time.Sleep(500 * time.Millisecond)
	_ = exec.Command("open", "-a", ulanziAppName).Run()
}
