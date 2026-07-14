#!/usr/bin/env node
// Onboard third-party Ulanzi plugins into the Community Store by opening a
// ready-made PR against each author's repo.
//
// For every target it: forks the repo, branches off the upstream default,
// runs the local plugin-starter in non-interactive mode (--yes --minimal
// --skip-sdk) to make it store-ready without touching plugin source, commits,
// pushes to our fork, and opens a PR upstream.
//
// Usage:
//   node scripts/onboard-store-prs.mjs list                  # show targets
//   node scripts/onboard-store-prs.mjs prepare [sel]         # fork+branch+adapt+push, NO PR
//   node scripts/onboard-store-prs.mjs publish [sel]         # open PRs for prepared forks
//   node scripts/onboard-store-prs.mjs run     [sel]         # prepare + publish
//
//   [sel] = --pilot (default) | --all | one or more repo slugs / names
//   --draft  open PRs as drafts (applies to publish / run)
//
// Two-phase by design: `prepare` is reversible (only touches our own fork);
// review the diffs, then `publish` opens the PRs.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const CLI = join(REPO_ROOT, 'plugin-starter', 'bin', 'cli.mjs');
const WORKSPACE = join(REPO_ROOT, '.plugin-forks');
const BRANCH = 'ulanzi-community-store';
const STORE_SITE = 'https://ulanzicommunitystore.narlei.com';
const STORE_REPO = 'narlei/ulanzicommunitystore';
const PR_TITLE = 'Add Ulanzi Community Store support';

const ME = getMe();
const DRAFT = process.argv.includes('--draft');
const ALL = JSON.parse(readFileSync(join(__dirname, 'onboard-targets.json'), 'utf8')).targets;

// ---------- shell helpers ----------

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString();
}
function tryRun(cmd, args, opts = {}) {
  try { return { ok: true, out: run(cmd, args, opts).trim() }; }
  catch (e) { return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}`.toString().trim() }; }
}
function getMe() {
  const r = tryRun('gh', ['api', 'user', '-q', '.login']);
  if (!r.ok || !r.out) { console.error('✖ gh not authenticated. Run `gh auth login`.'); process.exit(1); }
  return r.out;
}

const log = (...a) => console.log(...a);
const forkName = (repo) => repo.split('/')[1];
const forkDir = (repo) => join(WORKSPACE, repo.replace('/', '__'));
const defaultBranch = (repo) => run('gh', ['repo', 'view', repo, '--json', 'defaultBranchRef', '-q', '.defaultBranchRef.name']).trim();

// ---------- plugin / PR content ----------

// A loose-manifest "wrap" moves every non-infra file at the repo root into the
// plugin folder. That's fine for a flat plugin, but destructive for a repo that
// compiles to a plugin (its build toolchain / source tree lives at the root).
// Detect those and hand them off for manual review instead of relocating the tree.
const BUILD_FILES = new Set([
  'package.json', 'tsconfig.json', 'cargo.toml', 'go.mod', 'pom.xml',
  'pyproject.toml', 'requirements.txt', 'gemfile', 'composer.json', 'setup.py',
]);
const BUILD_EXT = ['.csproj', '.sln', '.vcxproj', '.gradle'];
const BUILD_DIRS = new Set(['src', 'scripts']);
function buildToolingAtRoot(dir) {
  const hits = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const l = e.name.toLowerCase();
    if (e.isDirectory()) { if (BUILD_DIRS.has(l)) hits.push(`${e.name}/`); }
    else if (BUILD_FILES.has(l) || BUILD_EXT.some((x) => l.endsWith(x))) hits.push(e.name);
  }
  return hits;
}

function pluginInfo(dir) {
  const folder = readdirSync(dir).find(
    (f) => f.endsWith('.ulanziPlugin') && existsSync(join(dir, f, 'manifest.json'))
  );
  let name = null, version = null;
  const id = folder ? folder.replace(/\.ulanziPlugin$/, '') : null;
  if (folder) {
    try { const m = JSON.parse(readFileSync(join(dir, folder, 'manifest.json'), 'utf8')); name = m.Name; version = m.Version; } catch {}
  }
  return { name, id, folder, version };
}

// Patch-bump the manifest Version (in place, surgical replace so the diff is one line).
// The release workflow triggers on a manifest.json change, so this makes the merge
// itself publish a release. Returns { from, to } (to=null if Version is non-numeric).
const VERSION_RE = /("Version"\s*:\s*")([^"]+)(")/;
function bumpManifestPatch(dir, folder) {
  const p = join(dir, folder, 'manifest.json');
  const raw = readFileSync(p, 'utf8');
  const m = raw.match(VERSION_RE);
  if (!m) return { from: null, to: null };
  const parts = m[2].trim().split('.').map((n) => parseInt(n, 10));
  while (parts.length < 3) parts.push(0);
  if (parts.some((n) => Number.isNaN(n))) return { from: m[2], to: null };
  parts[parts.length - 1] += 1;
  const next = parts.join('.');
  writeFileSync(p, raw.replace(VERSION_RE, `$1${next}$3`));
  return { from: m[2], to: next };
}

function caseLine(target, info) {
  const folder = info.folder || `${info.id}.ulanziPlugin`;
  switch (target.case) {
    case 'wrap':
      return `- **Wraps** your plugin files into a \`${folder}/\` folder (the store looks for it at the repo root).`;
    case 'hoist':
      return `- **Moves** your plugin folder up to the repo root (where the store looks for it).`;
    default: // adapt
      return `- Your plugin folder is already at the repo root — **nothing was moved**.`;
  }
}

