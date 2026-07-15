#!/usr/bin/env node
// Generates dist/catalog/catalog.json from the entries in registry/plugins/*.json.
// For each { repo }, reads the latest release + manifest.json + store.json (optional) via
// the GitHub API and builds the catalog entry. A repo with an error is skipped (with a warning),
// never taking down the entire catalog.
//
// Usage:  GH_TOKEN=$(gh auth token) npm run catalog:build
// In the Action, GITHUB_TOKEN is injected automatically.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const REGISTRY_DIR = join(ROOT, 'registry', 'plugins');
const OUT_FILE = process.env.CATALOG_OUT_FILE || join(ROOT, 'dist', 'catalog', 'catalog.json');
// Per-repo security records emitted by scripts/security-scan.mjs (keyed by repo).
// Absent when the catalog is built without a prior scan — every entry falls back
// to `unknown` and the catalog builds fine.
const SECURITY_DIR = process.env.SECURITY_DIR || join(ROOT, 'dist', 'security');

// Base URL of the published site, used to build absolute `reportUrl`s pointing at
// security.html. Explicit PAGES_BASE_URL wins; otherwise derived from the Actions
// GITHUB_REPOSITORY (owner/repo → https://owner.github.io/repo). Null on local
// builds without either — reportUrl then stays null.
const PAGES_BASE_URL = resolvePagesBaseUrl();

function resolvePagesBaseUrl() {
  if (process.env.PAGES_BASE_URL) return process.env.PAGES_BASE_URL.replace(/\/+$/, '');
  const repo = process.env.GITHUB_REPOSITORY;
  if (repo && repo.includes('/')) {
    const [owner, name] = repo.split('/');
    return `https://${owner}.github.io/${name}`;
  }
  return null;
}

// Stable in-page anchor / reportUrl for a repo. `owner/repo` → `owner-repo`.
function anchorFor(repo) {
  return repo.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '');
}

// `owner/name` → `owner`. Real GitHub handle (unlike manifest.json's free-text Author),
// used to credit/link the maintainer on the security report.
function ownerOf(repo) {
  return repo.split('/')[0];
}

function reportUrlFor(repo) {
  return PAGES_BASE_URL ? `${PAGES_BASE_URL}/security.html#${anchorFor(repo)}` : null;
}

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const API = 'https://api.github.com';

// Match for the release asset. Accepts the fixed name `com.<...>.ulanziPlugin.zip`
// and also the versioned `com.<...>.ulanziPlugin-1.5.0.zip` (suffix after `-` or `_`).
const ASSET_RE = /\.ulanziPlugin(?:[-_][^/]*)?\.zip$/;

// Derives the pluginId (= plugin folder name) by cutting at `.ulanziPlugin`,
// discarding any version suffix and the `.zip`.
function pluginIdFromAsset(name) {
  return name.replace(/(\.ulanziPlugin)(?:[-_][^/]*)?\.zip$/, '$1');
}

// Locales supported by the official SDK. Used to detect language files.
const KNOWN_LOCALES = ['en', 'de', 'es', 'fr', 'ja', 'ko', 'pt_BR', 'zh_CN', 'zh_HK', 'zh_TW'];

// Locales used by the site (EN/PT/ZH + fallbacks) — we pull Name/Description from these.
const SITE_LOCALES = ['en', 'pt_BR', 'pt', 'zh_CN', 'zh_HK', 'zh_TW'];

function ghHeaders(extra = {}) {
  const h = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ulanzideck-store-catalog-builder',
    ...extra,
  };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

// Transient HTTP statuses from the GitHub API that are worth retrying (5xx + rate limit).
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = Number(process.env.CATALOG_FETCH_RETRIES || 4);
const RETRY_BASE_MS = Number(process.env.CATALOG_FETCH_RETRY_MS || 500);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fetch with exponential retry for transient errors (5xx/429) and network failures.
// Definitive errors (4xx except 429) return immediately, without retry.
async function ghFetch(url, init) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || !RETRY_STATUS.has(res.status) || attempt === MAX_RETRIES) return res;
      lastErr = new Error(`${res.status} ${res.statusText}`);
    } catch (err) {
      // Network failure (DNS/connection/timeout) — also transient.
      lastErr = err;
      if (attempt === MAX_RETRIES) throw err;
    }
    const delay = RETRY_BASE_MS * 2 ** attempt;
    console.warn(`  ! ${url} failed (${lastErr.message}); retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
    await sleep(delay);
  }
  throw lastErr;
}

async function ghJson(path) {
  const res = await ghFetch(`${API}${path}`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${res.statusText}`);
  return res.json();
}

