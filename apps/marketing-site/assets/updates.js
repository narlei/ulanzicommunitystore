/* global window, document, MarketingI18n */
//
// "What's new" digest, rebuilt live from catalog.json — nothing is generated per edition.
//
// A window is two explicit dates in the URL (?from=&to=), so a link shared today keeps
// showing what it showed today. That only works because every catalog entry carries its
// release history plus `addedAt` (the commit that put it in the registry): `addedAt`
// separates a brand-new plugin from an update, and the history lets an old window be
// reconstructed after the plugin has moved on to newer versions.
(function (global) {
  'use strict';

  var CATALOG_URL = 'https://narlei.github.io/ulanzicommunitystore/catalog.json';
  var PAGE_URL = 'https://ulanzicommunitystore.narlei.com/updates/';
  var DEFAULT_WINDOW_DAYS = 7;
  var DAY_MS = 24 * 60 * 60 * 1000;
  var LOCALE_MAP = {
    en: ['en'],
    pt: ['pt_BR', 'pt'],
    zh: ['zh_CN', 'zh_HK', 'zh_TW'],
  };
  var DATE_LOCALE = { en: 'en-US', pt: 'pt-BR', zh: 'zh-CN' };

  var state = { plugins: null, from: null, to: null, error: false };

  function t(key) {
    var i18n = global.MarketingI18n;
    if (!i18n) return key;
    return i18n.t.apply(i18n, [key].concat(Array.prototype.slice.call(arguments, 1)));
  }

  function lang() {
    return (global.MarketingI18n && global.MarketingI18n.getLang()) || 'en';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --- dates -----------------------------------------------------------------
  // Everything is UTC: a window must mean the same thing to everyone who opens the
  // shared link, whatever timezone they're in.

  function todayYmd() {
    return new Date().toISOString().slice(0, 10);
  }

  function isYmd(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    var d = new Date(value + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }

  function shiftYmd(ymd, days) {
    return new Date(Date.parse(ymd + 'T00:00:00Z') + days * DAY_MS).toISOString().slice(0, 10);
  }

  function daysBetween(from, to) {
    return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY_MS);
  }

  function inWindow(iso) {
    if (!iso) return false;
    var ts = Date.parse(iso);
    if (isNaN(ts)) return false;
    return ts >= Date.parse(state.from + 'T00:00:00Z') && ts <= Date.parse(state.to + 'T23:59:59.999Z');
  }

  function formatDate(iso) {
    var ts = Date.parse(iso);
    if (isNaN(ts)) return '';
    try {
      return new Intl.DateTimeFormat(DATE_LOCALE[lang()] || 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(ts));
    } catch (err) {
      return iso.slice(0, 10);
    }
  }

  function readWindow() {
    var params = new URLSearchParams(global.location.search);
    var from = params.get('from');
    var to = params.get('to');
    if (isYmd(from) && isYmd(to) && daysBetween(from, to) >= 0) {
      state.from = from;
      state.to = to;
      return;
    }
    state.to = todayYmd();
    state.from = shiftYmd(state.to, -(DEFAULT_WINDOW_DAYS - 1));
  }

  // Navigating rewrites the URL rather than reloading: the window is the only state,
  // and the back button should walk through the editions you looked at.
  function setWindow(from, to) {
    state.from = from;
    state.to = to;
    try {
      global.history.pushState({ from: from, to: to }, '', '?from=' + from + '&to=' + to);
    } catch (err) {
      /* file:// or a blocked history API — the page still renders */
    }
  }

  function shareUrl() {
    return PAGE_URL + '?from=' + state.from + '&to=' + state.to;
  }

  // --- catalog ---------------------------------------------------------------

  function pluginText(plugin, field) {
    var locales = LOCALE_MAP[lang()] || ['en'];
    var i18n = plugin.i18n || {};
    for (var i = 0; i < locales.length; i++) {
      var text = i18n[locales[i]] && i18n[locales[i]][field];
      if (text) return text;
    }
    return plugin[field] || '';
  }

  // Release history, newest first. Entries built before the catalog carried `releases`
  // fall back to their latest release so the current window still works.
  function releasesOf(plugin) {
    if (Array.isArray(plugin.releases) && plugin.releases.length) return plugin.releases;
    if (!plugin.publishedAt) return [];
    return [{
      tag: plugin.releaseTag,
      version: plugin.version,
      publishedAt: plugin.publishedAt,
      notes: plugin.changelog || '',
    }];
  }

  // The version that was current at the end of the window — not today's version. Without
  // this, reopening an old edition would show versions that didn't exist back then.
  function versionAt(plugin) {
    var cutoff = Date.parse(state.to + 'T23:59:59.999Z');
    var releases = releasesOf(plugin);
    for (var i = 0; i < releases.length; i++) {
      if (Date.parse(releases[i].publishedAt) <= cutoff) return releases[i].version || plugin.version;
    }
    return plugin.version;
  }

  // Splits the catalog into what entered the store in this window and what merely shipped
  // a new release. `addedAt` is the discriminator; an entry without one (git history
  // unavailable at build time) can only ever be classified as an update.
  function partition() {
    var added = [];
    var updated = [];

    (state.plugins || []).forEach(function (plugin) {
      var releases = releasesOf(plugin).filter(function (r) {
        return inWindow(r.publishedAt);
      });

      if (inWindow(plugin.addedAt)) {
        added.push({ plugin: plugin, at: plugin.addedAt, releases: releases });
      } else if (releases.length) {
        updated.push({ plugin: plugin, at: releases[0].publishedAt, releases: releases });
      }
    });

    var byDateDesc = function (a, b) {
      return Date.parse(b.at) - Date.parse(a.at);
    };
    return { added: added.sort(byDateDesc), updated: updated.sort(byDateDesc) };
  }

  // --- grouping by author ----------------------------------------------------

  // The GitHub owner, not manifest.Author: the same maintainer can ship plugins under
  // different Author strings (beyondlevi publishes as both "Ulanzi Dev" and
  // "Levi Nobrega"), which would split one person into two groups.
  function authorKey(plugin) {
    return String(plugin.repo || '').split('/')[0].toLowerCase();
  }

  function authorHandle(plugin) {
    return String(plugin.repo || '').split('/')[0];
  }

  // Groups keep the date ordering they arrived in: newest group first, newest item first
  // inside each. The label comes from the most recent plugin, so a maintainer who renamed
  // themselves shows up under the name they use now.
  function groupByAuthor(items) {
    var order = [];
    var groups = {};

    items.forEach(function (item) {
      var key = authorKey(item.plugin);
      if (!groups[key]) {
        groups[key] = {
          key: key,
          handle: authorHandle(item.plugin),
          label: item.plugin.author || authorHandle(item.plugin),
          items: [],
        };
        order.push(key);
      }
      groups[key].items.push(item);
    });

    return order.map(function (key) {
      return groups[key];
    });
  }

  function groupHeadHtml(group) {
    var count = t('updates_author_count', String(group.items.length));
    var label = group.label;
    // Only show the handle when it adds something the label doesn't already say.
    var handle = label.toLowerCase() === group.handle.toLowerCase() ? '' : '@' + group.handle;

    return (
      '<div class="updates-author">' +
      '<h3 class="updates-author-name">' + escapeHtml(label) + '</h3>' +
      (handle
        ? '<a class="updates-author-handle" href="https://github.com/' + escapeHtml(group.handle) +
          '" target="_blank" rel="noopener noreferrer">' + escapeHtml(handle) + '</a>'
        : '') +
      '<span class="updates-author-count">' + escapeHtml(count) + '</span>' +
      '</div>'
    );
  }

  // Renders a section as per-author blocks, each holding its own grid/list container.
  function sectionHtml(items, renderItem, containerClass) {
    return groupByAuthor(items)
      .map(function (group) {
        return (
          '<div class="updates-author-block">' +
          groupHeadHtml(group) +
          '<div class="' + containerClass + '">' + group.items.map(renderItem).join('') + '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  // --- release notes ---------------------------------------------------------

  // Release bodies in the wild are inconsistent — some are real changelogs, others are
  // install instructions or marketing copy. This keeps the first couple of prose lines
  // and drops the parts that never summarize anything: code blocks, badges, headings,
  // HTML comments. Whatever survives is plain text, so it renders escaped.
  function summarizeNotes(notes) {
    var text = String(notes || '');
    if (!text.trim()) return '';

    text = text.replace(/```[\s\S]*?```/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');

    var lines = text.split('\n');
    var kept = [];
    for (var i = 0; i < lines.length && kept.length < 3; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      if (/^!\[/.test(line)) continue; // image / badge
      if (/^<\/?[a-z]/i.test(line)) continue; // raw HTML block
      if (/^[-*_]{3,}$/.test(line)) continue; // horizontal rule

      line = line
        .replace(/^#{1,6}\s*/, '')
        .replace(/^[-*+]\s+/, '· ')
        .replace(/^>\s*/, '')
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links / images → their text
        .replace(/[`*_]/g, '')
        .trim();

      if (line) kept.push(line);
    }

    var summary = kept.join(' ');
    if (summary.length > 240) summary = summary.slice(0, 240).replace(/\s+\S*$/, '') + '…';
    return summary;
  }

  // --- rendering -------------------------------------------------------------

  function iconHtml(plugin) {
    if (!plugin.icon) return '<div class="updates-icon updates-icon-fallback" aria-hidden="true">◆</div>';
    return '<img class="updates-icon" src="' + escapeHtml(plugin.icon) + '" alt="" loading="lazy" width="48" height="48">';
  }

  function pluginHref(plugin) {
    return '/plugins/?plugin=' + encodeURIComponent(plugin.repo);
  }

  function newCardHtml(item) {
    var plugin = item.plugin;
    var name = pluginText(plugin, 'name') || plugin.name;
    var desc = pluginText(plugin, 'description') || '';

    return (
      '<a class="card updates-card" href="' + escapeHtml(pluginHref(plugin)) + '">' +
      (plugin.cover
        ? '<img class="updates-card-cover" src="' + escapeHtml(plugin.cover) + '" alt="" loading="lazy">'
        : '<div class="updates-card-cover updates-card-cover-fallback" aria-hidden="true"></div>') +
      '<div class="updates-card-body">' +
      '<div class="updates-card-top">' +
      iconHtml(plugin) +
      '<div class="updates-card-meta">' +
      '<h3>' + escapeHtml(name) + '</h3>' +
      '<p class="updates-card-author">' + escapeHtml(plugin.author || '') + '</p>' +
      '</div>' +
      '<span class="updates-pill updates-pill-new">v' + escapeHtml(versionAt(plugin)) + '</span>' +
      '</div>' +
      '<p class="updates-card-desc">' + escapeHtml(desc) + '</p>' +
      '<p class="updates-card-date">' + escapeHtml(t('updates_added_on', formatDate(item.at))) + '</p>' +
      '</div>' +
      '</a>'
    );
  }

  function updatedRowHtml(item) {
    var plugin = item.plugin;
    var name = pluginText(plugin, 'name') || plugin.name;
    var head = item.releases[0];
    var summary = summarizeNotes(head.notes);
    var extra = item.releases.length - 1;

    return (
      '<a class="updates-row" href="' + escapeHtml(pluginHref(plugin)) + '">' +
      iconHtml(plugin) +
      '<div class="updates-row-body">' +
      '<div class="updates-row-head">' +
      '<h3>' + escapeHtml(name) + '</h3>' +
      '<span class="updates-pill">' + escapeHtml(t('updates_to_version', head.version || plugin.version)) + '</span>' +
      (extra > 0 ? '<span class="updates-row-extra">' + escapeHtml(t('updates_more_releases', extra)) + '</span>' : '') +
      '</div>' +
      (summary ? '<p class="updates-row-notes">' + escapeHtml(summary) + '</p>' : '') +
      '<p class="updates-card-date">' + escapeHtml(t('updates_released_on', formatDate(item.at))) + '</p>' +
      '</div>' +
      '</a>'
    );
  }

  function renderPeriod() {
    var label = document.getElementById('updatesRange');
    if (label) label.textContent = t('updates_range', formatDate(state.from), formatDate(state.to));

    // The window can be paged forward only up to the one containing today; there is
    // nothing to show in the future and an empty "next week" reads as a bug.
    var next = document.getElementById('updatesNext');
    if (next) next.disabled = daysBetween(todayYmd(), state.to) >= 0;
  }

  function renderStatus(message) {
    var status = document.getElementById('updatesStatus');
    if (!status) return;
    status.hidden = !message;
    status.textContent = message || '';
  }

  function render() {
    renderPeriod();

    var newGrid = document.getElementById('updatesNewGrid');
    var updatedList = document.getElementById('updatesUpdatedList');
    var newSection = document.getElementById('updatesNewSection');
    var updatedSection = document.getElementById('updatesUpdatedSection');
    var summary = document.getElementById('updatesSummary');
    var empty = document.getElementById('updatesEmpty');
    if (!newGrid || !updatedList) return;

    if (state.error) {
      renderStatus(t('updates_error'));
      return;
    }
    if (!state.plugins) {
      renderStatus(t('updates_loading'));
      return;
    }
    renderStatus('');

    var split = partition();

    newGrid.innerHTML = sectionHtml(split.added, newCardHtml, 'catalog-grid');
    updatedList.innerHTML = sectionHtml(split.updated, updatedRowHtml, 'updates-list');
    newSection.hidden = !split.added.length;
    updatedSection.hidden = !split.updated.length;
    empty.hidden = Boolean(split.added.length || split.updated.length);

    summary.textContent = t('updates_summary', String(split.added.length), String(split.updated.length));
    summary.hidden = false;
  }

  // --- wiring ----------------------------------------------------------------

  function page(direction) {
    var span = daysBetween(state.from, state.to) + 1;
    setWindow(shiftYmd(state.from, direction * span), shiftYmd(state.to, direction * span));
    render();
  }

  function bind() {
    var prev = document.getElementById('updatesPrev');
    var next = document.getElementById('updatesNext');
    var share = document.getElementById('updatesShare');

    if (prev) prev.addEventListener('click', function () { page(-1); });
    if (next) next.addEventListener('click', function () { page(1); });

    if (share) {
      share.addEventListener('click', function () {
        var copy = global.__marketingCopyText;
        if (!copy) return;
        // On failure the label just resets (same as the catalog's share button) — dumping
        // the URL into a pill-shaped button wrecks the toolbar layout.
        copy(shareUrl()).then(function (ok) {
          share.textContent = ok ? t('updates_share_copied') : t('updates_share');
          setTimeout(function () { share.textContent = t('updates_share'); }, 1800);
        });
      });
    }

    global.addEventListener('popstate', function () {
      readWindow();
      render();
    });

    document.addEventListener('marketing:langchange', function () {
      document.title = t('updates_meta_title');
      var desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute('content', t('updates_meta_description'));
      render();
    });
  }

  function load() {
    fetch(CATALOG_URL, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        state.plugins = (data && data.plugins) || [];
        render();
      })
      .catch(function () {
        state.error = true;
        render();
      });
  }

  function init() {
    readWindow();
    bind();
    // i18n.js applies the shared homepage title on load; this page owns its own.
    document.title = t('updates_meta_title');
    render();
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
