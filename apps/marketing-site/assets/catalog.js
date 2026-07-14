/* global window, document, MarketingI18n */
(function (global) {
  'use strict';

  var CATALOG_URL = 'https://narlei.github.io/ulanzicommunitystore/catalog.json';
  var PLATFORM_FILTER_KEY = 'catalogPlatformFilter';
  var LOCALE_MAP = {
    en: ['en'],
    pt: ['pt_BR', 'pt'],
    zh: ['zh_CN', 'zh_HK', 'zh_TW'],
  };

  function detectHostPlatform() {
    var ua = '';
    try {
      ua = String(
        (navigator.userAgentData && navigator.userAgentData.platform) ||
          navigator.platform ||
          navigator.userAgent ||
          ''
      ).toLowerCase();
    } catch (err) {
      ua = '';
    }
    if (ua.indexOf('mac') !== -1 || ua.indexOf('darwin') !== -1 || ua.indexOf('iphone') !== -1 || ua.indexOf('ipad') !== -1) {
      return 'mac';
    }
    if (ua.indexOf('win') !== -1) return 'windows';
    return '';
  }

  function loadPlatformFilter() {
    try {
      var stored = localStorage.getItem(PLATFORM_FILTER_KEY);
      if (stored === '' || stored === 'mac' || stored === 'windows') return stored;
    } catch (err) {
      // private mode / blocked storage
    }
    // Default to the visitor's OS so Windows-only plugins stay out of the way on Mac (and vice-versa).
    return detectHostPlatform();
  }

  function savePlatformFilter(value) {
    try {
      localStorage.setItem(PLATFORM_FILTER_KEY, value);
    } catch (err) {
      // ignore
    }
  }

  var state = {
    plugins: [],
    query: '',
    device: '',
    platform: loadPlatformFilter(),
    category: '',
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

  function normalizePlatform(value) {
    var lower = String(value || '').toLowerCase();
    if (lower.indexOf('mac') === 0 || lower === 'darwin') return 'mac';
    if (lower.indexOf('win') === 0) return 'windows';
    return 'other';
  }

  function platformFilterLabel(value) {
    if (value === 'mac') return 'macOS';
    if (value === 'windows') return 'Windows';
    return platformLabel(value);
  }

  function pluginSupportsPlatform(plugin, platform) {
    if (!platform) return true;
    var platforms = plugin.platforms || [];
    if (!platforms.length) return true;
    for (var i = 0; i < platforms.length; i++) {
      if (normalizePlatform(platforms[i]) === platform) return true;
    }
    return false;
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

  function platformsFrom(plugins) {
    var set = {};
    plugins.forEach(function (plugin) {
      (plugin.platforms || []).forEach(function (p) {
        var key = normalizePlatform(p);
        if (key === 'mac' || key === 'windows') set[key] = true;
      });
    });
    return Object.keys(set).sort();
  }

  // Categories in the UI come from store.json `tags` (e.g. productivity), not
  // manifest.Category (often the plugin product name).
  function categoriesFrom(plugins) {
    var set = {};
    plugins.forEach(function (plugin) {
      (plugin.tags || []).forEach(function (tag) {
        var value = String(tag || '').trim();
        if (value) set[value] = true;
      });
    });
    return Object.keys(set).sort(function (a, b) {
      return a.localeCompare(b);
    });
  }

  function categoryLabel(value) {
    return String(value || '')
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join(' ');
  }

  function pluginHasCategory(plugin, category) {
    if (!category) return true;
    var tags = plugin.tags || [];
    for (var i = 0; i < tags.length; i++) {
      if (String(tags[i] || '').trim() === category) return true;
    }
    return false;
  }

  function filteredPlugins() {
    var q = state.query.trim().toLowerCase();
    var list = state.plugins.filter(function (plugin) {
      if (state.device && (plugin.deviceTypes || []).indexOf(state.device) === -1) {
        return false;
      }
      if (!pluginSupportsPlatform(plugin, state.platform)) return false;
      if (!pluginHasCategory(plugin, state.category)) return false;
      if (!q) return true;
      var haystack = [
        pluginText(plugin, 'name'),
        pluginText(plugin, 'description'),
        plugin.author,
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

  var PLUGIN_QUERY_KEY = 'plugin';
  var APP_PROTOCOL = 'ulanzicommunitystore';

  function findPluginByRepo(repo) {
    if (!repo) return null;
    var target = String(repo).toLowerCase();
    for (var i = 0; i < state.plugins.length; i++) {
      if (String(state.plugins[i].repo || '').toLowerCase() === target) return state.plugins[i];
    }
    return null;
  }

  function catalogBaseUrl() {
    return location.origin + location.pathname;
  }

  // Shareable web URL that opens straight to this plugin's detail (?plugin=owner/name).
  function pluginShareUrl(plugin) {
    return catalogBaseUrl() + '?' + PLUGIN_QUERY_KEY + '=' + plugin.repo;
  }

  // Custom-scheme deep link that surfaces this plugin inside the desktop app.
  function pluginAppUrl(plugin) {
    return APP_PROTOCOL + '://plugin?repo=' + encodeURIComponent(plugin.repo);
  }

  // There's no way to ask the OS whether the app is installed, so we try the deep
  // link and watch for the tab losing focus (the app taking over). If nothing
  // happens within the grace period, assume it's not installed and fall back to
  // the download instructions.
  var APP_LAUNCH_FALLBACK_MS = 1800;

  function attemptOpenApp(url) {
    // A hidden iframe (instead of window.location.href) avoids Safari's native
    // "address is invalid" alert when no app is registered for the scheme —
    // Safari treats a top-level navigation failure as a real page-load error,
    // but silently drops a failed iframe navigation.
    var iframe = document.createElement('iframe');
    iframe.hidden = true;
    iframe.src = url;

    var fallbackTimer = setTimeout(function () {
      cleanup();
      if (typeof global.__marketingOpenDownloadModal === 'function') {
        global.__marketingOpenDownloadModal();
      }
    }, APP_LAUNCH_FALLBACK_MS);

    function onAppLikelyOpened() {
      cleanup();
    }

    function cleanup() {
      clearTimeout(fallbackTimer);
      document.removeEventListener('visibilitychange', onAppLikelyOpened);
      window.removeEventListener('blur', onAppLikelyOpened);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }

    document.addEventListener('visibilitychange', onAppLikelyOpened);
    window.addEventListener('blur', onAppLikelyOpened);
    document.body.appendChild(iframe);
  }

  function requestedPluginRepo() {
    try {
      return new URLSearchParams(location.search).get(PLUGIN_QUERY_KEY) || '';
    } catch (err) {
      return '';
    }
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

  function renderToolbar() {
    var countEl = document.getElementById('catalogCount');
    var platformEl = document.getElementById('catalogPlatforms');
    var deviceEl = document.getElementById('catalogDevices');
    var categoryEl = document.getElementById('catalogCategories');
    var clearEl = document.getElementById('catalogClearFilters');
    var visible = filteredPlugins();
    var platforms = platformsFrom(state.plugins);
    var devices = devicesFrom(state.plugins);
    var categories = categoriesFrom(state.plugins);
    var html;
    var i;

    if (countEl) {
      countEl.textContent = t('catalog_count', String(visible.length));
    }

    if (platformEl) {
      if (!platforms.length) {
        platformEl.hidden = true;
        platformEl.innerHTML = '';
      } else {
        platformEl.hidden = false;
        html =
          '<button type="button" class="seg-btn' +
          (state.platform === '' ? ' is-active' : '') +
          '" data-platform="">' +
          escapeHtml(t('catalog_all')) +
          '</button>';
        for (i = 0; i < platforms.length; i++) {
          html +=
            '<button type="button" class="seg-btn' +
            (state.platform === platforms[i] ? ' is-active' : '') +
            '" data-platform="' +
            escapeHtml(platforms[i]) +
            '">' +
            escapeHtml(platformFilterLabel(platforms[i])) +
            '</button>';
        }
        platformEl.innerHTML = html;
      }
    }

    // Only show when 2+ device types exist — a single option (e.g. all Deck) is noise.
    if (deviceEl) {
      if (devices.length < 2) {
        deviceEl.hidden = true;
        deviceEl.innerHTML = '';
        // Drop a stale device filter if the catalog collapsed to one type.
        if (state.device) state.device = '';
      } else {
        deviceEl.hidden = false;
        html =
          '<button type="button" class="seg-btn' +
          (state.device === '' ? ' is-active' : '') +
          '" data-device="">' +
          escapeHtml(t('catalog_all')) +
          '</button>';
        for (i = 0; i < devices.length; i++) {
          html +=
            '<button type="button" class="seg-btn' +
            (state.device === devices[i] ? ' is-active' : '') +
            '" data-device="' +
            escapeHtml(devices[i]) +
            '">' +
            escapeHtml(deviceLabel(devices[i])) +
            '</button>';
        }
        deviceEl.innerHTML = html;
      }
    }

    var categoryWrap = document.getElementById('catalogCategoryWrap');
    if (categoryEl) {
      if (!categories.length) {
        if (categoryWrap) categoryWrap.hidden = true;
        categoryEl.innerHTML = '';
        categoryEl.classList.remove('is-active');
      } else {
        if (categoryWrap) categoryWrap.hidden = false;
        html =
          '<option value="">' +
          escapeHtml(t('catalog_all_categories')) +
          '</option>';
        for (i = 0; i < categories.length; i++) {
          html +=
            '<option value="' +
            escapeHtml(categories[i]) +
            '"' +
            (state.category === categories[i] ? ' selected' : '') +
            '>' +
            escapeHtml(categoryLabel(categories[i])) +
            '</option>';
        }
        categoryEl.innerHTML = html;
        categoryEl.value = state.category;
        categoryEl.classList.toggle('is-active', Boolean(state.category));
      }
    }

    if (clearEl) {
      var hasFilters = Boolean(state.platform || state.device || state.category);
      clearEl.hidden = !hasFilters;
      clearEl.textContent = t('catalog_clear_filters');
    }
  }

  function metaBits(plugin) {
    var bits = ['v' + plugin.version];
    (plugin.deviceTypes || []).forEach(function (d) {
      bits.push(deviceLabel(d));
    });
    return bits.map(escapeHtml).join(' · ');
  }

  // NEW badge from catalog publishedAt (latest GitHub release), 14-day window.
  var NEW_PLUGIN_WINDOW_DAYS = 14;

  function isPluginNew(publishedAt) {
    if (!publishedAt) return false;
    var published = Date.parse(publishedAt);
    if (isNaN(published)) return false;
    var ageMs = Date.now() - published;
    if (ageMs < 0) return true;
    return ageMs < NEW_PLUGIN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  }

  function popularityHtml(plugin) {
    var bits = [];
    var titles = [];
    if (typeof plugin.stars === 'number') {
      titles.push(t('catalog_stars_n', formatDownloads(plugin.stars)));
      bits.push(
        '<span class="catalog-card-stat-item">' +
          '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M12 2.5l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 16.4 6.6 19.3l1-6.1L3.2 8.9l6.1-.9L12 2.5z"/></svg>' +
          escapeHtml(formatDownloads(plugin.stars)) +
          '</span>'
      );
    }
    if (typeof plugin.downloads === 'number') {
      titles.push(t('catalog_downloads_n', formatDownloads(plugin.downloads)));
      bits.push(
        '<span class="catalog-card-stat-item">' +
          '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>' +
          escapeHtml(formatDownloads(plugin.downloads)) +
          '</span>'
      );
    }
    if (!bits.length) return '';
    return (
      '<div class="catalog-card-popularity" title="' +
      escapeHtml(titles.join(' · ')) +
      '">' +
      bits.join('') +
      '</div>'
    );
  }

  function newBadgeHtml(plugin) {
    if (!isPluginNew(plugin.publishedAt)) return '';
    return (
      '<span class="catalog-card-new">' + escapeHtml(t('catalog_new')) + '</span>'
    );
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
    var tagsHtml = (plugin.tags || [])
      .slice(0, 2)
      .map(function (tag) {
        return '<span class="chip">' + escapeHtml(categoryLabel(tag)) + '</span>';
      })
      .join('');

    return (
      '<article class="card catalog-card" role="button" tabindex="0" data-plugin-id="' +
      escapeHtml(plugin.id) +
      '">' +
      '<div class="catalog-card-cover-wrap">' +
      cover +
      newBadgeHtml(plugin) +
      popularityHtml(plugin) +
      '</div>' +
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
      tagsHtml +
      '</div>' +
      '</div>' +
      '</article>'
    );
  }

  function renderGrid() {
    var grid = document.getElementById('catalogGrid');
    if (!grid) return;

    var list = filteredPlugins();
    renderToolbar();

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

  function openDetail(plugin, options) {
    options = options || {};
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
    var tags = (plugin.tags || []).slice(0, 6).map(categoryLabel).join(', ');

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
      '<a class="button button-sm catalog-btn-openapp" href="' +
      escapeHtml(pluginAppUrl(plugin)) +
      '">' +
      '<svg class="catalog-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 3l-9 9"/><path d="M15 3h6v6"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>' +
      escapeHtml(t('catalog_open_app')) +
      '</a>' +
      (plugin.sourceUrl
        ? '<a class="button secondary button-sm catalog-btn-star" href="' +
          escapeHtml(plugin.sourceUrl) +
          '" target="_blank" rel="noopener noreferrer">' +
          '<span class="catalog-btn-emoji" aria-hidden="true">⭐</span>' +
          escapeHtml(t('catalog_star')) +
          (typeof plugin.stars === 'number' ? ' · ' + escapeHtml(formatDownloads(plugin.stars)) : '') +
          '</a>'
        : '') +
      '<div class="catalog-menu">' +
      '<button type="button" class="catalog-btn-menu" aria-haspopup="menu" aria-expanded="false" aria-label="' +
      escapeHtml(t('catalog_more_actions')) +
      '">' +
      '<svg class="catalog-btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>' +
      '</button>' +
      '<div class="catalog-menu-panel" role="menu" hidden>' +
      '<button type="button" role="menuitem" class="catalog-menu-item catalog-btn-share" data-share-url="' +
      escapeHtml(pluginShareUrl(plugin)) +
      '">' +
      '<svg class="catalog-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6l6.8-3.9M8.6 13.4l6.8 3.9"/></svg>' +
      '<span class="catalog-share-label">' +
      escapeHtml(t('catalog_share')) +
      '</span>' +
      '</button>' +
      (plugin.sourceUrl
        ? '<div class="catalog-menu-divider" role="separator"></div>' +
          '<a role="menuitem" class="catalog-menu-item" href="' +
          escapeHtml(plugin.sourceUrl) +
          '" target="_blank" rel="noopener noreferrer">' +
          '<svg class="catalog-btn-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>' +
          escapeHtml(t('catalog_source')) +
          '</a>' +
          '<a role="menuitem" class="catalog-menu-item catalog-menu-item-danger" href="' +
          escapeHtml(plugin.sourceUrl + '/issues/new') +
          '" target="_blank" rel="noopener noreferrer">' +
          '<svg class="catalog-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>' +
          escapeHtml(t('catalog_report_problem')) +
          '</a>'
        : '') +
      '</div>' +
      '</div>' +
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
      detailCell(
        t('catalog_stars'),
        typeof plugin.stars === 'number' ? formatDownloads(plugin.stars) : ''
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

    // Reflect the open plugin in the URL so it can be shared / deep-linked.
    // Skipped when opening from an existing history entry (initial load, Back/Forward).
    if (options.updateHistory !== false) {
      try {
        history.pushState({ plugin: plugin.repo }, '', pluginShareUrl(plugin));
      } catch (err) {
        // History API blocked (e.g. file://) — sharing still works via the button.
      }
    }
  }

  // Visually dismiss the detail sheet without touching browser history.
  function hideDetail() {
    var overlay = document.getElementById('pluginDetailModal');
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    state.selectedId = null;
    if (document.getElementById('downloadModal') && !document.getElementById('downloadModal').hidden) {
      return;
    }
    document.body.style.overflow = '';
  }

  function closeDetail() {
    // If we pushed a history entry when opening, pop it so Back/Forward stay in sync;
    // popstate then hides the sheet. Otherwise (deep-linked entry) just clear the URL.
    if (history.state && history.state.plugin) {
      history.back();
    } else {
      hideDetail();
      try {
        history.replaceState({}, '', catalogBaseUrl());
      } catch (err) {
        // Ignore when the History API is unavailable.
      }
    }
  }

  function bindEvents() {
    var search = document.getElementById('catalogSearch');
    var sortEl = document.getElementById('catalogSort');
    var platformEl = document.getElementById('catalogPlatforms');
    var deviceEl = document.getElementById('catalogDevices');
    var categoryEl = document.getElementById('catalogCategories');
    var clearEl = document.getElementById('catalogClearFilters');
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

    if (platformEl) {
      platformEl.addEventListener('click', function (event) {
        var btn = event.target.closest('[data-platform]');
        if (!btn) return;
        state.platform = btn.getAttribute('data-platform') || '';
        savePlatformFilter(state.platform);
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

    if (categoryEl) {
      categoryEl.addEventListener('change', function () {
        state.category = categoryEl.value || '';
        renderGrid();
      });
    }

    if (clearEl) {
      clearEl.addEventListener('click', function () {
        state.platform = '';
        state.device = '';
        state.category = '';
        savePlatformFilter('');
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

    // The "..." overflow menu on the detail sheet (Share / Source / Report a Problem).
    function closeOverflowMenu() {
      var panel = document.querySelector('.catalog-menu-panel:not([hidden])');
      if (!panel) return;
      panel.hidden = true;
      var trigger = panel.previousElementSibling;
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }

    var detailBody = document.getElementById('pluginDetailBody');
    if (detailBody) {
      detailBody.addEventListener('click', function (event) {
        var openAppBtn = event.target.closest('.catalog-btn-openapp');
        if (openAppBtn && detailBody.contains(openAppBtn)) {
          // Let modified clicks (new tab / new window) behave normally.
          if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            attemptOpenApp(openAppBtn.getAttribute('href'));
          }
          return;
        }

        var menuTrigger = event.target.closest('.catalog-btn-menu');
        if (menuTrigger) {
          var panel = menuTrigger.nextElementSibling;
          var willOpen = panel.hidden;
          closeOverflowMenu();
          if (willOpen) {
            panel.hidden = false;
            menuTrigger.setAttribute('aria-expanded', 'true');
          }
          return;
        }

        // Copy the shareable plugin link (delegated — the button is re-rendered per open).
        var shareBtn = event.target.closest('[data-share-url]');
        if (shareBtn && detailBody.contains(shareBtn)) {
          var url = shareBtn.getAttribute('data-share-url');
          if (!url) return;
          var label = shareBtn.querySelector('.catalog-share-label');
          window.__marketingCopyText(url).then(function (ok) {
            if (!label) return;
            label.textContent = ok ? t('catalog_share_copied') : t('catalog_share');
            setTimeout(function () {
              label.textContent = t('catalog_share');
              closeOverflowMenu();
            }, 1800);
          });
          return;
        }

        if (event.target.closest('.catalog-menu-item')) {
          closeOverflowMenu();
        }
      });
    }

    document.addEventListener('click', function (event) {
      if (event.target.closest('.catalog-menu')) return;
      closeOverflowMenu();
    });

    // Keep the sheet in sync with Back/Forward and deep links pasted into the address bar.
    window.addEventListener('popstate', function () {
      var repo = requestedPluginRepo();
      if (repo) {
        var plugin = findPluginByRepo(repo);
        if (plugin) {
          openDetail(plugin, { updateHistory: false });
          return;
        }
      }
      hideDetail();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (document.querySelector('.catalog-menu-panel:not([hidden])')) {
        closeOverflowMenu();
        return;
      }
      if (detailOverlay && !detailOverlay.hidden) {
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
        if (selected) openDetail(selected, { updateHistory: false });
      }
    });
  }

  // Open the plugin named in the URL (?plugin=owner/name) once the catalog is loaded.
  function applyDeepLink() {
    var repo = requestedPluginRepo();
    if (!repo) return;
    var plugin = findPluginByRepo(repo);
    if (plugin) openDetail(plugin, { updateHistory: false });
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
        applyDeepLink();
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
