#!/usr/bin/env node

import * as readline from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir, readdir, stat, rm, rename } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');
const TARGET_DIR = process.cwd();

// Interactive (TTY): classic readline. Piped/non-TTY: pre-buffer lines so multi-prompt
// flows still work (Node's readline only reliably handles one question on a pipe).
let rl = null;
let pipedLines = null; // string[] | null — null until first read when !isTTY

async function nextLine(query) {
  if (process.stdin.isTTY) {
    if (!rl) rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      try { rl.question(query, resolve); } catch { resolve(''); }
    });
  }
  if (!pipedLines) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString('utf8');
    pipedLines = text.length ? text.split(/\r?\n/) : [];
    // Final trailing newline produces an empty last cell — drop it.
    if (pipedLines.length && pipedLines[pipedLines.length - 1] === '') pipedLines.pop();
  }
  process.stdout.write(query);
  const line = pipedLines.length ? pipedLines.shift() : '';
  process.stdout.write(`${line}\n`);
  return line;
}

function closeInput() {
  if (rl) {
    rl.close();
    rl = null;
  }
}

// ---------- small helpers ----------

// Run a shell command, never throw. Returns { ok, stdout, stderr }.
async function sh(cmd, opts = {}) {
  try {
    const { stdout, stderr } = await execAsync(cmd, opts);
    return { ok: true, stdout: stdout.toString(), stderr: stderr.toString() };
  } catch (err) {
    return { ok: false, stdout: (err.stdout || '').toString(), stderr: (err.stderr || err.message || '').toString() };
  }
}

async function ask(query, fallback = '') {
  const suffix = fallback ? ` [${fallback}]` : '';
  const answer = (await nextLine(`${query}${suffix}: `)).trim();
  return answer || fallback;
}

async function confirm(query, defaultYes = true) {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const answer = (await nextLine(`${query} [${hint}]: `)).trim().toLowerCase();
  if (!answer) return defaultYes;
  return answer === 'y' || answer === 'yes';
}

// "Pomodoro Timer!" -> "pomodoro-timer"
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
// "Pomodoro Timer!" -> "pomodorotimer" (for reverse-dns plugin ids)
const idPart = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

async function fileExists(path) {
  try { await stat(path); return true; } catch { return false; }
}

async function isDir(path) {
  try { return (await stat(path)).isDirectory(); } catch { return false; }
}

// ---------- context detection ----------

async function hasCommand(cmd) {
  return (await sh(`${cmd} --version`)).ok;
}

async function detectGitContext() {
  const inside = await sh('git rev-parse --is-inside-work-tree');
  const isRepo = inside.ok && inside.stdout.trim() === 'true';
  let origin = null, owner = null, repo = null;
  if (isRepo) {
    const o = await sh('git remote get-url origin');
    if (o.ok) {
      origin = o.stdout.trim();
      const m = origin.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
      if (m) { owner = m[1]; repo = m[2]; }
    }
  }
  return { isRepo, origin, owner, repo };
}

// The GitHub identity of the *logged-in gh user* — never the machine's git config.
async function detectGithubUser() {
  if (!(await hasCommand('gh'))) return { available: false, user: null };
  const auth = await sh('gh auth status');
  if (!auth.ok) return { available: true, user: null }; // gh installed but not logged in
  const r = await sh('gh api user -q .login');
  const user = r.ok ? r.stdout.trim() : null;
  return { available: true, user: user || null };
}

// A `com.<...>.ulanziPlugin/` folder sitting directly at the repo root.
async function getExistingPluginId(targetDir) {
  try {
    for (const file of await readdir(targetDir)) {
      if (file.endsWith('.ulanziPlugin') && (await isDir(join(targetDir, file)))) {
        return file.replace('.ulanziPlugin', '');
      }
    }
  } catch {}
  return null;
}

// Directories we never descend into while hunting for a nested plugin folder.
const WALK_SKIP = new Set([
  '.git', 'node_modules', 'ulanzi_plugin_example', 'dist', 'build',
  '.github', '.claude', '.cursor', '.vscode', '.idea',
]);

