'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// API segura exposta ao renderer (sem nodeIntegration).
contextBridge.exposeInMainWorld('api', {
  getCatalog: () => ipcRenderer.invoke('catalog:get'),
  listInstalled: () => ipcRenderer.invoke('installed:list'),
  install: (cp) => ipcRenderer.invoke('plugin:install', cp),
  uninstall: (id) => ipcRenderer.invoke('plugin:uninstall', id),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  onProgress: (cb) =>
    ipcRenderer.on('plugin:progress', (_e, data) => cb(data)),
});
