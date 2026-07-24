#!/usr/bin/env node
// Daily security scan of every community plugin repo listed in registry/plugins/*.json.
//
// For each `{ "repo": "owner/name" }` entry it shallow-clones the repo and runs
// Trivy (dependency vulnerabilities + leaked secrets). Results are aggregated into
// a Markdown report so the CI can drop it into the job summary and open/update a
// GitHub issue. Third-party repos are only *flagged* here — we can't fix them.
//
// Usage: node scripts/security-scan.mjs
// Env:
//   SEVERITY       comma list passed to Trivy   (default: HIGH,CRITICAL)
//   REPORT_FILE    where to write the Markdown report (default: security-report.md)
//   GITHUB_TOKEN   optional, used to authenticate git clone (raises rate limits)
//   GITHUB_OUTPUT  optional, GitHub Actions output file (we set `found` + `report`)
//   MAX_ROWS       max finding rows per repo in the report (default: 25)

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REGISTRY_DIR = new URL('../registry/plugins/', import.meta.url);
const SEVERITY = process.env.SEVERITY || 'HIGH,CRITICAL';
const REPORT_FILE = process.env.REPORT_FILE || 'security-report.md';
const MAX_ROWS = Number(process.env.MAX_ROWS || 25);
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
// Where the per-repo machine-readable results are written, keyed by registry
// filename. build-catalog.mjs reads these to attach a `security` field to each
// catalog entry. Defaults to <root>/dist/security.
const SECURITY_DIR = process.env.SECURITY_DIR || fileURLToPath(new URL('../dist/security/', import.meta.url));
// Optional allow-list of registry entries to scan, used by the PR check to scan ONLY the
// files a Pull Request touched instead of the whole registry. Accepts full paths or bare
// filenames, space/newline separated. Empty → scan everything (daily/full run).
const ONLY_FILES = new Set(
  (process.env.ONLY_FILES || '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.split('/').pop()),
);

function readRegistry() {
  const dir = new URL(REGISTRY_DIR);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => ONLY_FILES.size === 0 || ONLY_FILES.has(f))
    .map((f) => {
      const raw = readFileSync(new URL(f, REGISTRY_DIR), 'utf8');
      let repo = null;
      try {
        repo = JSON.parse(raw).repo || null;
      } catch {
        /* malformed entry — reported below */
      }
      return { file: f, repo };
    });
}

