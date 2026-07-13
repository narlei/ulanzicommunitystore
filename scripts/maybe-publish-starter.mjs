#!/usr/bin/env node
// Publishes plugin-starter to npm when the version in its package.json
// is not yet on the registry. Safe to run repeatedly — it is a no-op
// whenever the current version is already published.
//
// Invoked by the pre-push git hook (.githooks/pre-push). Never blocks the
// push: a failed publish only prints a warning so git operations stay
// decoupled from the npm registry being reachable.

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const starterDir = join(root, 'plugin-starter');
const pkg = JSON.parse(await readFile(join(starterDir, 'package.json'), 'utf8'));
const { name, version } = pkg;

// `npm view <name>@<version> version` exits non-zero when that exact version
// (or the package itself) does not exist — that's our "needs publish" signal.
const view = spawnSync('npm', ['view', `${name}@${version}`, 'version'], {
  stdio: ['ignore', 'ignore', 'ignore'],
});

if (view.status === 0) {
  // Already published — nothing to do, stay quiet so normal pushes aren't noisy.
  process.exit(0);
}

console.log(`\n📦 ${name}@${version} is not on npm yet — publishing before push...`);

const publish = spawnSync('npm', ['publish', '--access', 'public'], {
  cwd: starterDir,
  stdio: 'inherit', // inherits the /dev/tty the hook wired up, so the 2FA/OTP prompt works
});

if (publish.status === 0) {
  console.log(`✅ Published ${name}@${version}\n`);
} else {
  console.error(`\n⚠️  Could not publish ${name}@${version} — continuing with the push anyway.`);
  console.error('   Publish it manually with:');
  console.error(`     cd plugin-starter && npm publish --access public --otp=YOUR_CODE\n`);
}

// Always succeed: publishing must not block git.
process.exit(0);
