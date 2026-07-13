#!/usr/bin/env node
// Valida as entradas de registry ADICIONADAS/ALTERADAS em um Pull Request.
// Diferente de validate-registry.mjs (checagem estrutural rasa de todo o registry),
// este script bate na API do GitHub e confirma que o repositório submetido segue os
// padrões da loja: nome de arquivo correto, sem duplicata, release com asset
// .ulanziPlugin.zip, manifest.json válido e store.json (opcional) bem-formado.
//
// Acumula TODOS os problemas (não para no primeiro) e escreve um resumo em markdown
// para o workflow comentar no PR.
//
// Entrada: env CHANGED_FILES (uma lista separada por espaço/nova-linha de caminhos
//          relativos à raiz do repo). Sem ela, valida tudo em registry/plugins/.
// Saída:   stdout humano + markdown em $PR_VALIDATION_MD (se definido). Exit 1 se houver erro.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const REGISTRY_DIR = join(ROOT, 'registry', 'plugins');
const REGISTRY_REL = 'registry/plugins';

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const API = 'https://api.github.com';

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
// Aceita o asset com nome fixo `com.<...>.ulanziPlugin.zip` e o versionado
// `com.<...>.ulanziPlugin-1.5.0.zip` (sufixo após `-` ou `_`).
const ASSET_RE = /\.ulanziPlugin(?:[-_][^/]*)?\.zip$/;
const ALLOWED_KEYS = new Set(['repo']);
const VALID_DEVICE_TYPES = new Set(['deck', 'dial']);

function ghHeaders(extra = {}) {
  const h = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ulanzideck-store-pr-validator',
    ...extra,
  };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retorna { ok, status, json } sem lançar, pra podermos acumular erros com mensagem clara.
// Faz retry em erros transitórios (5xx / falha de rede) pra um soluço da API do GitHub
// não reprovar um PR legítimo.
async function ghGet(path, accept) {
  const url = `${API}${path}`;
  const headers = ghHeaders(accept ? { Accept: accept } : {});
  let res;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      res = await fetch(url, { headers });
    } catch {
      if (attempt < 2) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      return { ok: false, status: 0 }; // falha de rede após retries
    }
    if (res.status >= 500 && attempt < 2) {
      await sleep(1000 * (attempt + 1));
      continue;
    }
    break;
  }
  const out = { ok: res.ok, status: res.status };
  if (res.ok) {
    out.text = await res.text();
    if (!accept || accept.includes('json')) {
      try {
        out.json = JSON.parse(out.text);
      } catch {
        /* deixa json indefinido */
      }
    }
  }
  return out;
}

// Existe o arquivo `path` no repo/ref? (contents API, funciona em repo privado)
async function repoFileText(repo, path, ref) {
  const res = await ghGet(
    `/repos/${repo}/contents/${encodeURI(path)}${ref ? `?ref=${ref}` : ''}`,
    'application/vnd.github.raw',
  );
  if (res.status === 404) return { missing: true };
  if (!res.ok) return { error: `HTTP ${res.status}` };
  return { text: res.text };
}

// Nome de arquivo esperado a partir do repo: owner/name -> owner__name.json
function expectedFilename(repo) {
  return `${repo.replace(/\//g, '__')}.json`;
}

// Valida a estrutura local do arquivo e devolve { repo, problems }.
async function validateLocal(fileRel, existingByRepo) {
  const problems = [];
  const name = basename(fileRel);
  let entry;

  try {
    entry = JSON.parse(await readFile(join(ROOT, fileRel), 'utf8'));
  } catch (err) {
    return { repo: null, problems: [`JSON inválido: ${err.message}`] };
  }

  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return { repo: null, problems: ['o arquivo deve ser um objeto JSON `{ "repo": "owner/repo" }`'] };
  }

  const repo = entry.repo;
  if (!repo || typeof repo !== 'string' || !REPO_RE.test(repo)) {
    problems.push('campo `repo` ausente ou inválido (esperado `owner/repo`)');
  }

  const extraKeys = Object.keys(entry).filter((k) => !ALLOWED_KEYS.has(k));
  if (extraKeys.length) {
    problems.push(`chaves não suportadas no JSON: ${extraKeys.map((k) => `\`${k}\``).join(', ')} (use apenas \`repo\`)`);
  }

  if (repo && REPO_RE.test(repo)) {
    const expected = expectedFilename(repo);
    if (name !== expected) {
      problems.push(`nome do arquivo deve ser \`${expected}\` (para o repo \`${repo}\`), mas é \`${name}\``);
    }
    // Duplicata: mesmo repo (case-insensitive) já registrado em outro arquivo.
    const dup = existingByRepo.get(repo.toLowerCase());
    if (dup && dup !== name) {
      problems.push(`repo \`${repo}\` já está registrado em \`${dup}\` (entrada duplicada)`);
    }
  }

  return { repo: repo && REPO_RE.test(repo) ? repo : null, problems };
}

