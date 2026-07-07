import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(__dirname, '..', 'build');
const htmlPath = path.join(buildDir, 'dmg-background.html');
const outPath = path.join(buildDir, 'dmg-background.png');

const WIDTH = 660;
const HEIGHT = 420;

await app.whenReady();

const win = new BrowserWindow({
  width: WIDTH,
  height: HEIGHT,
  show: false,
  webPreferences: { offscreen: true },
});

win.webContents.setFrameRate(60);
await win.loadFile(htmlPath);
// let webfonts/layout settle
await new Promise((resolve) => setTimeout(resolve, 150));

const image = await win.webContents.capturePage({ x: 0, y: 0, width: WIDTH, height: HEIGHT });
fs.writeFileSync(outPath, image.toPNG());

console.log(`Wrote ${outPath}`);
app.quit();
