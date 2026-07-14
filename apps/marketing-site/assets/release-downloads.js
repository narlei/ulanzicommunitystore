/* global window, document, localStorage, fetch */
(function () {
  'use strict';

  var REPO = 'narlei/ulanzicommunitystore';
  var CACHE_KEY = 'release-downloads-total';
  var CACHE_TTL = 5 * 60 * 1000; // 5 minutes — keeps well under GitHub's anonymous rate limit
  var lastTotal = null;

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (typeof data.total !== 'number' || Date.now() - data.at > CACHE_TTL) return null;
      return data.total;
    } catch (err) {
      return null;
    }
  }

  function writeCache(total) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ total: total, at: Date.now() }));
    } catch (err) { /* ignore */ }
  }

  async function fetchTotal() {
    var total = 0;
    for (var page = 1; page <= 5; page++) {
      var res = await fetch('https://api.github.com/repos/' + REPO + '/releases?per_page=100&page=' + page, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) throw new Error('releases ' + res.status);
      var releases = await res.json();
      for (var i = 0; i < releases.length; i++) {
        var assets = releases[i].assets || [];
        for (var j = 0; j < assets.length; j++) {
          total += assets[j].download_count || 0;
        }
      }
      if (releases.length < 100) break;
    }
    return total;
  }

  function render() {
    if (lastTotal === null) return;
    var el = document.getElementById('footerDownloads');
    if (!el) return;
    var i18n = window.MarketingI18n;
    var htmlLang = (i18n && i18n.LANG_HTML[i18n.getLang()]) || 'en';
    var formatted = lastTotal.toLocaleString(htmlLang);
    el.textContent = i18n ? i18n.t('footer_downloads', formatted) : formatted + ' downloads';
    el.hidden = false;
    var sep = document.getElementById('footerDownloadsSep');
    if (sep) sep.hidden = false;
  }

  document.addEventListener('marketing:langchange', render);

  var cached = readCache();
  if (cached !== null) {
    lastTotal = cached;
    render();
  } else {
    fetchTotal().then(function (total) {
      writeCache(total);
      lastTotal = total;
      render();
    }).catch(function () { /* API unavailable — counter stays hidden */ });
  }
})();