// Find `*.ulanziPlugin/` folders that live *below* the repo root (nested), so we can
// hoist them up. Skips the SDK example and other noise; capped at a shallow depth.
async function findNestedPluginDirs(root, maxDepth = 3) {
  const results = [];
  async function walk(dir, rel, depth) {
    if (depth > maxDepth) return;
    let ents;
    try { ents = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of ents) {
      if (!ent.isDirectory() || WALK_SKIP.has(ent.name)) continue;
      const relPath = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.name.endsWith('.ulanziPlugin')) {
        if (rel) results.push(relPath); // rel non-empty => below root
        continue; // don't descend into a plugin folder
      }
      await walk(join(dir, ent.name), relPath, depth + 1);
    }
  }
  await walk(root, '', 0);
  return results;
}

// Derive the plugin folder id (`com.<owner>.<plugin>`) from a manifest's Action UUIDs,
// which look like `com.owner.plugin.action`. Returns null if it can't be inferred.
function derivePluginIdFromManifest(manifest) {
  const uuids = (manifest.Actions || []).map((a) => a && a.UUID).filter(Boolean);
  if (!uuids.length) return null;
  const parts = uuids.map((u) => u.split('.'));
  const first = parts[0];
  let n = first.length;
  for (const p of parts) {
    let i = 0;
    while (i < n && i < p.length && p[i] === first[i]) i += 1;
    n = i;
  }
  let prefix = first.slice(0, n);
  // A single action UUID (com.x.plugin.action) still carries the trailing action
  // segment in the "common" prefix — drop it to recover the folder id.
  if (uuids.length === 1 && prefix.length > 2) prefix = prefix.slice(0, -1);
  const id = prefix.join('.');
  return id.includes('.') ? id : null;
}

// Write a file only if it doesn't exist yet.
async function safeWrite(path, content, label) {
  if (await fileExists(path)) {
    console.log(`  - ⏭️  Skipped ${label} (already exists)`);
  } else {
    await writeFile(path, content);
    console.log(`  - ✅ Created ${label}`);
  }
}

// ---------- structural adapters (hoist / wrap) ----------

// Move a nested plugin folder (e.g. plugin/com.x.ulanziPlugin) up to the repo root.
async function hoistNested(targetDir, relPath) {
  const base = relPath.split('/').pop();
  const dest = join(targetDir, base);
  if (await fileExists(dest)) {
    console.log(`  - ⚠️  ./${base} already exists at root — skipping hoist, please move it manually.`);
    return null;
  }
  await rename(join(targetDir, relPath), dest);
  console.log(`  - ✅ Hoisted ${relPath} → ./${base}`);
  return base.replace(/\.ulanziPlugin$/, '');
}

// Repo-infrastructure that must stay at the root when wrapping a loose plugin.
const WRAP_KEEP_EXACT = new Set([
  '.git', '.github', '.gitignore', '.gitattributes',
  '.claude', '.cursor', '.vscode', '.idea',
  'makefile', 'store.json', 'resources', 'ulanzi_plugin_example',
  'dist', 'build', 'node_modules', '.ds_store',
]);
const WRAP_KEEP_PREFIX = ['readme', 'license', 'licence', 'changelog', 'contributing', 'code_of_conduct', 'security', 'authors', 'notice'];

// Wrap a loose `manifest.json` (and its sibling plugin files) into a
// `com.<id>.ulanziPlugin/` folder, leaving repo infrastructure at the root.
// Everything not on the keep-list moves together, preserving relative paths.
async function wrapLooseManifest(targetDir, folderName) {
  const keepSelf = folderName.toLowerCase();
  const entries = (await readdir(targetDir)).sort((a, b) => a.localeCompare(b));
  const move = [], keep = [];
  for (const e of entries) {
    const l = e.toLowerCase();
    const isKept =
      WRAP_KEEP_EXACT.has(l) ||
      l === keepSelf ||
      l.endsWith('.ulanziplugin') ||
      l.endsWith('.ulanziplugin.zip') ||
      WRAP_KEEP_PREFIX.some((p) => l.startsWith(p));
    (isKept ? keep : move).push(e);
  }
  if (!move.length) {
    console.log('   Nothing to wrap.');
    return false;
  }
  console.log(`\n   Plan — wrap the plugin into ./${folderName}/`);
  console.log(`   ├─ move to folder : ${move.join(', ')}`);
  console.log(`   └─ keep at root   : ${keep.join(', ') || '(none)'}`);
  if (!(await confirm('   Proceed with this move?', true))) {
    console.log('   Skipped — no files were moved.');
    return false;
  }
  await mkdir(join(targetDir, folderName), { recursive: true });
  for (const e of move) {
    await rename(join(targetDir, e), join(targetDir, folderName, e));
  }
  console.log(`  - ✅ Wrapped ${move.length} item(s) into ${folderName}/`);
  console.log('     ⚠️  Review `git status` / `git diff` before committing.');
  return true;
}

