import { app, BrowserWindow, ipcMain, nativeImage, Notification, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions, isPluginId, isRepoSlug, type CatalogPlugin } from '@ulanzideck/catalog';
import { fetchCatalog, installPlugin, listInstalled, uninstallPlugin } from './install.js';
import { getSettings, updateSettings } from './settings.js';
import { checkSubmission } from './submit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTOCOL = 'ulanzipluginstore';

let win: BrowserWindow | null = null;

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
    title: 'Ulanzi Plugin Store',
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
  } catch {
    // Ignore malformed external links.
  }
}

function focusWindow(): void {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
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
    if (process.platform === 'darwin') {
      app.dock?.setIcon(nativeImage.createFromPath(appIconPath()));
    }
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    const url = process.argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (url) win?.webContents.once('did-finish-load', () => void handleDeepLink(url));
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
  installPlugin(plugin, (progress) => event.sender.send('plugin:progress', progress)),
);

ipcMain.handle('plugin:uninstall', async (_event, pluginId: unknown) => {
  if (typeof pluginId !== 'string' || !isPluginId(pluginId)) throw new Error('Invalid pluginId');
  await uninstallPlugin(pluginId);
  return { ok: true };
});

ipcMain.handle('updates:check', async () => {
  const [catalog, installed] = await Promise.all([fetchCatalog(), listInstalled()]);
  const byId = new Map(installed.map((item) => [item.pluginId, item.version]));
  const updates = catalog.plugins.filter((plugin) => {
    const current = byId.get(plugin.id);
    return current && compareVersions(plugin.version, current) > 0;
  });

  if (updates.length && Notification.isSupported()) {
    new Notification({
      title: 'Ulanzi Plugin Store',
      body:
        updates.length === 1
          ? `Update available: ${updates[0].name}`
          : `${updates.length} plugins have updates available`,
    }).show();
  }
  return updates.map((plugin) => plugin.id);
});

ipcMain.handle('submit:check', (_event, repoInput: unknown) =>
  checkSubmission(typeof repoInput === 'string' ? repoInput : ''),
);

ipcMain.handle('shell:openExternal', async (_event, url: unknown) => {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) throw new Error('Invalid URL');
  await shell.openExternal(url);
});
