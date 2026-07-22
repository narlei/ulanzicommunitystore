import { app } from 'electron';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CatalogPlugin } from '@ulanzideck/catalog';

/**
 * On-disk cache for the opt-in Ulanzi sources. Neither is cheap: the marketplace feed is a
 * ~600 ms round-trip and the creator portal costs one ranged request per plugin plus a
 * detail call, which lands around 5 s against their CDN. Both change on the order of days,
 * so re-fetching on every store load is pure latency.
 *
 * The community catalog is deliberately not cached — it is a single 50 ms request and the
 * one source where a stale entry would be most visible.
 */
const TTL_MS = 60 * 60 * 1000;

type CacheEntry = {
  savedAt: number;
  plugins: CatalogPlugin[];
};

function cacheDir(): string {
  return path.join(app.getPath('userData'), 'catalog-cache');
}

function cachePath(name: string): string {
  return path.join(cacheDir(), `${name}.json`);
}

/**
 * Drops every cached source so the next store load goes back to the network. Exposed in
 * Settings because the TTL is the only other way in, and a user who knows a plugin just
 * shipped shouldn't have to wait it out.
 */
export async function clearCache(): Promise<void> {
  await rm(cacheDir(), { recursive: true, force: true });
}

async function readEntry(name: string): Promise<CacheEntry | null> {
  try {
    const parsed = JSON.parse(await readFile(cachePath(name), 'utf8')) as Partial<CacheEntry>;
    if (typeof parsed?.savedAt !== 'number' || !Array.isArray(parsed.plugins)) return null;
    return { savedAt: parsed.savedAt, plugins: parsed.plugins };
  } catch {
    // Missing or corrupt — treated the same as a cold cache.
    return null;
  }
}

export function isFresh(entry: CacheEntry, now: number = Date.now()): boolean {
  const age = now - entry.savedAt;
  // A savedAt in the future means the clock moved backwards; don't trust it.
  return age >= 0 && age < TTL_MS;
}

async function writeEntry(name: string, plugins: CatalogPlugin[]): Promise<void> {
  const file = cachePath(name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ savedAt: Date.now(), plugins } satisfies CacheEntry));
}

/**
 * Cached plugins for `name`, or a fresh fetch when the cache is cold or expired.
 *
 * A failed fetch falls back to expired cache when there is one — an entry that is a few
 * hours stale beats dropping the whole source out of the store because the network blipped.
 */
export async function loadCached(
  name: string,
  fetchSource: () => Promise<CatalogPlugin[]>,
  onError: (err: unknown) => void | Promise<void>,
): Promise<CatalogPlugin[]> {
  const entry = await readEntry(name);
  if (entry && isFresh(entry)) return entry.plugins;

  try {
    const plugins = await fetchSource();
    // Never cache an empty result — it is far more likely to be a silent upstream failure
    // than a genuinely empty catalog, and it would stick for the whole TTL.
    if (plugins.length > 0) await writeEntry(name, plugins);
    return plugins;
  } catch (err) {
    await onError(err);
    return entry ? entry.plugins : [];
  }
}
