/// <reference types="vite/client" />

import type { Catalog, CatalogPlugin, InstalledPlugin } from '@ulanzideck/catalog';
import type { AppUpdateInfo, InstallProgress, Settings, SubmitCheckResult } from '../shared';

declare global {
  interface Window {
    api: {
      getCatalog: () => Promise<Catalog>;
      listInstalled: () => Promise<InstalledPlugin[]>;
      install: (plugin: CatalogPlugin, options?: { skipRestart?: boolean }) => Promise<InstalledPlugin>;
      uninstall: (pluginId: string) => Promise<{ ok: true }>;
      restartStudio: () => Promise<{ ok: true }>;
      checkUpdates: () => Promise<string[]>;
      checkAppUpdate: (force?: boolean) => Promise<AppUpdateInfo>;
      applyAppUpdate: () => Promise<{ ok: true; mode: AppUpdateInfo['applyMode'] }>;
      getSettings: () => Promise<Settings>;
      setDeveloperMode: (enabled: boolean) => Promise<Settings>;
      checkSubmission: (repoInput: string) => Promise<SubmitCheckResult>;
      openExternal: (url: string) => Promise<void>;
      onProgress: (callback: (progress: InstallProgress) => void) => () => void;
      onInstalledRefresh: (callback: () => void) => () => void;
      onUpdatesChanged: (callback: (pluginIds: string[]) => void) => () => void;
      onAppUpdateChanged: (callback: (info: AppUpdateInfo) => void) => () => void;
    };
  }
}
