import type { CatalogPlugin, PluginText } from '@ulanzideck/catalog';
import { isPluginId } from '@ulanzideck/catalog';

/**
 * ugc.ulanzistudio.com is the creator portal behind the Ulanzi Studio Marketplace —
 * the web front-end where makers upload plugins. It serves the same product set as the
 * `product/list` feed in official-catalog.ts, but two things make it worth its own source:
 *
 *  1. It exposes metadata the product feed returns as null — banners (screenshots), a real
 *     long description, and titles/overviews in 7 languages.
 *  2. Its records carry no parseable plugin id (the zip is stored under a content hash), so
 *     the id is recovered from the archive itself — see resolvePluginId. That happens to
 *     rescue the ~21 products the official source drops for exactly the same reason.
 *
 * Undocumented, so every field is treated as optional and any entry that fails to yield a
 * valid plugin id is skipped rather than guessed at.
 */
const UGC_ORIGIN = 'https://ugc.ulanzistudio.com';

/** The "Plugins" category. The portal also serves Profiles, Icons, 3D and Pixel Assets. */
const PLUGIN_CATE_ID = '457067174939463680';

/** The list endpoint 500s unless every parameter is present, even the empty ones. */
const PAGE_SIZE = 100;

/** Hard stop so a runaway `count` can't spin the loop forever. */
const MAX_PAGES = 10;

const UA = 'ulanzi-plugin-store/0.1.0';

/** Parallel HTTP fan-out for the per-plugin id probes and detail calls. */
const CONCURRENCY = 8;

const REQUEST_TIMEOUT_MS = 15_000;

type UgcListItem = {
  id?: string;
  uuid?: string | null;
  files?: string | null;
  titleEn?: string | null;
  titleCn?: string | null;
  nickname?: string | null;
  classify?: number | null;
  device?: string | null;
  support?: string | null;
  language?: string | null;
  banner?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
};

type UgcResource = UgcListItem & {
  version?: string | null;
  author?: string | null;
  productName?: string | null;
  coverUrl?: string | null;
  overview?: string | null;
  overviewZh?: string | null;
  overviewPt?: string | null;
  detailDesc?: string | null;
  detailDescEn?: string | null;
  detailDescPt?: string | null;
  titleJa?: string | null;
  titlePt?: string | null;
};

type UgcListResponse = { code?: number; count?: number; data?: UgcListItem[] | null };
type UgcDetailResponse = { code?: number; tResources?: UgcResource | null };

// Same numeric mapping the product feed uses (see CLASSIFY_LABELS in official-catalog.ts) —
// the portal returns only the number, never the label.
const CLASSIFY_LABELS: Record<number, string> = {
  0: 'Stream Live',
  1: 'Creative',
  2: 'Lighting',
  3: 'Office',
  4: 'Tools',
};

