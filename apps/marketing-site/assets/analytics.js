/* global window, document */
//
// Google Analytics 4 for the marketing site.
//
// Single place that knows the measurement ID and every custom event, so the three
// pages (/, /plugins/, /updates/) only have to include this one script. Events are
// wired through delegated document listeners, which means they keep working for
// markup rendered later by catalog.js / updates.js.
//
// GA4's Enhanced Measurement already covers page_view, scroll, outbound clicks and
// file downloads. What it can't see is intent that never leaves the page — opening
// the download modal, copying the install one-liner, opening a plugin sheet — so
// those are the ones tracked explicitly below.
(function () {
  'use strict';

  // GA4 measurement ID for the ulanzicommunitystore.narlei.com property.
  var MEASUREMENT_ID = 'G-S29VT6PEEX';

  // A real ID can legitimately contain an X, so only the exact placeholder counts.
  function isPlaceholder(id) {
    return !id || id === 'G-XXXXXXXXXX';
  }

  // Local previews and file:// would otherwise pollute the property with fake traffic.
  function isLocal() {
    var host = window.location.hostname;
    return (
      window.location.protocol === 'file:' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.indexOf('.local') !== -1
    );
  }

  var enabled = !isPlaceholder(MEASUREMENT_ID) && !isLocal();

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  // The standard GA snippet exposes this globally; keep that contract for anything
  // that expects to call gtag() directly.
  window.gtag = window.gtag || gtag;

  // Safe to call from anywhere — a no-op until a real ID is configured.
  window.trackEvent = function (name, params) {
    if (!enabled) return;
    gtag('event', name, params || {});
  };

  if (enabled) {
    var tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
    document.head.appendChild(tag);

    gtag('js', new Date());
    gtag('config', MEASUREMENT_ID);
  }

  // ---- Custom events ----

  // Which of the download buttons was clicked (nav, hero, bottom CTA).
  function placementOf(el) {
    return el.getAttribute('data-analytics-placement') || 'unknown';
  }

  // The download modal shows one panel per OS; the visible one is the user's pick.
  function activeOs() {
    var btn = document.querySelector('#downloadModal .modal-os-btn.is-active');
    return (btn && btn.getAttribute('data-os')) || 'unknown';
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || typeof target.closest !== 'function') return;

    // Opens the download modal on / and /plugins/; on /updates/ there is no modal
    // and the link goes straight to the releases page.
    var trigger = target.closest('.js-download-trigger');
    if (trigger) {
      window.trackEvent('download_click', { placement: placementOf(trigger) });
      return;
    }

    var direct = target.closest('.modal-direct a[href]');
    if (direct) {
      var href = direct.getAttribute('href') || '';
      var isInstaller = /\.(dmg|exe)$/i.test(href);
      window.trackEvent(isInstaller ? 'installer_download' : 'releases_page_open', {
        os: isInstaller ? (/\.dmg$/i.test(href) ? 'macos' : 'windows') : activeOs(),
      });
      return;
    }

    var copy = target.closest('#downloadModal .modal-copy');
    if (copy) {
      window.trackEvent('install_command_copy', { os: activeOs() });
    }
  });
})();
