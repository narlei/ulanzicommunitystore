#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const version = (await readFile(join(root, 'VERSION'), 'utf8')).trim();

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`VERSION invalido: ${version}`);
}

for (const file of ['package.json', 'apps/store-desktop/package.json']) {
  const path = join(root, file);
  const pkg = JSON.parse(await readFile(path, 'utf8'));
  pkg.version = version;
  await writeFile(path, JSON.stringify(pkg, null, 2) + '\n');
}

console.log(`Versao sincronizada: ${version}`);
