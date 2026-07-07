'use strict';
(() => {
const { t, setLang, locText, getLang, LANGS, LANG_NAMES } = window.I18N;

let catalog = [];
let installed = {}; // pluginId -> version
const filter = { device: '', query: '' };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) n.append(kid);
  return n;
}

function cmpVersion(a, b) {
  const pa = String(a).split(/[^\d]+/).filter(Boolean).map(Number);
  const pb = String(b).split(/[^\d]+/).filter(Boolean).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function deviceLabel(d) {
  return d === 'deck' ? 'Deck' : d === 'dial' ? 'Dial' : d;
}
function platformLabel(p) {
  const l = String(p).toLowerCase();
  if (l.startsWith('mac') || l === 'darwin') return 'macOS';
  if (l.startsWith('win')) return 'Windows';
  return p;
}

// ---- chrome estático (i18n) ----------------------------------------------
function renderChrome() {
  document.documentElement.lang = getLang();
  $('#hero-title').innerHTML = t(
    'hero.title',
    `<span class="accent">${t('hero.deck')}</span>`,
    `<span class="accent">${t('hero.dial')}</span>`
  );
  $('#hero-sub').textContent = t('hero.sub');
  $('#search').placeholder = t('search.placeholder');
  $('#disclaimer').textContent = t('disclaimer');
  $$('[data-i18n]').forEach((n) => (n.textContent = t(n.dataset.i18n)));

  const sw = $('#lang-switch');
  sw.textContent = '';
  for (const code of LANGS) {
    sw.append(
      el('a', {
        class: 'lang-opt' + (code === getLang() ? ' is-active' : ''),
        href: '#',
        text: LANG_NAMES[code],
        onclick: (e) => {
          e.preventDefault();
          setLang(code);
          renderChrome();
          renderGrid();
        },
      })
    );
  }
}

// ---- filtros --------------------------------------------------------------
function renderFilters() {
  const devices = [...new Set(catalog.flatMap((p) => p.deviceTypes || []))].sort();
  const group = $('#device-filter');
  group.textContent = '';
  const mk = (val, label) =>
    el('button', {
      type: 'button',
      class: 'pill' + (filter.device === val ? ' is-active' : ''),
      text: label,
      onclick: () => {
        filter.device = val;
        renderFilters();
        renderGrid();
      },
    });
  group.append(mk('', t('filter.all')));
  for (const d of devices) group.append(mk(d, deviceLabel(d)));
  $('#toolbar').hidden = catalog.length === 0;
}

// ---- estado do botão por plugin ------------------------------------------
function applyState(card, p) {
  const btn = $('.btn-install', card);
  const badge = $('.badge-update', card);
  const un = $('.btn-uninstall', card);
  const have = installed[p.id];
  if (!have) {
    btn.textContent = t('btn.install');
    btn.classList.remove('btn-installed');
    badge.hidden = true;
    un.hidden = true;
  } else if (cmpVersion(p.version, have) > 0) {
    btn.textContent = t('btn.update');
    btn.classList.remove('btn-installed');
    badge.hidden = false;
    un.hidden = false;
  } else {
    btn.textContent = t('btn.installed');
    btn.classList.add('btn-installed');
    badge.hidden = true;
    un.hidden = false;
  }
}

function card(p) {
  const name = locText(p, 'name');
  const desc = locText(p, 'description');
  const c = el(
    'article',
    { class: 'card', 'data-id': p.id },
    el(
      'a',
      { class: 'card-media', href: '#', onclick: (e) => { e.preventDefault(); openDetail(p); } },
      p.cover ? el('img', { src: p.cover, alt: '', loading: 'lazy' }) : el('span', { class: 'card-media-fallback', text: '◈' })
    ),
    el(
      'div',
      { class: 'card-body' },
      el(
        'div',
        { class: 'card-head' },
        el('h2', { class: 'card-title' }, el('a', { href: '#', text: name, onclick: (e) => { e.preventDefault(); openDetail(p); } })),
        el('span', { class: 'badge badge-update', hidden: true, text: t('badge.update') })
      ),
      el('p', { class: 'card-author', text: t('card.by', p.author) }),
      el('p', { class: 'card-desc', text: clip(desc, 140) }),
      metaRow(p),
      el(
        'div',
        { class: 'card-actions' },
        el('button', { type: 'button', class: 'btn btn-install', onclick: () => doInstall(p, c) }),
        el('button', { type: 'button', class: 'btn btn-uninstall', hidden: true, text: t('btn.uninstall'), onclick: () => doUninstall(p, c) }),
        el('span', { class: 'install-status', 'data-status': '' })
      ),
      el('div', { class: 'progress' }, el('i'))
    )
  );
  applyState(c, p);
  return c;
}

function metaRow(p) {
  const row = el('div', { class: 'card-meta' });
  for (const d of p.deviceTypes || []) row.append(el('span', { class: 'chip chip-device', text: deviceLabel(d) }));
  for (const pl of p.platforms || []) row.append(el('span', { class: 'chip', text: platformLabel(pl) }));
  if (p.languages && p.languages.length) row.append(el('span', { class: 'chip chip-muted', text: t('card.langs', p.languages.length) }));
  return row;
}

function clip(s, n) {
  s = s || '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function matches(p) {
  if (filter.device && !(p.deviceTypes || []).includes(filter.device)) return false;
  if (filter.query) {
    const hay = [locText(p, 'name'), p.author, locText(p, 'description'), p.category, (p.tags || []).join(' ')]
      .join(' ')
      .toLowerCase();
    if (!hay.includes(filter.query)) return false;
  }
  return true;
}

function renderGrid() {
  const grid = $('#grid');
  grid.textContent = '';
  const list = catalog.filter(matches);
  for (const p of list) grid.append(card(p));
  grid.hidden = list.length === 0;
  $('#no-results').hidden = list.length !== 0 || catalog.length === 0;
  $('#no-results').textContent = t('empty.no_results');
}

// ---- ações ---------------------------------------------------------------
async function doInstall(p, c) {
  const btn = $('.btn-install', c);
  const prog = $('.progress', c);
  btn.classList.add('btn-busy');
  btn.textContent = t('st.installing');
  prog.classList.add('on');
  try {
    await window.api.install(p);
    installed[p.id] = p.version;
  } catch (e) {
    $('.install-status', c).textContent = '✕ ' + (e.message || t('st.error'));
  } finally {
    prog.classList.remove('on');
    $('.progress i', c).style.width = '0';
    btn.classList.remove('btn-busy');
    applyState(c, p);
  }
}

async function doUninstall(p, c) {
  const un = $('.btn-uninstall', c);
  un.classList.add('btn-busy');
  un.textContent = t('st.uninstalling');
  try {
    await window.api.uninstall(p.id);
    delete installed[p.id];
  } catch (e) {
    $('.install-status', c).textContent = '✕ ' + (e.message || t('st.error'));
  } finally {
    un.classList.remove('btn-busy');
    un.textContent = t('btn.uninstall');
    applyState(c, p);
  }
}

// progresso vindo do main (uma vez, roteia por id)
window.api.onProgress(({ id, pct }) => {
  const c = $(`.card[data-id="${CSS.escape(id)}"]`);
  if (c) $('.progress i', c).style.width = pct + '%';
});

// ---- detalhe (modal) ------------------------------------------------------
function openDetail(p) {
  const body = $('#detail-body');
  body.textContent = '';
  const have = installed[p.id];
  body.append(
    el(
      'header',
      { class: 'detail-head' },
      p.icon ? el('img', { class: 'detail-icon', src: p.icon, alt: '' }) : null,
      el(
        'div',
        { class: 'detail-head-text' },
        el('h1', { text: locText(p, 'name') }),
        el('p', { class: 'card-author', text: t('card.by', p.author) + ' · v' + p.version }),
        metaRow(p)
      )
    )
  );
  if (p.screenshots && p.screenshots.length) {
    const shots = el('section', { class: 'shots' });
    for (const s of p.screenshots) shots.append(el('img', { src: s, alt: '', loading: 'lazy' }));
    body.append(shots);
  }
  body.append(
    el(
      'section',
      { class: 'detail-cols' },
      el(
        'div',
        { class: 'detail-main' },
        el('h2', { text: t('detail.about') }),
        el('p', { class: 'longdesc', text: locText(p, 'longDescription') }),
        p.changelog ? el('h2', { text: t('detail.whats_new', p.releaseTag) }) : null,
        p.changelog ? el('pre', { class: 'changelog', text: p.changelog }) : null
      ),
      el(
        'aside',
        { class: 'detail-side' },
        el('h3', { text: t('detail.details') }),
        dl([
          [t('detail.version'), p.version],
          p.minSoftwareVersion ? [t('detail.min_sw'), p.minSoftwareVersion] : null,
          p.languages && p.languages.length ? [t('detail.languages'), p.languages.join(', ')] : null,
          p.publishedAt ? [t('detail.published'), p.publishedAt.slice(0, 10)] : null,
          have ? [t('detail.installed_v', have), ''] : null,
        ])
      )
    )
  );
  $('#detail-modal').hidden = false;
}

function dl(rows) {
  const d = el('dl');
  for (const r of rows) {
    if (!r) continue;
    d.append(el('dt', { text: r[0] }), el('dd', { text: r[1] }));
  }
  return d;
}

function wireModal() {
  const m = $('#detail-modal');
  $$('[data-modal-close]', m).forEach((b) => b.addEventListener('click', () => (m.hidden = true)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') m.hidden = true;
  });
}

// ---- init -----------------------------------------------------------------
async function init() {
  renderChrome();
  wireModal();
  $('#search').addEventListener('input', (e) => {
    filter.query = e.target.value.trim().toLowerCase();
    renderGrid();
  });

  try {
    const [cat, inst] = await Promise.all([window.api.getCatalog(), window.api.listInstalled()]);
    catalog = cat.plugins || [];
    installed = Object.fromEntries(inst.map((i) => [i.pluginId, i.version]));
  } catch (e) {
    $('#loading').hidden = true;
    const err = $('#load-error');
    err.hidden = false;
    err.textContent = t('load_error');
    return;
  }
  $('#loading').hidden = true;
  renderFilters();
  renderGrid();

  // checagem proativa de updates (notificação nativa)
  window.api.checkUpdates().catch(() => {});
}

init();
})();
