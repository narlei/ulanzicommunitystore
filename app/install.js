'use strict';
// Lógica de instalação (portada do helper Go): baixar release, extrair, mover pra
// pasta de Plugins, tirar quarantine e reiniciar o UlanziDeck. Roda no processo main.
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const AdmZip = require('adm-zip');
const { pluginsDir, ULANZI_APP } = require('./paths');

const CATALOG_URL =
  process.env.STORE_CATALOG_URL || 'https://ulanzipluginstore.narlei.com/catalog.json';

const UA = 'ulanzi-plugin-store/0.1.0';

async function fetchCatalog() {
  const res = await fetch(CATALOG_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`catálogo HTTP ${res.status}`);
  return res.json();
}

// Lista os plugins já instalados na pasta do UlanziDeck (id + versão do manifest).
async function listInstalled() {
  const dir = pluginsDir();
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory() || !e.name.endsWith('.ulanziPlugin')) continue;
    let version = null;
    try {
      const m = JSON.parse(await fsp.readFile(path.join(dir, e.name, 'manifest.json'), 'utf8'));
      version = m.Version || null;
    } catch {
      /* manifest ilegível — ainda listamos o plugin */
    }
    out.push({ pluginId: e.name, version });
  }
  return out;
}

async function installPlugin(cp, onProgress) {
  const p = (pct, msg) => onProgress && onProgress(pct, msg);
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'ustore-'));
  try {
    p(10, 'download');
    const zipPath = path.join(tmp, cp.id + '.zip');
    await download(cp.downloadUrl, zipPath);

    p(50, 'extract');
    new AdmZip(zipPath).extractAllTo(tmp, /* overwrite */ true);
    const src = path.join(tmp, cp.id);
    if (!fs.existsSync(src)) throw new Error(`zip com estrutura inesperada: falta ${cp.id}/`);

    p(75, 'install');
    const dir = pluginsDir();
    await fsp.mkdir(dir, { recursive: true });
    const dest = path.join(dir, cp.id);
    await fsp.rm(dest, { recursive: true, force: true });
    try {
      await fsp.rename(src, dest);
    } catch {
      // fallback: cópia (tmp e Plugins em volumes diferentes)
      await fsp.cp(src, dest, { recursive: true });
    }

    if (process.platform === 'darwin') {
      p(85, 'quarantine');
      await run('xattr', ['-dr', 'com.apple.quarantine', dest]).catch(() => {});
    }

    p(95, 'restart');
    await restartUlanzi();
    p(100, 'done');
    return { pluginId: cp.id, version: cp.version };
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

async function uninstallPlugin(pluginId) {
  if (!pluginId.endsWith('.ulanziPlugin') || /[\\/]/.test(pluginId)) {
    throw new Error('pluginId inválido');
  }
  await fsp.rm(path.join(pluginsDir(), pluginId), { recursive: true, force: true });
  await restartUlanzi();
}

// ---- helpers ---------------------------------------------------------------

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fsp.writeFile(dest, buf);
}

async function restartUlanzi() {
  if (process.env.STORE_SKIP_RESTART) return;
  if (process.platform === 'darwin') {
    await run('osascript', ['-e', `tell application "${ULANZI_APP}" to quit`]).catch(() => {});
    await sleep(1500);
    await run('pkill', ['-f', `/${ULANZI_APP}.app/`]).catch(() => {});
    await sleep(500);
    await run('open', ['-a', ULANZI_APP]).catch(() => {});
  } else if (process.platform === 'win32') {
    // TODO fase 2: taskkill /IM + start do executável do UlanziDeck
  }
}

function run(cmd, args) {
  return new Promise((resolve, reject) =>
    execFile(cmd, args, (err) => (err ? reject(err) : resolve()))
  );
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { fetchCatalog, listInstalled, installPlugin, uninstallPlugin, CATALOG_URL };
