import { app, shell } from 'electron';
import { spawn } from 'node:child_process';
import { compareVersions } from '@ulanzideck/catalog';
import type { AppUpdateInfo } from '../shared.js';

const REPO = 'narlei/ulanzicommunitystore';
export const RELEASES_URL = `https://github.com/${REPO}/releases`;
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const INSTALL_SH_URL = `https://raw.githubusercontent.com/${REPO}/main/install.sh`;
const CACHE_MS = 60 * 60 * 1000;

const HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'UlanziCommunityStore',
  'X-GitHub-Api-Version': '2022-11-28',
} as const;

let cache: { at: number; info: AppUpdateInfo } | null = null;

function applyModeForPlatform(): AppUpdateInfo['applyMode'] {
  if (process.platform === 'darwin') return 'install-script';
  return 'open-releases';
}

function baseInfo(partial: Partial<AppUpdateInfo> = {}): AppUpdateInfo {
  return {
    currentVersion: app.getVersion(),
    latestVersion: null,
    updateAvailable: false,
    releaseUrl: RELEASES_URL,
    applyMode: applyModeForPlatform(),
    ...partial,
  };
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^v/i, '');
}

export async function checkAppUpdate({ force = false } = {}): Promise<AppUpdateInfo> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.info;
  }

  const currentVersion = app.getVersion();

  try {
    const res = await fetch(LATEST_API, { headers: HEADERS });
    if (!res.ok) {
      const info = baseInfo({ currentVersion });
      cache = { at: Date.now(), info };
      return info;
    }

    const release = (await res.json()) as { tag_name?: string; html_url?: string };
    const latestVersion = normalizeTag(release.tag_name || '');
    const updateAvailable = Boolean(latestVersion && compareVersions(latestVersion, currentVersion) > 0);
    const info = baseInfo({
      currentVersion,
      latestVersion: latestVersion || null,
      updateAvailable,
      releaseUrl: release.html_url || RELEASES_URL,
    });
    cache = { at: Date.now(), info };
    return info;
  } catch {
    const info = baseInfo({ currentVersion });
    // Don't cache hard failures for long — allow a retry soon.
    cache = { at: Date.now() - CACHE_MS + 60_000, info };
    return info;
  }
}

/**
 * Applies the app update for the current platform.
 * - macOS: detach install.sh (after a short delay) and quit so the .app can be replaced.
 * - Windows / other: open the GitHub Releases page (manual download).
 */
export async function applyAppUpdate(): Promise<{ ok: true; mode: AppUpdateInfo['applyMode'] }> {
  if (process.platform === 'darwin') {
    // Quit first so install.sh can replace the running bundle cleanly.
    // The detached shell keeps running after this process exits.
    const cmd = `sleep 1; curl -fsSL ${INSTALL_SH_URL} | bash`;
    const child = spawn('/bin/bash', ['-lc', cmd], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    // Defer quit so the IPC response can flush.
    setTimeout(() => {
      app.quit();
    }, 150);
    return { ok: true, mode: 'install-script' };
  }

  await shell.openExternal(RELEASES_URL);
  return { ok: true, mode: 'open-releases' };
}