// Valida que o repositório remoto segue os padrões da loja. Acumula problemas.
async function validateRepo(repo) {
  const problems = [];

  // 1) repo existe e é acessível
  const repoRes = await ghGet(`/repos/${repo}`);
  if (repoRes.status === 404) {
    problems.push(`repositório \`${repo}\` não encontrado (privado ou inexistente)`);
    return problems;
  }
  if (!repoRes.ok) {
    problems.push(`falha ao consultar \`${repo}\`: HTTP ${repoRes.status}`);
    return problems;
  }
  const ref = repoRes.json?.default_branch || 'main';

  // 2) release mais recente com asset .ulanziPlugin.zip
  const relRes = await ghGet(`/repos/${repo}/releases/latest`);
  if (relRes.status === 404) {
    problems.push('não há nenhuma GitHub Release publicada (a loja precisa da release mais recente)');
    return problems;
  }
  if (!relRes.ok) {
    problems.push(`falha ao ler a release mais recente: HTTP ${relRes.status}`);
    return problems;
  }
  const zipAsset = (relRes.json?.assets || []).find((a) => ASSET_RE.test(a.name));
  if (!zipAsset) {
    problems.push(
      'a release mais recente não tem o asset `com.<...>.ulanziPlugin.zip` ' +
        '(o nome pode incluir a versão, ex.: `com.<...>.ulanziPlugin-1.5.0.zip`)',
    );
    return problems;
  }
  // com.<...>.ulanziPlugin — corta em `.ulanziPlugin`, descartando versão e `.zip`
  const pluginId = zipAsset.name.replace(/(\.ulanziPlugin)(?:[-_][^/]*)?\.zip$/, '$1');

  // 3) manifest.json na pasta do plugin
  const manifestFile = await repoFileText(repo, `${pluginId}/manifest.json`, ref);
  if (manifestFile.missing) {
    problems.push(`\`${pluginId}/manifest.json\` não encontrado (deve existir na branch \`${ref}\`)`);
  } else if (manifestFile.error) {
    problems.push(`falha ao ler \`${pluginId}/manifest.json\`: ${manifestFile.error}`);
  } else {
    try {
      const manifest = JSON.parse(manifestFile.text);
      if (!manifest.Name || typeof manifest.Name !== 'string') {
        problems.push('`manifest.json` sem o campo `Name`');
      }
      if (!Array.isArray(manifest.Actions) || manifest.Actions.length === 0) {
        problems.push('`manifest.json` sem `Actions` (o plugin precisa de ao menos uma action)');
      }
    } catch (err) {
      problems.push(`\`manifest.json\` não é um JSON válido: ${err.message}`);
    }
  }

  // 4) store.json opcional — se existir, precisa estar bem-formado
  const storeFile = await repoFileText(repo, 'store.json', ref);
  if (!storeFile.missing && !storeFile.error) {
    let store;
    try {
      store = JSON.parse(storeFile.text);
    } catch (err) {
      problems.push(`\`store.json\` presente mas inválido: ${err.message}`);
    }
    if (store && typeof store === 'object') {
      const imgs = [];
      if ('cover' in store) {
        if (typeof store.cover !== 'string') problems.push('`store.json`: `cover` deve ser uma string (caminho da imagem)');
        else imgs.push(store.cover);
      }
      if ('screenshots' in store) {
        if (!Array.isArray(store.screenshots) || store.screenshots.some((s) => typeof s !== 'string')) {
          problems.push('`store.json`: `screenshots` deve ser um array de strings');
        } else {
          imgs.push(...store.screenshots);
        }
      }
      if ('deviceTypes' in store) {
        if (!Array.isArray(store.deviceTypes) || store.deviceTypes.some((d) => !VALID_DEVICE_TYPES.has(d))) {
          problems.push('`store.json`: `deviceTypes` deve conter apenas `"deck"` e/ou `"dial"`');
        }
      }
      if ('tags' in store && (!Array.isArray(store.tags) || store.tags.some((t) => typeof t !== 'string'))) {
        problems.push('`store.json`: `tags` deve ser um array de strings');
      }
      if ('longDescription' in store && typeof store.longDescription !== 'string') {
        problems.push('`store.json`: `longDescription` deve ser uma string');
      }
      // Imagens referenciadas precisam existir no repo (evita link quebrado na vitrine).
      for (const img of imgs) {
        const f = await repoFileText(repo, img, ref);
        if (f.missing) problems.push(`\`store.json\`: imagem \`${img}\` não existe no repositório`);
      }
    }
  }

  return problems;
}

