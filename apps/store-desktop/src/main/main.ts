import { app, BrowserWindow, ipcMain, nativeImage, Notification, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions, isPluginId, isRepoSlug, type CatalogPlugin } from '@ulanzideck/catalog';
import { applyAppUpdate, checkAppUpdate } from './app-update.js';
import { fetchCatalog, installPlugin, listInstalled, restartUlanzi, uninstallPlugin, type InstallOptions } from './install.js';
import { logError, openErrorLog } from './logger.js';
import { fetchStoreCatalog } from './official-catalog.js';
import { getSettings, updateSettings } from './settings.js';
import { checkSubmission } from './submit.js';
import type { AppUpdateInfo } from '../shared.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTOCOL = 'ulanzicommunitystore';

let win: BrowserWindow | null = null;
let updateCheckInFlight: Promise<string[]> | null = null;
let lastUpdateIds: string[] = [];
// Repo slug from a `plugin` deep link that arrived before the renderer was
// ready to receive it. The renderer drains this on startup via `plugin:pendingOpen`.
let pendingOpenRepo: string | null = null;

function appIconPath(): string {
  return path.join(__dirname, '..', '..', 'build', 'icon.png');
}

function createWindow(): void {
  const isMac = process.platform === 'darwin';
  win = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    // On macOS the window is transparent so the native sidebar vibrancy
    // (frosted glass) shows through behind the renderer's sidebar.
    ...(isMac
      ? {
          vibrancy: 'sidebar' as const,
          visualEffectState: 'followWindow' as const,
          backgroundColor: '#00000000',
          trafficLightPosition: { x: 20, y: 18 },
        }
      : { backgroundColor: '#1e1e1e' }),
    title: 'Ulanzi Community Store',
    icon: appIconPath(),
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    void win.loadURL(devServer);
  } else {
    void win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => {
    win = null;
  });

  win.webContents.once('did-finish-load', () => {
    scheduleUpdateCheck();
    scheduleAppUpdateCheck();
  });
}

if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

async function handleDeepLink(url: string): Promise<void> {
  try {
    const parsed = new URL(url);
    const repo = parsed.searchParams.get('repo') || '';
    if (!isRepoSlug(repo)) return;

    // ulanzicommunitystore://plugin?repo=owner/name — surface the plugin's detail
    // in the app (shared from the website). No install; the user decides in-app.
    if (parsed.host === 'plugin') {
      focusWindow();
      pendingOpenRepo = repo;
      win?.webContents.send('plugin:open', repo);
      return;
    }

    if (parsed.host !== 'install') return;

    focusWindow();
    const catalog = await fetchCatalog();
    const plugin = catalog.plugins.find((item) => item.repo.toLowerCase() === repo.toLowerCase());
    if (!plugin) return;

    await installPlugin(plugin, (progress) => win?.webContents.send('plugin:progress', progress));
    win?.webContents.send('installed:refresh');
    scheduleUpdateCheck();
  } catch (err) {
    await logError(`deepLink:install (${url})`, err);
  }
}

/** Logs the technical detail of any failure surfaced to the user before rethrowing it unchanged. */
async function withErrorLog<T>(context: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    await logError(context, err);
    throw err;
  }
}

function focusWindow(): void {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
}

function sameUpdateIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function badgeOverlay(count: number): Electron.NativeImage {
  const label = count > 99 ? '99+' : String(count);
  const fontSize = label.length > 2 ? 34 : label.length > 1 ? 40 : 46;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <circle cx="84" cy="44" r="40" fill="#ff3b30"/>
      <circle cx="84" cy="44" r="36" fill="#ff3b30" stroke="white" stroke-width="6"/>
      <text x="84" y="58" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="${fontSize}" font-weight="700" fill="white">${label}</text>
    </svg>
  `;
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

function updateAppBadge(count: number): void {
  app.setBadgeCount(count);
  if (process.platform === 'darwin') {
    app.dock?.setBadge(count > 0 ? String(count) : '');
  } else if (process.platform === 'win32') {
    if (win && !win.isDestroyed()) {
      win.setOverlayIcon(count > 0 ? badgeOverlay(count) : null, count > 0 ? `${count} updates available` : '');
    }
  }
}

function notifyUpdates(updates: CatalogPlugin[]): void {
  if (!updates.length || !Notification.isSupported()) return;
  new Notification({
    title: 'Ulanzi Community Store',
    body:
      updates.length === 1
        ? `Update available: ${updates[0].name}`
        : `${updates.length} plugins have updates available`,
  }).show();
}

async function checkForUpdates({ notify = false } = {}): Promise<string[]> {
  if (updateCheckInFlight) return updateCheckInFlight;
  updateCheckInFlight = (async () => {
    const [catalog, installed] = await Promise.all([fetchStoreCatalog(), listInstalled()]);
    const byId = new Map(installed.map((item) => [item.pluginId, item.version]));
    const updates = catalog.plugins.filter((plugin) => {
      const current = byId.get(plugin.id);
      return current && compareVersions(plugin.version, current) > 0;
    });
    const updateIds = updates.map((plugin) => plugin.id).sort();
    const changed = !sameUpdateIds(updateIds, lastUpdateIds);

    lastUpdateIds = updateIds;
    updateAppBadge(updateIds.length);
    if (changed) win?.webContents.send('updates:changed', updateIds);
    if (notify) notifyUpdates(updates);

    return updateIds;
  })();
  try {
    return await updateCheckInFlight;
  } finally {
    updateCheckInFlight = null;
  }
}

function scheduleUpdateCheck(): void {
  void checkForUpdates().catch(() => {
    // Keep focus/activation checks silent when the remote catalog is unavailable.
  });
}

async function pushAppUpdate(force = false): Promise<AppUpdateInfo> {
  const info = await checkAppUpdate({ force });
  win?.webContents.send('appUpdate:changed', info);
  return info;
}

function scheduleAppUpdateCheck(force = false): void {
  void pushAppUpdate(force).catch(() => {
    // Silent when GitHub is unreachable.
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (url) void handleDeepLink(url);
    else focusWindow();
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    void handleDeepLink(url);
  });

  app.whenReady().then(() => {
    app.setAboutPanelOptions({
      applicationName: 'Ulanzi Community Store',
      credits: 'The open-source community store for Ulanzi Deck & Dial plugins.\nMade by the community — unofficial project, not affiliated with Ulanzi.',
      website: 'https://ulanzicommunitystore.narlei.com',
    });
    if (process.platform === 'darwin') {
      app.dock?.setIcon(nativeImage.createFromPath(appIconPath()));
    }
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      scheduleUpdateCheck();
      scheduleAppUpdateCheck();
    });
    const url = process.argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (url) win?.webContents.once('did-finish-load', () => void handleDeepLink(url));
  });

  app.on('browser-window-focus', () => {
    scheduleUpdateCheck();
    scheduleAppUpdateCheck();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

ipcMain.handle('plugin:pendingOpen', () => {
  const repo = pendingOpenRepo;
  pendingOpenRepo = null;
  return repo;
});

ipcMain.handle('catalog:get', () => withErrorLog('catalog:get', () => fetchStoreCatalog()));
ipcMain.handle('installed:list', () => withErrorLog('installed:list', () => listInstalled()));
ipcMain.handle('settings:get', () => getSettings());
ipcMain.handle('settings:developerMode', (_event, enabled: unknown) =>
  updateSettings({ developerMode: enabled === true }),
);
ipcMain.handle('settings:officialCatalog', (_event, enabled: unknown) =>
  updateSettings({ officialCatalog: enabled === true }),
);

ipcMain.handle('plugin:install', (event, plugin: CatalogPlugin, options?: InstallOptions) =>
  withErrorLog(`plugin:install (${plugin?.id})`, () =>
    installPlugin(plugin, (progress) => event.sender.send('plugin:progress', progress), {
      skipRestart: options?.skipRestart === true,
    }).finally(() => {
      scheduleUpdateCheck();
    }),
  ),
);

ipcMain.handle('studio:restart', async () => {
  await withErrorLog('studio:restart', () => restartUlanzi());
  return { ok: true };
});

ipcMain.handle('plugin:uninstall', async (event, pluginId: unknown) => {
  if (typeof pluginId !== 'string' || !isPluginId(pluginId)) throw new Error('Invalid pluginId');
  await withErrorLog(`plugin:uninstall (${pluginId})`, () =>
    uninstallPlugin(pluginId, (progress) => event.sender.send('plugin:progress', progress)),
  );
  scheduleUpdateCheck();
  return { ok: true };
});

ipcMain.handle('updates:check', () => checkForUpdates({ notify: true }));

ipcMain.handle('appUpdate:check', async (_event, force: unknown) => pushAppUpdate(force === true));
ipcMain.handle('appUpdate:apply', () => applyAppUpdate());

ipcMain.handle('submit:check', (_event, repoInput: unknown) =>
  withErrorLog(`submit:check (${repoInput})`, () =>
    checkSubmission(typeof repoInput === 'string' ? repoInput : ''),
  ),
);

ipcMain.handle('logs:open', () => withErrorLog('logs:open', () => openErrorLog()));

ipcMain.handle('shell:openExternal', async (_event, url: unknown) => {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) throw new Error('Invalid URL');
  await shell.openExternal(url);
});