// Resolve how this repo maps to a store plugin. May move files (hoist/wrap) after
// asking. Returns { pluginId, adapted, aborted }. `adapted` means "don't scaffold
// source". `aborted` means a structure was found but the user declined the fix.
async function resolvePluginStructure(targetDir, owner) {
  // 1) A plugin folder already at the root → adapt in place.
  const rootId = await getExistingPluginId(targetDir);
  if (rootId) {
    console.log(`\n🔍 Detected existing plugin folder: ${rootId}.ulanziPlugin`);
    console.log('   Adapting this repository for the Community Store without overwriting your source code.');
    return { pluginId: rootId, adapted: true, aborted: false };
  }

  // 2) A plugin folder nested below the root → offer to hoist it.
  const nested = await findNestedPluginDirs(targetDir);
  if (nested.length) {
    const rel = nested[0];
    console.log(`\n🔍 Found a plugin folder nested at: ${rel}`);
    console.log('   The store looks for it at the repository root.');
    if (nested.length > 1) {
      console.log(`   ⚠️  ${nested.length} nested plugin folders found — I'll hoist the first; move the rest by hand:`);
      nested.slice(1).forEach((n) => console.log(`        ${n}`));
    }
    if (await confirm(`Move ${rel} to the repo root?`, true)) {
      const id = await hoistNested(targetDir, rel);
      if (id) return { pluginId: id, adapted: true, aborted: false };
    }
    return { pluginId: null, adapted: false, aborted: true };
  }

  // 3) A loose manifest.json at the root (no folder) → offer to wrap it.
  if (await fileExists(join(targetDir, 'manifest.json'))) {
    let manifest = {};
    try { manifest = JSON.parse(await readFile(join(targetDir, 'manifest.json'), 'utf-8')); } catch {}
    const derived = derivePluginIdFromManifest(manifest) || `com.${idPart(owner)}.${idPart(manifest.Name || 'plugin')}`;
    console.log('\n🔍 Found a manifest.json at the repo root (loose — not inside a plugin folder).');
    console.log('   The store requires the plugin inside a `com.<you>.<plugin>.ulanziPlugin/` folder.');
    const wrapId = await ask('Plugin folder id (without .ulanziPlugin)', derived);
    const ok = await wrapLooseManifest(targetDir, `${wrapId}.ulanziPlugin`);
    if (ok) return { pluginId: wrapId, adapted: true, aborted: false };
    return { pluginId: null, adapted: false, aborted: true };
  }

  // 4) Nothing plugin-shaped here → scaffold a brand-new plugin.
  return { pluginId: null, adapted: false, aborted: false };
}

// ---------- store.json command ----------

const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;
const IMAGE_SKIP_DIRS = new Set([
  '.git', 'node_modules', 'ulanzi_plugin_example', 'dist', 'build',
  '.github', '.claude', '.cursor', '.vscode', '.idea',
]);
// Names that look like in-plugin UI assets (not store marketing art).
const UI_ASSET_RE = /^(icon|action|category|logo|state|pressed|image)(\b|[_-]|\d|$)/i;

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

// Locate the plugin folder + parse its manifest (root-level *.ulanziPlugin only).
async function loadRootPlugin(targetDir) {
  const pluginId = await getExistingPluginId(targetDir);
  if (!pluginId) return null;
  const manifestPath = join(targetDir, `${pluginId}.ulanziPlugin`, 'manifest.json');
  if (!(await fileExists(manifestPath))) return { pluginId, manifest: null, manifestPath };
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
    return { pluginId, manifest, manifestPath };
  } catch {
    return { pluginId, manifest: null, manifestPath };
  }
}

