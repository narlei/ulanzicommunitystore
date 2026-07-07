'use strict';
const { app, BrowserWindow, ipcMain, Notification, shell } = require('electron');
const path = require('path');
const {
  fetchCatalog,
  listInstalled,
  installPlugin,
  uninstallPlugin,
} = require('./install');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1120,
    height: 800,
    minWidth: 380,
    minHeight: 480,
    backgroundColor: '#0f1114',
    title: 'Ulanzi Plugin Store',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Links externos abrem no navegador padrão, não numa janela do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---- IPC ------------------------------------------------------------------

ipcMain.handle('catalog:get', () => fetchCatalog());
ipcMain.handle('installed:list', () => listInstalled());
ipcMain.handle('plugin:uninstall', (_evt, id) => uninstallPlugin(id));

ipcMain.handle('plugin:install', (evt, cp) =>
  installPlugin(cp, (pct, msg) =>
    evt.sender.send('plugin:progress', { id: cp.id, pct, msg })
  )
);

// Checagem proativa de updates → notificação nativa.
ipcMain.handle('updates:check', async () => {
  const [cat, installed] = await Promise.all([fetchCatalog(), listInstalled()]);
  const byId = Object.fromEntries(installed.map((i) => [i.pluginId, i.version]));
  const updates = cat.plugins.filter(
    (p) => byId[p.id] && cmpVersion(p.version, byId[p.id]) > 0
  );
  if (updates.length && Notification.isSupported()) {
    new Notification({
      title: 'Ulanzi Plugin Store',
      body:
        updates.length === 1
          ? `Update disponível: ${updates[0].name}`
          : `${updates.length} plugins com update disponível`,
    }).show();
  }
  return updates.map((p) => p.id);
});

function cmpVersion(a, b) {
  const pa = String(a).split(/[^\d]+/).filter(Boolean).map(Number);
  const pb = String(b).split(/[^\d]+/).filter(Boolean).map(Number);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}
