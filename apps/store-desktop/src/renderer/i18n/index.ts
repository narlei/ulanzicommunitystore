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
    title: 'Community Store',
    subtitle: 'Install, update, and manage community plugins for Ulanzi Deck and Dial.',
    search: 'Search plugins...',
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
    downloads: 'Downloads',
    sortRecent: 'Recent',
    sortPopular: 'Popular',
    minSoftware: 'Minimum software',
    developerMode: 'Developer Mode',
    developerModeHelp: 'Allows future manual installs outside the official catalog.',
    language: 'Language',
    languageHelp: 'Language used across the app interface.',
    unofficial: 'The open-source community store for Ulanzi Deck & Dial plugins. Unofficial project, not affiliated with Ulanzi.',
    updateBadge: 'Update',
    installedCount: '%s installed',
    updateCount: '%s updates',
    emptyInstalled: 'No installed plugins detected yet.',
    emptyUpdates: 'Everything is up to date.',
    submit: 'Send plugin',
    submitSubtitle: 'Publish your own plugin to the Ulanzi Community Store.',
    submitRegistry: 'Browse registry examples',
    submitSdk: 'Official Ulanzi SDK',
    submitStep1: 'Build your plugin with the official Ulanzi SDK: a `com.you.plugin.ulanziPlugin/` folder with a `manifest.json`.',
    submitStep2: 'Publish a **GitHub Release** with the asset `com.you.plugin.ulanziPlugin.zip` (the plugin folder zipped).',
    submitStep3: 'Paste your repository URL below. The app validates everything and opens the Pull Request for you.',
    submitToolTitle: 'Validate and submit',
    submitToolHelp: 'Paste the GitHub repository of your plugin. Only public GitHub data is read, nothing is uploaded.',
    submitValidate: 'Validate',
    submitChecking: 'Checking...',
    submitNetworkError: 'Could not reach GitHub. Check your connection and try again.',
    submit_repo_ok: 'Repository found: %s',
    submit_repo_fail: 'Repository not found. Use a public GitHub URL like https://github.com/you/your-plugin.',
    submit_release_ok: 'Latest release: %s',
    submit_release_fail: 'No GitHub Release found. Publish a release before submitting.',
    submit_asset_ok: 'Release asset: %s',
    submit_asset_fail: 'The latest release has no *.ulanziPlugin.zip asset. Zip the plugin folder and attach it to the release.',
    submit_manifest_ok: 'manifest.json is valid: %s',
    submit_manifest_warn: 'manifest.json found in %s/ but Name or Version is missing.',
    submit_manifest_fail: 'manifest.json missing or invalid in %s/.',
    submit_store_ok: 'store.json found. Cover, screenshots and tags will show in the store.',
    submit_store_warn: 'No store.json (optional). Add one for cover image, screenshots and tags.',
    submit_store_warn_invalid: 'store.json exists but is not valid JSON, so it will be ignored.',
    submitFixHint: 'Fix the items above and validate again. The official SDK and the registry examples can help.',
    submitReadyTitle: 'Ready to publish!',
    submitReadyText: 'This is your registry entry. Click the button below: GitHub forks the store repository, creates the file and opens the Pull Request. No manual editing needed.',
    submitOpenPr: 'Open Pull Request on GitHub',
    submitCopy: 'Copy JSON',
    submitCopied: 'Copied!',
    submitPrHint: 'Once the PR is merged, your plugin goes live automatically. Every new release in your repo becomes an update in the store.',
    submitMarkdown: `## What your repo needs
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
    title: 'Community Store',
    subtitle: 'Instale, atualize e gerencie plugins da comunidade para Ulanzi Deck e Dial.',
    search: 'Buscar plugins...',
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
    downloads: 'Downloads',
    sortRecent: 'Recentes',
    sortPopular: 'Populares',
    minSoftware: 'Software minimo',
    developerMode: 'Developer Mode',
    developerModeHelp: 'Permite futuras instalacoes manuais fora do catalogo oficial.',
    language: 'Idioma',
    languageHelp: 'Idioma usado na interface do app.',
    unofficial: 'A loja open source da comunidade para plugins de Ulanzi Deck & Dial. Projeto nao-oficial, nao afiliado a Ulanzi.',
    updateBadge: 'Update',
    installedCount: '%s instalados',
    updateCount: '%s updates',
    emptyInstalled: 'Nenhum plugin instalado foi detectado ainda.',
    emptyUpdates: 'Tudo esta atualizado.',
    submit: 'Enviar plugin',
    submitSubtitle: 'Publique o seu proprio plugin na Ulanzi Community Store.',
    submitRegistry: 'Ver exemplos no registry',
    submitSdk: 'SDK oficial da Ulanzi',
    submitStep1: 'Crie seu plugin com o SDK oficial da Ulanzi: uma pasta `com.voce.plugin.ulanziPlugin/` com `manifest.json`.',
    submitStep2: 'Publique uma **GitHub Release** com o asset `com.voce.plugin.ulanziPlugin.zip` (a pasta do plugin zipada).',
    submitStep3: 'Cole a URL do seu repositorio abaixo. O app valida tudo e abre o Pull Request pra voce.',
    submitToolTitle: 'Validar e enviar',
    submitToolHelp: 'Cole o repositorio do seu plugin no GitHub. So dados publicos do GitHub sao lidos, nada e enviado.',
    submitValidate: 'Validar',
    submitChecking: 'Verificando...',
    submitNetworkError: 'Nao consegui acessar o GitHub. Verifique a conexao e tente de novo.',
    submit_repo_ok: 'Repositorio encontrado: %s',
    submit_repo_fail: 'Repositorio nao encontrado. Use uma URL publica do GitHub, ex.: https://github.com/voce/seu-plugin.',
    submit_release_ok: 'Release mais nova: %s',
    submit_release_fail: 'Nenhuma GitHub Release encontrada. Publique uma release antes de enviar.',
    submit_asset_ok: 'Asset da release: %s',
    submit_asset_fail: 'A release mais nova nao tem um asset *.ulanziPlugin.zip. Zipe a pasta do plugin e anexe na release.',
    submit_manifest_ok: 'manifest.json valido: %s',
    submit_manifest_warn: 'manifest.json encontrado em %s/ mas falta Name ou Version.',
    submit_manifest_fail: 'manifest.json ausente ou invalido em %s/.',
    submit_store_ok: 'store.json encontrado. Capa, screenshots e tags vao aparecer na loja.',
    submit_store_warn: 'Sem store.json (opcional). Adicione um para ter capa, screenshots e tags.',
    submit_store_warn_invalid: 'store.json existe mas nao e um JSON valido, entao sera ignorado.',
    submitFixHint: 'Corrija os itens acima e valide de novo. O SDK oficial e os exemplos do registry podem ajudar.',
    submitReadyTitle: 'Pronto pra publicar!',
    submitReadyText: 'Esta e a sua entrada no registry. Clique no botao abaixo: o GitHub faz o fork do repositorio da loja, cria o arquivo e abre o Pull Request. Sem edicao manual.',
    submitOpenPr: 'Abrir Pull Request no GitHub',
    submitCopy: 'Copiar JSON',
    submitCopied: 'Copiado!',
    submitPrHint: 'Quando o PR for mesclado, seu plugin entra no ar automaticamente. Toda nova release no seu repo vira um update na loja.',
    submitMarkdown: `## O que o seu repo precisa ter
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
    title: 'Community Store',
    subtitle: '安装、更新并管理 Ulanzi Deck 和 Dial 的社区插件。',
    search: '搜索插件...',
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
    downloads: '下载量',
    sortRecent: '最新',
    sortPopular: '最热',
    minSoftware: '最低版本',
    developerMode: '开发者模式',
    developerModeHelp: '允许未来从官方目录外手动安装。',
    language: '语言',
    languageHelp: '应用界面所使用的语言。',
    unofficial: 'Ulanzi Deck 和 Dial 插件的开源社区商店。非官方项目，与 Ulanzi 无关联。',
    updateBadge: '更新',
    installedCount: '已安装 %s',
    updateCount: '%s 个更新',
    emptyInstalled: '尚未检测到已安装插件。',
    emptyUpdates: '全部都是最新版本。',
    submit: '提交插件',
    submitSubtitle: '将你自己的插件发布到 Ulanzi Community Store。',
    submitRegistry: '查看 registry 示例',
    submitSdk: 'Ulanzi 官方 SDK',
    submitStep1: '使用 Ulanzi 官方 SDK 构建插件：一个含 `manifest.json` 的 `com.you.plugin.ulanziPlugin/` 文件夹。',
    submitStep2: '发布一个 **GitHub Release**，资源文件为 `com.you.plugin.ulanziPlugin.zip`（插件文件夹打包的 zip）。',
    submitStep3: '在下方粘贴你的仓库 URL。应用会自动验证并为你打开 Pull Request。',
    submitToolTitle: '验证并提交',
    submitToolHelp: '粘贴你插件的 GitHub 仓库地址。只读取 GitHub 公开数据，不会上传任何内容。',
    submitValidate: '验证',
    submitChecking: '正在检查...',
    submitNetworkError: '无法访问 GitHub。请检查网络连接后重试。',
    submit_repo_ok: '找到仓库：%s',
    submit_repo_fail: '未找到仓库。请使用公开的 GitHub 地址，例如 https://github.com/you/your-plugin。',
    submit_release_ok: '最新 release：%s',
    submit_release_fail: '未找到 GitHub Release。请先发布一个 release 再提交。',
    submit_asset_ok: 'Release 资源文件：%s',
    submit_asset_fail: '最新 release 中没有 *.ulanziPlugin.zip 资源文件。请将插件文件夹打包为 zip 并附加到 release。',
    submit_manifest_ok: 'manifest.json 有效：%s',
    submit_manifest_warn: '在 %s/ 中找到 manifest.json，但缺少 Name 或 Version。',
    submit_manifest_fail: '%s/ 中的 manifest.json 缺失或无效。',
    submit_store_ok: '找到 store.json。封面、截图和标签将在商店中展示。',
    submit_store_warn: '没有 store.json（可选）。添加后可展示封面、截图和标签。',
    submit_store_warn_invalid: 'store.json 存在但不是有效的 JSON，将被忽略。',
    submitFixHint: '修复上面的问题后再次验证。官方 SDK 和 registry 示例可以提供帮助。',
    submitReadyTitle: '可以发布了！',
    submitReadyText: '这就是你的 registry 条目。点击下方按钮：GitHub 会自动 fork 商店仓库、创建文件并打开 Pull Request，无需手动编辑。',
    submitOpenPr: '在 GitHub 上打开 Pull Request',
    submitCopy: '复制 JSON',
    submitCopied: '已复制！',
    submitPrHint: 'PR 合并后，你的插件会自动上线。之后你仓库里的每个新 release 都会成为商店中的更新。',
    submitMarkdown: `## 你的仓库需要包含
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
