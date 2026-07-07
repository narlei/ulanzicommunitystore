// Cliente da loja: descobre o Helper local (127.0.0.1), mostra estado de instalação/update
// e dispara instalações. Sem dependências externas.
(() => {
  'use strict';
  const CFG = window.STORE_CONFIG || { portBase: 39273, portCount: 5, installSh: '' };
  const I18N = window.STORE_I18N || {};
  const T = (k) => I18N[k] || k;

  let helperBase = null;          // ex: "http://127.0.0.1:39273"
  let installed = {};             // { pluginId: version }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ---- util ----------------------------------------------------------------
  async function fetchWithTimeout(url, opts = {}, ms = 1200) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...opts, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  }

  // Compara versões tipo "1.2.10" numericamente. >0 se a>b, <0 se a<b, 0 igual.
  function cmpVersion(a, b) {
    const pa = String(a).split(/[^\d]+/).filter(Boolean).map(Number);
    const pb = String(b).split(/[^\d]+/).filter(Boolean).map(Number);
    const n = Math.max(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    return 0;
  }

  // ---- descoberta do helper ------------------------------------------------
  async function discoverHelper() {
    for (let i = 0; i < CFG.portCount; i++) {
      const base = `http://127.0.0.1:${CFG.portBase + i}`;
      try {
        const res = await fetchWithTimeout(`${base}/ping`, {}, 900);
        if (res.ok) {
          const data = await res.json();
          if (data && data.ok) { helperBase = base; return true; }
        }
      } catch (_) { /* porta não respondeu, tenta a próxima */ }
    }
    return false;
  }

  async function loadInstalled() {
    if (!helperBase) return;
    try {
      const res = await fetchWithTimeout(`${helperBase}/installed`, {}, 1500);
      if (!res.ok) return;
      const list = await res.json();
      installed = {};
      for (const it of (list.plugins || list || [])) {
        if (it && it.pluginId) installed[it.pluginId] = it.version;
      }
    } catch (_) {}
  }

  // ---- UI: modal "instale o helper" ----------------------------------------
  let pendingInstallEl = null; // card cujo Instalar disparou o modal

  function helperCommand() {
    return `/bin/bash -c "$(curl -fsSL ${CFG.installSh})"`;
  }

  function openHelperModal(el) {
    pendingInstallEl = el || null;
    const modal = $('#helper-modal');
    if (!modal) return;
    const code = $('#helper-cmd');
    if (code) code.textContent = helperCommand();
    const rs = $('[data-retry-status]', modal);
    if (rs) rs.textContent = '';
    modal.hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeHelperModal() {
    const modal = $('#helper-modal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function wireHelperModal() {
    const modal = $('#helper-modal');
    if (!modal) return;

    $$('[data-modal-close]', modal).forEach((b) =>
      b.addEventListener('click', closeHelperModal)
    );
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) closeHelperModal();
    });

    const copyBtn = $('[data-copy-cmd]', modal);
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(helperCommand()); copyBtn.textContent = T('copied'); }
        catch (_) { copyBtn.textContent = T('copyManual'); }
        setTimeout(() => (copyBtn.textContent = T('copy')), 2000);
      });
    }

    const retryBtn = $('[data-retry-helper]', modal);
    const retryStatus = $('[data-retry-status]', modal);
    if (retryBtn) {
      retryBtn.addEventListener('click', async () => {
        retryBtn.disabled = true;
        if (retryStatus) retryStatus.textContent = T('searching');
        const found = await discoverHelper();
        retryBtn.disabled = false;
        if (found) {
          await loadInstalled();
          refreshAll();
          const el = pendingInstallEl;
          closeHelperModal();
          if (el) doInstall(el); // continua a instalação que o usuário pediu
        } else if (retryStatus) {
          retryStatus.textContent = T('retryNotFound');
        }
      });
    }
  }

  // ---- estado por card/detalhe ---------------------------------------------
  function refreshItem(el, catalogVersion) {
    const id = el.dataset.pluginId;
    const btn = $('[data-install]', el);
    const badge = $('[data-update-badge]', el);
    const status = $('[data-status]', el);
    if (!btn) return;

    if (!helperBase) {
      btn.textContent = T('install');
      btn.classList.remove('btn-installed');
      return;
    }

    const have = installed[id];
    if (!have) {
      btn.textContent = T('install');
      btn.classList.remove('btn-installed');
      if (badge) badge.hidden = true;
    } else if (cmpVersion(catalogVersion, have) > 0) {
      btn.textContent = T('update');
      btn.classList.remove('btn-installed');
      if (badge) badge.hidden = false;
      if (status) status.textContent = T('installedV').replace('%s', have);
    } else {
      btn.textContent = T('installed');
      btn.classList.add('btn-installed');
      if (badge) badge.hidden = true;
    }
  }

  function refreshAll() {
    $$('[data-plugin-id]').forEach((el) => refreshItem(el, el.dataset.version));
  }

  // ---- fluxo de instalação -------------------------------------------------
  async function pollStatus(jobId, onProgress) {
    for (;;) {
      await new Promise((r) => setTimeout(r, 600));
      let res;
      try { res = await fetchWithTimeout(`${helperBase}/status?job=${encodeURIComponent(jobId)}`, {}, 2000); }
      catch (_) { continue; }
      if (!res.ok) throw new Error('status indisponível');
      const s = await res.json();
      if (onProgress) onProgress(s);
      if (s.state === 'done') return s;
      if (s.state === 'error') throw new Error(s.message || 'falha na instalação');
    }
  }

  async function doInstall(el) {
    const repo = el.dataset.repo;
    const btn = $('[data-install]', el);
    const status = $('[data-status]', el);

    if (!helperBase) {
      // pode ter sido instalado agora — tenta descobrir de novo antes de abrir o modal
      if (status) status.textContent = T('searching');
      const found = await discoverHelper();
      if (found) { await loadInstalled(); refreshAll(); }
    }
    if (!helperBase) {
      if (status) status.textContent = '';
      openHelperModal(el);
      return;
    }

    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = T('installing');
    if (status) status.textContent = '';

    try {
      const res = await fetch(`${helperBase}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo }),
      });
      if (res.status === 403) throw new Error(T('blocked'));
      if (!res.ok) throw new Error(T('errorPrefix').replace('%s', res.status));
      const { jobId } = await res.json();
      await pollStatus(jobId, (s) => {
        if (status && s.message) status.textContent = s.message;
      });
      await loadInstalled();
      refreshAll();
      if (status) status.textContent = T('done');
    } catch (err) {
      btn.textContent = original;
      if (status) status.textContent = `✕ ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  }

  function wireButtons() {
    $$('[data-install]').forEach((btn) => {
      const el = btn.closest('[data-plugin-id]');
      btn.addEventListener('click', () => doInstall(el));
    });
  }

  // ---- busca + filtros -----------------------------------------------------
  function wireFilters() {
    const search = $('#search');
    const grid = $('#plugin-grid');
    if (!grid) return;
    const noResults = $('#no-results');
    const cards = $$('.card', grid);
    const active = { device: '', category: '' };
    let query = '';

    function apply() {
      let visible = 0;
      cards.forEach((card) => {
        const matchesQuery = !query || (card.dataset.search || '').includes(query);
        const matchesDevice =
          !active.device || (card.dataset.device || '').split(' ').includes(active.device);
        const matchesCategory = !active.category || card.dataset.category === active.category;
        const show = matchesQuery && matchesDevice && matchesCategory;
        card.hidden = !show;
        if (show) visible++;
      });
      if (noResults) noResults.hidden = visible !== 0;
    }

    if (search) {
      search.addEventListener('input', () => {
        query = search.value.trim().toLowerCase();
        apply();
      });
    }
    $$('.filter-group').forEach((group) => {
      const kind = group.dataset.group; // 'device' | 'category'
      group.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.pill');
        if (!btn) return;
        active[kind] = btn.dataset.value || '';
        $$('.pill', group).forEach((p) => p.classList.toggle('is-active', p === btn));
        apply();
      });
    });
  }

  // ---- init ----------------------------------------------------------------
  async function init() {
    wireButtons();
    wireFilters();
    wireHelperModal();
    const found = await discoverHelper();
    if (found) {
      await loadInstalled();
    }
    refreshAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
