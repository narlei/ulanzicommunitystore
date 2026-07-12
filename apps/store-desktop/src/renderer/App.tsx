import { createElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CatalogPlugin, InstalledPlugin } from '@ulanzideck/catalog';
import { compareVersions } from '@ulanzideck/catalog';
import type { InstallProgress, Settings, SubmitCheck, SubmitCheckResult } from '../shared';
import { LANG_NAMES, LANGS, detectLang, pluginText, t, type Lang } from './i18n';

type View = 'store' | 'installed' | 'updates' | 'submit' | 'settings';

const REPO_URL = 'https://github.com/narlei/ulanzipluginstore';
const SDK_URL = 'https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK';
type BusyState = Record<string, { pct: number; msg: string }>;

const defaultSettings: Settings = { developerMode: false };

const NAV_VIEWS: View[] = ['store', 'installed', 'updates', 'submit', 'settings'];

const NAV_ICONS: Record<View, ReactNode> = {
  store: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <path d="M9 20v-6h6v6" />
    </svg>
  ),
  installed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d="M12 3v12" />
      <path d="M8 11l4 4 4-4" />
      <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
    </svg>
  ),
  updates: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  ),
  submit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d="M12 20V6" />
      <path d="M6 12l6-6 6 6" />
      <path d="M4 4h16" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

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
  const searchRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'f')) {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function setLang(next: Lang) {
    localStorage.setItem('lang', next);
    setLangState(next);
  }

  function onSearch(value: string) {
    setQuery(value);
    if (value && (view === 'settings' || view === 'submit')) setView('store');
  }

  const devices = useMemo(
    () => Array.from(new Set(plugins.flatMap((plugin) => plugin.deviceTypes || []))).sort(),
    [plugins],
  );

  const updateCount = useMemo(
    () => plugins.filter((plugin) => hasUpdate(plugin, installed)).length,
    [plugins, installed],
  );

  const installedCount = useMemo(
    () => plugins.filter((plugin) => installed[plugin.id]).length,
    [plugins, installed],
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

  const isListView = view === 'store' || view === 'installed' || view === 'updates';

  return (
    <main className="flex h-screen overflow-hidden text-[13px] text-ink">
      <aside className="sidebar flex w-[232px] shrink-0 flex-col border-r border-stroke/70">
        <div className="drag-region h-[52px] shrink-0" />
        <div className="px-3">
          <div className="search-field no-drag">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="search-icon h-3.5 w-3.5">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              ref={searchRef}
              placeholder={t(lang, 'search')}
              value={query}
              onChange={(event) => onSearch(event.target.value)}
              spellCheck={false}
            />
            {!query && <span className="kbd">⌘K</span>}
          </div>
        </div>
        <nav className="no-drag mt-4 flex-1 space-y-px overflow-y-auto px-3">
          <div className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink3">
            Ulanzi Plugin Store
          </div>
          {NAV_VIEWS.map((item) => (
            <button
              key={item}
              className={`nav-item ${view === item ? 'nav-item-active' : ''}`}
              onClick={() => setView(item)}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className={view === item ? '' : 'text-accent'}>{NAV_ICONS[item]}</span>
                <span className="truncate">{t(lang, item)}</span>
              </span>
              {item === 'installed' && installedCount > 0 && (
                <span className="nav-badge">{installedCount}</span>
              )}
              {item === 'updates' && updateCount > 0 && (
                <span className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${view === item ? 'nav-badge' : 'bg-accent text-accent-ink'}`}>
                  {updateCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <footer className="no-drag px-5 pb-4 text-[11px] leading-relaxed text-ink3">
          {t(lang, 'unofficial')}
        </footer>
      </aside>

      <section className="content-pane flex min-w-0 flex-1 flex-col">
        <header className="drag-region flex h-[52px] shrink-0 items-center justify-between gap-4 border-b border-stroke/70 px-6">
          <h1 className="truncate text-[15px] font-semibold">
            {view === 'store' ? t(lang, 'title') : t(lang, view)}
          </h1>
          {isListView && devices.length > 0 && (
            <div className="seg no-drag">
              <button className={device === '' ? 'seg-active' : ''} onClick={() => setDevice('')}>
                {t(lang, 'all')}
              </button>
              {devices.map((item) => (
                <button key={item} className={device === item ? 'seg-active' : ''} onClick={() => setDevice(item)}>
                  {deviceLabel(item)}
                </button>
              ))}
            </div>
          )}
        </header>

        {view === 'settings' ? (
          <SettingsView lang={lang} settings={settings} setLang={setLang} setDeveloperMode={setDeveloperMode} />
        ) : view === 'submit' ? (
          <SubmitView lang={lang} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
            <div className="mb-6">
              <h2 className="text-[26px] font-bold tracking-tight">
                {view === 'store' ? t(lang, 'title') : t(lang, view)}
              </h2>
              <p className="mt-0.5 text-ink2">{t(lang, 'subtitle')}</p>
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
              <StateCard>
                {view === 'installed' ? t(lang, 'emptyInstalled') : view === 'updates' ? t(lang, 'emptyUpdates') : t(lang, 'noResults')}
              </StateCard>
            )}

            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5 pb-4">
              {visible.map((plugin, index) => (
                <PluginCard
                  key={plugin.id}
                  plugin={plugin}
                  index={index}
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

function InstallButton({
  lang,
  installedVersion,
  update,
  busy,
  onInstall,
}: {
  lang: Lang;
  installedVersion?: string | null;
  update?: boolean | null;
  busy?: { pct: number; msg: string };
  onInstall: () => void;
}) {
  const label = busy
    ? t(lang, 'installing')
    : installedVersion
      ? update
        ? t(lang, 'update')
        : t(lang, 'installedState')
      : t(lang, 'install');
  const isIdleInstalled = Boolean(installedVersion && !update);
  return (
    <button
      className={isIdleInstalled ? 'btn-pill-ghost' : 'btn-get'}
      disabled={Boolean(busy) || isIdleInstalled}
      onClick={(event) => {
        event.stopPropagation();
        onInstall();
      }}
    >
      {label}
    </button>
  );
}

function PluginCard({
  plugin,
  index,
  lang,
  installedVersion,
  busy,
  onOpen,
  onInstall,
  onUninstall,
}: {
  plugin: CatalogPlugin;
  index: number;
  lang: Lang;
  installedVersion?: string | null;
  busy?: { pct: number; msg: string };
  onOpen: () => void;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  const update = Boolean(installedVersion && compareVersions(plugin.version, installedVersion) > 0);
  return (
    <article
      className="card card-interactive animate-card group flex cursor-pointer flex-col overflow-hidden"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
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
      <div className="h-32 w-full overflow-hidden bg-raised">
        {plugin.cover ? (
          <img src={plugin.cover} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="grid h-full place-items-center text-3xl text-accent/50">◆</div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-3">
          {plugin.icon ? (
            <img src={plugin.icon} alt="" className="h-10 w-10 shrink-0 rounded-[10px] object-cover shadow-card" />
          ) : (
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-accent/10 text-accent">◆</div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[14px] font-semibold">{pluginText(plugin, 'name', lang)}</h3>
            <p className="truncate text-[12px] text-ink3">{plugin.author}</p>
          </div>
          <InstallButton lang={lang} installedVersion={installedVersion} update={update} busy={busy} onInstall={onInstall} />
        </div>
        <p className="mt-3 line-clamp-2 min-h-9 text-[12.5px] leading-[18px] text-ink2">
          {pluginText(plugin, 'description', lang)}
        </p>
        {busy ? (
          <div className="mt-3">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${busy.pct}%` }} />
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-2">
            <Meta plugin={plugin} showUpdate={Boolean(update)} lang={lang} />
            {installedVersion && (
              <button
                className="shrink-0 text-[12px] font-medium text-ink3 transition-colors hover:text-red-500"
                onClick={(event) => {
                  event.stopPropagation();
                  onUninstall();
                }}
              >
                {t(lang, 'uninstall')}
              </button>
            )}
          </div>
        )}
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
  const update = Boolean(installedVersion && compareVersions(plugin.version, installedVersion) > 0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="animate-backdrop fixed inset-0 z-20 grid place-items-center bg-black/40 p-8 backdrop-blur-[2px]" onClick={onClose}>
      <article
        className="animate-sheet flex h-full max-h-[760px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-bg shadow-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="relative flex items-center gap-5 border-b border-stroke/70 p-6 pr-14">
          {plugin.icon ? (
            <img src={plugin.icon} alt="" className="h-[76px] w-[76px] shrink-0 rounded-[17px] object-cover shadow-card" />
          ) : (
            <div className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-[17px] bg-accent/10 text-3xl text-accent">◆</div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[22px] font-bold tracking-tight">{pluginText(plugin, 'name', lang)}</h2>
            <p className="mt-0.5 text-ink2">
              {plugin.author} · v{plugin.version}
            </p>
            <div className="mt-2.5 flex items-center gap-3">
              <InstallButton lang={lang} installedVersion={installedVersion} update={update} busy={busy} onInstall={onInstall} />
              {installedVersion && (
                <button className="btn-pill-ghost !text-red-500" disabled={Boolean(busy)} onClick={onUninstall}>
                  {t(lang, 'uninstall')}
                </button>
              )}
              <button className="btn-pill-ghost" onClick={() => void window.api.openExternal(plugin.sourceUrl)}>
                {t(lang, 'source')}
              </button>
              {busy && (
                <div className="progress-track w-40">
                  <div className="progress-fill" style={{ width: `${busy.pct}%` }} />
                </div>
              )}
            </div>
          </div>
          <button
            className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full bg-black/[0.06] text-ink2 transition-colors hover:bg-black/[0.12] hover:text-ink dark:bg-white/[0.08] dark:hover:bg-white/[0.14]"
            onClick={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="h-3.5 w-3.5">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-6">
          {plugin.screenshots?.length > 0 && (
            <div className="mb-6 flex gap-3 overflow-x-auto pb-1">
              {plugin.screenshots.map((shot) => (
                <img key={shot} src={shot} alt="" className="h-56 shrink-0 rounded-xl object-cover shadow-card" />
              ))}
            </div>
          )}

          <section className="min-w-0">
            <h3 className="mb-2 text-[16px] font-semibold">{t(lang, 'about')}</h3>
            <p className="overflow-wrap-anywhere selectable whitespace-pre-line leading-6 text-ink2">
              {pluginText(plugin, 'longDescription', lang)}
            </p>
          </section>

          {plugin.changelog && (
            <section className="mt-7 min-w-0">
              <h3 className="mb-2 text-[16px] font-semibold">{t(lang, 'whatsNew')}</h3>
              <Markdown className="rounded-xl bg-surface p-4 text-sm leading-6 shadow-card" text={plugin.changelog} />
            </section>
          )}

          <section className="mt-7">
            <h3 className="mb-3 text-[16px] font-semibold">{t(lang, 'details')}</h3>
            <div className="grid grid-cols-2 gap-x-6 rounded-xl bg-surface px-5 shadow-card sm:grid-cols-3 lg:grid-cols-4">
              <DetailCell label={t(lang, 'version')} value={plugin.version} />
              {plugin.minSoftwareVersion && <DetailCell label={t(lang, 'minSoftware')} value={plugin.minSoftwareVersion} />}
              {plugin.languages?.length > 0 && <DetailCell label={t(lang, 'languages')} value={plugin.languages.join(', ')} />}
              {plugin.publishedAt && <DetailCell label={t(lang, 'published')} value={plugin.publishedAt.slice(0, 10)} />}
              {(plugin.deviceTypes || []).length > 0 && (
                <DetailCell label="Devices" value={(plugin.deviceTypes || []).map(deviceLabel).join(', ')} />
              )}
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}

function SettingsView({
  lang,
  settings,
  setLang,
  setDeveloperMode,
}: {
  lang: Lang;
  settings: Settings;
  setLang: (lang: Lang) => void;
  setDeveloperMode: (enabled: boolean) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
      <div className="max-w-2xl">
        <h2 className="mb-6 text-[26px] font-bold tracking-tight">{t(lang, 'settings')}</h2>
        <section className="card divide-y divide-stroke/60 px-5">
          <div className="flex items-center justify-between gap-6 py-4">
            <div>
              <h3 className="font-semibold">{t(lang, 'language')}</h3>
              <p className="mt-0.5 text-[12px] text-ink2">{t(lang, 'languageHelp')}</p>
            </div>
            <div className="seg shrink-0">
              {LANGS.map((code) => (
                <button key={code} className={lang === code ? 'seg-active' : ''} onClick={() => setLang(code)}>
                  {LANG_NAMES[code]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-6 py-4">
            <div>
              <h3 className="font-semibold">{t(lang, 'developerMode')}</h3>
              <p className="mt-0.5 text-[12px] text-ink2">{t(lang, 'developerModeHelp')}</p>
            </div>
            <button
              className={`toggle shrink-0 ${settings.developerMode ? 'toggle-on' : ''}`}
              onClick={() => setDeveloperMode(!settings.developerMode)}
            >
              <span />
            </button>
          </div>
        </section>
        <p className="mt-4 px-1 text-[11px] text-ink3">{t(lang, 'unofficial')}</p>
      </div>
    </div>
  );
}

function SubmitView({ lang }: { lang: Lang }) {
  const [repoInput, setRepoInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<SubmitCheckResult | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [copied, setCopied] = useState(false);

  async function validate() {
    if (!repoInput.trim() || checking) return;
    setChecking(true);
    setResult(null);
    setNetworkError(false);
    setCopied(false);
    try {
      setResult(await window.api.checkSubmission(repoInput));
    } catch {
      setNetworkError(true);
    } finally {
      setChecking(false);
    }
  }

  async function copyJson() {
    if (!result) return;
    await navigator.clipboard.writeText(result.registryJson);
    setCopied(true);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
      <div className="max-w-3xl space-y-5">
        <div>
          <h2 className="text-[26px] font-bold tracking-tight">{t(lang, 'submit')}</h2>
          <p className="mt-0.5 text-ink2">{t(lang, 'submitSubtitle')}</p>
        </div>

        <section className="card p-5">
          <ol className="space-y-2.5">
            {(['submitStep1', 'submitStep2', 'submitStep3'] as const).map((key, index) => (
              <li key={key} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/10 text-[11px] font-bold text-accent">
                  {index + 1}
                </span>
                <span className="leading-6 text-ink2">{renderInlineMarkdown(t(lang, key))}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => void window.api.openExternal(SDK_URL)}>
              {t(lang, 'submitSdk')}
            </button>
            <button className="btn-ghost" onClick={() => void window.api.openExternal(`${REPO_URL}/tree/main/registry`)}>
              {t(lang, 'submitRegistry')}
            </button>
          </div>
        </section>

        <section className="card p-5">
          <h3 className="text-[16px] font-semibold">{t(lang, 'submitToolTitle')}</h3>
          <p className="mt-1 text-ink2">{t(lang, 'submitToolHelp')}</p>
          <div className="mt-4 flex gap-2">
            <input
              className="h-9 min-w-0 flex-1 rounded-[7px] border border-stroke bg-raised/60 px-3 text-[13px] outline-none transition-shadow placeholder:text-ink3 focus:border-accent/70 focus:shadow-[0_0_0_3px_rgb(var(--c-accent)/0.25)]"
              placeholder="https://github.com/you/your-plugin"
              value={repoInput}
              onChange={(event) => setRepoInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void validate();
              }}
              spellCheck={false}
            />
            <button className="btn-primary" disabled={checking || !repoInput.trim()} onClick={() => void validate()}>
              {checking ? t(lang, 'submitChecking') : t(lang, 'submitValidate')}
            </button>
          </div>

          {networkError && <p className="mt-4 text-[13px] text-red-500">{t(lang, 'submitNetworkError')}</p>}

          {result && (
            <ul className="mt-5 space-y-2">
              {result.checks.map((check) => (
                <SubmitCheckRow key={check.id} check={check} lang={lang} />
              ))}
            </ul>
          )}

          {result && !result.ok && (
            <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] p-4 leading-6 text-amber-700 dark:text-amber-300">
              {t(lang, 'submitFixHint')}
            </p>
          )}

          {result?.ok && (
            <div className="mt-5 rounded-xl border border-accent/25 bg-accent/[0.05] p-5">
              <div className="flex items-center gap-3">
                {result.plugin?.icon && <img src={result.plugin.icon} alt="" className="h-10 w-10 rounded-[10px] object-cover shadow-card" />}
                <div>
                  <div className="font-semibold text-accent">{t(lang, 'submitReadyTitle')}</div>
                  {result.plugin && (
                    <div className="text-ink2">
                      {result.plugin.name} · v{result.plugin.version}
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-3 leading-6 text-ink2">{t(lang, 'submitReadyText')}</p>
              <div className="mt-3 rounded-lg border border-stroke bg-raised p-4">
                <div className="font-mono text-[11px] text-ink3">registry/plugins/{result.registryFileName}</div>
                <pre className="selectable mt-2 overflow-x-auto font-mono text-[12px] leading-5 text-ink">{result.registryJson.trim()}</pre>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-primary" onClick={() => void window.api.openExternal(result.prUrl)}>
                  {t(lang, 'submitOpenPr')}
                </button>
                <button className="btn-ghost" onClick={() => void copyJson()}>
                  {copied ? t(lang, 'submitCopied') : t(lang, 'submitCopy')}
                </button>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-ink3">{t(lang, 'submitPrHint')}</p>
            </div>
          )}
        </section>

        <section className="card p-5">
          <Markdown className="text-[13px]" text={t(lang, 'submitMarkdown')} />
        </section>
      </div>
    </div>
  );
}

function SubmitCheckRow({ check, lang }: { check: SubmitCheck; lang: Lang }) {
  const styles: Record<SubmitCheck['status'], { badge: string; symbol: string }> = {
    ok: { badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', symbol: '✓' },
    warn: { badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-300', symbol: '!' },
    fail: { badge: 'bg-red-500/15 text-red-500', symbol: '✕' },
  };
  const { badge, symbol } = styles[check.status];
  const suffix = check.id === 'store' && check.value === 'invalid' ? '_invalid' : '';
  return (
    <li className="flex items-start gap-3">
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${badge}`}>{symbol}</span>
      <span className="leading-6 text-ink2">
        {t(lang, `submit_${check.id}_${check.status}${suffix}`, check.value || '')}
      </span>
    </li>
  );
}

function Meta({ plugin, showUpdate, lang }: { plugin: CatalogPlugin; showUpdate?: boolean; lang?: Lang }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {showUpdate && lang && <span className="chip bg-accent text-accent-ink">{t(lang, 'updateBadge')}</span>}
      {(plugin.deviceTypes || []).map((item) => (
        <span className="chip chip-brand" key={item}>
          {deviceLabel(item)}
        </span>
      ))}
      {(plugin.platforms || []).map((item) => (
        <span className="chip" key={item}>
          {platformLabel(item)}
        </span>
      ))}
      {(plugin.tags || []).slice(0, 2).map((item) => (
        <span className="chip" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink3">{label}</div>
      <div className="selectable mt-1 text-[13px] text-ink">{value}</div>
    </div>
  );
}

function StateCard({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-stroke bg-surface/40 p-8 text-center text-ink2">
      <div>{children}</div>
    </div>
  );
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
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|<img\b[^>]*>)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={nodes.length}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={nodes.length}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('![')) {
      const image = token.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      const src = image?.[2] || '';
      if (/^https?:\/\//.test(src)) {
        nodes.push(<img key={nodes.length} src={src} alt={image?.[1] || ''} className="my-2 max-w-full rounded-lg" />);
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith('<img')) {
      const src = token.match(/\bsrc="([^"]+)"/)?.[1] || '';
      const alt = token.match(/\balt="([^"]*)"/)?.[1] || '';
      if (/^https?:\/\//.test(src)) {
        nodes.push(<img key={nodes.length} src={src} alt={alt} className="my-2 max-w-full rounded-lg" />);
      } else {
        nodes.push(token);
      }
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
