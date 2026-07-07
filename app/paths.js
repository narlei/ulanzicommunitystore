'use strict';
const os = require('os');
const path = require('path');

// Pasta de Plugins do UlanziDeck por SO. STORE_PLUGINS_DIR sobrescreve (testes/CI).
function pluginsDir() {
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

const ULANZI_APP = 'Ulanzi Studio';

module.exports = { pluginsDir, ULANZI_APP };