function prBody(target, dir) {
  const info = pluginInfo(dir);
  const label = info.name ? `**${info.name}**` : `\`${target.repo}\``;
  const ver = info.version ? `v${info.version}` : 'a version';
  return `Hi 👋 — I help run the **Ulanzi Community Store**, a community-run, open-source catalog for Ulanzi Deck & Dial plugins: one-click install and automatic updates on every GitHub Release. It's **not** a replacement for the official Ulanzi Studio Marketplace — it's a complementary fast lane for community makers, unaffiliated with Ulanzi.

I'd love to include ${label}. This PR makes the repo store-ready:

${caseLine(target, info)}
- Adds a GitHub Actions workflow (\`.github/workflows/release.yml\`) that publishes the plugin zip as a Release.
- Bumps the plugin's patch version so merging this PR triggers that release.

**Your plugin's own source code was not changed.**

### After you merge
That's it — no extra steps. Merging publishes a **${ver}** release automatically (the workflow builds the \`.ulanziPlugin.zip\` and creates the GitHub Release), and future releases go out whenever you bump the \`Version\` in your manifest. You can also run it any time from the **Actions** tab → *release-plugin* → **Run workflow**.

Once the release is up, the plugin can be listed. Site: ${STORE_SITE} · Registry: https://github.com/${STORE_REPO}

Not interested? No problem at all — just close this PR. 💚
`;
}

// ---------- steps ----------

function ensureFork(repo) {
  const fork = `${ME}/${forkName(repo)}`;
  const view = tryRun('gh', ['repo', 'view', fork, '--json', 'isFork,parent']);
  if (view.ok) {
    let parentSlug = '';
    try {
      const j = JSON.parse(view.out);
      if (j.isFork && j.parent) parentSlug = `${j.parent.owner.login}/${j.parent.name}`;
    } catch {}
    if (parentSlug.toLowerCase() !== repo.toLowerCase()) {
      throw new Error(`${fork} exists but is not a fork of ${repo} (parent: ${parentSlug || 'none'}). Skipping to avoid clobbering it.`);
    }
    return fork; // already forked
  }
  log(`   forking ${repo} → ${fork}`);
  const fk = tryRun('gh', ['repo', 'fork', repo, '--clone=false']);
  if (!fk.ok) throw new Error(`fork failed: ${fk.out}`);
  return fork;
}

