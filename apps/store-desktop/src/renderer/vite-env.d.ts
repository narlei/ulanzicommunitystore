/// <reference types="vite/client" />

import type { Catalog, CatalogPlugin, InstalledPlugin } from '@ulanzideck/catalog';
import type { InstallProgress, Settings, SubmitCheckResult } from '../shared';

declare global {
  interface Window {
    api: {
      getCatalog: () => Promise<Catalog>;
      listInstalled: () => Promise<InstalledPlugin[]>;
      install: (plugin: CatalogPlugin) => Promise<InstalledPlugin>;
      uninstall: (pluginId: string) => Promise<{ ok: true }>;
      checkUpdates: () => Promise<string[]>;
      getSettings: () => Promise<Settings>;
      setDeveloperMode: (enabled: boolean) => Promise<Settings>;
      checkSubmission: (repoInput: string) => Promise<SubmitCheckResult>;
      openExternal: (url: string) => Promise<void>;
      onProgress: (callback: (progress: InstallProgress) => void) => () => void;
      onInstalledRefresh: (callback: () => void) => () => void;
      onUpdatesChanged: (callback: (pluginIds: string[]) => void) => () => void;
    };
  }
}
