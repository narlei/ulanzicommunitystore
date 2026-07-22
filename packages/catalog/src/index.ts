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
  /** Latest GitHub release `published_at` at catalog build time. */
  publishedAt: string | null;
  /** Sum of downloads for .ulanziPlugin.zip assets across all releases. Absent in older catalogs. */
  downloads?: number;
  /** GitHub stargazers_count at catalog build time. Absent in older catalogs. */
  stars?: number;
  downloadUrl: string;
  sourceUrl: string;
  /**
   * Where the entry came from. 'official' = Ulanzi Studio Marketplace product feed,
   * 'ugc' = the ugc.ulanzistudio.com creator portal. Absent = community registry.
   */
  source?: 'official' | 'ugc';
  /** Automated security scan result for the plugin's repo. Absent in older catalogs. */
  security?: PluginSecurity;
};

/**
 * Result of the automated dependency + secret scan (Trivy) for a plugin's repo.
 * `status`: clean = scanned, no HIGH/CRITICAL findings; findings = CVEs or leaked
 * secrets found; error = scan could not run; unknown = not scanned yet (e.g. a
 * plugin added since the last scan). Absent in older catalogs built before scanning.
 */
export type PluginSecurity = {
  status: 'clean' | 'findings' | 'error' | 'unknown';
  scanner: { name: string; version: string } | null;
  severityFilter: string | null;
  critical: number;
  high: number;
  secrets: number;
  /** Short commit SHA actually scanned (default branch HEAD), or null. */
  scannedRef: string | null;
  scannedAt: string | null;
  /** Deep link to the full report page (security.html#owner-repo), or null on local builds. */
  reportUrl: string | null;
};

/** Days a plugin stays marked as NEW after the latest catalog release date (`publishedAt`). */
export const NEW_PLUGIN_WINDOW_DAYS = 14;

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

/**
 * True when the latest release in the catalog is within the NEW window.
 * Uses catalog `publishedAt` (GitHub latest release). Recent updates also light up NEW —
 * useful for discovery. UI should hide NEW when the plugin is already installed.
 */
export function isPluginNew(
  publishedAt: string | null | undefined,
  now: Date = new Date(),
  windowDays: number = NEW_PLUGIN_WINDOW_DAYS,
): boolean {
  if (!publishedAt) return false;
  const published = Date.parse(publishedAt);
  if (Number.isNaN(published)) return false;
  const ageMs = now.getTime() - published;
  if (ageMs < 0) return true; // clock skew / future-dated → still show NEW
  return ageMs < windowDays * 24 * 60 * 60 * 1000;
}