// Collect image files that could be store cover/screenshots.
// Prefers marketing folders at the repo root; skips *.ulanziPlugin internals
// (those icons are for the Deck UI, not the store listing).
async function findStoreImages(root, maxDepth = 3) {
  const results = [];
  async function walk(dir, rel, depth) {
    if (depth > maxDepth) return;
    let ents;
    try { ents = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of ents) {
      const relPath = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        if (IMAGE_SKIP_DIRS.has(ent.name)) continue;
        if (ent.name.endsWith('.ulanziPlugin')) continue;
        await walk(join(dir, ent.name), relPath, depth + 1);
        continue;
      }
      if (!ent.isFile() || !IMAGE_EXT.test(ent.name)) continue;
      // Skip tiny UI-style names at non-marketing paths; still keep cover/banner-ish names.
      const base = ent.name.replace(IMAGE_EXT, '');
      const inMarketingDir = /^(resources|images|img|screenshots|docs|assets|media|promo)(\/|$)/i.test(relPath);
      if (!inMarketingDir && UI_ASSET_RE.test(base)) continue;
      results.push(relPath.replace(/\\/g, '/'));
    }
  }
  await walk(root, '', 0);
  // Prefer resources/ first, then alphabetical for stable numbering.
  results.sort((a, b) => {
    const score = (p) => (p.startsWith('resources/') ? 0 : p.startsWith('images/') ? 1 : 2);
    const d = score(a) - score(b);
    return d !== 0 ? d : a.localeCompare(b);
  });
  return results;
}

function guessCover(images, existing) {
  if (existing && images.includes(existing)) return existing;
  if (existing && !images.length) return existing;
  const byName = images.find((p) => /(?:^|\/)cover(?:[._-]|$)/i.test(p));
  if (byName) return byName;
  // resources/cover.* style already covered; try hero / banner0 / thumbnail
  const hero = images.find((p) => /(?:^|\/)(hero|thumb(?:nail)?|poster)(?:[._-]|$)/i.test(p));
  if (hero) return hero;
  return images[0] || existing || '';
}

// basename looks like banner1, screenshot_2, preview-a, …
function isScreenshotName(path) {
  const base = path.split('/').pop() || path;
  return /^(banner|screenshot|screen|shot|preview|gallery|promo|slide)([._-]?\d|[._-]|$)/i.test(base);
}

function isCoverName(path) {
  const base = path.split('/').pop() || path;
  return /^cover([._-]|$)/i.test(base);
}

function guessScreenshots(images, cover, existing) {
  if (Array.isArray(existing) && existing.length) {
    return existing.filter((p) => p && p !== cover);
  }
  const bannerish = images.filter((p) => p !== cover && isScreenshotName(p));
  if (bannerish.length) return bannerish;
  // Everything except cover that lives in a marketing folder.
  return images.filter(
    (p) => p !== cover && /^(resources|images|img|screenshots|docs|assets|media|promo)\//i.test(p),
  );
}

function parseListAnswer(answer, numbered, fallback) {
  const raw = (answer || '').trim();
  if (!raw) return fallback;
  // "all" / "*" → every numbered image
  if (/^(all|\*)$/i.test(raw)) return [...numbered];
  // "none" / "-" → empty
  if (/^(none|-)$/i.test(raw)) return [];
  const parts = raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const idx = Number(part) - 1;
      if (idx >= 0 && idx < numbered.length) out.push(numbered[idx]);
      else console.log(`   ⚠️  Ignoring out-of-range index: ${part}`);
    } else {
      out.push(part.replace(/\\/g, '/'));
    }
  }
  // de-dupe, preserve order
  return [...new Set(out)];
}

function formatDeviceTypesDefault(types) {
  if (!types.length) return 'deck';
  if (types.includes('deck') && types.includes('dial')) return 'both';
  return types[0];
}

function parseDeviceTypes(raw, fallback) {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return fallback.length ? fallback : ['deck'];
  if (s.includes('both') || (s.includes('deck') && s.includes('dial'))) return ['deck', 'dial'];
  if (s.includes('dial')) return ['dial'];
  if (s.includes('deck')) return ['deck'];
  return fallback.length ? fallback : ['deck'];
}

