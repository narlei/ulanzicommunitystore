/* global window, document, MarketingI18n */
(function (global) {
  'use strict';

  var CATALOG_URL = 'https://narlei.github.io/ulanzicommunitystore/catalog.json';
  var LOCALE_MAP = {
    en: ['en'],
    pt: ['pt_BR', 'pt'],
    zh: ['zh_CN', 'zh_HK', 'zh_TW'],
  };

  var state = {
    plugins: [],
    query: '',
    device: '',
    sort: 'recent',
    selectedId: null,
  };

  function t(key) {
    var i18n = global.MarketingI18n;
    if (!i18n) return key;
    var args = Array.prototype.slice.call(arguments, 1);
    return i18n.t.apply(i18n, [key].concat(args));
  }

  function lang() {
    return (global.MarketingI18n && global.MarketingI18n.getLang()) || 'en';
  }

  function pluginText(plugin, field) {
    var locales = LOCALE_MAP[lang()] || ['en'];
    var i18n = plugin.i18n || {};
    var fields = field === 'longDescription' ? ['longDescription', 'description'] : [field];
    var i;
    var j;
    var locale;
    var candidate;
    var text;

    for (i = 0; i < locales.length; i++) {
      locale = locales[i];
      for (j = 0; j < fields.length; j++) {
        candidate = fields[j];
        text = i18n[locale] && i18n[locale][candidate];
        if (text) return text;
      }
    }

    for (j = 0; j < fields.length; j++) {
      text = plugin[fields[j]];
      if (typeof text === 'string' && text) return text;
    }

    return '';
  }

  function deviceLabel(value) {
    if (value === 'deck') return 'Deck';
    if (value === 'dial') return 'Dial';
    return value;
  }

  function platformLabel(value) {
    var lower = String(value || '').toLowerCase();
    if (lower.indexOf('mac') === 0 || lower === 'darwin') return 'macOS';
    if (lower.indexOf('win') === 0) return 'Windows';
    return value;
  }

  function formatDownloads(n) {
    if (typeof n !== 'number') return '';
    try {
      return n.toLocaleString(lang() === 'pt' ? 'pt-BR' : lang() === 'zh' ? 'zh-CN' : 'en');
    } catch (err) {
      return String(n);
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function devicesFrom(plugins) {
    var set = {};
    plugins.forEach(function (plugin) {
      (plugin.deviceTypes || []).forEach(function (d) {
        set[d] = true;
      });
    });
    return Object.keys(set).sort();
  }

  function filteredPlugins() {
    var q = state.query.trim().toLowerCase();
    var list = state.plugins.filter(function (plugin) {
      if (state.device && (plugin.deviceTypes || []).indexOf(state.device) === -1) {
        return false;
      }
      if (!q) return true;
      var haystack = [
        pluginText(plugin, 'name'),
        pluginText(plugin, 'description'),
        plugin.author,
        plugin.category,
        (plugin.tags || []).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.indexOf(q) !== -1;
    });

    if (state.sort === 'popular') {
      list = list.slice().sort(function (a, b) {
        return (b.downloads || 0) - (a.downloads || 0);
      });
    }

    return list;
  }

  function findPlugin(id) {
    for (var i = 0; i < state.plugins.length; i++) {
      if (state.plugins[i].id === id) return state.plugins[i];
    }
    return null;
  }

  function setStatus(kind, message) {
    var el = document.getElementById('catalogStatus');
    var grid = document.getElementById('catalogGrid');
    if (!el) return;

    if (!kind) {
      el.hidden = true;
      el.innerHTML = '';
      if (grid) grid.hidden = false;
      return;
    }

    if (grid) grid.hidden = true;
    el.hidden = false;
    el.className = 'catalog-status catalog-status-' + kind;

    if (kind === 'error') {
      el.innerHTML =
        '<p>' +
        escapeHtml(message) +
        '</p><button type="button" class="button secondary button-sm" id="catalogRetry">' +
        escapeHtml(t('catalog_retry')) +
        '</button>';
      var retry = document.getElementById('catalogRetry');
      if (retry) retry.addEventListener('click', loadCatalog);
      return;
    }

    el.innerHTML = '<p>' + escapeHtml(message) + '</p>';
  }

  function renderToolbar(devices) {
    var countEl = document.getElementById('catalogCount');
    var deviceEl = document.getElementById('catalogDevices');
    var visible = filteredPlugins();

    if (countEl) {
      countEl.textContent = t('catalog_count', String(visible.length));
    }

    if (!deviceEl) return;

    var html =
      '<button type="button" class="seg-btn' +
      (state.device === '' ? ' is-active' : '') +
      '" data-device="">' +
      escapeHtml(t('catalog_all')) +
      '</button>';

    devices.forEach(function (device) {
      html +=
        '<button type="button" class="seg-btn' +
        (state.device === device ? ' is-active' : '') +
        '" data-device="' +
        escapeHtml(device) +
        '">' +
        escapeHtml(deviceLabel(device)) +
        '</button>';
    });

    deviceEl.innerHTML = html;
  }

  function metaBits(plugin) {
    var bits = ['v' + plugin.version];
    if (typeof plugin.downloads === 'number') {
      bits.push(t('catalog_downloads_n', formatDownloads(plugin.downloads)));
    }
    (plugin.deviceTypes || []).forEach(function (d) {
      bits.push(deviceLabel(d));
    });
    return bits.map(escapeHtml).join(' · ');
  }

  function cardHtml(plugin) {
    var name = pluginText(plugin, 'name') || plugin.name;
    var desc = pluginText(plugin, 'description') || '';
    var icon = plugin.icon
      ? '<img class="catalog-card-icon" src="' +
        escapeHtml(plugin.icon) +
        '" alt="" loading="lazy" width="44" height="44">'
      : '<div class="catalog-card-icon catalog-card-icon-fallback" aria-hidden="true">◆</div>';
    var cover = plugin.cover
      ? '<img class="catalog-card-cover" src="' + escapeHtml(plugin.cover) + '" alt="" loading="lazy">'
      : '<div class="catalog-card-cover catalog-card-cover-fallback" aria-hidden="true"></div>';
    var category = plugin.category
      ? '<span class="chip">' + escapeHtml(plugin.category) + '</span>'
      : '';

    return (
      '<article class="card catalog-card" role="button" tabindex="0" data-plugin-id="' +
      escapeHtml(plugin.id) +
      '">' +
      cover +
      '<div class="catalog-card-body">' +
      '<div class="catalog-card-top">' +
      icon +
      '<div class="catalog-card-meta">' +
      '<h3>' +
      escapeHtml(name) +
      '</h3>' +
      '<p class="catalog-card-author">' +
      escapeHtml(plugin.author || '') +
      '</p>' +
      '</div>' +
      '<button type="button" class="button button-sm catalog-get js-download-trigger" data-stop>' +
      escapeHtml(t('catalog_get_app')) +
      '</button>' +
      '</div>' +
      '<p class="catalog-card-desc">' +
      escapeHtml(desc) +
      '</p>' +
      '<div class="catalog-card-foot">' +
      '<span class="catalog-card-bits">' +
      metaBits(plugin) +
      '</span>' +
      category +
      '</div>' +
      '</div>' +
      '</article>'
    );
  }

  function renderGrid() {
    var grid = document.getElementById('catalogGrid');
    if (!grid) return;

    var list = filteredPlugins();
    renderToolbar(devicesFrom(state.plugins));

    if (!list.length) {
      setStatus('empty', t('catalog_no_results'));
      return;
    }

    setStatus(null);
    grid.innerHTML = list.map(cardHtml).join('');
  }

  function detailCell(label, value) {
    if (!value) return '';
    return (
      '<div class="catalog-detail-cell">' +
      '<span class="catalog-detail-label">' +
      escapeHtml(label) +
      '</span>' +
      '<strong>' +
      escapeHtml(value) +
      '</strong>' +
      '</div>'
    );
  }

  function openDetail(plugin) {
    var overlay = document.getElementById('pluginDetailModal');
    var body = document.getElementById('pluginDetailBody');
    if (!overlay || !body) return;

    state.selectedId = plugin.id;

    var name = pluginText(plugin, 'name') || plugin.name;
    var about = pluginText(plugin, 'longDescription') || pluginText(plugin, 'description');
    var icon = plugin.icon
      ? '<img class="catalog-detail-icon" src="' +
        escapeHtml(plugin.icon) +
        '" alt="" width="76" height="76">'
      : '<div class="catalog-detail-icon catalog-card-icon-fallback" aria-hidden="true">◆</div>';

    var shots = '';
    if (plugin.screenshots && plugin.screenshots.length) {
      shots =
        '<div class="catalog-shots">' +
        plugin.screenshots
          .map(function (shot) {
            return (
              '<img src="' + escapeHtml(shot) + '" alt="" loading="lazy" class="catalog-shot">'
            );
          })
          .join('') +
        '</div>';
    }

    var devices = (plugin.deviceTypes || []).map(deviceLabel).join(', ');
    var platforms = (plugin.platforms || []).map(platformLabel).join(', ');
    var tags = (plugin.tags || []).slice(0, 6).join(', ');

    body.innerHTML =
      '<header class="catalog-detail-head">' +
      icon +
      '<div class="catalog-detail-head-text">' +
      '<h2 id="pluginDetailTitle">' +
      escapeHtml(name) +
      '</h2>' +
      '<p>' +
      escapeHtml(plugin.author || '') +
      ' · v' +
      escapeHtml(plugin.version || '') +
      '</p>' +
      '<div class="catalog-detail-actions">' +
      '<button type="button" class="button button-sm js-download-trigger">' +
      escapeHtml(t('catalog_get_app')) +
      '</button>' +
      (plugin.sourceUrl
        ? '<a class="button secondary button-sm" href="' +
          escapeHtml(plugin.sourceUrl) +
          '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(t('catalog_source')) +
          '</a>'
        : '') +
      '</div>' +
      '</div>' +
      '</header>' +
      '<div class="catalog-detail-scroll">' +
      shots +
      '<section class="catalog-detail-section">' +
      '<h3>' +
      escapeHtml(t('catalog_about')) +
      '</h3>' +
      '<p class="catalog-detail-about">' +
      escapeHtml(about) +
      '</p>' +
      '</section>' +
      '<section class="catalog-detail-section">' +
      '<h3>' +
      escapeHtml(t('catalog_details')) +
      '</h3>' +
      '<div class="catalog-detail-grid">' +
      detailCell(t('catalog_version'), plugin.version) +
      detailCell(
        t('catalog_downloads'),
        typeof plugin.downloads === 'number' ? formatDownloads(plugin.downloads) : ''
      ) +
      detailCell(t('catalog_devices'), devices) +
      detailCell(t('catalog_platforms'), platforms) +
      detailCell(t('catalog_published'), plugin.publishedAt ? String(plugin.publishedAt).slice(0, 10) : '') +
      detailCell(t('catalog_tags'), tags) +
      '</div>' +
      '</section>' +
      '<p class="catalog-detail-hint">' +
      escapeHtml(t('catalog_install_hint')) +
      '</p>' +
      '</div>';

    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    var closeBtn = document.getElementById('pluginDetailClose');
    if (closeBtn) closeBtn.focus();
  }

  function closeDetail() {
    var overlay = document.getElementById('pluginDetailModal');
    if (!overlay) return;
    overlay.hidden = true;
    state.selectedId = null;
    if (document.getElementById('downloadModal') && !document.getElementById('downloadModal').hidden) {
      return;
    }
    document.body.style.overflow = '';
  }

  function bindEvents() {
    var search = document.getElementById('catalogSearch');
    var sortEl = document.getElementById('catalogSort');
    var deviceEl = document.getElementById('catalogDevices');
    var grid = document.getElementById('catalogGrid');
    var detailOverlay = document.getElementById('pluginDetailModal');
    var detailClose = document.getElementById('pluginDetailClose');

    if (search) {
      search.addEventListener('input', function () {
        state.query = search.value || '';
        renderGrid();
      });
    }

    if (sortEl) {
      sortEl.addEventListener('click', function (event) {
        var btn = event.target.closest('[data-sort]');
        if (!btn) return;
        state.sort = btn.getAttribute('data-sort') || 'recent';
        var buttons = sortEl.querySelectorAll('[data-sort]');
        for (var i = 0; i < buttons.length; i++) {
          buttons[i].classList.toggle('is-active', buttons[i].getAttribute('data-sort') === state.sort);
        }
        renderGrid();
      });
    }

    if (deviceEl) {
      deviceEl.addEventListener('click', function (event) {
        var btn = event.target.closest('[data-device]');
        if (!btn) return;
        state.device = btn.getAttribute('data-device') || '';
        renderGrid();
      });
    }

    function openFromTarget(target) {
      var card = target.closest('[data-plugin-id]');
      if (!card) return;
      if (target.closest('[data-stop]')) return;
      var plugin = findPlugin(card.getAttribute('data-plugin-id'));
      if (plugin) openDetail(plugin);
    }

    if (grid) {
      grid.addEventListener('click', function (event) {
        openFromTarget(event.target);
      });
      grid.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        var card = event.target.closest('[data-plugin-id]');
        if (!card || event.target !== card) return;
        event.preventDefault();
        var plugin = findPlugin(card.getAttribute('data-plugin-id'));
        if (plugin) openDetail(plugin);
      });
    }

    if (detailClose) detailClose.addEventListener('click', closeDetail);
    if (detailOverlay) {
      detailOverlay.addEventListener('click', function (event) {
        if (event.target === detailOverlay) closeDetail();
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && detailOverlay && !detailOverlay.hidden) {
        var downloadModal = document.getElementById('downloadModal');
        if (downloadModal && !downloadModal.hidden) return;
        closeDetail();
      }
    });

    document.addEventListener('marketing:langchange', function () {
      if (search) search.setAttribute('placeholder', t('catalog_search'));
      var recent = document.querySelector('[data-sort="recent"]');
      var popular = document.querySelector('[data-sort="popular"]');
      if (recent) recent.textContent = t('catalog_sort_recent');
      if (popular) popular.textContent = t('catalog_sort_popular');
      renderGrid();
      if (state.selectedId) {
        var selected = findPlugin(state.selectedId);
        if (selected) openDetail(selected);
      }
    });
  }

  function loadCatalog() {
    setStatus('loading', t('catalog_loading'));
    fetch(CATALOG_URL, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('status ' + res.status);
        return res.json();
      })
      .then(function (catalog) {
        state.plugins = (catalog && catalog.plugins) || [];
        renderGrid();
      })
      .catch(function () {
        setStatus('error', t('catalog_error'));
      });
  }

  function init() {
    if (!document.getElementById('catalogGrid')) return;
    bindEvents();
    var search = document.getElementById('catalogSearch');
    if (search) search.setAttribute('placeholder', t('catalog_search'));
    loadCatalog();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
