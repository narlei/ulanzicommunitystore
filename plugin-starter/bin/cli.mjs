#!/usr/bin/env node

import * as readline from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir, copyFile, readdir, stat } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');
const TARGET_DIR = process.cwd();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function getGitUser() {
  try {
    const { stdout } = await execAsync('git config user.name');
    return stdout.trim();
  } catch {
    return 'your-username';
  }
}

async function getExistingPluginId(targetDir) {
  try {
    const files = await readdir(targetDir);
    for (const file of files) {
      if (file.endsWith('.ulanziPlugin')) {
        const s = await stat(join(targetDir, file));
        if (s.isDirectory()) return file.replace('.ulanziPlugin', '');
      }
    }
  } catch {}
  return null;
}

// Safely write a file only if it doesn't exist, or log if skipped
async function safeWrite(path, content, label) {
  try {
    await stat(path);
    console.log(`  - ⏭️  Skipped ${label} (already exists)`);
  } catch {
    await writeFile(path, content);
    console.log(`  - ✅ Created ${label}`);
  }
}

async function run() {
  console.log('✨ Welcome to the Ulanzi Plugin Starter Kit!\n');

  const existingId = await getExistingPluginId(TARGET_DIR);
  let pluginName = 'My Ulanzi Plugin';
  let pluginId = existingId;
  let author, description, category, controllers, deviceTypesJson;

  const defaultAuthor = await getGitUser();

  if (existingId) {
    console.log(`🔍 Detected existing plugin folder: ${existingId}.ulanziPlugin`);
    console.log(`   We will adapt this repository for the Community Store without overwriting your source code.\n`);
    
    const devicesRaw = (await question('Device types supported (deck, dial, or both) [deck]: ')).toLowerCase() || 'deck';
    let deviceTypes = ['deck'];
    if (devicesRaw.includes('both')) deviceTypes = ['deck', 'dial'];
    else if (devicesRaw.includes('dial')) deviceTypes = ['dial'];
    deviceTypesJson = deviceTypes.map(d => `    "${d}"`).join(',\n');
  } else {
    pluginName = (await question('Plugin name (e.g. Pomodoro Timer): ')) || 'My Ulanzi Plugin';
    
    const defaultId = `com.${defaultAuthor.toLowerCase().replace(/[^a-z0-9]/g, '')}.${pluginName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    pluginId = (await question(`Plugin ID [${defaultId}]: `)) || defaultId;
    
    author = (await question(`Author [${defaultAuthor}]: `)) || defaultAuthor;
    description = (await question('Description: ')) || 'A plugin for Ulanzi Deck and Dial.';
    
    const devicesRaw = (await question('Device types (deck, dial, or both) [deck]: ')).toLowerCase() || 'deck';
    let deviceTypes = ['deck'];
    controllers = ['"Keypad"'];
    
    if (devicesRaw.includes('both')) {
      deviceTypes = ['deck', 'dial'];
      controllers = ['        "Keypad",\n        "Encoder"'];
    } else if (devicesRaw.includes('dial')) {
      deviceTypes = ['dial'];
      controllers = ['        "Encoder"'];
    } else {
      controllers = ['        "Keypad"'];
    }
    
    deviceTypesJson = deviceTypes.map(d => `    "${d}"`).join(',\n');
    category = (await question('Category [Custom]: ')) || 'Custom';
  }
  
  console.log('\n⚙️ Generating plugin scaffolding...\n');
  
  const pluginDir = join(TARGET_DIR, `${pluginId}.ulanziPlugin`);
  await mkdir(pluginDir, { recursive: true });
  await mkdir(join(pluginDir, 'pi'), { recursive: true });
  await mkdir(join(TARGET_DIR, 'resources'), { recursive: true });
  await mkdir(join(TARGET_DIR, '.github', 'workflows'), { recursive: true });
  await mkdir(join(TARGET_DIR, '.claude', 'skills', 'ulanzi-plugin-dev'), { recursive: true });

  // Read templates
  const manifestTpl = await readFile(join(TEMPLATES_DIR, 'manifest.json.tpl'), 'utf-8');
  const appJsTpl = await readFile(join(TEMPLATES_DIR, 'app.js.tpl'), 'utf-8');
  const piHtmlTpl = await readFile(join(TEMPLATES_DIR, 'pi.html.tpl'), 'utf-8');
  const storeJsonTpl = await readFile(join(TEMPLATES_DIR, 'store.json.tpl'), 'utf-8');
  const makefileTpl = await readFile(join(TEMPLATES_DIR, 'Makefile.tpl'), 'utf-8');
  const releaseYmlTpl = await readFile(join(TEMPLATES_DIR, 'release.yml.tpl'), 'utf-8');
  const gitignoreTpl = await readFile(join(TEMPLATES_DIR, 'gitignore.tpl'), 'utf-8');
  const skillTpl = await readFile(join(TEMPLATES_DIR, 'SKILL.md.tpl'), 'utf-8');
  
  // Replace placeholders
  const storeJson = storeJsonTpl.replace(/\{\{DEVICE_TYPES\}\}/g, deviceTypesJson);
  const makefile = makefileTpl.replace(/\{\{PLUGIN_ID\}\}/g, pluginId);
  
  // Write files (safely)
  if (!existingId) {
    const manifest = manifestTpl
      .replace(/\{\{PLUGIN_NAME\}\}/g, pluginName)
      .replace(/\{\{AUTHOR\}\}/g, author)
      .replace(/\{\{DESCRIPTION\}\}/g, description)
      .replace(/\{\{CATEGORY\}\}/g, category)
      .replace(/\{\{REPO_NAME\}\}/g, 'your-repo-name')
      .replace(/\{\{PLUGIN_ID\}\}/g, pluginId)
      .replace(/\{\{CONTROLLERS\}\}/g, controllers.join('\n'));
      
    const piHtml = piHtmlTpl.replace(/\{\{PLUGIN_NAME\}\}/g, pluginName);

    await safeWrite(join(pluginDir, 'manifest.json'), manifest, 'manifest.json');
    await safeWrite(join(pluginDir, 'app.js'), appJsTpl, 'app.js');
    await safeWrite(join(pluginDir, 'pi', 'index.html'), piHtml, 'pi/index.html');
  }
  
  await safeWrite(join(TARGET_DIR, 'store.json'), storeJson, 'store.json');
  await safeWrite(join(TARGET_DIR, 'Makefile'), makefile, 'Makefile');
  await safeWrite(join(TARGET_DIR, '.github', 'workflows', 'release.yml'), releaseYmlTpl, 'release.yml (GitHub Actions)');
  await safeWrite(join(TARGET_DIR, '.gitignore'), gitignoreTpl, '.gitignore');
  await safeWrite(join(TARGET_DIR, '.claude', 'skills', 'ulanzi-plugin-dev', 'SKILL.md'), skillTpl, 'Claude SKILL.md');
  await safeWrite(join(TARGET_DIR, 'resources', '.gitkeep'), '', 'resources/ folder');
  
  console.log('📦 Downloading official Ulanzi SDK example...');
  try {
    await execAsync('git clone --depth 1 https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK ulanzi_plugin_example');
    await execAsync('rm -rf ulanzi_plugin_example/.git');
  } catch (err) {
    console.error('⚠️ Could not download the SDK example. Make sure git is installed.');
  }

  console.log(`
✅ Plugin '${pluginName}' criado com sucesso!

Próximos passos:
1. \`cd\` para a pasta do seu projeto (se já não estiver lá)
2. Rode \`make install\` (instala no Ulanzi Deck e reinicia o Ulanzi Studio)
${existingId ? '' : `3. Escreva seu código em \`${pluginId}.ulanziPlugin/app.js\``}
4. Rode \`make package\` para gerar o .zip final de distribuição

💡 Para IA (Claude/Gemini): O projeto já inclui uma skill customizada.
Basta pedir à IA para "ler a skill ulanzi-plugin-dev" para ela entender a estrutura.

📚 O SDK oficial foi baixado na pasta \`ulanzi_plugin_example\` (já ignorada no git) para referência.
`);

  rl.close();
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
