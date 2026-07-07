#!/usr/bin/env node
import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const electronDir = join(root, 'node_modules', 'electron');
const electronCache = join(root, '.cache', 'electron');

const platformChecks = {
  darwin: [
    join(electronDir, 'path.txt'),
    join(electronDir, 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron'),
    join(electronDir, 'dist', 'Electron.app', 'Contents', 'Frameworks', 'Electron Framework.framework', 'Electron Framework'),
  ],
  win32: [
    join(electronDir, 'path.txt'),
    join(electronDir, 'dist', 'electron.exe'),
  ],
  linux: [
    join(electronDir, 'path.txt'),
    join(electronDir, 'dist', 'electron'),
  ],
};

const checks = platformChecks[process.platform] || platformChecks.linux;
const platformPath = platformExecutablePath();

if (isElectronComplete()) {
  process.exit(0);
}

if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) {
  console.error('ELECTRON_SKIP_BINARY_DOWNLOAD is set, so Electron cannot download its runtime.');
  process.exit(1);
}

console.log('Electron binary is incomplete. Installing Electron runtime...');
rmSync(join(electronDir, 'dist'), { recursive: true, force: true });
rmSync(join(electronDir, 'path.txt'), { force: true });

if (!existsSync(join(electronDir, 'install.js'))) {
  const installPackage = spawnSync('npm', ['install', '--ignore-scripts'], {
    stdio: 'inherit',
    env: electronEnv(),
  });
  if (installPackage.status !== 0) {
    process.exit(installPackage.status ?? 1);
  }
}

const installRuntime = spawnSync(process.execPath, [join(electronDir, 'install.js')], {
  stdio: 'inherit',
  env: electronEnv(),
});

if (installRuntime.status !== 0) {
  process.exit(installRuntime.status ?? 1);
}

if (!isElectronComplete()) {
  const zip = findElectronZip(electronCache);
  if (zip) {
    console.log(`Electron installer did not finish extraction. Extracting cached runtime: ${zip}`);
    rmSync(join(electronDir, 'dist'), { recursive: true, force: true });
    mkdirSync(join(electronDir, 'dist'), { recursive: true });
    const unzip = spawnSync('unzip', ['-oq', zip, '-d', join(electronDir, 'dist')], {
      stdio: 'inherit',
    });
    if (unzip.status !== 0) process.exit(unzip.status ?? 1);
    writeFileSync(join(electronDir, 'path.txt'), platformPath);
  }
}

const missing = checks.filter((file) => !pathExists(file));
if (missing.length) {
  console.error('Electron install finished, but required files are still missing:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

function isElectronComplete() {
  return checks.every((file) => pathExists(file));
}

function electronEnv() {
  const env = {
    ...process.env,
    force_no_cache: 'true',
    electron_config_cache: electronCache,
    npm_config_electron_config_cache: electronCache,
  };
  delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;
  return env;
}

function pathExists(file) {
  try {
    lstatSync(file);
    return true;
  } catch {
    return false;
  }
}

function findElectronZip(dir) {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = findElectronZip(file);
        if (nested) return nested;
      } else if (entry.isFile() && /^electron-v.+\.zip$/.test(entry.name)) {
        return file;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function platformExecutablePath() {
  if (process.platform === 'darwin') return 'Electron.app/Contents/MacOS/Electron';
  if (process.platform === 'win32') return 'electron.exe';
  return 'electron';
}
