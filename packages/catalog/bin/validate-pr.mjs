#!/usr/bin/env node
// Validates registry entries ADDED/CHANGED in a Pull Request.
// Unlike validate-registry.mjs (shallow structural check of the entire registry),
// this script hits the GitHub API and confirms that the submitted repository follows
// store standards: correct filename, no duplicates, release with a .ulanziPlugin.zip
// asset, valid manifest.json, and well-formed store.json (optional).
//
// Accumulates ALL problems (does not stop at the first) and writes a markdown summary
// for the workflow to comment on the PR.
//
// Input: env CHANGED_FILES (a space/newline-separated list of paths relative to the
//        repo root). Without it, validates everything in registry/plugins/.
// Output: human-readable stdout + markdown in $PR_VALIDATION_MD (if set). Exit 1 on error.

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
// Accepts the asset with fixed name `com.<...>.ulanziPlugin.zip` and the versioned
// `com.<...>.ulanziPlugin-1.5.0.zip` (suffix after `-` or `_`).
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

// Returns { ok, status, json } without throwing, so we can accumulate errors with clear messages.
// Retries on transient errors (5xx / network failure) so a GitHub API hiccup
// does not reject a legitimate PR.
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
      return { ok: false, status: 0 }; // network failure after retries
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
        /* leave json undefined */
      }
    }
  }
  return out;
}

// Does the file `path` exist in the repo/ref? (contents API, works in private repos)
async function repoFileText(repo, path, ref) {
  const res = await ghGet(
    `/repos/${repo}/contents/${encodeURI(path)}${ref ? `?ref=${ref}` : ''}`,
    'application/vnd.github.raw',
  );
  if (res.status === 404) return { missing: true };
  if (!res.ok) return { error: `HTTP ${res.status}` };
  return { text: res.text };
}

// Expected filename derived from the repo: owner/name -> owner__name.json
function expectedFilename(repo) {
  return `${repo.replace(/\//g, '__')}.json`;
}

// Validates the local structure of the file and returns { repo, problems }.
async function validateLocal(fileRel, existingByRepo) {
  const problems = [];
  const name = basename(fileRel);
  let entry;

  try {
    entry = JSON.parse(await readFile(join(ROOT, fileRel), 'utf8'));
  } catch (err) {
    return { repo: null, problems: [`Invalid JSON: ${err.message}`] };
  }

  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return { repo: null, problems: ['file must be a JSON object `{ "repo": "owner/repo" }`'] };
  }

  const repo = entry.repo;
  if (!repo || typeof repo !== 'string' || !REPO_RE.test(repo)) {
    problems.push('missing or invalid `repo` field (expected `owner/repo`)');
  }

  const extraKeys = Object.keys(entry).filter((k) => !ALLOWED_KEYS.has(k));
  if (extraKeys.length) {
    problems.push(`unsupported keys in JSON: ${extraKeys.map((k) => `\`${k}\``).join(', ')} (use only \`repo\`)`);
  }

  if (repo && REPO_RE.test(repo)) {
    const expected = expectedFilename(repo);
    if (name !== expected) {
      problems.push(`filename must be \`${expected}\` (for repo \`${repo}\`), but got \`${name}\``);
    }
    // Duplicate: same repo (case-insensitive) already registered in another file.
    const dup = existingByRepo.get(repo.toLowerCase());
    if (dup && dup !== name) {
      problems.push(`repo \`${repo}\` is already registered in \`${dup}\` (duplicate entry)`);
    }
  }

  return { repo: repo && REPO_RE.test(repo) ? repo : null, problems };
}

