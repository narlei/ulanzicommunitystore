// Valida um repositório de plugin direto na API pública do GitHub e gera a entrada
// do registry pronta para o Pull Request. Espelha as mesmas regras do build-catalog:
// release mais nova com asset *.ulanziPlugin.zip, manifest.json na pasta do plugin
// e store.json opcional na raiz.
import type { SubmitCheck, SubmitCheckResult } from '../shared.js';

const API = 'https://api.github.com';
const STORE_REPO = 'narlei/ulanzicommunitystore';

// Aceita o asset com nome fixo `com.<...>.ulanziPlugin.zip` e o versionado
// `com.<...>.ulanziPlugin-1.5.0.zip` (sufixo após `-` ou `_`).
const ASSET_RE = /\.ulanziPlugin(?:[-_][^/]*)?\.zip$/;

const HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'ulanzi-plugin-store-app',
};

export function parseRepoInput(input: string): string | null {
  const value = input.trim().replace(/\/+$/, '');
  if (!value) return null;
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) return value;
  const match = value.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:git@)?github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[/?#].*)?$/i,
  );
  if (!match) return null;
  return `${match[1]}/${match[2]}`;
}

function registryFileName(repo: string): string {
  return `${repo.replace('/', '__')}.json`;
}

function registryJson(repo: string): string {
  return `{\n  "repo": "${repo}"\n}\n`;
}

// Link "novo arquivo" pré-preenchido: para quem não tem write access, o GitHub
// faz o fork e abre o Pull Request sozinho.
function prUrl(repo: string): string {
  const params = new URLSearchParams({
    filename: registryFileName(repo),
    value: registryJson(repo),
  });
  return `https://github.com/${STORE_REPO}/new/main/registry/plugins?${params.toString()}`;
}

async function rawFile(repo: string, ref: string, path: string): Promise<string | null> {
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/${ref}/${path}`, {
    headers: { 'User-Agent': HEADERS['User-Agent'] },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.text();
}

export async function checkSubmission(input: string): Promise<SubmitCheckResult> {
  const repo = parseRepoInput(typeof input === 'string' ? input : '');
  const checks: SubmitCheck[] = [];
  let plugin: SubmitCheckResult['plugin'] = null;

  const result = (): SubmitCheckResult => ({
    ok: checks.length > 0 && !checks.some((check) => check.status === 'fail'),
    repo: repo || '',
    checks,
    plugin,
    registryFileName: repo ? registryFileName(repo) : '',
    registryJson: repo ? registryJson(repo) : '',
    prUrl: repo ? prUrl(repo) : '',
  });

  if (!repo) {
    checks.push({ id: 'repo', status: 'fail' });
    return result();
  }

  // 1) repositório existe (e branch padrão para buscar arquivos)
  const repoRes = await fetch(`${API}/repos/${repo}`, { headers: HEADERS });
  if (!repoRes.ok) {
    checks.push({ id: 'repo', status: 'fail' });
    return result();
  }
  const repoInfo = (await repoRes.json()) as { default_branch?: string };
  const ref = repoInfo.default_branch || 'main';
  checks.push({ id: 'repo', status: 'ok', value: repo });

  // 2) release mais nova
  const releaseRes = await fetch(`${API}/repos/${repo}/releases/latest`, { headers: HEADERS });
  if (!releaseRes.ok) {
    checks.push({ id: 'release', status: 'fail' });
    return result();
  }
  const release = (await releaseRes.json()) as {
    tag_name?: string;
    assets?: Array<{ name: string }>;
  };
  checks.push({ id: 'release', status: 'ok', value: release.tag_name || '' });

  // 3) asset com.<voce>.<plugin>.ulanziPlugin.zip (nome fixo ou versionado)
  const asset = (release.assets || []).find((item) => ASSET_RE.test(item.name));
  if (!asset) {
    checks.push({ id: 'asset', status: 'fail' });
    return result();
  }
  checks.push({ id: 'asset', status: 'ok', value: asset.name });
  // com.<...>.ulanziPlugin — corta em `.ulanziPlugin`, descartando versão e `.zip`
  const pluginId = asset.name.replace(/(\.ulanziPlugin)(?:[-_][^/]*)?\.zip$/, '$1');

  // 4) manifest.json dentro da pasta do plugin
  try {
    const manifestText = await rawFile(repo, ref, `${pluginId}/manifest.json`);
    if (!manifestText) {
      checks.push({ id: 'manifest', status: 'fail', value: pluginId });
    } else {
      const manifest = JSON.parse(manifestText) as { Name?: string; Version?: string; Icon?: string };
      if (manifest.Name && manifest.Version) {
        checks.push({ id: 'manifest', status: 'ok', value: `${manifest.Name} v${manifest.Version}` });
        plugin = {
          id: pluginId,
          name: manifest.Name,
          version: manifest.Version,
          icon: manifest.Icon
            ? `https://raw.githubusercontent.com/${repo}/${ref}/${pluginId}/${manifest.Icon}`
            : null,
        };
      } else {
        checks.push({ id: 'manifest', status: 'warn', value: pluginId });
      }
    }
  } catch {
    checks.push({ id: 'manifest', status: 'fail', value: pluginId });
  }

  // 5) store.json opcional na raiz
  try {
    const storeText = await rawFile(repo, ref, 'store.json');
    if (storeText === null) {
      checks.push({ id: 'store', status: 'warn' });
    } else {
      JSON.parse(storeText);
      checks.push({ id: 'store', status: 'ok' });
    }
  } catch {
    checks.push({ id: 'store', status: 'warn', value: 'invalid' });
  }

  return result();
}
