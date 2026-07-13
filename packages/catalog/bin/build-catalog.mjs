#!/usr/bin/env node
// Gera dist/catalog/catalog.json a partir das entradas em registry/plugins/*.json.
// Para cada { repo }, lê a release mais nova + manifest.json + store.json (opcional) via
// API do GitHub e monta a entrada do catálogo. Um repo com erro é ignorado (com aviso),
// nunca derruba o catálogo inteiro.
//
// Uso:  GH_TOKEN=$(gh auth token) npm run catalog:build
// Na Action, GITHUB_TOKEN é injetado automaticamente.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const REGISTRY_DIR = join(ROOT, 'registry', 'plugins');
const OUT_FILE = process.env.CATALOG_OUT_FILE || join(ROOT, 'dist', 'catalog', 'catalog.json');

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const API = 'https://api.github.com';

// Match do asset da release. Aceita o nome fixo `com.<...>.ulanziPlugin.zip`
// e também o versionado `com.<...>.ulanziPlugin-1.5.0.zip` (sufixo após `-` ou `_`).
const ASSET_RE = /\.ulanziPlugin(?:[-_][^/]*)?\.zip$/;

// Deriva o pluginId (= nome da pasta do plugin) cortando em `.ulanziPlugin`,
// descartando qualquer sufixo de versão e o `.zip`.
function pluginIdFromAsset(name) {
  return name.replace(/(\.ulanziPlugin)(?:[-_][^/]*)?\.zip$/, '$1');
}

// Locales suportados pelo SDK oficial. Usados para detectar os arquivos de idioma.
const KNOWN_LOCALES = ['en', 'de', 'es', 'fr', 'ja', 'ko', 'pt_BR', 'zh_CN', 'zh_HK', 'zh_TW'];

// Locales que o site usa (EN/PT/ZH + fallbacks) — puxamos Name/Description destes.
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

// Status HTTP transitórios da API do GitHub que valem retry (5xx + rate limit).
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = Number(process.env.CATALOG_FETCH_RETRIES || 4);
const RETRY_BASE_MS = Number(process.env.CATALOG_FETCH_RETRY_MS || 500);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fetch com retry exponencial para erros transitórios (5xx/429) e falhas de rede.
// Erros definitivos (4xx que não 429) retornam na hora, sem retry.
async function ghFetch(url, init) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || !RETRY_STATUS.has(res.status) || attempt === MAX_RETRIES) return res;
      lastErr = new Error(`${res.status} ${res.statusText}`);
    } catch (err) {
      // Falha de rede (DNS/conexão/timeout) — também é transitória.
      lastErr = err;
      if (attempt === MAX_RETRIES) throw err;
    }
    const delay = RETRY_BASE_MS * 2 ** attempt;
    console.warn(`  ! ${url} falhou (${lastErr.message}); retry ${attempt + 1}/${MAX_RETRIES} em ${delay}ms`);
    await sleep(delay);
  }
  throw lastErr;
}

async function ghJson(path) {
  const res = await ghFetch(`${API}${path}`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${res.statusText}`);
  return res.json();
}

// Busca um arquivo de texto do repo via contents API (funciona em repo privado também).
// Retorna null se 404.
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

// Deriva os tipos de device a partir dos Controllers das actions do manifest.
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

// Lê Name/Description dos arquivos de idioma do plugin para localizar a vitrine.
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
            /* ignora arquivo de idioma inválido */
        }
    }
    return out;
}

// Soma os download_count dos assets *.ulanziPlugin.zip de todas as releases do repo.
// Falha vira 0 — popularidade nunca derruba a entrada do catálogo.
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

async function buildEntry(repo) {
  // 1) release mais nova
  const release = await ghJson(`/repos/${repo}/releases/latest`);
  const zipAsset = (release.assets || []).find((a) => ASSET_RE.test(a.name));
  if (!zipAsset) {
    throw new Error('release sem asset *.ulanziPlugin.zip');
  }
  const pluginId = pluginIdFromAsset(zipAsset.name); // com.<...>.ulanziPlugin
  // Nome versionado (ex.: ...ulanziPlugin-1.5.0.zip) não bate com o permalink
  // `latest/download/<pluginId>.zip`, então usamos a URL do asset da release.
  const isVersionedAsset = zipAsset.name !== `${pluginId}.zip`;

  // 2) branch padrão
  const repoInfo = await ghJson(`/repos/${repo}`);
  const ref = repoInfo.default_branch || 'main';

  // 3) manifest.json
  const manifestText = await ghRawFile(repo, `${pluginId}/manifest.json`, ref);
  if (!manifestText) throw new Error(`manifest.json não encontrado em ${pluginId}/`);
  const manifest = JSON.parse(manifestText);

  // 4) store.json opcional (raiz do repo)
  let store = {};
  const storeText = await ghRawFile(repo, 'store.json', ref);
  if (storeText) {
    try {
      store = JSON.parse(storeText);
    } catch {
      console.warn(`  ! store.json inválido em ${repo}, ignorando`);
    }
  }

  // 5) idiomas + textos localizados (name/description por locale)
  const languages = await detectLanguages(repo, pluginId, ref);
  const i18n = await fetchI18n(repo, pluginId, ref, languages);
  const downloads = await countDownloads(repo);

  // 6) device types (store.json sobrescreve o derivado do manifest)
  const deviceTypes =
    Array.isArray(store.deviceTypes) && store.deviceTypes.length
      ? store.deviceTypes
      : deviceTypesFromManifest(manifest);

  // 7) plataformas do manifest
  const platforms = (manifest.OS || []).map((o) => o.Platform);

  // 8) resolver imagens para URLs raw
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
    // Nome fixo: permalink estável que sempre aponta pra release mais recente.
    // Nome versionado: URL do asset específico (atualiza a cada rebuild do catálogo).
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
    console.error(`Sem diretório de registry em ${REGISTRY_DIR}`);
    process.exit(1);
  }

  const plugins = [];
  const errors = [];
  for (const file of files) {
    const entry = JSON.parse(await readFile(join(REGISTRY_DIR, file), 'utf8'));
    const repo = entry.repo;
    if (!repo || !/^[^/]+\/[^/]+$/.test(repo)) {
      errors.push({ file, error: 'campo "repo" ausente ou inválido (esperado owner/repo)' });
      continue;
    }
    process.stdout.write(`→ ${repo} ... `);
    try {
      const built = await buildEntry(repo);
      plugins.push(built);
      console.log(`ok (v${built.version}, ${built.deviceTypes.join('+') || '?'})`);
    } catch (err) {
      console.log(`FALHOU: ${err.message}`);
      errors.push({ file, repo, error: err.message });
    }
  }

  plugins.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));

  const catalog = {
    generatedAt: new Date().toISOString(),
    count: plugins.length,
    plugins,
  };

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(catalog, null, 2) + '\n');
  console.log(`\nCatálogo: ${plugins.length} plugin(s) → ${OUT_FILE}`);
  if (errors.length) {
    console.log(`Avisos (${errors.length}):`);
    for (const e of errors) console.log(`  - ${e.file}${e.repo ? ` (${e.repo})` : ''}: ${e.error}`);
    if (process.env.CATALOG_STRICT === '1') {
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