function prepare(target) {
  const { repo } = target;
  const dir = forkDir(repo);
  log(`\n▶ ${repo}  (${target.case}, ${target.device})`);

  if (target.manual) {
    log(`   ⏭️  manual: ${target.manualReason || 'flagged for hand-handling'}`);
    return { repo, dir, status: 'manual', reason: target.manualReason };
  }

  ensureFork(repo);

  if (!existsSync(dir)) {
    // Fork can take a moment to be clonable right after creation.
    let cloned = false;
    for (let i = 0; i < 5 && !cloned; i++) {
      const c = tryRun('gh', ['repo', 'clone', `${ME}/${forkName(repo)}`, dir, '--', '--origin', 'origin']);
      cloned = c.ok || existsSync(dir);
      if (!cloned) run('sleep', ['2']);
    }
    if (!cloned) throw new Error('clone failed');
  }

  const def = defaultBranch(repo);
  if (!run('git', ['remote'], { cwd: dir }).includes('upstream')) {
    run('git', ['remote', 'add', 'upstream', `https://github.com/${repo}.git`], { cwd: dir });
  }
  run('git', ['fetch', '--quiet', 'upstream', def], { cwd: dir });

  // Recreate the branch fresh off the upstream default so the diff is clean and re-runnable.
  tryRun('git', ['checkout', '--quiet', '-B', 'tmp-base', `upstream/${def}`], { cwd: dir });
  tryRun('git', ['branch', '-D', BRANCH], { cwd: dir });
  run('git', ['checkout', '--quiet', '-b', BRANCH, `upstream/${def}`], { cwd: dir });

  // Guard: a loose-manifest wrap on a repo that compiles to a plugin would move
  // its whole source tree into the plugin folder. Hand those off for manual review.
  const rootFolder = readdirSync(dir).some((f) => f.endsWith('.ulanziPlugin') && statSync(join(dir, f)).isDirectory());
  const willWrap = !rootFolder && existsSync(join(dir, 'manifest.json'));
  if (willWrap && !target.forceWrap) {
    const tooling = buildToolingAtRoot(dir);
    if (tooling.length) {
      log(`   ⏭️  manual review: loose manifest + build toolchain at root (${tooling.join(', ')})`);
      return { repo, dir, status: 'manual', reason: `build toolchain at root: ${tooling.join(', ')}` };
    }
  }

  // Adapt in place — non-interactive, store essentials only, no source changes.
  run('node', [CLI, '--yes', '--minimal', '--skip-sdk', '--skip-store', `--owner=${repo.split('/')[0]}`, `--device=${target.device}`, `--default-branch=${def}`], { cwd: dir });

  // Verify the end state structurally.
  const info = pluginInfo(dir);
  if (!info.folder) throw new Error('no *.ulanziPlugin/ folder at repo root after adaptation');
  if (!existsSync(join(dir, '.github', 'workflows', 'release.yml'))) throw new Error('release.yml missing');

  // Patch-bump so the merge itself triggers the release workflow (manifest.json change).
  const bump = bumpManifestPatch(dir, info.folder);
  if (bump.to) log(`   ↑ manifest Version ${bump.from} → ${bump.to}`);
  else log(`   ⚠️  manifest Version "${bump.from}" is non-numeric — left as-is (merge won't auto-release)`);

  run('git', ['add', '-A'], { cwd: dir });
  const status = run('git', ['status', '--porcelain'], { cwd: dir }).trim();
  if (!status) { log('   ⚠️  nothing changed — repo may already be store-ready'); return { repo, dir, status: 'nochange', plugin: info }; }

  run('git', ['commit', '--quiet', '-m', PR_TITLE], { cwd: dir });
  run('git', ['push', '--force-with-lease', '-u', 'origin', BRANCH], { cwd: dir });
  const files = status.split('\n').map((l) => l.slice(3));
  log(`   ✅ prepared & pushed (${files.length} files): ${files.join(', ')}`);
  return { repo, dir, status: 'prepared', plugin: info };
}

