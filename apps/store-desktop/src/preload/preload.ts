import { contextBridge, ipcRenderer } from 'electron';
import type { CatalogPlugin } from '@ulanzideck/catalog';
import type { InstallProgress } from '../shared.js';

contextBridge.exposeInMainWorld('api', {
  getCatalog: () => ipcRenderer.invoke('catalog:get'),
  listInstalled: () => ipcRenderer.invoke('installed:list'),
  install: (plugin: CatalogPlugin) => ipcRenderer.invoke('plugin:install', plugin),
  uninstall: (pluginId: string) => ipcRenderer.invoke('plugin:uninstall', pluginId),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setDeveloperMode: (enabled: boolean) => ipcRenderer.invoke('settings:developerMode', enabled),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  onProgress: (callback: (progress: InstallProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: InstallProgress) => callback(progress);
    ipcRenderer.on('plugin:progress', listener);
    return () => ipcRenderer.off('plugin:progress', listener);
  },
  onInstalledRefresh: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('installed:refresh', listener);
    return () => ipcRenderer.off('installed:refresh', listener);
  },
});