async function loadExistingRegistry() {
  // Mapa repo(lowercase) -> nome de arquivo, de tudo que já está no registry.
  const map = new Map();
  let files = [];
  try {
    files = (await readdir(REGISTRY_DIR)).filter((f) => f.endsWith('.json'));
  } catch {
    return map;
  }
  for (const file of files) {
    try {
      const entry = JSON.parse(await readFile(join(REGISTRY_DIR, file), 'utf8'));
      if (entry?.repo && typeof entry.repo === 'string') map.set(entry.repo.toLowerCase(), file);
    } catch {
      /* arquivos quebrados serão pegos na validação local se estiverem no PR */
    }
  }
  return map;
}

function parseChangedFiles() {
  const raw = process.env.CHANGED_FILES || process.argv.slice(2).join('\n');
  return raw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => p.startsWith(`${REGISTRY_REL}/`) && p.endsWith('.json'));
}

async function main() {
  const changed = parseChangedFiles();
  // No CI a env CHANGED_FILES vem sempre definida (mesmo vazia) → modo "só o que mudou".
  // Rodando local sem a env e sem args → valida todo o registry.
  const usingChangedList = 'CHANGED_FILES' in process.env || process.argv.length > 2;

  let targets = changed;
  if (!usingChangedList) {
    // Sem lista de mudanças: valida todo o registry (útil rodando local).
    try {
      targets = (await readdir(REGISTRY_DIR))
        .filter((f) => f.endsWith('.json'))
        .map((f) => `${REGISTRY_REL}/${f}`);
    } catch {
      targets = [];
    }
  }

  if (targets.length === 0) {
    const msg = 'Nenhuma entrada de registry adicionada/alterada neste PR — nada a validar.';
    console.log(msg);
    await writeSummary(`✅ ${msg}`);
    return;
  }

  const existing = await loadExistingRegistry();
  const results = [];

  for (const fileRel of targets) {
    const name = basename(fileRel);
    process.stdout.write(`→ ${name} ... `);
    const { repo, problems } = await validateLocal(fileRel, existing);
    if (repo && problems.length === 0) {
      const repoProblems = await validateRepo(repo);
      problems.push(...repoProblems);
    }
    results.push({ name, repo, problems });
    console.log(problems.length ? `${problems.length} problema(s)` : 'ok');
  }

  const failed = results.filter((r) => r.problems.length > 0);
  await writeSummary(renderMarkdown(results, failed));

  console.log('');
  if (failed.length) {
    for (const r of failed) {
      console.error(`✗ ${r.name}${r.repo ? ` (${r.repo})` : ''}`);
      for (const p of r.problems) console.error(`    - ${p}`);
    }
    console.error(`\n${failed.length} de ${results.length} entrada(s) com problema.`);
    process.exit(1);
  }
  console.log(`✅ ${results.length} entrada(s) validada(s) com sucesso.`);
}

function renderMarkdown(results, failed) {
  const lines = ['<!-- registry-validation -->', '## 🔎 Validação do registry', ''];
  if (failed.length === 0) {
    lines.push(`✅ **Tudo certo!** ${results.length} entrada(s) seguem os padrões da loja.`);
    lines.push('');
    for (const r of results) lines.push(`- \`${r.name}\`${r.repo ? ` → \`${r.repo}\`` : ''} — ok`);
    return lines.join('\n');
  }
  lines.push(`❌ **${failed.length} entrada(s) precisam de ajuste** antes do merge:`);
  lines.push('');
  for (const r of failed) {
    lines.push(`### \`${r.name}\`${r.repo ? ` → \`${r.repo}\`` : ''}`);
    for (const p of r.problems) lines.push(`- ${p}`);
    lines.push('');
  }
  const okOnes = results.filter((r) => r.problems.length === 0);
  if (okOnes.length) {
    lines.push('<details><summary>Entradas OK</summary>', '');
    for (const r of okOnes) lines.push(`- \`${r.name}\` → \`${r.repo}\``);
    lines.push('</details>');
  }
  lines.push('');
  lines.push('Veja os requisitos em [`registry/README.md`](../blob/main/registry/README.md).');
  return lines.join('\n');
}

async function writeSummary(md) {
  const out = process.env.PR_VALIDATION_MD;
  if (out) {
    try {
      await writeFile(out, md + '\n');
    } catch (err) {
      console.warn(`aviso: não consegui escrever ${out}: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error('Erro fatal no validador:', err);
  process.exit(1);
});
