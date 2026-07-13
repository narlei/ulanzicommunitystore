import { app, BrowserWindow, ipcMain, nativeImage, Notification, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions, isPluginId, isRepoSlug, type CatalogPlugin } from '@ulanzideck/catalog';
import { applyAppUpdate, checkAppUpdate } from './app-update.js';
import { fetchCatalog, installPlugin, listInstalled, uninstallPlugin } from './install.js';
import { getSettings, updateSettings } from './settings.js';
import { checkSubmission } from './submit.js';
import type { AppUpdateInfo } from '../shared.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTOCOL = 'ulanzicommunitystore';

let win: BrowserWindow | null = null;
let updateCheckInFlight: Promise<string[]> | null = null;
let lastUpdateIds: string[] = [];

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
    if (parsed.host !== 'install') return;
    const repo = parsed.searchParams.get('repo') || '';
    if (!isRepoSlug(repo)) return;

    focusWindow();
    const catalog = await fetchCatalog();
    const plugin = catalog.plugins.find((item) => item.repo.toLowerCase() === repo.toLowerCase());
    if (!plugin) return;

    await installPlugin(plugin, (progress) => win?.webContents.send('plugin:progress', progress));
    win?.webContents.send('installed:refresh');
    scheduleUpdateCheck();
  } catch {
    // Ignore malformed external links.
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
    const [catalog, installed] = await Promise.all([fetchCatalog(), listInstalled()]);
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

ipcMain.handle('catalog:get', () => fetchCatalog());
ipcMain.handle('installed:list', () => listInstalled());
ipcMain.handle('settings:get', () => getSettings());
ipcMain.handle('settings:developerMode', (_event, enabled: unknown) =>
  updateSettings({ developerMode: enabled === true }),
);

ipcMain.handle('plugin:install', (event, plugin: CatalogPlugin) =>
  installPlugin(plugin, (progress) => event.sender.send('plugin:progress', progress)).finally(() => {
    scheduleUpdateCheck();
  }),
);

ipcMain.handle('plugin:uninstall', async (_event, pluginId: unknown) => {
  if (typeof pluginId !== 'string' || !isPluginId(pluginId)) throw new Error('Invalid pluginId');
  await uninstallPlugin(pluginId);
  scheduleUpdateCheck();
  return { ok: true };
});

ipcMain.handle('updates:check', () => checkForUpdates({ notify: true }));

ipcMain.handle('appUpdate:check', async (_event, force: unknown) => pushAppUpdate(force === true));
ipcMain.handle('appUpdate:apply', () => applyAppUpdate());

ipcMain.handle('submit:check', (_event, repoInput: unknown) =>
  checkSubmission(typeof repoInput === 'string' ? repoInput : ''),
);

ipcMain.handle('shell:openExternal', async (_event, url: unknown) => {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) throw new Error('Invalid URL');
  await shell.openExternal(url);
});
