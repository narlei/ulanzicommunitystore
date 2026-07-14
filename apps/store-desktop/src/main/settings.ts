import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Settings } from '../shared.js';

const DEFAULT_SETTINGS: Settings = {
  developerMode: false,
  officialCatalog: false,
};

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export async function getSettings(): Promise<Settings> {
  try {
    const parsed = JSON.parse(await readFile(settingsPath(), 'utf8')) as Partial<Settings>;
    return {
      developerMode: parsed.developerMode === true,
      officialCatalog: parsed.officialCatalog === true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(next: Partial<Settings>): Promise<Settings> {
  const settings = { ...(await getSettings()), ...next };
  await mkdir(path.dirname(settingsPath()), { recursive: true });
  await writeFile(settingsPath(), JSON.stringify(settings, null, 2) + '\n');
  return settings;
}