async function loadExistingStore(targetDir) {
  const path = join(targetDir, 'store.json');
  if (!(await fileExists(path))) return null;
  try {
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch {
    console.log('⚠️  Existing store.json is invalid JSON — it will be replaced.');
    return null;
  }
}

async function runStore() {
  console.log('\n🛍️  Ulanzi Plugin Starter — create store.json\n');

  const plugin = await loadRootPlugin(TARGET_DIR);
  if (!plugin) {
    console.log('No `*.ulanziPlugin/` folder found at the repository root.');
    console.log('Run `npx ulanzi-plugin-starter init` first (or move your plugin folder to the root),');
    console.log('then re-run `npx ulanzi-plugin-starter store`.');
    closeInput();
    return;
  }

  const { pluginId, manifest } = plugin;
  console.log(`🔍 Plugin folder: ${pluginId}.ulanziPlugin`);
  if (manifest) {
    if (manifest.Name) console.log(`   Name: ${manifest.Name}`);
    if (manifest.Author) console.log(`   Author: ${manifest.Author}`);
    if (manifest.Version) console.log(`   Version: ${manifest.Version}`);
    if (manifest.Description) {
      const short = manifest.Description.length > 100
        ? `${manifest.Description.slice(0, 100)}…`
        : manifest.Description;
      console.log(`   Description: ${short}`);
    }
  } else {
    console.log('   ⚠️  Could not read manifest.json — some defaults will be empty.');
  }

  const existing = await loadExistingStore(TARGET_DIR);
  if (existing) {
    console.log('\n📄 Found existing store.json — answers default to current values.');
  }

  const images = await findStoreImages(TARGET_DIR);
  if (images.length) {
    console.log(`\n📂 Found ${images.length} image(s) usable for the store:`);
    images.forEach((p, i) => {
      const marks = [];
      if (isCoverName(p)) marks.push('cover?');
      if (isScreenshotName(p)) marks.push('screenshot?');
      console.log(`   ${String(i + 1).padStart(2)}. ${p}${marks.length ? `  (${marks.join(', ')})` : ''}`);
    });
  } else {
    console.log('\n📂 No images found under resources/, images/, screenshots/, docs/, etc.');
    console.log('   You can still type relative paths (e.g. resources/cover.png) if you plan to add them.');
  }

  const defaultCover = guessCover(images, existing?.cover || '');
  const defaultShots = guessScreenshots(images, defaultCover, existing?.screenshots);
  const defaultDevices = (
    Array.isArray(existing?.deviceTypes) && existing.deviceTypes.length
      ? existing.deviceTypes
      : deviceTypesFromManifest(manifest || {})
  );
  const defaultLong = (existing?.longDescription != null && existing.longDescription !== '')
    ? existing.longDescription
    : (manifest?.Description || '');
  const defaultTags = Array.isArray(existing?.tags) ? existing.tags : [];

  console.log('');
  const coverAnswer = await ask(
    'Cover image (number from the list, or path)',
    defaultCover || '',
  );
  let cover = coverAnswer;
  if (/^\d+$/.test(coverAnswer) && images.length) {
    const idx = Number(coverAnswer) - 1;
    cover = images[idx] || coverAnswer;
  }
  cover = (cover || '').replace(/\\/g, '/');

  const shotsHint = defaultShots.length
    ? defaultShots.map((p) => {
        const i = images.indexOf(p);
        return i >= 0 ? String(i + 1) : p;
      }).join(',')
    : (images.length > 1 ? 'all' : 'none');
  const shotsAnswer = await ask(
    'Screenshots (numbers/paths comma-separated, or "all" / "none")',
    shotsHint,
  );
  let screenshots = parseListAnswer(shotsAnswer, images, defaultShots);
  screenshots = screenshots.filter((p) => p && p !== cover);

  // Validate referenced files when they look like local paths.
  for (const img of [cover, ...screenshots].filter(Boolean)) {
    if (!(await fileExists(join(TARGET_DIR, img)))) {
      console.log(`   ⚠️  "${img}" does not exist yet — store validation will fail until you add it.`);
    }
  }

  const devicesRaw = await ask(
    'Device types (deck, dial, or both)',
    formatDeviceTypesDefault(defaultDevices),
  );
  const deviceTypes = parseDeviceTypes(devicesRaw, defaultDevices);

  console.log('\nLong description (shown on the plugin detail page).');
  console.log('  Tip: leave empty to reuse the manifest Description, or pass a path to a .md/.txt file.');
  let longDescription = await ask('Long description', defaultLong ? '(press Enter to keep default)' : '');
  if (!longDescription || longDescription === '(press Enter to keep default)') {
    longDescription = defaultLong;
  } else if (/\.(md|txt)$/i.test(longDescription) && (await fileExists(join(TARGET_DIR, longDescription)))) {
    const fromFile = longDescription;
    longDescription = await readFile(join(TARGET_DIR, fromFile), 'utf-8');
    console.log(`   ✅ Loaded text from ${fromFile}`);
  }

  const tagsRaw = await ask(
    'Tags (comma-separated, e.g. productivity, timer)',
    defaultTags.join(', '),
  );
  const tags = tagsRaw
    ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  const store = {
    cover: cover || '',
    screenshots,
    longDescription: longDescription || '',
    deviceTypes,
    tags,
  };

  const outPath = join(TARGET_DIR, 'store.json');
  if (existing && !(await confirm(`\nOverwrite ${outPath}?`, true))) {
    console.log('Cancelled — store.json was not modified.');
    closeInput();
    return;
  }

  await writeFile(outPath, `${JSON.stringify(store, null, 2)}\n`);
  console.log(`
✅ Wrote store.json

${JSON.stringify(store, null, 2)}

Next:
  1. Commit and push store.json (images must live in the repo at those paths).
  2. Submit / re-submit the plugin so the catalog picks up cover, screenshots and tags.
  3. Optional badge for your README:
     https://raw.githubusercontent.com/narlei/ulanzicommunitystore/main/docs/badges/ulanzi-community-store.svg
`);
  closeInput();
}

// ---------- help ----------

function showHelp() {
  console.log(`
ulanzi-plugin-starter — scaffold and store helpers for Ulanzi Deck/Dial plugins

Usage:
  npx ulanzi-plugin-starter@latest init     Scaffold or adapt a plugin for the Community Store
  npx ulanzi-plugin-starter@latest store    Create/update store.json from the current repo
  npx ulanzi-plugin-starter@latest help     Show this help

\`store\` reads the root *.ulanziPlugin/manifest.json and scans resources/ (and similar
folders) for cover/banner images, then asks only for what it cannot infer.
`);
}

// ---------- main ----------

async function run() {
  console.log('\n✨ Ulanzi Plugin Starter Kit\n');

  const git = await detectGitContext();
  const gh = await detectGithubUser();

  // --- Report what we found, so the user knows the CLI is context-aware ---
  if (git.isRepo) {
    console.log(`🔍 Local git repository detected${git.origin ? '' : ' (no GitHub remote yet)'}.`);
    if (git.owner && git.repo) console.log(`   Remote: github.com/${git.owner}/${git.repo}`);
  }
  if (gh.available && gh.user) console.log(`🔑 Signed in to GitHub as @${gh.user}.`);
  else if (gh.available) console.log('⚠️  GitHub CLI found but not authenticated (run `gh auth login` to enable repo creation).');
  else console.log('ℹ️  GitHub CLI (`gh`) not found — repo creation will be skipped. Install it from https://cli.github.com to enable it.');
  console.log('');

  // --- GitHub owner (handle). Prefer the logged-in gh user, otherwise ask. ---
  let owner = git.owner || gh.user || '';
  owner = await ask('GitHub username (owner)', owner);
  while (!owner) owner = await ask('GitHub username is required', '');

  // --- Resolve structure: adapt / hoist / wrap / new (may move files) ---
  const resolved = await resolvePluginStructure(TARGET_DIR, owner);
  if (resolved.aborted) {
    console.log('\nNo changes were made. Once the plugin lives in a `com.<you>.<plugin>.ulanziPlugin/`');
    console.log('folder at the repo root, run this command again to finish the setup.');
    closeInput();
    return;
  }

  let pluginId = resolved.pluginId;
  const adapted = resolved.adapted;
  let pluginName = 'My Ulanzi Plugin';
  let author, description, category, controllers, deviceTypesJson;

  if (adapted) {
    // Reuse the display name from the (now root-level) manifest, if we can read it.
    try {
      const mf = JSON.parse(await readFile(join(TARGET_DIR, `${pluginId}.ulanziPlugin`, 'manifest.json'), 'utf-8'));
      if (mf.Name) pluginName = mf.Name;
    } catch {}

    const devicesRaw = (await ask('Device types supported (deck, dial, or both)', 'deck')).toLowerCase();
    let deviceTypes = ['deck'];
    if (devicesRaw.includes('both')) deviceTypes = ['deck', 'dial'];
    else if (devicesRaw.includes('dial')) deviceTypes = ['dial'];
    deviceTypesJson = deviceTypes.map((d) => `    "${d}"`).join(',\n');
  } else {
    pluginName = await ask('Plugin name (e.g. Pomodoro Timer)', 'My Ulanzi Plugin');

    const defaultId = `com.${idPart(owner)}.${idPart(pluginName)}`;
    pluginId = await ask('Plugin ID', defaultId);

    author = await ask('Author (display name)', owner);
    description = await ask('Description', 'A plugin for Ulanzi Deck and Dial.');

    const devicesRaw = (await ask('Device types (deck, dial, or both)', 'deck')).toLowerCase();
    let deviceTypes = ['deck'];
    controllers = ['        "Keypad"'];
    if (devicesRaw.includes('both')) {
      deviceTypes = ['deck', 'dial'];
      controllers = ['        "Keypad",\n        "Encoder"'];
    } else if (devicesRaw.includes('dial')) {
      deviceTypes = ['dial'];
      controllers = ['        "Encoder"'];
    }
    deviceTypesJson = deviceTypes.map((d) => `    "${d}"`).join(',\n');
    category = await ask('Category', 'Custom');
  }

  // --- Repository name ---
  const repoBase = adapted ? slugify(pluginId.split('.').pop()) : slugify(pluginName);
  let repoName = git.repo || `ulanzideck-${repoBase}`;
  if (!git.origin) repoName = await ask('Repository name', repoName);

  // --- Scaffold ---
  console.log('\n⚙️  Generating plugin scaffolding...\n');

  const pluginDir = join(TARGET_DIR, `${pluginId}.ulanziPlugin`);
  await mkdir(pluginDir, { recursive: true });
  await mkdir(join(pluginDir, 'pi'), { recursive: true });
  await mkdir(join(TARGET_DIR, 'resources'), { recursive: true });
  await mkdir(join(TARGET_DIR, '.github', 'workflows'), { recursive: true });
  await mkdir(join(TARGET_DIR, '.claude', 'skills', 'ulanzi-plugin-dev'), { recursive: true });

  const tpl = async (name) => readFile(join(TEMPLATES_DIR, name), 'utf-8');
  const storeJson = (await tpl('store.json.tpl')).replace(/\{\{DEVICE_TYPES\}\}/g, deviceTypesJson);
  const makefile = (await tpl('Makefile.tpl')).replace(/\{\{PLUGIN_ID\}\}/g, pluginId);

  if (!adapted) {
    const manifest = (await tpl('manifest.json.tpl'))
      .replace(/\{\{PLUGIN_NAME\}\}/g, pluginName)
      .replace(/\{\{AUTHOR\}\}/g, author)
      .replace(/\{\{OWNER\}\}/g, owner)
      .replace(/\{\{DESCRIPTION\}\}/g, description)
      .replace(/\{\{CATEGORY\}\}/g, category)
      .replace(/\{\{REPO_NAME\}\}/g, repoName)
      .replace(/\{\{PLUGIN_ID\}\}/g, pluginId)
      .replace(/\{\{CONTROLLERS\}\}/g, controllers.join('\n'));
    const piHtml = (await tpl('pi.html.tpl')).replace(/\{\{PLUGIN_NAME\}\}/g, pluginName);

    await safeWrite(join(pluginDir, 'manifest.json'), manifest, 'manifest.json');
    await safeWrite(join(pluginDir, 'app.js'), await tpl('app.js.tpl'), 'app.js');
    await safeWrite(join(pluginDir, 'pi', 'index.html'), piHtml, 'pi/index.html');
  }

  await safeWrite(join(TARGET_DIR, 'store.json'), storeJson, 'store.json');
  await safeWrite(join(TARGET_DIR, 'Makefile'), makefile, 'Makefile');
  await safeWrite(join(TARGET_DIR, '.github', 'workflows', 'release.yml'), await tpl('release.yml.tpl'), 'release.yml (GitHub Actions)');
  await safeWrite(join(TARGET_DIR, '.gitignore'), await tpl('gitignore.tpl'), '.gitignore');
  await safeWrite(join(TARGET_DIR, '.claude', 'skills', 'ulanzi-plugin-dev', 'SKILL.md'), await tpl('SKILL.md.tpl'), 'Claude SKILL.md');
  await safeWrite(join(TARGET_DIR, 'resources', '.gitkeep'), '', 'resources/ folder');

  // --- Reference SDK ---
  if (await fileExists(join(TARGET_DIR, 'ulanzi_plugin_example'))) {
    console.log('  - ⏭️  Skipped SDK example (ulanzi_plugin_example already exists)');
  } else {
    console.log('\n📦 Downloading official Ulanzi SDK example...');
    const clone = await sh('git clone --depth 1 https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK ulanzi_plugin_example');
    if (clone.ok) {
      await rm(join(TARGET_DIR, 'ulanzi_plugin_example', '.git'), { recursive: true, force: true });
    } else {
      console.error('⚠️  Could not download the SDK example (is git installed?). You can clone it later.');
    }
  }

  // --- Git + GitHub wiring ---
  await setupGitAndGithub({ git, gh, owner, repoName });

  const repoUrl = `https://github.com/${owner}/${repoName}`;
  console.log(`
✅ Plugin '${pluginName}' is ready!

Next steps:
  1. cd into your project folder (if you're not already there)
  2. Run \`make install\` to install the plugin locally and restart Ulanzi Studio (macOS)${adapted ? '' : `
  3. Write your logic in \`${pluginId}.ulanziPlugin/app.js\``}
  4. Run \`make package\` to build the distributable .zip

🚀 Publish a release:
  - git tag v1.0.0 && git push origin v1.0.0
  - The included GitHub Action builds the zip and creates the Release automatically.

🛍️  Submit to the Ulanzi Community Store:
  - Open the Store app → "Submit", paste ${repoUrl}
  - or open a PR adding a file under registry/plugins/ at
    https://github.com/narlei/ulanzicommunitystore

💡 Using an AI assistant (Claude / Cursor / Gemini)?
  Ask it to "read the ulanzi-plugin-dev skill" — it's bundled in .claude/skills/.
`);

  closeInput();
}