function cloneUrl(repo) {
  if (TOKEN) return `https://x-access-token:${TOKEN}@github.com/${repo}.git`;
  return `https://github.com/${repo}.git`;
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

// Reads the Trivy version at runtime so the catalog never advertises a stale/wrong
// scanner version. Returns 'unknown' if Trivy is missing or the output is unexpected.
function trivyVersion() {
  try {
    const out = run('trivy', ['--version']);
    const m = out.match(/Version:\s*v?([\w.\-]+)/i);
    return m ? m[1] : (out.split('\n')[0] || '').trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

// Scan a single repo; returns { repo, error?, vulns:[], secrets:[] }.
function scanRepo(repo) {
  const workdir = mkdtempSync(join(tmpdir(), 'scan-'));
  const checkout = join(workdir, 'repo');
  try {
    run('git', ['clone', '--depth', '1', '--quiet', cloneUrl(repo), checkout]);

    // Record the commit actually scanned so the catalog can show exactly what was
    // checked (the scan runs against the default branch HEAD, not a release tag).
    let sha = null;
    try {
      sha = run('git', ['-C', checkout, 'rev-parse', 'HEAD']).trim().slice(0, 7);
    } catch {
      /* non-fatal — sha stays null */
    }

    const out = run('trivy', [
      'fs',
      '--scanners', 'vuln,secret',
      '--severity', SEVERITY,
      '--format', 'json',
      '--quiet',
      '--no-progress',
      checkout,
    ]);

    const json = JSON.parse(out || '{}');
    const vulns = [];
    const secrets = [];
    for (const result of json.Results || []) {
      const target = (result.Target || '').replace(`${checkout}/`, '');
      for (const v of result.Vulnerabilities || []) {
        vulns.push({
          target,
          id: v.VulnerabilityID,
          pkg: v.PkgName,
          installed: v.InstalledVersion,
          fixed: v.FixedVersion || '—',
          severity: v.Severity,
          url: v.PrimaryURL || '',
        });
      }
      for (const s of result.Secrets || []) {
        secrets.push({
          target,
          rule: s.RuleID,
          severity: s.Severity,
          title: s.Title,
          line: s.StartLine,
        });
      }
    }
    return { repo, sha, vulns, secrets };
  } catch (err) {
    const msg = (err.stderr || err.stdout || err.message || '').toString().trim().split('\n').slice(-3).join(' ');
    return { repo, sha: null, error: msg || 'unknown error', vulns: [], secrets: [] };
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

function sevRank(s) {
  return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 }[s] ?? 5;
}

// The repo owner (`owner/name` → `owner`) is a real GitHub handle, unlike the free-text
// `Author` in manifest.json — safe to @-mention inside our own issue/comments.
function mentionFor(repo) {
  return `@${repo.split('/')[0]}`;
}

// Compact, machine-readable record consumed by build-catalog.mjs. One file per
// registry entry, so the join key is the registry filename.
//   status: clean | findings | error   (build-catalog fills `unknown` when absent)
function toSecurityRecord(repo, result, scanner, scannedAt) {
  const critical = result.vulns.filter((v) => v.severity === 'CRITICAL').length;
  const high = result.vulns.filter((v) => v.severity === 'HIGH').length;
  const secrets = result.secrets.length;
  const status = result.error ? 'error' : critical || high || secrets ? 'findings' : 'clean';
  const record = {
    repo,
    status,
    scanner,
    severityFilter: SEVERITY,
    critical,
    high,
    secrets,
    scannedRef: result.sha || null,
    scannedAt,
  };
  if (result.error) record.error = result.error;
  return record;
}

function buildReport(results) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const lines = [];
  lines.push(`# 🔒 Community plugin security scan`);
  lines.push('');
  lines.push(`Severity filter: \`${SEVERITY}\` · Scanned ${results.length} repo(s) · ${now}`);
  lines.push('');

  const withFindings = results.filter((r) => r.vulns.length || r.secrets.length);
  const errored = results.filter((r) => r.error);
  const clean = results.filter((r) => !r.error && !r.vulns.length && !r.secrets.length);

  // Summary table
  lines.push('| Repo | Vulnerabilities | Secrets | Status |');
  lines.push('| --- | ---: | ---: | --- |');
  for (const r of results) {
    const status = r.error ? '⚠️ scan error' : r.vulns.length || r.secrets.length ? '❌ findings' : '✅ clean';
    lines.push(`| [${r.repo}](https://github.com/${r.repo}) | ${r.vulns.length} | ${r.secrets.length} | ${status} |`);
  }
  lines.push('');

  if (withFindings.length) {
    // Deduped so an author with several plugins is only pinged once. This is our own
    // issue/comment, so the mention is a real GitHub notification — not a message
    // posted on a third-party repo.
    const mentions = [...new Set(withFindings.map((r) => mentionFor(r.repo)))];
    lines.push(`**Maintainers to ping:** ${mentions.join(' ')}`);
    lines.push('');
  }

  for (const r of withFindings) {
    lines.push(`## ❌ ${r.repo}`);
    lines.push('');
    lines.push(`Maintainer: ${mentionFor(r.repo)}`);
    lines.push('');
    if (r.vulns.length) {
      const rows = [...r.vulns].sort((a, b) => sevRank(a.severity) - sevRank(b.severity)).slice(0, MAX_ROWS);
      lines.push('**Vulnerabilities**');
      lines.push('');
      lines.push('| Severity | Package | Installed | Fixed | Advisory |');
      lines.push('| --- | --- | --- | --- | --- |');
      for (const v of rows) {
        const adv = v.url ? `[${v.id}](${v.url})` : v.id;
        lines.push(`| ${v.severity} | \`${v.pkg}\` (${v.target}) | ${v.installed} | ${v.fixed} | ${adv} |`);
      }
      if (r.vulns.length > MAX_ROWS) lines.push(`| … | +${r.vulns.length - MAX_ROWS} more | | | |`);
      lines.push('');
    }
    if (r.secrets.length) {
      lines.push('**Possible leaked secrets**');
      lines.push('');
      lines.push('| Severity | Rule | Location |');
      lines.push('| --- | --- | --- |');
      for (const s of r.secrets.slice(0, MAX_ROWS)) {
        lines.push(`| ${s.severity} | ${s.rule} | ${s.target}:${s.line} |`);
      }
      lines.push('');
    }
  }

  if (errored.length) {
    lines.push('## ⚠️ Scan errors');
    lines.push('');
    for (const r of errored) lines.push(`- **${r.repo}** — ${r.error}`);
    lines.push('');
  }

  if (clean.length) {
    lines.push(`<sub>✅ Clean: ${clean.map((r) => r.repo).join(', ')}</sub>`);
    lines.push('');
  }

  return { report: lines.join('\n'), hasFindings: withFindings.length > 0, errored: errored.length };
}

function main() {
  const entries = readRegistry();
  const scanner = { name: 'Trivy', version: trivyVersion() };
  const scannedAt = new Date().toISOString();
  console.log(`Scanning ${entries.length} registry entrie(s) with severity ${SEVERITY} (Trivy ${scanner.version})…`);

  mkdirSync(SECURITY_DIR, { recursive: true });

  const results = [];
  for (const { file, repo } of entries) {
    let result;
    if (!repo) {
      result = { repo: file, error: 'malformed manifest (no "repo" field)', vulns: [], secrets: [] };
    } else {
      console.log(`→ ${repo}`);
      result = scanRepo(repo);
    }
    results.push(result);
    // One JSON per registry file, so build-catalog can join by the registry entry.
    const record = toSecurityRecord(repo || file, result, scanner, scannedAt);
    writeFileSync(join(SECURITY_DIR, file), JSON.stringify(record, null, 2) + '\n');
  }

  const { report, hasFindings, errored } = buildReport(results);
  writeFileSync(REPORT_FILE, report);
  console.log(`\nReport written to ${REPORT_FILE} (findings: ${hasFindings}, errors: ${errored}).`);
  console.log(`Per-repo security records written to ${SECURITY_DIR}`);

  if (process.env.GITHUB_OUTPUT) {
    const secretsTotal = results.reduce((n, r) => n + (r.secrets?.length || 0), 0);
    const criticalTotal = results.reduce(
      (n, r) => n + (r.vulns?.filter((v) => v.severity === 'CRITICAL').length || 0),
      0,
    );
    appendFileSync(process.env.GITHUB_OUTPUT, `found=${hasFindings}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `errors=${errored}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `secrets=${secretsTotal}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `critical=${criticalTotal}\n`);
  }

  // Never fail the job on findings — we surface them via summary + issue instead.
  process.exit(0);
}

main();
