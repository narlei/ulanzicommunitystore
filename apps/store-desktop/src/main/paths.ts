import os from 'node:os';
import path from 'node:path';

export const ULANZI_APP = 'Ulanzi Studio';

export function pluginsDir(): string {
  if (process.env.STORE_PLUGINS_DIR) return process.env.STORE_PLUGINS_DIR;
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Ulanzi', 'UlanziDeck', 'Plugins');
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'Ulanzi', 'UlanziDeck', 'Plugins');
  }
  return path.join(os.homedir(), '.ulanzideck', 'Plugins');
}
