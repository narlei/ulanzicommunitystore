#!/usr/bin/env node
// macOS dev mode runs the generic `node_modules/electron` binary. Its bundle is named
// "Electron.app", and that filename — not just the Info.plist's CFBundleName — is what
// Spotlight/Launch Services cache and what the Dock's tooltip ends up showing, even after
// the plist is patched and `lsregister -f` is forced. Editing the plist in place isn't
// reliable, so rename the bundle folder itself: a real rename can't go stale, there's no
// cache to bust. `path.txt` (read by the `electron` package to find its own binary) is
// kept in sync so `electron .` still resolves correctly afterward.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
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

const pathFile = join(electronPkgDir, 'path.txt');
if (!existsSync(pathFile)) process.exit(0);

const appPkg = JSON.parse(readFileSync(join(__dirname, '..', 'apps', 'store-desktop', 'package.json'), 'utf8'));
const productName = appPkg.productName || appPkg.build?.productName;
if (!productName) process.exit(0);

// path.txt looks like "Electron.app/Contents/MacOS/Electron" — everything after the first
// "/" (the internal executable name) stays the same; only the outer bundle folder is ours to rename.
const relativeExecPath = readFileSync(pathFile, 'utf-8').trim();
const execSuffix = relativeExecPath.slice(relativeExecPath.indexOf('/'));
const targetAppName = `${productName}.app`;
const targetAppDir = join(electronPkgDir, 'dist', targetAppName);

if (!existsSync(targetAppDir)) {
  const currentAppName = relativeExecPath.slice(0, relativeExecPath.indexOf('/'));
  const currentAppDir = join(electronPkgDir, 'dist', currentAppName);
  if (existsSync(currentAppDir)) {
    renameSync(currentAppDir, targetAppDir);
    writeFileSync(pathFile, `${targetAppName}${execSuffix}`);
  }
}

if (!existsSync(targetAppDir)) process.exit(0);

const infoPlist = join(targetAppDir, 'Contents', 'Info.plist');
for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
  spawnSync('plutil', ['-replace', key, '-string', productName, infoPlist], { stdio: 'inherit' });
}

// Belt and suspenders: also force Launch Services to pick up the (now correctly named) bundle.
const lsregister =
  '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';
if (existsSync(lsregister)) {
  spawnSync(lsregister, ['-f', targetAppDir], { stdio: 'inherit' });
}