// Validates that the remote repository follows store standards. Accumulates problems.
async function validateRepo(repo) {
  const problems = [];

  // 1) repo exists and is accessible
  const repoRes = await ghGet(`/repos/${repo}`);
  if (repoRes.status === 404) {
    problems.push(`repository \`${repo}\` not found (private or does not exist)`);
    return problems;
  }
  if (!repoRes.ok) {
    problems.push(`failed to query \`${repo}\`: HTTP ${repoRes.status}`);
    return problems;
  }
  const ref = repoRes.json?.default_branch || 'main';

  // 2) latest release with a .ulanziPlugin.zip asset
  const relRes = await ghGet(`/repos/${repo}/releases/latest`);
  if (relRes.status === 404) {
    problems.push('no GitHub Release published yet (the store requires the latest release)');
    return problems;
  }
  if (!relRes.ok) {
    problems.push(`failed to read the latest release: HTTP ${relRes.status}`);
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
  // com.<...>.ulanziPlugin — cuts at `.ulanziPlugin`, discarding version and `.zip`
  const pluginId = zipAsset.name.replace(/(\.ulanziPlugin)(?:[-_][^/]*)?\.zip$/, '$1');

  // 3) manifest.json in the plugin folder
  const manifestFile = await repoFileText(repo, `${pluginId}/manifest.json`, ref);
  if (manifestFile.missing) {
    problems.push(`\`${pluginId}/manifest.json\` not found (must exist on branch \`${ref}\`)`);
  } else if (manifestFile.error) {
    problems.push(`failed to read \`${pluginId}/manifest.json\`: ${manifestFile.error}`);
  } else {
    try {
      const manifest = JSON.parse(manifestFile.text);
      if (!manifest.Name || typeof manifest.Name !== 'string') {
        problems.push('`manifest.json` missing `Name` field');
      }
      if (!Array.isArray(manifest.Actions) || manifest.Actions.length === 0) {
        problems.push('`manifest.json` has no `Actions` (plugin must have at least one action)');
      }
    } catch (err) {
      problems.push(`\`manifest.json\` is not valid JSON: ${err.message}`);
    }
  }

  // 4) optional store.json — if present, must be well-formed
  const storeFile = await repoFileText(repo, 'store.json', ref);
  if (!storeFile.missing && !storeFile.error) {
    let store;
    try {
      store = JSON.parse(storeFile.text);
    } catch (err) {
      problems.push(`\`store.json\` present but invalid: ${err.message}`);
    }
    if (store && typeof store === 'object') {
      const imgs = [];
      if ('cover' in store) {
        if (typeof store.cover !== 'string') problems.push('`store.json`: `cover` must be a string (image path)');
        else imgs.push(store.cover);
      }
      if ('screenshots' in store) {
        if (!Array.isArray(store.screenshots) || store.screenshots.some((s) => typeof s !== 'string')) {
          problems.push('`store.json`: `screenshots` must be an array of strings');
        } else {
          imgs.push(...store.screenshots);
        }
      }
      if ('deviceTypes' in store) {
        if (!Array.isArray(store.deviceTypes) || store.deviceTypes.some((d) => !VALID_DEVICE_TYPES.has(d))) {
          problems.push('`store.json`: `deviceTypes` must contain only `"deck"` and/or `"dial"`');
        }
      }
      if ('tags' in store && (!Array.isArray(store.tags) || store.tags.some((t) => typeof t !== 'string'))) {
        problems.push('`store.json`: `tags` must be an array of strings');
      }
      if ('longDescription' in store && typeof store.longDescription !== 'string') {
        problems.push('`store.json`: `longDescription` must be a string');
      }
      // Referenced images must exist in the repo (prevents broken links in the store listing).
      for (const img of imgs) {
        const f = await repoFileText(repo, img, ref);
        if (f.missing) problems.push(`\`store.json\`: image \`${img}\` does not exist in the repository`);
      }
    }
  }

  return problems;
}

async function loadExistingRegistry() {
  // Map repo(lowercase) -> filename, for everything already in the registry.
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
      /* broken files will be caught in local validation if they are in the PR */
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
  // In CI the CHANGED_FILES env is always set (even if empty) → "only what changed" mode.
  // Running locally without the env and without args → validates the entire registry.
  const usingChangedList = 'CHANGED_FILES' in process.env || process.argv.length > 2;

  let targets = changed;
  if (!usingChangedList) {
    // No change list: validate the entire registry (useful when running locally).
    try {
      targets = (await readdir(REGISTRY_DIR))
        .filter((f) => f.endsWith('.json'))
        .map((f) => `${REGISTRY_REL}/${f}`);
    } catch {
      targets = [];
    }
  }

  if (targets.length === 0) {
    const msg = 'No registry entries added/changed in this PR — nothing to validate.';
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
    console.log(problems.length ? `${problems.length} problem(s)` : 'ok');
  }

  const failed = results.filter((r) => r.problems.length > 0);
  await writeSummary(renderMarkdown(results, failed));

  console.log('');
  if (failed.length) {
    for (const r of failed) {
      console.error(`✗ ${r.name}${r.repo ? ` (${r.repo})` : ''}`);
      for (const p of r.problems) console.error(`    - ${p}`);
    }
    console.error(`\n${failed.length} of ${results.length} entry/entries with problems.`);
    process.exit(1);
  }
  console.log(`✅ ${results.length} entry/entries validated successfully.`);
}

function renderMarkdown(results, failed) {
  const lines = ['<!-- registry-validation -->', '## 🔎 Registry validation', ''];
  if (failed.length === 0) {
    lines.push(`✅ **All good!** ${results.length} entry/entries follow the store standards.`);
    lines.push('');
    for (const r of results) lines.push(`- \`${r.name}\`${r.repo ? ` → \`${r.repo}\`` : ''} — ok`);
    return lines.join('\n');
  }
  lines.push(`❌ **${failed.length} entry/entries need adjustment** before merging:`);
  lines.push('');
  for (const r of failed) {
    lines.push(`### \`${r.name}\`${r.repo ? ` → \`${r.repo}\`` : ''}`);
    for (const p of r.problems) lines.push(`- ${p}`);
    lines.push('');
  }
  const okOnes = results.filter((r) => r.problems.length === 0);
  if (okOnes.length) {
    lines.push('<details><summary>OK entries</summary>', '');
    for (const r of okOnes) lines.push(`- \`${r.name}\` → \`${r.repo}\``);
    lines.push('</details>');
  }
  lines.push('');
  lines.push('See the requirements at [`registry/README.md`](../blob/main/registry/README.md).');
  return lines.join('\n');
}

async function writeSummary(md) {
  const out = process.env.PR_VALIDATION_MD;
  if (out) {
    try {
      await writeFile(out, md + '\n');
    } catch (err) {
      console.warn(`warning: could not write ${out}: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error in validator:', err);
  process.exit(1);
});
