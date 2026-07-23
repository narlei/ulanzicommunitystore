#!/usr/bin/env node
// Reads a "Publish a plugin" issue and extracts the repository slug.
//
// The issue body is UNTRUSTED input (anyone can open an issue), so nothing here is
// ever interpolated into a shell command: the workflow passes the body through env
// and only consumes the strict `owner/repo` slug this script emits.
//
// Input:  env ISSUE_BODY, ISSUE_LABELS (comma-separated, optional)
// Output: GITHUB_OUTPUT with `is_submission`, `repo`, `file` and `error`.

import { appendFile } from 'node:fs/promises';

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const FIELD_HEADING = 'plugin repository';
const SUBMISSION_LABEL = 'plugin-submission';

// Issue forms render as `### <label>` followed by the value. Grabs the section
// belonging to the repository field, ignoring the free-text ones.
function fieldValue(body, heading) {
  const lines = body.split(/\r?\n/);
  let capturing = false;
  const collected = [];
  for (const line of lines) {
    const match = line.match(/^#{1,6}\s+(.*)$/);
    if (match) {
      if (capturing) break;
      capturing = match[1].trim().toLowerCase() === heading;
      continue;
    }
    if (capturing) collected.push(line);
  }
  return collected.join('\n').trim();
}

// Same rules as the app's parseRepoInput: bare slug or any GitHub URL shape.
function parseRepo(input) {
  const value = String(input || '')
    .trim()
    .replace(/^`+|`+$/g, '')
    .replace(/\/+$/, '');
  if (!value) return null;
  if (REPO_RE.test(value)) return value;
  const match = value.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:git@)?github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[/?#].*)?$/i,
  );
  if (!match) return null;
  const slug = `${match[1]}/${match[2]}`;
  return REPO_RE.test(slug) ? slug : null;
}

async function output(values) {
  const file = process.env.GITHUB_OUTPUT;
  const text = Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  console.log(text);
  if (file) await appendFile(file, `${text}\n`);
}

const body = process.env.ISSUE_BODY || '';
const labels = (process.env.ISSUE_LABELS || '')
  .split(',')
  .map((l) => l.trim().toLowerCase())
  .filter(Boolean);

const raw = fieldValue(body, FIELD_HEADING);
const isSubmission = raw !== '' || labels.includes(SUBMISSION_LABEL);

if (!isSubmission) {
  await output({ is_submission: 'false', repo: '', file: '', error: '' });
  process.exit(0);
}

const repo = parseRepo(raw);
if (!repo) {
  await output({
    is_submission: 'true',
    repo: '',
    file: '',
    error: 'could-not-parse-repo',
  });
  process.exit(0);
}

await output({
  is_submission: 'true',
  repo,
  file: `registry/plugins/${repo.replace('/', '__')}.json`,
  error: '',
});