// Fetches a text file from the repo via the contents API (also works in private repos).
// Returns null if 404.
async function ghRawFile(repo, path, ref) {
  const url = `${API}/repos/${repo}/contents/${path}${ref ? `?ref=${ref}` : ''}`;
  const res = await ghFetch(url, { headers: ghHeaders({ Accept: 'application/vnd.github.raw' }) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET contents ${path} → ${res.status}`);
  return res.text();
}

function rawUrl(repo, ref, path) {
  return `https://raw.githubusercontent.com/${repo}/${ref}/${path}`;
}

// Derives device types from the Controllers of the manifest actions.
function deviceTypesFromManifest(manifest) {
  const set = new Set();
  for (const action of manifest.Actions || []) {
    for (const c of action.Controllers || []) {
      if (c === 'Keypad') set.add('deck');
      if (c === 'Encoder') set.add('dial');
    }
  }
  return [...set];
}

async function detectLanguages(repo, pluginId, ref) {
  try {
    const entries = await ghJson(`/repos/${repo}/contents/${pluginId}?ref=${ref}`);
    const langs = [];
    for (const e of entries) {
      if (e.type !== 'file' || !e.name.endsWith('.json')) continue;
      const base = e.name.replace(/\.json$/, '');
      if (KNOWN_LOCALES.includes(base)) langs.push(base);
    }
    return langs.sort();
  } catch {
    return [];
  }
}

// Reads Name/Description from the plugin's language files to localize the store listing.
async function fetchI18n(repo, pluginId, ref, languages) {
    const out = {};
    for (const loc of languages) {
        if (!SITE_LOCALES.includes(loc)) continue;
        const text = await ghRawFile(repo, `${pluginId}/${loc}.json`, ref);
        if (!text) continue;
        try {
            const j = JSON.parse(text);
            const entry = {};
            if (j.Name) entry.name = j.Name;
            if (j.Description) entry.description = j.Description;
            if (Object.keys(entry).length) out[loc] = entry;
        } catch {
            /* ignore invalid language file */
        }
    }
    return out;
}

// Sums the download_count of *.ulanziPlugin.zip assets across all repo releases.
// Failures return 0 — popularity never takes down a catalog entry.
async function countDownloads(repo) {
  try {
    const releases = await ghJson(`/repos/${repo}/releases?per_page=100`);
    let total = 0;
    for (const release of releases) {
      for (const asset of release.assets || []) {
        if (ASSET_RE.test(asset.name)) total += asset.download_count || 0;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

// Shown for repos with no scan record yet (e.g. a plugin added since the last scan).
const UNKNOWN_SECURITY = {
  status: 'unknown',
  scanner: null,
  severityFilter: null,
  critical: 0,
  high: 0,
  secrets: 0,
  scannedRef: null,
  scannedAt: null,
  reportUrl: null,
};

// Keeps only the fields the catalog exposes, guarding against a malformed record.
function normalizeSecurity(rec) {
  const out = {
    status: rec.status || 'unknown',
    scanner: rec.scanner || null,
    severityFilter: rec.severityFilter || null,
    critical: Number(rec.critical) || 0,
    high: Number(rec.high) || 0,
    secrets: Number(rec.secrets) || 0,
    scannedRef: rec.scannedRef || null,
    scannedAt: rec.scannedAt || null,
  };
  if (rec.error) out.error = rec.error;
  return out;
}

// Loads every per-repo security record into a Map keyed by `owner/repo`.
// Missing directory / unreadable files degrade gracefully to an empty map.
async function loadSecurity() {
  const map = new Map();
  let files = [];
  try {
    files = (await readdir(SECURITY_DIR)).filter((f) => f.endsWith('.json'));
  } catch {
    console.warn(`  ! no security records at ${SECURITY_DIR} — entries will be "unknown"`);
    return map;
  }
  for (const f of files) {
    try {
      const rec = JSON.parse(await readFile(join(SECURITY_DIR, f), 'utf8'));
      if (rec && rec.repo) map.set(rec.repo, normalizeSecurity(rec));
    } catch {
      console.warn(`  ! invalid security record ${f}, skipping`);
    }
  }
  return map;
}

function escapeHtml(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

const STATUS_LABEL = {
  clean: '✅ Clean',
  findings: '❌ Findings',
  error: '⚠️ Scan error',
  unknown: '· Not yet scanned',
};

// Findings first (most actionable), then errors, unknown, and clean last.
function statusRank(s) {
  return { findings: 0, error: 1, unknown: 2, clean: 3 }[s] ?? 4;
}

// Renders the standalone security.html served next to catalog.json on Pages.
// Each plugin gets an anchor (`#owner-repo`) so catalog reportUrls deep-link here.
function buildSecurityHtml(plugins, generatedAt) {
  const rows = [...plugins].sort(
    (a, b) => statusRank(a.security.status) - statusRank(b.security.status) || a.name.localeCompare(b.name),
  );
  const tally = plugins.reduce((m, p) => ((m[p.security.status] = (m[p.security.status] || 0) + 1), m), {});
  const scanner = plugins.map((p) => p.security.scanner).find(Boolean);
  const scannerLabel = scanner ? `${escapeHtml(scanner.name)} ${escapeHtml(scanner.version)}` : 'Trivy';

  const summary = ['findings', 'error', 'unknown', 'clean']
    .filter((s) => tally[s])
    .map((s) => `${STATUS_LABEL[s]}: ${tally[s]}`)
    .join(' · ');

  const body = rows
    .map((p) => {
      const s = p.security;
      const scanned = s.scannedAt ? escapeHtml(s.scannedAt.slice(0, 10)) : '—';
      const ref = s.scannedRef ? `<code>${escapeHtml(s.scannedRef)}</code>` : '—';
      const sv = s.scanner ? `${escapeHtml(s.scanner.name)} ${escapeHtml(s.scanner.version)}` : '—';
      const owner = ownerOf(p.repo);
      return `      <tr id="${escapeHtml(anchorFor(p.repo))}" class="s-${escapeHtml(s.status)}">
        <td><a href="${escapeHtml(p.sourceUrl)}">${escapeHtml(p.name)}</a><div class="repo">${escapeHtml(p.repo)}</div></td>
        <td class="status">${STATUS_LABEL[s.status] || escapeHtml(s.status)}</td>
        <td class="num">${s.critical || 0}</td>
        <td class="num">${s.high || 0}</td>
        <td class="num">${s.secrets || 0}</td>
        <td>${scanned}<div class="repo">${ref} · ${sv}</div></td>
        <td><a href="https://github.com/${escapeHtml(owner)}">@${escapeHtml(owner)}</a></td>
      </tr>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Community plugin security scan</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 2rem 1rem; background: #fafafa; color: #1a1a1a; }
  @media (prefers-color-scheme: dark) { body { background: #16181d; color: #e6e6e6; } }
  main { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  .meta { opacity: .7; font-size: .85rem; margin-bottom: 1.5rem; }
  .note { font-size: .85rem; opacity: .75; margin: 1.5rem 0 0; }
  table { border-collapse: collapse; width: 100%; font-size: .9rem; }
  th, td { text-align: left; padding: .55rem .6rem; border-bottom: 1px solid rgba(128,128,128,.25); vertical-align: top; }
  th { font-weight: 600; opacity: .7; font-size: .8rem; text-transform: uppercase; letter-spacing: .03em; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .repo { opacity: .6; font-size: .78rem; margin-top: .15rem; }
  a { color: inherit; }
  code { font-size: .82em; opacity: .85; }
  tr:target { background: rgba(255,214,0,.18); }
  tr.s-findings td.status { color: #d33; font-weight: 600; }
  tr.s-error td.status { color: #b8860b; }
  tr.s-clean td.status { color: #2a8; }
  tr.s-unknown td.status { opacity: .55; }
</style>
</head>
<body>
<main>
  <h1>🔒 Community plugin security scan</h1>
  <div class="meta">Scanned with ${scannerLabel} · ${escapeHtml(generatedAt)}${summary ? ` · ${summary}` : ''}</div>
  <table>
    <thead>
      <tr><th>Plugin</th><th>Status</th><th class="num">Critical</th><th class="num">High</th><th class="num">Secrets</th><th>Scanned</th><th>Maintainer</th></tr>
    </thead>
    <tbody>
${body}
    </tbody>
  </table>
  <p class="note">Automated dependency &amp; secret scan (severity HIGH/CRITICAL) of each plugin's source at the commit shown.
  It flags known CVEs and leaked secrets — it does not certify a plugin as safe, and cannot detect malicious logic.
  Scans run against the default branch, which may differ from the released build you download.</p>
</main>
</body>
</html>
`;
}

async function buildEntry(repo) {
  // 1) latest release
  const release = await ghJson(`/repos/${repo}/releases/latest`);
  const zipAsset = (release.assets || []).find((a) => ASSET_RE.test(a.name));
  if (!zipAsset) {
    throw new Error('release has no *.ulanziPlugin.zip asset');
  }
  const pluginId = pluginIdFromAsset(zipAsset.name); // com.<...>.ulanziPlugin
  // Versioned asset name (e.g. ...ulanziPlugin-1.5.0.zip) does not match the permalink
  // `latest/download/<pluginId>.zip`, so we use the release asset URL directly.
  const isVersionedAsset = zipAsset.name !== `${pluginId}.zip`;

  // 2) default branch + stars (same API call)
  const repoInfo = await ghJson(`/repos/${repo}`);
  const ref = repoInfo.default_branch || 'main';
  const stars = typeof repoInfo.stargazers_count === 'number' ? repoInfo.stargazers_count : 0;

  // 3) manifest.json
  const manifestText = await ghRawFile(repo, `${pluginId}/manifest.json`, ref);
  if (!manifestText) throw new Error(`manifest.json not found in ${pluginId}/`);
  const manifest = JSON.parse(manifestText);

  // 4) optional store.json (repo root)
  let store = {};
  const storeText = await ghRawFile(repo, 'store.json', ref);
  if (storeText) {
    try {
      store = JSON.parse(storeText);
    } catch {
      console.warn(`  ! invalid store.json in ${repo}, skipping`);
    }
  }

  // 5) languages + localized text (name/description per locale)
  const languages = await detectLanguages(repo, pluginId, ref);
  const i18n = await fetchI18n(repo, pluginId, ref, languages);
  const downloads = await countDownloads(repo);

  // 6) device types (store.json overrides the one derived from the manifest)
  const deviceTypes =
    Array.isArray(store.deviceTypes) && store.deviceTypes.length
      ? store.deviceTypes
      : deviceTypesFromManifest(manifest);

  // 7) platforms from the manifest
  const platforms = (manifest.OS || []).map((o) => o.Platform);

  // 8) resolve images to raw URLs
  const iconUrl = manifest.Icon ? rawUrl(repo, ref, `${pluginId}/${manifest.Icon}`) : null;
  const cover = store.cover ? rawUrl(repo, ref, store.cover) : iconUrl;
  const screenshots = Array.isArray(store.screenshots)
    ? store.screenshots.map((s) => rawUrl(repo, ref, s))
    : [];

  return {
    id: pluginId,
    repo,
    name: manifest.Name || pluginId,
    author: manifest.Author || repo.split('/')[0],
    version: manifest.Version || release.tag_name.replace(/^v/, ''),
    description: manifest.Description || '',
    longDescription: store.longDescription || manifest.Description || '',
    category: manifest.Category || null,
    icon: iconUrl,
    cover,
    screenshots,
    deviceTypes,
    platforms,
    languages,
    i18n,
    tags: Array.isArray(store.tags) ? store.tags : [],
    minSoftwareVersion: manifest.Software?.MinVersion || null,
    releaseTag: release.tag_name,
    changelog: release.body || '',
    publishedAt: release.published_at,
    downloads,
    stars,
    // Fixed name: stable permalink that always points to the latest release.
    // Versioned name: specific asset URL (updates on every catalog rebuild).
    downloadUrl: isVersionedAsset
      ? zipAsset.browser_download_url
      : `https://github.com/${repo}/releases/latest/download/${pluginId}.zip`,
    sourceUrl: `https://github.com/${repo}`,
  };
}

async function main() {
  let files = [];
  try {
    files = (await readdir(REGISTRY_DIR)).filter((f) => f.endsWith('.json'));
  } catch {
    console.error(`No registry directory at ${REGISTRY_DIR}`);
    process.exit(1);
  }

  const security = await loadSecurity();

  const plugins = [];
  const errors = [];
  for (const file of files) {
    const entry = JSON.parse(await readFile(join(REGISTRY_DIR, file), 'utf8'));
    const repo = entry.repo;
    if (!repo || !/^[^/]+\/[^/]+$/.test(repo)) {
      errors.push({ file, error: 'missing or invalid "repo" field (expected owner/repo)' });
      continue;
    }
    process.stdout.write(`→ ${repo} ... `);
    try {
      const built = await buildEntry(repo);
      const sec = security.get(repo) ? { ...security.get(repo) } : { ...UNKNOWN_SECURITY };
      sec.reportUrl = reportUrlFor(repo);
      built.security = sec;
      plugins.push(built);
      console.log(`ok (v${built.version}, ${built.deviceTypes.join('+') || '?'}, sec:${built.security.status})`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      errors.push({ file, repo, error: err.message });
    }
  }

  plugins.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));

  const catalog = {
    generatedAt: new Date().toISOString(),
    count: plugins.length,
    plugins,
  };

  const outDir = dirname(OUT_FILE);
  await mkdir(outDir, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(catalog, null, 2) + '\n');
  console.log(`\nCatalog: ${plugins.length} plugin(s) → ${OUT_FILE}`);

  const reportFile = join(outDir, 'security.html');
  await writeFile(reportFile, buildSecurityHtml(plugins, catalog.generatedAt));
  console.log(`Security report → ${reportFile}${PAGES_BASE_URL ? ` (reportUrl base: ${PAGES_BASE_URL})` : ' (no PAGES_BASE_URL — reportUrls null)'}`);
  if (errors.length) {
    console.log(`Warnings (${errors.length}):`);
    for (const e of errors) console.log(`  - ${e.file}${e.repo ? ` (${e.repo})` : ''}: ${e.error}`);
    if (process.env.CATALOG_STRICT === '1') {
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
