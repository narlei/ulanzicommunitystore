import type { Catalog, CatalogPlugin } from '@ulanzideck/catalog';
import { isPluginId } from '@ulanzideck/catalog';
import { loadCached } from './catalog-cache.js';
import { fetchCatalog } from './install.js';
import { logError } from './logger.js';
import { getSettings } from './settings.js';
import { fetchUgcCatalog } from './ugc-catalog.js';

// Undocumented endpoint used by the Ulanzi Studio desktop app to list its official
// marketplace. os=3 (Windows+Mac, no OS filtering) and type=1 (plugins only — Ulanzi
// also serves "Profiles" (2) and "Icon Packs" (4) through the same endpoint, which
// aren't installable plugins and are out of scope here).
const OFFICIAL_CATALOG_URL = 'https://www.ulanzistudio.com/product/list?os=3&type=1';

const UA = 'ulanzi-plugin-store/0.1.0';

type UlanziOfficialProduct = {
  productName?: string;
  author?: string | null;
  uuid?: string;
  iconUrl?: string | null;
  fileUrl?: string;
  overview?: string | null;
  version?: string;
  os?: string[] | null;
  contentType?: string | null;
  classify?: number | null;
  dialSupport?: number | null;
  updateTime?: string | null;
  createTime?: string | null;
};

type UlanziOfficialResponse = {
  code: number;
  data: UlanziOfficialProduct[] | null;
};

// `contentType` is missing on some items; `classify` is always present and maps 1:1 to it
// (reverse-engineered from a live catalog sample — Ulanzi doesn't document this field).
const CLASSIFY_LABELS: Record<number, string> = {
  0: 'Stream Live',
  1: 'Creative',
  2: 'Lighting',
  3: 'Office',
  4: 'Tools',
};

function categoryLabel(product: UlanziOfficialProduct): string | null {
  if (product.contentType) return product.contentType;
  if (typeof product.classify === 'number' && product.classify in CLASSIFY_LABELS) {
    return CLASSIFY_LABELS[product.classify];
  }
  return null;
}

// Release asset names follow `com.<...>.ulanziPlugin.zip`, optionally versioned
// (`...ulanziPlugin-1.5.0.zip`) — same convention build-catalog.mjs uses for the
// community catalog. The captured group is the pluginId (= install folder name).
const ASSET_ID_RE = /^(.+\.ulanziPlugin)(?:[-_][^/]*)?\.zip$/;

function pluginIdFromFileUrl(fileUrl: string): string | null {
  const name = fileUrl.split('/').pop() || '';
  const match = name.match(ASSET_ID_RE);
  return match ? match[1] : null;
}

function toCatalogPlugin(product: UlanziOfficialProduct): CatalogPlugin | null {
  if (!product.fileUrl) return null;
  const id = pluginIdFromFileUrl(product.fileUrl);
  if (!id || !isPluginId(id)) return null;

  const updatedAt = product.updateTime || product.createTime || null;
  const publishedAt = updatedAt && !Number.isNaN(Date.parse(updatedAt)) ? new Date(updatedAt).toISOString() : null;
  const category = categoryLabel(product);

  return {
    id,
    repo: '',
    name: product.productName || id,
    author: product.author || 'Ulanzi',
    version: product.version || '0.0.0',
    description: product.overview || '',
    longDescription: product.overview || '',
    category,
    icon: product.iconUrl ?? null,
    cover: product.iconUrl ?? null,
    screenshots: [],
    deviceTypes: product.dialSupport ? ['deck', 'dial'] : ['deck'],
    platforms: product.os || [],
    languages: [],
    i18n: {},
    // The category filter UI reads `tags`, not `category` — see App.tsx.
    tags: category ? [category] : [],
    minSoftwareVersion: null,
    releaseTag: product.version || '',
    changelog: '',
    publishedAt,
    downloadUrl: product.fileUrl,
    // No public repo to link to — hides the "View source" / "Report problem" actions.
    sourceUrl: '',
    source: 'official',
  };
}

export async function fetchOfficialCatalog(): Promise<CatalogPlugin[]> {
  const res = await fetch(OFFICIAL_CATALOG_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Official catalog HTTP ${res.status}`);
  const body = (await res.json()) as UlanziOfficialResponse;
  if (body.code !== 200 || !Array.isArray(body.data)) {
    throw new Error(`Official catalog error: ${body.code}`);
  }
  const seen = new Set<string>();
  const plugins: CatalogPlugin[] = [];
  for (const product of body.data) {
    const plugin = toCatalogPlugin(product);
    if (!plugin || seen.has(plugin.id)) continue;
    seen.add(plugin.id);
    plugins.push(plugin);
  }
  return plugins;
}

/**
 * Community catalog, plus the opt-in Ulanzi Studio sources merged in: the official
 * marketplace feed (`officialCatalog`) and the creator portal (`ugcCatalog`).
 *
 * Precedence on id collisions is community > official > UGC, so a plugin published in the
 * community registry keeps its repo, changelog and security scan. Each extra source is
 * fetched independently and a failure degrades to whatever else resolved, rather than
 * breaking the store.
 */
export async function fetchStoreCatalog(): Promise<Catalog> {
  // Settings is a local file read; the three catalogs are network-bound and independent,
  // so they all run together rather than making the fast community fetch wait its turn.
  const settings = await getSettings();

  const [community, official, ugc] = await Promise.all([
    fetchCatalog(),
    settings.officialCatalog ? loadExtraSource('official', fetchOfficialCatalog) : [],
    settings.ugcCatalog ? loadExtraSource('ugc', fetchUgcCatalog) : [],
  ]);

  if (official.length === 0 && ugc.length === 0) return community;

  // Precedence, highest first — the first source to claim an id owns the entry. The
  // community registry must stay ahead of both Ulanzi sources: its entries are the only
  // ones carrying a repo, changelog and security scan, so letting an Ulanzi record win
  // would silently strip all of that from a plugin published in both places.
  const sourcesByPrecedence = [community.plugins, official, ugc];

  const seen = new Set<string>();
  const plugins: CatalogPlugin[] = [];
  for (const source of sourcesByPrecedence) {
    for (const plugin of source) {
      if (seen.has(plugin.id)) continue;
      seen.add(plugin.id);
      plugins.push(plugin);
    }
  }

  return { ...community, count: plugins.length, plugins };
}

function loadExtraSource(
  name: string,
  fetchSource: () => Promise<CatalogPlugin[]>,
): Promise<CatalogPlugin[]> {
  return loadCached(name, fetchSource, async (err) => {
    console.error(`${name} catalog fetch failed:`, err);
    await logError(`catalog:${name} (served from cache or skipped)`, err);
  });
}
