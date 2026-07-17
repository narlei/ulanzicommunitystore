import type { Catalog, CatalogPlugin } from '@ulanzideck/catalog';
import { isPluginId } from '@ulanzideck/catalog';
import { fetchCatalog } from './install.js';
import { logError } from './logger.js';
import { getSettings } from './settings.js';

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
 * Community catalog, plus the Ulanzi Studio official catalog merged in when the
 * `officialCatalog` setting is on. Community entries always win on id collisions.
 * Official-fetch failures degrade to community-only rather than breaking the store.
 */
export async function fetchStoreCatalog(): Promise<Catalog> {
  const community = await fetchCatalog();
  const settings = await getSettings();
  if (!settings.officialCatalog) return community;

  try {
    const communityIds = new Set(community.plugins.map((plugin) => plugin.id));
    const official = (await fetchOfficialCatalog()).filter((plugin) => !communityIds.has(plugin.id));
    return {
      ...community,
      count: community.count + official.length,
      plugins: [...community.plugins, ...official],
    };
  } catch (err) {
    console.error('Official catalog fetch failed:', err);
    await logError('catalog:official (degraded to community-only)', err);
    return community;
  }
}
