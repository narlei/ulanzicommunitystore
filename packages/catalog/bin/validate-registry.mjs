#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..', '..');
const registryDir = join(root, 'registry', 'plugins');
const files = (await readdir(registryDir)).filter((file) => file.endsWith('.json'));
let errors = 0;

for (const file of files) {
  try {
    const entry = JSON.parse(await readFile(join(registryDir, file), 'utf8'));
    if (!entry.repo || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(entry.repo)) {
      console.error(`${file}: campo "repo" ausente ou invalido`);
      errors += 1;
    }
  } catch (error) {
    console.error(`${file}: ${error.message}`);
    errors += 1;
  }
}

if (errors) process.exit(1);
console.log(`Registry valido: ${files.length} plugin(s)`);