function publish(target) {
  const { repo } = target;
  const dir = forkDir(repo);
  if (target.manual) { log(`▶ ${repo}\n   ⏭️  manual — skipping`); return { repo, status: 'manual', reason: target.manualReason }; }
  if (!existsSync(dir)) { log(`▶ ${repo}\n   ↩︎ not prepared (no local clone) — skipping`); return { repo, status: 'skipped' }; }

  // Manual/unprepared repos never pushed the branch to our fork — skip them cleanly.
  if (!tryRun('git', ['ls-remote', '--exit-code', 'origin', BRANCH], { cwd: dir }).ok) {
    log(`▶ ${repo}\n   ↩︎ not prepared (no pushed branch) — skipping`);
    return { repo, status: 'skipped' };
  }

  // `gh pr list --head` takes the branch name only (no owner: prefix); scope to our fork by author.
  const existing = tryRun('gh', ['pr', 'list', '--repo', repo, '--head', BRANCH, '--state', 'open', '--json', 'url,author', '-q', `.[] | select(.author.login=="${ME}") | .url`]);
  if (existing.ok && existing.out) {
    const url = existing.out.split('\n')[0];
    tryRun('gh', ['pr', 'edit', url, '--body', prBody(target, dir)]); // keep the body in sync with the template
    log(`▶ ${repo}\n   ↩︎ PR already open (body synced): ${url}`);
    return { repo, url, skipped: true };
  }

  const def = defaultBranch(repo);
  const args = ['pr', 'create', '--repo', repo, '--base', def, '--head', `${ME}:${BRANCH}`, '--title', PR_TITLE, '--body', prBody(target, dir)];
  if (DRAFT) args.push('--draft');
  const res = tryRun('gh', args);
  if (!res.ok) throw new Error(`pr create failed: ${res.out}`);
  const url = (res.out.match(/https:\/\/github\.com\/\S+/) || [res.out])[0];
  log(`▶ ${repo}\n   ✅ ${DRAFT ? 'draft ' : ''}PR opened: ${url}`);
  return { repo, url };
}

// ---------- badge ----------

const BADGE_MD = '[![Available on Ulanzi Community Store](https://raw.githubusercontent.com/narlei/ulanzicommunitystore/main/docs/badges/ulanzi-community-store.svg)](https://ulanzicommunitystore.narlei.com)';
const H1_RE = /^#\s+.+$/m;

// Add the store badge to the plugin's README — after the first markdown H1 if there
// is one, else prepended at the top, else a fresh minimal README is created.
// Idempotent: no-ops if the badge is already present.
function insertBadge(dir, info) {
  const readmeName = readdirSync(dir).find((f) => /^readme\.md$/i.test(f));
  if (!readmeName) {
    const title = info.name || dir.split('__').pop();
    writeFileSync(join(dir, 'README.md'), `# ${title}\n\n${BADGE_MD}\n`);
    return 'created';
  }
  const p = join(dir, readmeName);
  const raw = readFileSync(p, 'utf8');
  if (raw.includes(BADGE_MD) || raw.includes('ulanzicommunitystore.narlei.com')) return 'already-present';
  const h1 = raw.match(H1_RE);
  const next = h1
    ? raw.replace(H1_RE, `${h1[0]}\n\n${BADGE_MD}`)
    : `${BADGE_MD}\n\n${raw}`;
  writeFileSync(p, next);
  return h1 ? 'inserted-after-h1' : 'prepended';
}

