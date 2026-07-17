import AdmZip from 'adm-zip';
import { app } from 'electron';
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Catalog, CatalogPlugin, InstalledPlugin } from '@ulanzideck/catalog';
import { isPluginId } from '@ulanzideck/catalog';
import type { InstallProgress } from '../shared.js';
import { pluginsDir, ULANZI_APP } from './paths.js';

// Published by .github/workflows/publish-catalog.yml on every registry change.
const DEFAULT_CATALOG_URL = 'https://narlei.github.io/ulanzicommunitystore/catalog.json';

export const CATALOG_URL =
  process.env.STORE_CATALOG_URL || (app.isPackaged ? DEFAULT_CATALOG_URL : '');

const UA = 'ulanzi-plugin-store/0.1.0';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function fetchCatalog(): Promise<Catalog> {
  if (!CATALOG_URL) return readLocalCatalog();

  const res = await fetch(CATALOG_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Catalog HTTP ${res.status}`);
  const catalog = (await res.json()) as Catalog;
  return normalizeCatalog(catalog);
}

async function readLocalCatalog(): Promise<Catalog> {
  const candidates = [
    process.env.STORE_CATALOG_FILE,
    path.resolve(process.cwd(), 'dist/catalog/catalog.json'),
    path.resolve(process.cwd(), '../../dist/catalog/catalog.json'),
    path.resolve(__dirname, '../../../catalog/catalog.json'),
  ].filter(Boolean) as string[];

  for (const file of candidates) {
    try {
      const catalog = JSON.parse(await fsp.readFile(file, 'utf8')) as Catalog;
      return normalizeCatalog(catalog);
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error(`Local catalog not found. Run "npm run catalog:build" or set STORE_CATALOG_FILE.`);
}

function normalizeCatalog(catalog: Catalog): Catalog {
  if (!catalog || !Array.isArray(catalog.plugins)) {
    throw new Error('Catalog format is invalid');
  }
  return catalog;
}

export async function listInstalled(): Promise<InstalledPlugin[]> {
  const dir = pluginsDir();
  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: InstalledPlugin[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isPluginId(entry.name)) continue;
    let version: string | null = null;
    try {
      const manifest = JSON.parse(await fsp.readFile(path.join(dir, entry.name, 'manifest.json'), 'utf8')) as {
        Version?: string;
      };
      version = manifest.Version || null;
    } catch {
      // Keep listing plugins with unreadable manifests so users can remove them.
    }
    out.push({ pluginId: entry.name, version });
  }
  return out;
}

export type InstallOptions = {
  /** Skip the Ulanzi Studio restart (batch installs restart once at the end). */
  skipRestart?: boolean;
};

export async function installPlugin(
  plugin: CatalogPlugin,
  onProgress?: (progress: InstallProgress) => void,
  options: InstallOptions = {},
): Promise<InstalledPlugin> {
  assertCatalogPlugin(plugin);
  const progress = (pct: number, msg: string) => onProgress?.({ id: plugin.id, pct, msg });
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'ustore-'));

  try {
    progress(10, 'download');
    const zipPath = path.join(tmp, `${plugin.id}.zip`);
    await download(plugin.downloadUrl, zipPath);

    progress(45, 'validate');
    const zip = new AdmZip(zipPath);
    validateZipEntries(zip, plugin.id);

    progress(55, 'extract');
    zip.extractAllTo(tmp, true);
    const src = path.join(tmp, plugin.id);
    const manifestPath = path.join(src, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Unexpected zip structure: missing ${plugin.id}/manifest.json`);
    }

    progress(75, 'install');
    const dir = pluginsDir();
    await fsp.mkdir(dir, { recursive: true });
    const dest = safePluginPath(dir, plugin.id);
    await fsp.rm(dest, { recursive: true, force: true });
    try {
      await fsp.rename(src, dest);
    } catch {
      await fsp.cp(src, dest, { recursive: true });
      await fsp.rm(src, { recursive: true, force: true }).catch(() => {});
    }

    if (process.platform === 'darwin') {
      progress(88, 'quarantine');
      await run('xattr', ['-dr', 'com.apple.quarantine', dest]).catch(() => {});
    }

    if (!options.skipRestart) {
      progress(95, 'restart');
      await restartUlanzi();
    }
    progress(100, 'done');
    return { pluginId: plugin.id, version: plugin.version };
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

export async function uninstallPlugin(
  pluginId: string,
  onProgress?: (progress: InstallProgress) => void,
): Promise<void> {
  if (!isPluginId(pluginId)) throw new Error('Invalid pluginId');
  const progress = (pct: number, msg: string) => onProgress?.({ id: pluginId, pct, msg });
  progress(35, 'remove');
  await fsp.rm(safePluginPath(pluginsDir(), pluginId), { recursive: true, force: true });
  progress(80, 'restart');
  await restartUlanzi();
  progress(100, 'done');
}