// Handles: git init, a first commit (with a GitHub-based local identity),
// and creating + pushing the GitHub repo via `gh` — all opt-in.
async function setupGitAndGithub({ git, gh, owner, repoName }) {
  const targetSlug = `${owner}/${repoName}`;

  // Already wired to a GitHub remote — nothing to create.
  if (git.origin && git.owner && git.repo) {
    console.log(`\n🔗 Using existing remote github.com/${git.owner}/${git.repo}.`);
    return;
  }

  // Initialise a local repo if needed.
  let isRepo = git.isRepo;
  if (!isRepo) {
    if (!(await confirm('\nInitialise a local git repository here?', true))) return;
    const init = await sh('git init');
    if (!init.ok) { console.error('⚠️  git init failed:', init.stderr.trim()); return; }
    await sh('git symbolic-ref HEAD refs/heads/main'); // default branch = main, pre-commit
    isRepo = true;
    console.log('  - ✅ git repository initialised (branch: main)');
  }

  if (!(gh.available && gh.user)) {
    console.log(`\nℹ️  To publish, create the repo yourself and push:`);
    console.log(`     gh repo create ${targetSlug} --public --source . --remote origin --push`);
    console.log(`   (or create it on github.com and \`git remote add origin ${`https://github.com/${targetSlug}.git`}\`)`);
    return;
  }

  if (!(await confirm(`\nCreate GitHub repository ${targetSlug} now and push?`, true))) {
    console.log('   Skipped — you can run the command above whenever you like.');
    return;
  }

  const visibility = (await confirm('Make it public? (required for the Community Store)', true)) ? '--public' : '--private';

  // Ensure a commit exists before pushing. Use a repo-local identity derived from
  // the GitHub handle so we never depend on (or modify) the machine's global git config.
  const email = await sh('git config user.email');
  if (!email.ok || !email.stdout.trim()) {
    await sh(`git config user.name "${owner}"`);
    await sh(`git config user.email "${owner}@users.noreply.github.com"`);
    console.log('  - ✅ Set a repo-local git identity from your GitHub handle');
  }
  await sh('git add -A');
  const commit = await sh('git commit -m "Initial Ulanzi plugin scaffold"');
  if (!commit.ok && !/nothing to commit/.test(commit.stdout + commit.stderr)) {
    console.error('⚠️  Could not create the initial commit:', (commit.stderr || commit.stdout).trim());
  }

  console.log(`\n🐙 Creating ${targetSlug}...`);
  const create = await sh(`gh repo create ${targetSlug} ${visibility} --source . --remote origin --push`);
  if (create.ok) {
    console.log(`  - ✅ Repository created and pushed: https://github.com/${targetSlug}`);
  } else {
    console.error('⚠️  Repo creation failed:', (create.stderr || create.stdout).trim());
    console.error(`   You can retry with: gh repo create ${targetSlug} ${visibility} --source . --remote origin --push`);
  }
}

// ---------- entry ----------

const cmd = (process.argv[2] || 'init').toLowerCase();
const dispatch = {
  init: run,
  store: runStore,
  help: async () => { showHelp(); closeInput(); },
  '--help': async () => { showHelp(); closeInput(); },
  '-h': async () => { showHelp(); closeInput(); },
};

const handler = dispatch[cmd];
if (!handler) {
  console.error(`Unknown command: ${process.argv[2]}`);
  showHelp();
  closeInput();
  process.exit(1);
} else {
  handler().catch((err) => {
    console.error('Error:', err);
    closeInput();
    process.exit(1);
  });
}
