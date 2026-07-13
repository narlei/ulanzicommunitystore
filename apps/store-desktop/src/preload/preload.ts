import { contextBridge, ipcRenderer } from 'electron';
import type { CatalogPlugin } from '@ulanzideck/catalog';
import type { AppUpdateInfo, InstallProgress } from '../shared.js';

contextBridge.exposeInMainWorld('api', {
  getCatalog: () => ipcRenderer.invoke('catalog:get'),
  listInstalled: () => ipcRenderer.invoke('installed:list'),
  install: (plugin: CatalogPlugin) => ipcRenderer.invoke('plugin:install', plugin),
  uninstall: (pluginId: string) => ipcRenderer.invoke('plugin:uninstall', pluginId),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  checkAppUpdate: (force?: boolean) => ipcRenderer.invoke('appUpdate:check', force === true),
  applyAppUpdate: () => ipcRenderer.invoke('appUpdate:apply'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setDeveloperMode: (enabled: boolean) => ipcRenderer.invoke('settings:developerMode', enabled),
  checkSubmission: (repoInput: string) => ipcRenderer.invoke('submit:check', repoInput),
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
  onUpdatesChanged: (callback: (pluginIds: string[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, pluginIds: string[]) => callback(pluginIds);
    ipcRenderer.on('updates:changed', listener);
    return () => ipcRenderer.off('updates:changed', listener);
  },
  onAppUpdateChanged: (callback: (info: AppUpdateInfo) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: AppUpdateInfo) => callback(info);
    ipcRenderer.on('appUpdate:changed', listener);
    return () => ipcRenderer.off('appUpdate:changed', listener);
  },
});