// GitHub for community plugins; Ulanzi's own CDN/static hosts for official-catalog plugins.
const TRUSTED_DOWNLOAD_HOSTS = [/^https:\/\/github\.com\//, /^https:\/\/([a-z0-9-]+\.)*ulanzistudio\.com\//];

function assertCatalogPlugin(plugin: CatalogPlugin): void {
  if (!plugin || !isPluginId(plugin.id)) {
    throw new Error(`Invalid plugin id: "${plugin?.id}" doesn't match the expected com.<author>.<name>.ulanziPlugin format`);
  }
  if (!plugin.downloadUrl || !TRUSTED_DOWNLOAD_HOSTS.some((host) => host.test(plugin.downloadUrl))) {
    throw new Error(`Invalid download URL "${plugin.downloadUrl}": not hosted on a trusted domain (github.com or *.ulanzistudio.com)`);
  }
}

// Harmless clutter added by macOS's Finder/zip (AppleDouble resource forks and Finder
// metadata) that ships in some plugin releases built on a Mac. Not part of the plugin.
function isMacMetadataEntry(name: string): boolean {
  return name === '__MACOSX' || name.startsWith('__MACOSX/') || name === '.DS_Store' || name.endsWith('/.DS_Store');
}

function validateZipEntries(zip: AdmZip, pluginId: string): void {
  const prefix = `${pluginId}/`;
  let hasRoot = false;
  let hasManifest = false;

  for (const entry of zip.getEntries()) {
    const name = entry.entryName.replace(/\\/g, '/');
    if (isMacMetadataEntry(name)) continue;

    if (name.startsWith('/')) {
      throw new Error(`Unsafe zip entry "${entry.entryName}": absolute path`);
    }
    if (/^[A-Za-z]:\//.test(name)) {
      throw new Error(`Unsafe zip entry "${entry.entryName}": Windows drive-letter path`);
    }
    if (name.split('/').includes('..')) {
      throw new Error(`Unsafe zip entry "${entry.entryName}": path traversal ("..")`);
    }
    if (!name.startsWith(prefix)) {
      throw new Error(`Unsafe zip entry "${entry.entryName}": outside the expected "${prefix}" folder`);
    }

    if (name === prefix) hasRoot = true;
    if (name === `${prefix}manifest.json`) hasManifest = true;
  }

  if (
    !hasRoot &&
    !zip
      .getEntries()
      .some((entry) => !isMacMetadataEntry(entry.entryName.replace(/\\/g, '/')) && entry.entryName.startsWith(prefix))
  ) {
    throw new Error(`Unexpected zip structure: no "${prefix}" top-level folder found in the archive`);
  }
  if (!hasManifest) {
    throw new Error(`Unexpected zip structure: "${prefix}manifest.json" is missing from the archive`);
  }
}

function safePluginPath(root: string, pluginId: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedDest = path.resolve(resolvedRoot, pluginId);
  if (!resolvedDest.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Resolved plugin path escapes plugins directory');
  }
  return resolvedDest;
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fsp.writeFile(dest, buf);
}

export async function restartUlanzi(): Promise<void> {
  if (process.env.STORE_SKIP_RESTART) return;
  if (process.platform === 'darwin') {
    await run('osascript', ['-e', `tell application "${ULANZI_APP}" to quit`]).catch(() => {});
    await sleep(1500);
    await run('pkill', ['-f', `/${ULANZI_APP}.app/`]).catch(() => {});
    await sleep(500);
    await run('open', ['-a', ULANZI_APP]).catch(() => {});
  } else if (process.platform === 'win32') {
    // Capture the exe path from the running process before killing it,
    // so the Studio comes back up instead of staying dead.
    const exePath = await windowsStudioExePath();
    await run('taskkill', ['/IM', `${ULANZI_APP}.exe`, '/F']).catch(() => {});
    if (exePath) {
      await sleep(800);
      try {
        const child = spawn(exePath, [], { detached: true, stdio: 'ignore' });
        child.unref();
      } catch {
        // Leave the Studio closed rather than fail the install.
      }
    }
  }
}

async function windowsStudioExePath(): Promise<string | null> {
  try {
    const out = await runCapture('powershell', [
      '-NoProfile',
      '-Command',
      `(Get-Process -Name '${ULANZI_APP}' -ErrorAction SilentlyContinue | Select-Object -First 1).Path`,
    ]);
    const exePath = out.trim();
    return exePath || null;
  } catch {
    return null;
  }
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err) => (err ? reject(err) : resolve()));
  });
}

function runCapture(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err, stdout) => (err ? reject(err) : resolve(stdout)));
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
