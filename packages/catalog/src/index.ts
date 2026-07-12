export type PluginText = {
  name?: string;
  description?: string;
  longDescription?: string;
};

export type CatalogPlugin = {
  id: string;
  repo: string;
  name: string;
  author: string;
  version: string;
  description: string;
  longDescription: string;
  category: string | null;
  icon: string | null;
  cover: string | null;
  screenshots: string[];
  deviceTypes: string[];
  platforms: string[];
  languages: string[];
  i18n: Record<string, PluginText>;
  tags: string[];
  minSoftwareVersion: string | null;
  releaseTag: string;
  changelog: string;
  publishedAt: string | null;
  /** Soma dos downloads dos assets .ulanziPlugin.zip em todas as releases. Ausente em catálogos antigos. */
  downloads?: number;
  downloadUrl: string;
  sourceUrl: string;
};

export type Catalog = {
  generatedAt: string | null;
  count: number;
  plugins: CatalogPlugin[];
};

export type InstalledPlugin = {
  pluginId: string;
  version: string | null;
};

export function isPluginId(value: string): boolean {
  return value.endsWith('.ulanziPlugin') && !/[\\/]/.test(value) && !value.includes('..');
}

export function isRepoSlug(value: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
}

export function compareVersions(a: string | null | undefined, b: string | null | undefined): number {
  const pa = String(a || '').split(/[^\d]+/).filter(Boolean).map(Number);
  const pb = String(b || '').split(/[^\d]+/).filter(Boolean).map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}
