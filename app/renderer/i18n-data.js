'use strict';
(() => {
// i18n do app (EN/PT/ZH). Sem modal de helper — o app instala direto.
const LANGS = ['en', 'pt', 'zh'];
const LANG_NAMES = { en: 'EN', pt: 'PT', zh: '中文' };
const LANG_PLUGIN_LOCALES = {
  en: ['en'],
  pt: ['pt_BR', 'pt'],
  zh: ['zh_CN', 'zh_HK', 'zh_TW'],
};

const STRINGS = {
  en: {
    'tagline': 'Unofficial plugin store for Ulanzi Deck and Dial',
    'nav.publish': 'Publish',
    'hero.title': 'Plugins for %s and %s',
    'hero.deck': 'Ulanzi Deck',
    'hero.dial': 'Dial',
    'hero.sub': 'One-click install and updates for your Ulanzi Deck and Dial.',
    'search.placeholder': 'Search plugins…',
    'filter.all': 'All',
    'card.by': 'by %s',
    'card.langs': '%d languages',
    'badge.update': 'update',
    'btn.install': 'Install',
    'btn.update': 'Update',
    'btn.installed': 'Installed',
    'btn.uninstall': 'Uninstall',
    'btn.source': 'Source',
    'empty.no_results': 'No plugins found. Try another search.',
    'st.installing': 'Installing…',
    'st.uninstalling': 'Uninstalling…',
    'st.done': 'Done',
    'st.error': 'Error',
    'detail.about': 'About',
    'detail.whats_new': 'What’s new — %s',
    'detail.details': 'Details',
    'detail.version': 'Version',
    'detail.min_sw': 'Minimum UlanziDeck',
    'detail.languages': 'Languages',
    'detail.published': 'Published',
    'detail.installed_v': 'Installed: v%s',
    'loading': 'Loading…',
    'load_error': 'Could not load the catalog. Check your connection.',
    'disclaimer': 'Unofficial project. Not affiliated with Ulanzi.',
  },
  pt: {
    'tagline': 'Loja não-oficial de plugins para Ulanzi Deck e Dial',
    'nav.publish': 'Publicar',
    'hero.title': 'Plugins para %s e %s',
    'hero.deck': 'Ulanzi Deck',
    'hero.dial': 'Dial',
    'hero.sub': 'Instalação e updates com um clique para seu Ulanzi Deck e Dial.',
    'search.placeholder': 'Buscar plugins…',
    'filter.all': 'Todos',
    'card.by': 'por %s',
    'card.langs': '%d idiomas',
    'badge.update': 'update',
    'btn.install': 'Instalar',
    'btn.update': 'Atualizar',
    'btn.installed': 'Instalado',
    'btn.uninstall': 'Remover',
    'btn.source': 'Código',
    'empty.no_results': 'Nenhum plugin encontrado. Tente outra busca.',
    'st.installing': 'Instalando…',
    'st.uninstalling': 'Removendo…',
    'st.done': 'Pronto',
    'st.error': 'Erro',
    'detail.about': 'Sobre',
    'detail.whats_new': 'Novidades — %s',
    'detail.details': 'Detalhes',
    'detail.version': 'Versão',
    'detail.min_sw': 'UlanziDeck mínimo',
    'detail.languages': 'Idiomas',
    'detail.published': 'Publicado',
    'detail.installed_v': 'Instalado: v%s',
    'loading': 'Carregando…',
    'load_error': 'Não consegui carregar o catálogo. Verifique a conexão.',
    'disclaimer': 'Projeto não-oficial. Não afiliado à Ulanzi.',
  },
  zh: {
    'tagline': 'Ulanzi Deck 与 Dial 的非官方插件商店',
    'nav.publish': '发布',
    'hero.title': '%s 和 %s 插件',
    'hero.deck': 'Ulanzi Deck',
    'hero.dial': 'Dial',
    'hero.sub': '为你的 Ulanzi Deck 和 Dial 一键安装与更新。',
    'search.placeholder': '搜索插件…',
    'filter.all': '全部',
    'card.by': '作者 %s',
    'card.langs': '%d 种语言',
    'badge.update': '更新',
    'btn.install': '安装',
    'btn.update': '更新',
    'btn.installed': '已安装',
    'btn.uninstall': '卸载',
    'btn.source': '源代码',
    'empty.no_results': '未找到插件。请尝试其他搜索。',
    'st.installing': '正在安装…',
    'st.uninstalling': '正在卸载…',
    'st.done': '完成',
    'st.error': '错误',
    'detail.about': '关于',
    'detail.whats_new': '更新内容 — %s',
    'detail.details': '详情',
    'detail.version': '版本',
    'detail.min_sw': '最低 UlanziDeck 版本',
    'detail.languages': '语言',
    'detail.published': '发布于',
    'detail.installed_v': '已安装：v%s',
    'loading': '加载中…',
    'load_error': '无法加载目录。请检查网络连接。',
    'disclaimer': '非官方项目，与 Ulanzi 无关联。',
  },
};

function detectLang() {
  const saved = localStorage.getItem('lang');
  if (saved && LANGS.includes(saved)) return saved;
  const nav = (navigator.language || 'en').toLowerCase();
  if (nav.startsWith('pt')) return 'pt';
  if (nav.startsWith('zh')) return 'zh';
  return 'en';
}

let currentLang = detectLang();

function setLang(l) {
  if (LANGS.includes(l)) {
    currentLang = l;
    localStorage.setItem('lang', l);
  }
}

function t(key, ...args) {
  let s = STRINGS[currentLang][key] ?? STRINGS.en[key] ?? key;
  args.forEach((a) => {
    s = s.replace('%s', a).replace('%d', a);
  });
  return s;
}

// Texto localizado de um plugin (name/description/longDescription) com fallback.
function locText(p, field) {
  const locales = LANG_PLUGIN_LOCALES[currentLang] || ['en'];
  const i18n = p.i18n || {};
  const fields = field === 'longDescription' ? ['longDescription', 'description'] : [field];
  for (const loc of locales) {
    for (const f of fields) {
      if (i18n[loc] && i18n[loc][f]) return i18n[loc][f];
    }
  }
  for (const f of fields) if (p[f]) return p[f];
  return '';
}

window.I18N = { LANGS, LANG_NAMES, t, setLang, locText, getLang: () => currentLang };
})();