function addBadge(target) {
  // Unlike prepare/publish, "manual" here only means "don't auto-adapt" — it doesn't
  // mean "no open PR". d850/ragibs were hand-fixed and do have an open PR, so badge
  // still applies to them; the branch-pushed check below is the real gate.
  const { repo } = target;
  const dir = forkDir(repo);
  if (!existsSync(dir) || !tryRun('git', ['ls-remote', '--exit-code', 'origin', BRANCH], { cwd: dir }).ok) {
    log(`▶ ${repo}\n   ↩︎ no open PR from our fork — skipping`);
    return { repo, status: 'skipped' };
  }

  run('git', ['checkout', '--quiet', BRANCH], { cwd: dir });
  const info = pluginInfo(dir);
  const result = insertBadge(dir, info);
  if (result === 'already-present') { log(`▶ ${repo}\n   • badge already present — no-op`); return { repo, status: 'noop' }; }

  run('git', ['add', '-A'], { cwd: dir });
  run('git', ['commit', '--quiet', '-m', 'Add Ulanzi Community Store badge to README'], { cwd: dir });
  run('git', ['push', '--quiet', 'origin', BRANCH], { cwd: dir });
  log(`▶ ${repo}\n   ✅ badge ${result} & pushed`);
  return { repo, status: result };
}

// ---------- CLI ----------

function select(rest) {
  const flags = rest.filter((a) => a.startsWith('--'));
  const names = rest.filter((a) => !a.startsWith('--'));
  if (names.length) return ALL.filter((t) => names.includes(t.repo) || names.includes(forkName(t.repo)));
  if (flags.includes('--all')) return ALL;
  return ALL.filter((t) => t.pilot); // default
}

function main() {
  const [sub, ...rest] = process.argv.slice(2);
  if (!sub || sub === 'list') {
    log(`Targets (${ALL.length}) — ${ME} is the fork owner\n`);
    for (const t of ALL) log(`  ${t.pilot ? '★' : ' '} ${t.repo}  [${t.case}, ${t.device}]${t.note ? `  ⚠️ ${t.note}` : ''}`);
    log('\n★ = pilot pair. Subcommands: prepare | publish | run | badge  (sel: --pilot | --all | <repo>...)');
    return;
  }
  mkdirSync(WORKSPACE, { recursive: true });
  const sel = select(rest);
  if (!sel.length) { console.error('No targets matched.'); process.exit(1); }

  if (sub === 'badge') {
    log(`\n=== badge · ${sel.length} repo(s) ===`);
    const results = sel.map((t) => {
      try { return addBadge(t); }
      catch (e) { log(`   ✖ ${t.repo}: ${e.message}`); return { repo: t.repo, error: e.message }; }
    });
    log('\n=== summary ===');
    for (const r of results) {
      if (r.error) log(`  ✖ ${r.repo} — ${r.error}`);
      else log(`  ${r.status === 'manual' || r.status === 'skipped' ? '↩︎' : '✅'} ${r.repo} — ${r.status}`);
    }
    return;
  }

  const doPrepare = sub === 'prepare' || sub === 'run';
  const doPublish = sub === 'publish' || sub === 'run';
  if (!doPrepare && !doPublish) { console.error(`Unknown subcommand: ${sub}`); process.exit(1); }

  log(`\n=== ${sub} · ${sel.length} repo(s) ===`);
  const results = [];
  for (const t of sel) {
    try {
      let prep = { status: 'prepared' };
      if (doPrepare) prep = prepare(t);
      if (doPublish && prep.status === 'prepared') {
        const pub = publish(t);
        results.push({ repo: t.repo, ...pub });
      } else if (doPrepare) {
        results.push({ repo: t.repo, status: prep.status, reason: prep.reason });
      }
    } catch (e) {
      log(`   ✖ ${t.repo}: ${e.message}`);
      results.push({ repo: t.repo, error: e.message });
    }
  }

  log('\n=== summary ===');
  for (const r of results) {
    if (r.error) log(`  ✖ ${r.repo} — ${r.error}`);
    else if (r.url) log(`  ✅ ${r.repo} — ${r.skipped ? 'already open' : 'PR'} ${r.url}`);
    else if (r.status === 'manual') log(`  ⏭️  ${r.repo} — manual: ${r.reason}`);
    else if (r.status === 'skipped') log(`  ↩︎ ${r.repo} — skipped (not prepared)`);
    else if (r.status === 'nochange') log(`  • ${r.repo} — no changes (already store-ready?)`);
    else log(`  • ${r.repo} — prepared`);
  }
}

main();
