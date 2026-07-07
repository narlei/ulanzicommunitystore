import type { CatalogPlugin, PluginText } from '@ulanzideck/catalog';

export type Lang = 'en' | 'pt' | 'zh';

export const LANGS: Lang[] = ['en', 'pt', 'zh'];
export const LANG_NAMES: Record<Lang, string> = { en: 'EN', pt: 'PT', zh: '中文' };

const pluginLocales: Record<Lang, string[]> = {
  en: ['en'],
  pt: ['pt_BR', 'pt'],
  zh: ['zh_CN', 'zh_HK', 'zh_TW'],
};

const strings: Record<Lang, Record<string, string>> = {
  en: {
    store: 'Store',
    installed: 'Installed',
    updates: 'Updates',
    settings: 'Settings',
    title: 'Plugin Store',
    subtitle: 'Install, update, and manage Ulanzi Deck and Dial plugins.',
    search: 'Search plugins, authors, tags...',
    all: 'All',
    loading: 'Loading catalog...',
    retry: 'Try again',
    catalogError: 'Could not load the catalog. Check your connection and try again.',
    noResults: 'No plugins match this view.',
    install: 'Install',
    update: 'Update',
    installedState: 'Installed',
    uninstall: 'Remove',
    installing: 'Installing',
    uninstalling: 'Removing',
    source: 'Source',
    details: 'Details',
    about: 'About',
    whatsNew: 'What changed',
    version: 'Version',
    languages: 'Languages',
    published: 'Published',
    minSoftware: 'Minimum software',
    developerMode: 'Developer Mode',
    developerModeHelp: 'Allows future manual installs outside the official catalog.',
    unofficial: 'Unofficial project. Not affiliated with Ulanzi.',
    updateBadge: 'Update',
    installedCount: '%s installed',
    updateCount: '%s updates',
    emptyInstalled: 'No installed plugins detected yet.',
    emptyUpdates: 'Everything is up to date.',
    submit: 'Send plugin',
    submitSubtitle: 'Publish your own plugin to the Ulanzi Plugin Store.',
    submitFork: 'Fork the repository',
    submitRegistry: 'Browse registry examples',
    submitSdk: 'Official Ulanzi SDK',
    submitMarkdown: `## 1. Fork the store repository
Fork **narlei/ulanzipluginstore** on GitHub.

## 2. Add your plugin entry
Create \`registry/plugins/<owner>__<repo>.json\` with at least:

\`\`\`json
{ "repo": "your-user/your-repo" }
\`\`\`

The file name is the \`owner\` and \`repo\`, joined with \`__\` (double underscore) instead of \`/\`.
Example: \`narlei/ulanzideck_ticktick\` becomes \`narlei__ulanzideck_ticktick.json\`.

## 3. Open a Pull Request
Once it's approved and merged, a GitHub Action reads your \`manifest.json\`, the optional
\`store.json\`, and your newest release, then publishes the plugin automatically. Every new
release you publish is detected as an update by the store.

## What your repo needs
- A \`com.<you>.<plugin>.ulanziPlugin/\` folder with \`manifest.json\`, following the official Ulanzi Deck Plugin SDK.
- A **GitHub Release** whose asset is \`com.<you>.<plugin>.ulanziPlugin.zip\` (the plugin folder zipped at the root).
- Optional: a \`store.json\` at the repo root with cover, screenshots, long description, device types and tags.

\`\`\`json
{
  "cover": "resources/cover.png",
  "screenshots": ["resources/banner1.png", "resources/banner2.png"],
  "longDescription": "A longer description in Markdown or plain text.",
  "deviceTypes": ["deck", "dial"],
  "tags": ["productivity", "timer"]
}
\`\`\`

Image paths are relative to your repo root.`,
  },
  pt: {
    store: 'Store',
    installed: 'Instalados',
    updates: 'Updates',
    settings: 'Ajustes',
    title: 'Plugin Store',
    subtitle: 'Instale, atualize e gerencie plugins para Ulanzi Deck e Dial.',
    search: 'Buscar plugins, autores, tags...',
    all: 'Todos',
    loading: 'Carregando catalogo...',
    retry: 'Tentar de novo',
    catalogError: 'Nao consegui carregar o catalogo. Verifique a conexao e tente novamente.',
    noResults: 'Nenhum plugin combina com esta visualizacao.',
    install: 'Instalar',
    update: 'Atualizar',
    installedState: 'Instalado',
    uninstall: 'Remover',
    installing: 'Instalando',
    uninstalling: 'Removendo',
    source: 'Codigo',
    details: 'Detalhes',
    about: 'Sobre',
    whatsNew: 'Novidades',
    version: 'Versao',
    languages: 'Idiomas',
    published: 'Publicado',
    minSoftware: 'Software minimo',
    developerMode: 'Developer Mode',
    developerModeHelp: 'Permite futuras instalacoes manuais fora do catalogo oficial.',
    unofficial: 'Projeto nao-oficial. Nao afiliado a Ulanzi.',
    updateBadge: 'Update',
    installedCount: '%s instalados',
    updateCount: '%s updates',
    emptyInstalled: 'Nenhum plugin instalado foi detectado ainda.',
    emptyUpdates: 'Tudo esta atualizado.',
    submit: 'Enviar plugin',
    submitSubtitle: 'Publique o seu proprio plugin na Ulanzi Plugin Store.',
    submitFork: 'Fazer fork do repositorio',
    submitRegistry: 'Ver exemplos no registry',
    submitSdk: 'SDK oficial da Ulanzi',
    submitMarkdown: `## 1. Faca um fork do repositorio da loja
Faca fork de **narlei/ulanzipluginstore** no GitHub.

## 2. Adicione a entrada do seu plugin
Crie \`registry/plugins/<owner>__<repo>.json\` com o minimo:

\`\`\`json
{ "repo": "seu-usuario/seu-repo" }
\`\`\`

O nome do arquivo e o \`owner\` e o \`repo\` separados por \`__\` (dois underscores), trocando
qualquer \`/\` por \`__\`. Ex.: \`narlei/ulanzideck_ticktick\` vira \`narlei__ulanzideck_ticktick.json\`.

## 3. Abra um Pull Request
Ao ser aprovado e mesclado, uma GitHub Action le o \`manifest.json\`, o \`store.json\` (opcional)
e a release mais nova do seu repo, e publica o plugin na loja automaticamente. Toda nova release
vira um update detectado pela loja.

## O que o seu repo precisa ter
- Uma pasta \`com.<voce>.<plugin>.ulanziPlugin/\` com \`manifest.json\`, no padrao do SDK oficial da Ulanzi.
- Uma **GitHub Release** cujo asset seja \`com.<voce>.<plugin>.ulanziPlugin.zip\` (o zip da pasta do plugin na raiz).
- Opcional: um \`store.json\` na raiz do repo com capa, screenshots, descricao longa, tipos de device e tags.

\`\`\`json
{
  "cover": "resources/cover.png",
  "screenshots": ["resources/banner1.png", "resources/banner2.png"],
  "longDescription": "Descricao mais longa em Markdown ou texto.",
  "deviceTypes": ["deck", "dial"],
  "tags": ["productivity", "timer"]
}
\`\`\`

Caminhos de imagem sao relativos a raiz do seu repo.`,
  },
  zh: {
    store: '商店',
    installed: '已安装',
    updates: '更新',
    settings: '设置',
    title: 'Plugin Store',
    subtitle: '安装、更新并管理 Ulanzi Deck 和 Dial 插件。',
    search: '搜索插件、作者、标签...',
    all: '全部',
    loading: '正在加载目录...',
    retry: '重试',
    catalogError: '无法加载目录。请检查网络连接后重试。',
    noResults: '没有匹配的插件。',
    install: '安装',
    update: '更新',
    installedState: '已安装',
    uninstall: '移除',
    installing: '正在安装',
    uninstalling: '正在移除',
    source: '源码',
    details: '详情',
    about: '关于',
    whatsNew: '更新内容',
    version: '版本',
    languages: '语言',
    published: '发布',
    minSoftware: '最低版本',
    developerMode: '开发者模式',
    developerModeHelp: '允许未来从官方目录外手动安装。',
    unofficial: '非官方项目，与 Ulanzi 无关联。',
    updateBadge: '更新',
    installedCount: '已安装 %s',
    updateCount: '%s 个更新',
    emptyInstalled: '尚未检测到已安装插件。',
    emptyUpdates: '全部都是最新版本。',
    submit: '提交插件',
    submitSubtitle: '将你自己的插件发布到 Ulanzi Plugin Store。',
    submitFork: 'Fork 这个仓库',
    submitRegistry: '查看 registry 示例',
    submitSdk: 'Ulanzi 官方 SDK',
    submitMarkdown: `## 1. Fork 商店仓库
在 GitHub 上 fork **narlei/ulanzipluginstore**。

## 2. 添加你的插件条目
创建 \`registry/plugins/<owner>__<repo>.json\`，最少包含：

\`\`\`json
{ "repo": "your-user/your-repo" }
\`\`\`

文件名是 \`owner\` 和 \`repo\`，用 \`__\`（两个下划线）代替 \`/\` 连接。
例如：\`narlei/ulanzideck_ticktick\` 会变成 \`narlei__ulanzideck_ticktick.json\`。

## 3. 打开一个 Pull Request
合并后，GitHub Action 会读取你的 \`manifest.json\`、可选的 \`store.json\` 以及你仓库最新的
release，并自动发布该插件。之后每次发布新的 release，商店都会自动识别为更新。

## 你的仓库需要包含
- 一个 \`com.<you>.<plugin>.ulanziPlugin/\` 文件夹，内含 \`manifest.json\`，遵循 Ulanzi 官方 SDK 规范。
- 一个 **GitHub Release**，其资源文件为 \`com.<you>.<plugin>.ulanziPlugin.zip\`（插件文件夹在根目录打包的 zip）。
- 可选：仓库根目录下的 \`store.json\`，包含封面、截图、长描述、设备类型和标签。

\`\`\`json
{
  "cover": "resources/cover.png",
  "screenshots": ["resources/banner1.png", "resources/banner2.png"],
  "longDescription": "使用 Markdown 或纯文本撰写的更长描述。",
  "deviceTypes": ["deck", "dial"],
  "tags": ["productivity", "timer"]
}
\`\`\`

图片路径相对于你的仓库根目录。`,
  },
};

export function detectLang(): Lang {
  const saved = localStorage.getItem('lang');
  if (saved && LANGS.includes(saved as Lang)) return saved as Lang;
  const nav = navigator.language.toLowerCase();
  if (nav.startsWith('pt')) return 'pt';
  if (nav.startsWith('zh')) return 'zh';
  return 'en';
}

export function t(lang: Lang, key: string, ...args: Array<string | number>): string {
  let value = strings[lang][key] || strings.en[key] || key;
  for (const arg of args) value = value.replace('%s', String(arg));
  return value;
}

export function pluginText(plugin: CatalogPlugin, field: keyof PluginText, lang: Lang): string {
  const locales = pluginLocales[lang] || ['en'];
  const i18n = plugin.i18n || {};
  const fields = field === 'longDescription' ? ['longDescription', 'description'] : [field];
  for (const locale of locales) {
    for (const candidate of fields) {
      const text = i18n[locale]?.[candidate as keyof PluginText];
      if (text) return text;
    }
  }
  for (const candidate of fields) {
    const text = plugin[candidate as keyof CatalogPlugin];
    if (typeof text === 'string' && text) return text;
  }
  return '';
}
