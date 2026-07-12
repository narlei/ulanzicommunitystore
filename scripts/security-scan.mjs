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
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REGISTRY_DIR = new URL('../registry/plugins/', import.meta.url);
const SEVERITY = process.env.SEVERITY || 'HIGH,CRITICAL';
const REPORT_FILE = process.env.REPORT_FILE || 'security-report.md';
const MAX_ROWS = Number(process.env.MAX_ROWS || 25);
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

function readRegistry() {
  const dir = new URL(REGISTRY_DIR);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
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

// Scan a single repo; returns { repo, error?, vulns:[], secrets:[] }.
function scanRepo(repo) {
  const workdir = mkdtempSync(join(tmpdir(), 'scan-'));
  const checkout = join(workdir, 'repo');
  try {
    run('git', ['clone', '--depth', '1', '--quiet', cloneUrl(repo), checkout]);

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
    return { repo, vulns, secrets };
  } catch (err) {
    const msg = (err.stderr || err.stdout || err.message || '').toString().trim().split('\n').slice(-3).join(' ');
    return { repo, error: msg || 'unknown error', vulns: [], secrets: [] };
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

function sevRank(s) {
  return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 }[s] ?? 5;
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

  for (const r of withFindings) {
    lines.push(`## ❌ ${r.repo}`);
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
  console.log(`Scanning ${entries.length} registry entrie(s) with severity ${SEVERITY}…`);

  const results = [];
  for (const { file, repo } of entries) {
    if (!repo) {
      results.push({ repo: file, error: 'malformed manifest (no "repo" field)', vulns: [], secrets: [] });
      continue;
    }
    console.log(`→ ${repo}`);
    results.push(scanRepo(repo));
  }

  const { report, hasFindings, errored } = buildReport(results);
  writeFileSync(REPORT_FILE, report);
  console.log(`\nReport written to ${REPORT_FILE} (findings: ${hasFindings}, errors: ${errored}).`);

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `found=${hasFindings}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `errors=${errored}\n`);
  }

  // Never fail the job on findings — we surface them via summary + issue instead.
  process.exit(0);
}

main();
