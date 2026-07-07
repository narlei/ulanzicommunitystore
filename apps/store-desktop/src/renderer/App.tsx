import { createElement, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CatalogPlugin, InstalledPlugin } from '@ulanzideck/catalog';
import { compareVersions } from '@ulanzideck/catalog';
import type { InstallProgress, Settings } from '../shared';
import { LANG_NAMES, LANGS, detectLang, pluginText, t, type Lang } from './i18n';

type View = 'store' | 'installed' | 'updates' | 'submit' | 'settings';

const REPO_URL = 'https://github.com/narlei/ulanzipluginstore';
const SDK_URL = 'https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK';
type BusyState = Record<string, { pct: number; msg: string }>;

const defaultSettings: Settings = { developerMode: false };

export function App() {
  const [lang, setLangState] = useState<Lang>(() => detectLang());
  const [view, setView] = useState<View>('store');
  const [plugins, setPlugins] = useState<CatalogPlugin[]>([]);
  const [installed, setInstalled] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<BusyState>({});
  const [selected, setSelected] = useState<CatalogPlugin | null>(null);
  const [query, setQuery] = useState('');
  const [device, setDevice] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [catalog, installedList, appSettings] = await Promise.all([
        window.api.getCatalog(),
        window.api.listInstalled(),
        window.api.getSettings(),
      ]);
      setPlugins(catalog.plugins);
      setInstalled(toInstalledMap(installedList));
      setSettings(appSettings);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const offProgress = window.api.onProgress((progress: InstallProgress) => {
      setBusy((current) => ({ ...current, [progress.id]: { pct: progress.pct, msg: progress.msg } }));
    });
    const offRefresh = window.api.onInstalledRefresh(() => {
      void window.api.listInstalled().then((items) => setInstalled(toInstalledMap(items)));
    });
    return () => {
      offProgress();
      offRefresh();
    };
  }, [load]);

  function setLang(next: Lang) {
    localStorage.setItem('lang', next);
    setLangState(next);
  }

  const devices = useMemo(
    () => Array.from(new Set(plugins.flatMap((plugin) => plugin.deviceTypes || []))).sort(),
    [plugins],
  );

  const visible = useMemo(() => {
    return plugins.filter((plugin) => {
      if (view === 'installed' && !installed[plugin.id]) return false;
      if (view === 'updates' && !hasUpdate(plugin, installed)) return false;
      if (device && !(plugin.deviceTypes || []).includes(device)) return false;
      if (query.trim()) {
        const haystack = [
          pluginText(plugin, 'name', lang),
          pluginText(plugin, 'description', lang),
          plugin.author,
          plugin.category,
          (plugin.tags || []).join(' '),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [plugins, view, installed, device, query, lang]);

  async function install(plugin: CatalogPlugin) {
    setBusy((current) => ({ ...current, [plugin.id]: { pct: 2, msg: 'start' } }));
    try {
      const result = await window.api.install(plugin);
      setInstalled((current) => ({ ...current, [result.pluginId]: result.version }));
    } finally {
      setBusy((current) => {
        const next = { ...current };
        delete next[plugin.id];
        return next;
      });
    }
  }

  async function uninstall(plugin: CatalogPlugin) {
    setBusy((current) => ({ ...current, [plugin.id]: { pct: 35, msg: 'remove' } }));
    try {
      await window.api.uninstall(plugin.id);
      setInstalled((current) => {
        const next = { ...current };
        delete next[plugin.id];
        return next;
      });
    } finally {
      setBusy((current) => {
        const next = { ...current };
        delete next[plugin.id];
        return next;
      });
    }
  }

  async function setDeveloperMode(enabled: boolean) {
    setSettings(await window.api.setDeveloperMode(enabled));
  }

  return (
    <main className="min-h-screen overflow-hidden bg-ink text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(65,230,195,0.14),transparent_32%),radial-gradient(circle_at_82%_12%,rgba(76,117,255,0.13),transparent_28%)]" />
      <div className="app-titlebar" />
      <div className="relative flex h-[calc(100vh-32px)]">
        <aside className="flex w-64 shrink-0 flex-col border-r border-white/10 bg-black/20 px-4 py-5 backdrop-blur-xl">
          <div className="mb-8 pl-2">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-brand">Ulanzi</div>
            <div className="mt-1 text-2xl font-semibold">Plugin Store</div>
          </div>
          <nav className="space-y-2">
            {(['store', 'installed', 'updates', 'submit', 'settings'] as View[]).map((item) => (
              <button
                key={item}
                className={`nav-item ${view === item ? 'nav-item-active' : ''}`}
                onClick={() => setView(item)}
              >
                {t(lang, item)}
                {item === 'installed' && <span>{Object.keys(installed).length}</span>}
                {item === 'updates' && <span>{plugins.filter((plugin) => hasUpdate(plugin, installed)).length}</span>}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-400">
            {t(lang, 'unofficial')}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 items-center gap-4 border-b border-white/10 px-8">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold">{view === 'store' ? t(lang, 'title') : t(lang, view)}</h1>
              <p className="mt-1 text-sm text-slate-400">{view === 'submit' ? t(lang, 'submitSubtitle') : t(lang, 'subtitle')}</p>
            </div>
            <div className="flex rounded-lg border border-white/10 bg-white/[0.04] p-1">
              {LANGS.map((code) => (
                <button
                  key={code}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${lang === code ? 'bg-brand text-slate-950' : 'text-slate-300'}`}
                  onClick={() => setLang(code)}
                >
                  {LANG_NAMES[code]}
                </button>
              ))}
            </div>
          </header>

          {view === 'settings' ? (
            <SettingsView lang={lang} settings={settings} setDeveloperMode={setDeveloperMode} />
          ) : view === 'submit' ? (
            <SubmitView lang={lang} />
          ) : (
            <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <input
                  className="h-11 min-w-80 flex-1 rounded-lg border border-white/10 bg-white/[0.05] px-4 text-sm outline-none transition focus:border-brand/70"
                  placeholder={t(lang, 'search')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <button className={`pill ${device === '' ? 'pill-active' : ''}`} onClick={() => setDevice('')}>
                  {t(lang, 'all')}
                </button>
                {devices.map((item) => (
                  <button key={item} className={`pill ${device === item ? 'pill-active' : ''}`} onClick={() => setDevice(item)}>
                    {deviceLabel(item)}
                  </button>
                ))}
              </div>

              {loading && <StateCard>{t(lang, 'loading')}</StateCard>}
              {error && (
                <StateCard>
                  <div>{t(lang, 'catalogError')}</div>
                  <button className="btn-primary mt-4" onClick={() => void load()}>
                    {t(lang, 'retry')}
                  </button>
                </StateCard>
              )}
              {!loading && !error && visible.length === 0 && (
                <StateCard>{view === 'installed' ? t(lang, 'emptyInstalled') : view === 'updates' ? t(lang, 'emptyUpdates') : t(lang, 'noResults')}</StateCard>
              )}

              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                {visible.map((plugin) => (
                  <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    lang={lang}
                    installedVersion={installed[plugin.id]}
                    busy={busy[plugin.id]}
                    onOpen={() => setSelected(plugin)}
                    onInstall={() => void install(plugin)}
                    onUninstall={() => void uninstall(plugin)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {selected && (
        <PluginDetail
          plugin={selected}
          lang={lang}
          installedVersion={installed[selected.id]}
          busy={busy[selected.id]}
          onClose={() => setSelected(null)}
          onInstall={() => void install(selected)}
          onUninstall={() => void uninstall(selected)}
        />
      )}
    </main>
  );
}

function PluginCard({
  plugin,
  lang,
  installedVersion,
  busy,
  onOpen,
  onInstall,
  onUninstall,
}: {
  plugin: CatalogPlugin;
  lang: Lang;
  installedVersion?: string | null;
  busy?: { pct: number; msg: string };
  onOpen: () => void;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  const update = installedVersion && compareVersions(plugin.version, installedVersion) > 0;
  return (
    <article
      className="group cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-white/[0.045] shadow-glow transition hover:-translate-y-0.5 hover:border-brand/50"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="block h-36 w-full overflow-hidden bg-slate-900 text-left">
        {plugin.cover ? (
          <img src={plugin.cover} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center text-4xl text-brand">◆</div>
        )}
      </div>
      <div className="p-4">
        <div className="mb-2 flex items-start gap-3">
          <div className="min-w-0 flex-1 text-left">
            <h2 className="truncate text-base font-semibold">{pluginText(plugin, 'name', lang)}</h2>
            <p className="mt-0.5 text-xs text-slate-400">by {plugin.author}</p>
          </div>
          {update && <span className="rounded bg-brand px-2 py-1 text-[10px] font-bold uppercase text-slate-950">{t(lang, 'updateBadge')}</span>}
        </div>
        <p className="line-clamp-2 min-h-10 text-sm text-slate-300">{pluginText(plugin, 'description', lang)}</p>
        <Meta plugin={plugin} />
        {busy && (
          <div className="mt-3 h-1.5 overflow-hidden rounded bg-white/10">
            <div className="h-full rounded bg-brand transition-all" style={{ width: `${busy.pct}%` }} />
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button className="btn-primary flex-1" disabled={Boolean(busy)} onClick={(event) => { event.stopPropagation(); onInstall(); }}>
            {busy ? t(lang, 'installing') : installedVersion ? (update ? t(lang, 'update') : t(lang, 'installedState')) : t(lang, 'install')}
          </button>
          {installedVersion && (
            <button className="btn-ghost" disabled={Boolean(busy)} onClick={(event) => { event.stopPropagation(); onUninstall(); }}>
              {t(lang, 'uninstall')}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function PluginDetail({
  plugin,
  lang,
  installedVersion,
  busy,
  onClose,
  onInstall,
  onUninstall,
}: {
  plugin: CatalogPlugin;
  lang: Lang;
  installedVersion?: string | null;
  busy?: { pct: number; msg: string };
  onClose: () => void;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  const update = installedVersion && compareVersions(plugin.version, installedVersion) > 0;
  return (
    <div className="fixed inset-0 z-20 bg-black/60 p-6 backdrop-blur-sm" onClick={onClose}>
      <article className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-white/10 bg-[#101722] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start gap-5 border-b border-white/10 p-6">
          {plugin.icon && <img src={plugin.icon} alt="" className="h-20 w-20 rounded-lg object-cover" />}
          <div className="min-w-0 flex-1">
            <h2 className="text-3xl font-semibold">{pluginText(plugin, 'name', lang)}</h2>
            <p className="mt-1 text-slate-400">by {plugin.author} · v{plugin.version}</p>
            <Meta plugin={plugin} />
          </div>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-6">
          {plugin.screenshots?.length > 0 && (
            <div className="mb-6 grid grid-cols-2 gap-3">
              {plugin.screenshots.map((shot) => (
                <img key={shot} src={shot} alt="" className="h-52 w-full rounded-lg border border-white/10 object-cover" />
              ))}
            </div>
          )}
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_180px] xl:grid-cols-[minmax(0,1fr)_200px]">
            <section className="min-w-0">
              <h3 className="mb-2 text-lg font-semibold">{t(lang, 'about')}</h3>
              <p className="overflow-wrap-anywhere whitespace-pre-line leading-7 text-slate-300">{pluginText(plugin, 'longDescription', lang)}</p>
              {plugin.changelog && (
                <>
                  <h3 className="mb-2 mt-6 text-lg font-semibold">{t(lang, 'whatsNew')}</h3>
                  <Markdown className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-300" text={plugin.changelog} />
                </>
              )}
            </section>
            <aside className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <h3 className="mb-4 font-semibold">{t(lang, 'details')}</h3>
              <DetailRow label={t(lang, 'version')} value={plugin.version} />
              {plugin.minSoftwareVersion && <DetailRow label={t(lang, 'minSoftware')} value={plugin.minSoftwareVersion} />}
              {plugin.languages?.length > 0 && <DetailRow label={t(lang, 'languages')} value={plugin.languages.join(', ')} />}
              {plugin.publishedAt && <DetailRow label={t(lang, 'published')} value={plugin.publishedAt.slice(0, 10)} />}
            </aside>
          </div>
        </div>
        <footer className="flex items-center gap-3 border-t border-white/10 p-5">
          <button className="btn-primary" disabled={Boolean(busy)} onClick={onInstall}>
            {busy ? t(lang, 'installing') : installedVersion ? (update ? t(lang, 'update') : t(lang, 'installedState')) : t(lang, 'install')}
          </button>
          {installedVersion && <button className="btn-ghost" disabled={Boolean(busy)} onClick={onUninstall}>{t(lang, 'uninstall')}</button>}
          <button className="btn-ghost" onClick={() => void window.api.openExternal(plugin.sourceUrl)}>{t(lang, 'source')}</button>
          {busy && <div className="h-1.5 flex-1 overflow-hidden rounded bg-white/10"><div className="h-full rounded bg-brand" style={{ width: `${busy.pct}%` }} /></div>}
        </footer>
      </article>
    </div>
  );
}

function SettingsView({ lang, settings, setDeveloperMode }: { lang: Lang; settings: Settings; setDeveloperMode: (enabled: boolean) => void }) {
  return (
    <div className="p-8">
      <section className="max-w-2xl rounded-lg border border-white/10 bg-white/[0.045] p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-lg font-semibold">{t(lang, 'developerMode')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{t(lang, 'developerModeHelp')}</p>
          </div>
          <button className={`toggle ${settings.developerMode ? 'toggle-on' : ''}`} onClick={() => setDeveloperMode(!settings.developerMode)}>
            <span />
          </button>
        </div>
      </section>
    </div>
  );
}

function SubmitView({ lang }: { lang: Lang }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
      <div className="mb-6 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => void window.api.openExternal(`${REPO_URL}/fork`)}>
          {t(lang, 'submitFork')}
        </button>
        <button className="btn-ghost" onClick={() => void window.api.openExternal(`${REPO_URL}/tree/main/registry/plugins`)}>
          {t(lang, 'submitRegistry')}
        </button>
        <button className="btn-ghost" onClick={() => void window.api.openExternal(SDK_URL)}>
          {t(lang, 'submitSdk')}
        </button>
      </div>
      <div className="max-w-3xl rounded-lg border border-white/10 bg-white/[0.045] p-6">
        <Markdown className="text-sm" text={t(lang, 'submitMarkdown')} />
      </div>
    </div>
  );
}

function Meta({ plugin }: { plugin: CatalogPlugin }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {(plugin.deviceTypes || []).map((item) => <span className="chip chip-brand" key={item}>{deviceLabel(item)}</span>)}
      {(plugin.platforms || []).map((item) => <span className="chip" key={item}>{platformLabel(item)}</span>)}
      {(plugin.tags || []).slice(0, 2).map((item) => <span className="chip" key={item}>{item}</span>)}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-200">{value}</div>
    </div>
  );
}

function StateCard({ children }: { children: ReactNode }) {
  return <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-white/10 bg-white/[0.025] p-8 text-center text-slate-400">{children}</div>;
}

function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const blocks = parseMarkdownBlocks(text || '');
  return (
    <div className={`markdown-body ${className}`}>
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return <pre key={index}><code>{block.text}</code></pre>;
        }
        if (block.type === 'hr') return <hr key={index} />;
        if (block.type === 'heading') {
          return createElement(`h${block.level}`, { key: index }, renderInlineMarkdown(block.text));
        }
        if (block.type === 'quote') return <blockquote key={index}>{renderInlineMarkdown(block.text)}</blockquote>;
        if (block.type === 'list') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item)}</li>)}
            </ul>
          );
        }
        return <p key={index}>{renderInlineMarkdown(block.text)}</p>;
      })}
    </div>
  );
}

type MarkdownBlock =
  | { type: 'code'; text: string }
  | { type: 'hr' }
  | { type: 'heading'; level: number; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'paragraph'; text: string };

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const fence = line.match(/^```/);
    if (fence) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', text: quote.join(' ') });
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim()) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={nodes.length}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={nodes.length}>{token.slice(1, -1)}</code>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = link?.[2] || '';
      if (/^https?:\/\//.test(href)) {
        nodes.push(
          <a key={nodes.length} href={href} onClick={(event) => { event.preventDefault(); void window.api.openExternal(href); }}>
            {link?.[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function toInstalledMap(items: InstalledPlugin[]): Record<string, string | null> {
  return Object.fromEntries(items.map((item) => [item.pluginId, item.version]));
}

function hasUpdate(plugin: CatalogPlugin, installed: Record<string, string | null>): boolean {
  const current = installed[plugin.id];
  return Boolean(current && compareVersions(plugin.version, current) > 0);
}

function deviceLabel(value: string): string {
  if (value === 'deck') return 'Deck';
  if (value === 'dial') return 'Dial';
  return value;
}

function platformLabel(value: string): string {
  const lower = value.toLowerCase();
  if (lower.startsWith('mac') || lower === 'darwin') return 'macOS';
  if (lower.startsWith('win')) return 'Windows';
  return value;
}