function listUrl(page: number): string {
  const params = new URLSearchParams({
    cateId: PLUGIN_CATE_ID,
    excludeCateId: '',
    screen: '',
    sort: '',
    isAsc: 'asc',
    limit: String(PAGE_SIZE),
    orderByColumn: '',
    page: String(page),
    searchText: '',
    classify: '0',
    lang: 'en_US',
    source: 'web',
  });
  return `${UGC_ORIGIN}/api/api/list?${params}`;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json', Referer: `${UGC_ORIGIN}/` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`UGC catalog HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Portal paths are origin-relative (`/cdn/...`); absolute values are passed through. */
function absoluteUrl(value: string | null | undefined): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${UGC_ORIGIN}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

function splitList(value: string | null | undefined): string[] {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * The plugin id is the folder the archive unpacks into — install.ts requires
 * `<id>/manifest.json` to exist inside the zip — and the portal never stores it.
 * A zip's first local file header sits at byte 0, so the first 1 KB is enough to read the
 * leading entry name and take its top-level directory. Costs one ranged request per plugin
 * instead of a full download.
 *
 * Dead uploads (the portal keeps rows whose CDN object is gone) answer with the SPA's HTML,
 * which fails the signature check and drops the entry — those would fail to install anyway.
 */
async function resolvePluginId(downloadUrl: string): Promise<string | null> {
  let head: Uint8Array;
  try {
    const res = await fetch(downloadUrl, {
      headers: { 'User-Agent': UA, Range: 'bytes=0-1023' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.status !== 206 && res.status !== 200) return null;
    head = new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }

  if (head.byteLength < 30) return null;
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  // Local file header signature "PK\x03\x04".
  if (view.getUint32(0, true) !== 0x04034b50) return null;

  const nameLength = view.getUint16(26, true);
  if (nameLength === 0 || 30 + nameLength > head.byteLength) return null;

  const entry = new TextDecoder().decode(head.subarray(30, 30 + nameLength));
  const top = entry.split('/')[0];
  return isPluginId(top) ? top : null;
}

function buildI18n(detail: UgcResource): Record<string, PluginText> {
  // Locale keys match pluginLocales in renderer/i18n — anything else is never read.
  const locales: Array<[string, PluginText]> = [
    [
      'en',
      {
        name: detail.titleEn || detail.productName || undefined,
        description: detail.overview || undefined,
        longDescription: detail.detailDescEn || undefined,
      },
    ],
    [
      'pt_BR',
      {
        name: detail.titlePt || undefined,
        description: detail.overviewPt || undefined,
        longDescription: detail.detailDescPt || undefined,
      },
    ],
    [
      'zh_CN',
      {
        name: detail.titleCn || undefined,
        description: detail.overviewZh || undefined,
        longDescription: detail.detailDesc || undefined,
      },
    ],
  ];

  const i18n: Record<string, PluginText> = {};
  for (const [locale, text] of locales) {
    const entries = Object.entries(text).filter(([, value]) => value);
    if (entries.length > 0) i18n[locale] = Object.fromEntries(entries);
  }
  return i18n;
}

/** `support` reads "Windows,macOS (Apple Silicon),macOS (Intel)" — collapse to the catalog's own vocabulary. */
function platformsFrom(support: string | null | undefined): string[] {
  const platforms = new Set<string>();
  for (const entry of splitList(support)) {
    const lower = entry.toLowerCase();
    if (lower.startsWith('win')) platforms.add('windows');
    else if (lower.startsWith('mac')) platforms.add('mac');
  }
  return [...platforms];
}

function toIsoDate(value: string | null | undefined): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  // "2026-07-21 09:33:34" is not ISO — the space keeps Safari/V8 lenient but Date.parse
  // treats it as local time, which is the best available reading (no zone is published).
  const parsed = Date.parse(raw.replace(' ', 'T'));
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function toCatalogPlugin(id: string, detail: UgcResource, downloadUrl: string): CatalogPlugin {
  const category =
    typeof detail.classify === 'number' ? (CLASSIFY_LABELS[detail.classify] ?? null) : null;
  const screenshots = splitList(detail.banner)
    .map(absoluteUrl)
    .filter((url): url is string => Boolean(url));
  const cover = absoluteUrl(detail.coverUrl) || screenshots[0] || null;
  const devices = splitList(detail.device).map((entry) => entry.toLowerCase());
  const version = String(detail.version || '').trim() || '0.0.0';

  return {
    id,
    repo: '',
    name: detail.titleEn || detail.productName || detail.titleCn || id,
    author: detail.author || detail.nickname || 'Ulanzi',
    version,
    description: detail.overview || '',
    longDescription: detail.detailDescEn || detail.overview || '',
    category,
    icon: cover,
    cover,
    screenshots,
    deviceTypes: devices.includes('dial') ? ['deck', 'dial'] : ['deck'],
    platforms: platformsFrom(detail.support),
    languages: [],
    i18n: buildI18n(detail),
    // The category filter UI reads `tags`, not `category` — see App.tsx.
    tags: category ? [category] : [],
    minSoftwareVersion: null,
    releaseTag: version,
    changelog: '',
    publishedAt: toIsoDate(detail.updateTime || detail.createTime),
    downloadUrl,
    // No public repo — hides the "View source" / "Report problem" actions.
    sourceUrl: '',
    source: 'ugc',
  };
}

/** Runs `worker` over `items` with a fixed number of workers, preserving input order. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let index = next++; index < items.length; index = next++) {
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

async function fetchListPage(page: number): Promise<UgcListResponse> {
  const body = await getJson<UgcListResponse>(listUrl(page));
  if (body.code !== 200 || !Array.isArray(body.data)) {
    throw new Error(`UGC catalog error: ${body.code}`);
  }
  return body;
}

/**
 * Page 1 reports the total, so the remaining pages are fetched together instead of
 * walking them one round-trip at a time.
 */
async function fetchListItems(): Promise<UgcListItem[]> {
  const first = await fetchListPage(1);
  const items = [...(first.data ?? [])];

  const total = typeof first.count === 'number' ? first.count : items.length;
  const pageCount = Math.min(Math.ceil(total / PAGE_SIZE), MAX_PAGES);
  if (pageCount <= 1 || items.length === 0) return items;

  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, offset) => fetchListPage(offset + 2)),
  );
  for (const body of rest) items.push(...(body.data ?? []));

  return items;
}

/**
 * Every installable plugin on the Ulanzi Studio creator portal.
 * Entries without an archive, with a dead archive, or whose id can't be recovered are skipped.
 */
export async function fetchUgcCatalog(): Promise<CatalogPlugin[]> {
  const listed = await fetchListItems();

  const candidates = listed
    .map((item) => ({ item, downloadUrl: absoluteUrl(item.files) }))
    .filter((entry): entry is { item: UgcListItem; downloadUrl: string } => Boolean(entry.downloadUrl));

  // The portal can hold several uploads of the same plugin; the first one listed wins.
  // Claimed inside the worker (between awaits, so never interleaved) which lets each entry
  // flow probe -> detail on its own instead of waiting for every probe to finish first.
  const claimed = new Set<string>();

  const plugins = await mapLimit(candidates, CONCURRENCY, async (entry) => {
    const id = await resolvePluginId(entry.downloadUrl);
    if (!id || claimed.has(id)) return null;
    claimed.add(id);
    return toCatalogPlugin(id, await fetchDetail(entry.item), entry.downloadUrl);
  });

  return plugins.filter((plugin): plugin is CatalogPlugin => plugin !== null);
}

/**
 * Version, descriptions and banners live behind a per-plugin call. It is enrichment rather
 * than a requirement, so anything that goes wrong falls back to the leaner list record.
 */
async function fetchDetail(item: UgcListItem): Promise<UgcResource> {
  if (!item.id) return item;
  try {
    const body = await getJson<UgcDetailResponse>(
      `${UGC_ORIGIN}/api/api/resources?id=${encodeURIComponent(item.id)}&lang=en_US&source=web`,
    );
    return body.code === 200 && body.tResources ? body.tResources : item;
  } catch {
    return item;
  }
}
