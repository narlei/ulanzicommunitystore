#!/usr/bin/env node
// macOS dev mode runs the generic `node_modules/electron` binary, whose Info.plist still
// reports CFBundleName/CFBundleDisplayName "Electron" — that's what the menu bar and Dock
// show, regardless of app.setName() or package.json's productName. Patch it in place so
// `npm run app` / `npm run open` show the real product name too, not just packaged builds.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') process.exit(0);

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let electronPkgDir;
try {
  electronPkgDir = dirname(require.resolve('electron/package.json'));
} catch {
  process.exit(0);
}

const infoPlist = join(electronPkgDir, 'dist', 'Electron.app', 'Contents', 'Info.plist');
if (!existsSync(infoPlist)) process.exit(0);

const appPkg = JSON.parse(readFileSync(join(__dirname, '..', 'apps', 'store-desktop', 'package.json'), 'utf8'));
const productName = appPkg.productName || appPkg.build?.productName;
if (!productName) process.exit(0);

for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
  spawnSync('plutil', ['-replace', key, '-string', productName, infoPlist], { stdio: 'inherit' });
}
