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
