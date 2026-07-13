import { createElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CatalogPlugin, InstalledPlugin } from '@ulanzideck/catalog';
import { compareVersions, isPluginNew } from '@ulanzideck/catalog';
import type { AppUpdateInfo, InstallProgress, Settings, SubmitCheck, SubmitCheckResult } from '../shared';
import { LANG_NAMES, LANGS, detectLang, pluginText, progressLabel, t, type Lang } from './i18n';

type View = 'store' | 'installed' | 'updates' | 'submit' | 'settings';
type Sort = 'recent' | 'popular';
/** Normalized OS filter key; empty string means all platforms. */
type PlatformFilter = '' | 'mac' | 'windows';

const REPO_URL = 'https://github.com/narlei/ulanzicommunitystore';
const SDK_URL = 'https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK';
const STARTER_DOCS_URL = `${REPO_URL}/tree/main/plugin-starter`;
const STARTER_INIT_CMD = 'npx ulanzi-plugin-starter@latest init';
const STARTER_STORE_CMD = 'npx ulanzi-plugin-starter@latest store';
const RELEASE_TAG_CMD = 'git tag v1.0.0 && git push origin v1.0.0';
/** Prompt for a GitHub star after the user has installed this many plugins. */
const GITHUB_STAR_PROMPT_THRESHOLD = 3;
const GITHUB_STAR_DISMISSED_KEY = 'githubStarDismissed';
const PLATFORM_FILTER_KEY = 'platformFilter';

type BusyState = Record<string, { pct: number; msg: string }>;

const defaultSettings: Settings = { developerMode: false };

function detectHostPlatform(): PlatformFilter {
  const platform = (navigator.platform || navigator.userAgent || '').toLowerCase();
  if (platform.includes('mac') || platform.includes('darwin')) return 'mac';
  if (platform.includes('win')) return 'windows';
  return '';
}

function loadPlatformFilter(): PlatformFilter {
  try {
    const stored = localStorage.getItem(PLATFORM_FILTER_KEY);
    if (stored === '' || stored === 'mac' || stored === 'windows') return stored;
  } catch {
    // private mode / blocked storage
  }
  // Default to this machine's OS so Windows-only plugins stay out of the way on macOS (and vice-versa).
  return detectHostPlatform();
}

function savePlatformFilter(value: PlatformFilter): void {
  try {
    localStorage.setItem(PLATFORM_FILTER_KEY, value);
  } catch {
    // ignore
  }
}

/** Map catalog platform strings (`mac`, `darwin`, `windows`, …) to filter keys. */
function normalizePlatform(value: string): PlatformFilter | 'other' {
  const lower = String(value || '').toLowerCase();
  if (lower.startsWith('mac') || lower === 'darwin') return 'mac';
  if (lower.startsWith('win')) return 'windows';
  return 'other';
}

function pluginSupportsPlatform(plugin: CatalogPlugin, platform: PlatformFilter): boolean {
  if (!platform) return true;
  const platforms = plugin.platforms || [];
  // Missing metadata → treat as cross-platform so plugins stay discoverable.
  if (platforms.length === 0) return true;
  return platforms.some((item) => normalizePlatform(item) === platform);
}

function isGithubStarDismissed(): boolean {
  return localStorage.getItem(GITHUB_STAR_DISMISSED_KEY) === '1';
}

function dismissGithubStarPrompt(): void {
  localStorage.setItem(GITHUB_STAR_DISMISSED_KEY, '1');
}

const NAV_VIEWS: View[] = ['store', 'installed', 'updates', 'submit', 'settings'];

const ICON_SM = 'h-3.5 w-3.5 shrink-0';

function IconTrash({ className = ICON_SM }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function IconGithub({ className = ICON_SM }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function IconWarning({ className = ICON_SM }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

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
  const [platform, setPlatformState] = useState<PlatformFilter>(() => loadPlatformFilter());
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [appUpdate, setAppUpdate] = useState<AppUpdateInfo | null>(null);
  const [appUpdateDismissed, setAppUpdateDismissed] = useState<string | null>(null);
  const [appUpdateBusy, setAppUpdateBusy] = useState(false);
  const [githubStarDismissed, setGithubStarDismissed] = useState(() => isGithubStarDismissed());
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
    void window.api.checkAppUpdate().then(setAppUpdate).catch(() => {
      // Keep UI quiet if the releases API is unreachable.
    });
    const offProgress = window.api.onProgress((progress: InstallProgress) => {
      setBusy((current) => ({ ...current, [progress.id]: { pct: progress.pct, msg: progress.msg } }));
    });
    const offRefresh = window.api.onInstalledRefresh(() => {
      void window.api.listInstalled().then((items) => setInstalled(toInstalledMap(items)));
    });
    const offUpdates = window.api.onUpdatesChanged(() => {
      void load();
    });
    const offAppUpdate = window.api.onAppUpdateChanged((info) => {
      setAppUpdate(info);
    });
    return () => {
      offProgress();
      offRefresh();
      offUpdates();
      offAppUpdate();
    };
  }, [load]);

  // When true, focus the catalog search once it is mounted (e.g. ⌘K from Settings).
  const pendingSearchFocus = useRef(false);

  const focusSearchField = useCallback(() => {
    const el = searchRef.current;
    if (!el) return false;
    el.focus();
    el.select();
    return true;
  }, []);

  // Focus the catalog search (⌘K / ⌘F). From settings/submit, jump to Store first.
  const focusSearch = useCallback(() => {
    if (view === 'settings' || view === 'submit') {
      pendingSearchFocus.current = true;
      setView('store');
      return;
    }
    if (!focusSearchField()) {
      pendingSearchFocus.current = true;
    }
  }, [view, focusSearchField]);

  useEffect(() => {
    if (!pendingSearchFocus.current) return;
    if (view === 'settings' || view === 'submit') return;
    if (focusSearchField()) pendingSearchFocus.current = false;
  }, [view, focusSearchField]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'f')) {
        event.preventDefault();
        focusSearch();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusSearch]);

  function setLang(next: Lang) {
    localStorage.setItem('lang', next);
    setLangState(next);
  }

  function onSearch(value: string) {
    setQuery(value);
  }

  function setPlatform(next: PlatformFilter) {
    setPlatformState(next);
    savePlatformFilter(next);
  }

  function clearAllFilters() {
    setPlatform('');
    setDevice('');
    setCategory('');
    setQuery('');
  }

  const devices = useMemo(
    () => Array.from(new Set(plugins.flatMap((plugin) => plugin.deviceTypes || []))).sort(),
    [plugins],
  );

  // Preview layout: always expose Deck/Dial so the filter bar density can be judged
  // even while the catalog is still single-device. Revert to `devices` when Dial ships.
  const deviceFilterOptions = useMemo(
    () => Array.from(new Set(['deck', 'dial', ...devices])).sort(),
    [devices],
  );

  // Drop stale selection only when the option is gone from the filter list.
  useEffect(() => {
    if (device && !deviceFilterOptions.includes(device)) setDevice('');
  }, [deviceFilterOptions, device]);

  // Categories in the UI come from store.json `tags` (e.g. productivity), not
  // manifest.Category (often the plugin product name).
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          plugins.flatMap((plugin) =>
            (plugin.tags || []).map((tag) => tag.trim()).filter(Boolean),
          ),
        ),
      ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [plugins],
  );

  const availablePlatforms = useMemo(() => {
    const set = new Set<PlatformFilter>();
    for (const plugin of plugins) {
      for (const item of plugin.platforms || []) {
        const key = normalizePlatform(item);
        if (key === 'mac' || key === 'windows') set.add(key);
      }
    }
    return Array.from(set).sort();
  }, [plugins]);

  const updateCount = useMemo(
    () => plugins.filter((plugin) => hasUpdate(plugin, installed)).length,
    [plugins, installed],
  );

  const installedCount = useMemo(
    () => plugins.filter((plugin) => installed[plugin.id]).length,
    [plugins, installed],
  );

  const visible = useMemo(() => {
    const filtered = plugins.filter((plugin) => {
      if (view === 'installed' && !installed[plugin.id]) return false;
      if (view === 'updates' && !hasUpdate(plugin, installed)) return false;
      if (device && !(plugin.deviceTypes || []).includes(device)) return false;
      if (!pluginSupportsPlatform(plugin, platform)) return false;
      if (category && !(plugin.tags || []).some((tag) => tag.trim() === category)) return false;
      if (query.trim()) {
        const haystack = [
          pluginText(plugin, 'name', lang),
          pluginText(plugin, 'description', lang),
          plugin.author,
          (plugin.tags || []).join(' '),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    });
    if (sort === 'popular') {
      filtered.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
    } else {
      // Recent: uninstalled + NEW first (discovery), then pure recency.
      filtered.sort((a, b) => {
        const aDiscover = !installed[a.id] && isPluginNew(a.publishedAt) ? 1 : 0;
        const bDiscover = !installed[b.id] && isPluginNew(b.publishedAt) ? 1 : 0;
        if (aDiscover !== bDiscover) return bDiscover - aDiscover;
        return (b.publishedAt || '').localeCompare(a.publishedAt || '');
      });
    }
    return filtered;
  }, [plugins, view, installed, device, platform, category, query, lang, sort]);

  // Any narrowing of the catalog list (OS default counts — clear resets it to “all”).
  const hasActiveFilters = Boolean(platform || device || category || query.trim());
  // Prefer the view empty-state when that view has nothing at all (e.g. zero installed).
  // Only offer Clear when filters/search may be hiding items that exist in the view.
  const viewHasItems =
    view === 'installed' ? installedCount > 0 : view === 'updates' ? updateCount > 0 : plugins.length > 0;
  const offerClearFilters = !loading && !error && visible.length === 0 && hasActiveFilters && viewHasItems;

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

  async function refreshAppUpdate() {
    setAppUpdateBusy(true);
    try {
      setAppUpdate(await window.api.checkAppUpdate(true));
    } catch {
      setAppUpdate((current) =>
        current
          ? { ...current, updateAvailable: false, latestVersion: null }
          : null,
      );
    } finally {
      setAppUpdateBusy(false);
    }
  }

  async function applyAppUpdate() {
    setAppUpdateBusy(true);
    try {
      await window.api.applyAppUpdate();
    } finally {
      // macOS quits; Windows stays open after launching the browser.
      setAppUpdateBusy(false);
    }
  }

  const showAppUpdateBanner =
    Boolean(appUpdate?.updateAvailable && appUpdate.latestVersion) &&
    appUpdateDismissed !== appUpdate?.latestVersion;

  const showGithubStarBanner =
    !githubStarDismissed && installedCount >= GITHUB_STAR_PROMPT_THRESHOLD;

  function dismissGithubStar() {
    dismissGithubStarPrompt();
    setGithubStarDismissed(true);
  }

  async function openGithubStar() {
    dismissGithubStar();
    await window.api.openExternal(REPO_URL);
  }

  return (
    <main className="flex h-screen overflow-hidden text-[13px] text-ink">
      <aside className="sidebar flex w-[232px] shrink-0 flex-col border-r border-stroke/70">
        <div className="drag-region h-[52px] shrink-0" />
        <nav className="no-drag flex-1 space-y-px overflow-y-auto px-3 pb-2">
          <div className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink3">
            Ulanzi Community Store
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
              {item === 'store' && plugins.length > 0 && (
                <span className="nav-badge">{plugins.length}</span>
              )}
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
        <footer className="no-drag space-y-3 px-3 pb-4">
          <button
            type="button"
            className="group w-full rounded-xl border border-stroke/70 bg-surface/60 px-3 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-surface"
            onClick={() => void window.api.openExternal(REPO_URL)}
          >
            <div className="text-[12px] font-semibold text-ink group-hover:text-accent">
              {t(lang, 'githubStarSidebar')}
            </div>
            <p className="mt-0.5 text-[10px] leading-snug text-ink3">
              {t(lang, 'githubStarSidebarHelp')}
            </p>
          </button>
          <p className="px-2 text-[11px] leading-relaxed text-ink3">{t(lang, 'unofficial')}</p>
        </footer>
      </aside>

      <section className="content-pane flex min-w-0 flex-1 flex-col">
        <header className="drag-region flex h-[52px] shrink-0 items-center justify-between gap-4 border-b border-stroke/70 px-6">
          <h1 className="truncate text-[15px] font-semibold">
            {view === 'store' ? t(lang, 'title') : t(lang, view)}
          </h1>
        </header>

        {view === 'settings' ? (
          <SettingsView
            lang={lang}
            settings={settings}
            setLang={setLang}
            setDeveloperMode={setDeveloperMode}
            appUpdate={appUpdate}
            appUpdateBusy={appUpdateBusy}
            onCheckAppUpdate={() => void refreshAppUpdate()}
            onApplyAppUpdate={() => void applyAppUpdate()}
          />
        ) : view === 'submit' ? (
          <SubmitView lang={lang} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="px-7 pt-6">
              {showAppUpdateBanner && appUpdate?.latestVersion && (
                <AppUpdateBanner
                  lang={lang}
                  latestVersion={appUpdate.latestVersion}
                  applyMode={appUpdate.applyMode}
                  busy={appUpdateBusy}
                  onUpdate={() => void applyAppUpdate()}
                  onLater={() => setAppUpdateDismissed(appUpdate.latestVersion)}
                />
              )}
              {showGithubStarBanner && (
                <GithubStarBanner
                  lang={lang}
                  onStar={() => void openGithubStar()}
                  onLater={dismissGithubStar}
                />
              )}
              <div className="mb-4">
                <h2 className="text-[26px] font-bold tracking-tight">
                  {view === 'store' ? t(lang, 'title') : t(lang, view)}
                </h2>
                <p className="mt-0.5 text-ink2">{t(lang, 'subtitle')}</p>
              </div>
            </div>

            <div className="filter-bar sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-stroke/50 px-7 py-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <div className="seg" role="group" aria-label={t(lang, 'sortRecent')}>
                  <button
                    type="button"
                    className={sort === 'recent' ? 'seg-active' : ''}
                    onClick={() => setSort('recent')}
                  >
                    {t(lang, 'sortRecent')}
                  </button>
                  <button
                    type="button"
                    className={sort === 'popular' ? 'seg-active' : ''}
                    onClick={() => setSort('popular')}
                  >
                    {t(lang, 'sortPopular')}
                  </button>
                </div>
                {/* OS is a preference people rarely change — dropdown saves bar space for device filters. */}
                {availablePlatforms.length > 0 && (
                  <label className="filter-select">
                    <span className="sr-only">{t(lang, 'filterPlatform')}</span>
                    <select
                      className={platform ? 'is-active' : ''}
                      value={platform}
                      onChange={(event) => setPlatform(event.target.value as PlatformFilter)}
                      aria-label={t(lang, 'filterPlatform')}
                    >
                      <option value="">{t(lang, 'allPlatforms')}</option>
                      {availablePlatforms.map((item) => (
                        <option key={item} value={item}>
                          {platformFilterLabel(item)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {/* Device filter: Deck / Dial (preview always shows both for layout). */}
                {deviceFilterOptions.length > 1 && (
                  <div className="seg" role="group" aria-label={t(lang, 'filterDevice')}>
                    <button
                      type="button"
                      className={device === '' ? 'seg-active' : ''}
                      onClick={() => setDevice('')}
                    >
                      {t(lang, 'all')}
                    </button>
                    {deviceFilterOptions.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={device === item ? 'seg-active' : ''}
                        onClick={() => setDevice(item)}
                      >
                        {deviceLabel(item)}
                      </button>
                    ))}
                  </div>
                )}
                {categories.length > 0 && (
                  <label className="filter-select">
                    <span className="sr-only">{t(lang, 'filterCategory')}</span>
                    <select
                      className={category ? 'is-active' : ''}
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      aria-label={t(lang, 'filterCategory')}
                    >
                      <option value="">{t(lang, 'allCategories')}</option>
                      {categories.map((item) => (
                        <option key={item} value={item}>
                          {categoryLabel(item)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="search-field filter-search">
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
                  aria-label={t(lang, 'search')}
                />
                {query ? (
                  <button
                    type="button"
                    className="search-clear"
                    onClick={() => {
                      setQuery('');
                      searchRef.current?.focus();
                    }}
                    aria-label={t(lang, 'clearSearch')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="h-3 w-3" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                ) : (
                  <span className="kbd">⌘K</span>
                )}
              </div>
            </div>

            <div className="px-7 pb-6 pt-5">
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
                  {offerClearFilters ? (
                    <>
                      <div>{t(lang, 'noResults')}</div>
                      <button type="button" className="btn-primary mt-4" onClick={clearAllFilters}>
                        {t(lang, 'clearFilters')}
                      </button>
                    </>
                  ) : view === 'installed' ? (
                    t(lang, 'emptyInstalled')
                  ) : view === 'updates' ? (
                    t(lang, 'emptyUpdates')
                  ) : (
                    t(lang, 'noResults')
                  )}
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
                  />
                ))}
              </div>
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
    ? busy.msg === 'remove'
      ? t(lang, 'uninstalling')
      : t(lang, 'installing')
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

function InstallProgressBar({
  lang,
  busy,
  className = '',
}: {
  lang: Lang;
  busy: { pct: number; msg: string };
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(busy.pct)));
  const isRestart = busy.msg === 'restart';
  return (
    <div className={`progress-block ${className}`.trim()} role="status" aria-live="polite">
      <div className="progress-meta">
        <span className={isRestart ? 'progress-label progress-label-restart' : 'progress-label'}>
          {progressLabel(lang, busy.msg)}
        </span>
        <span className="progress-pct">{pct}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
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
}: {
  plugin: CatalogPlugin;
  index: number;
  lang: Lang;
  installedVersion?: string | null;
  busy?: { pct: number; msg: string };
  onOpen: () => void;
  onInstall: () => void;
}) {
  const update = Boolean(installedVersion && compareVersions(plugin.version, installedVersion) > 0);
  // NEW from catalog publishedAt (latest release). Hidden when already installed
  // (installed + newer version uses the Update chip instead).
  const showNew = !installedVersion && isPluginNew(plugin.publishedAt);
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
      <div className="relative h-32 w-full overflow-hidden bg-raised">
        {plugin.cover ? (
          <img src={plugin.cover} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="grid h-full place-items-center text-3xl text-accent/50">◆</div>
        )}
        {showNew && (
          <span className="absolute left-2 top-2 z-[1] rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-ink shadow-sm">
            {t(lang, 'newBadge')}
          </span>
        )}
        <PopularityBadges plugin={plugin} className="absolute right-2 top-2" />
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
          <InstallProgressBar lang={lang} busy={busy} className="mt-3" />
        ) : (
          <div className="mt-2">
            <Meta plugin={plugin} showUpdate={Boolean(update)} lang={lang} />
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
            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <InstallButton lang={lang} installedVersion={installedVersion} update={update} busy={busy} onInstall={onInstall} />
              {installedVersion && (
                <button
                  className="btn-pill-ghost inline-flex items-center gap-1.5 !text-red-500 hover:!bg-red-500/10"
                  disabled={Boolean(busy)}
                  onClick={onUninstall}
                >
                  <IconTrash />
                  {t(lang, 'uninstall')}
                </button>
              )}
              {plugin.sourceUrl && (
                <>
                  <button
                    className="btn-pill-ghost inline-flex items-center gap-1.5 !text-ink"
                    onClick={() => void window.api.openExternal(plugin.sourceUrl)}
                  >
                    <IconGithub />
                    {t(lang, 'source')}
                  </button>
                  <button
                    className="btn-pill-ghost inline-flex items-center gap-1.5 !text-amber-500 hover:!bg-amber-500/10"
                    onClick={() => void window.api.openExternal(plugin.sourceUrl)}
                  >
                    <span aria-hidden="true">⭐</span>
                    {t(lang, 'starOnGithub')}
                    {typeof plugin.stars === 'number' ? ` · ${formatDownloads(plugin.stars)}` : ''}
                  </button>
                  <button
                    className="btn-pill-ghost inline-flex items-center gap-1.5 !text-red-500 hover:!bg-red-500/10"
                    onClick={() => void window.api.openExternal(`${plugin.sourceUrl}/issues/new`)}
                  >
                    <IconWarning />
                    {t(lang, 'reportProblem')}
                  </button>
                </>
              )}
              {busy && <InstallProgressBar lang={lang} busy={busy} className="min-w-[12rem] max-w-xs flex-1" />}
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
              {typeof plugin.downloads === 'number' && (
                <DetailCell label={t(lang, 'downloads')} value={plugin.downloads.toLocaleString()} />
              )}
              {typeof plugin.stars === 'number' && (
                <DetailCell label={t(lang, 'stars')} value={plugin.stars.toLocaleString()} />
              )}
              {plugin.minSoftwareVersion && <DetailCell label={t(lang, 'minSoftware')} value={plugin.minSoftwareVersion} />}
              {plugin.languages?.length > 0 && <DetailCell label={t(lang, 'languages')} value={plugin.languages.join(', ')} />}
              {plugin.publishedAt && <DetailCell label={t(lang, 'published')} value={plugin.publishedAt.slice(0, 10)} />}
              {(plugin.deviceTypes || []).length > 0 && (
                <DetailCell label="Devices" value={(plugin.deviceTypes || []).map(deviceLabel).join(', ')} />
              )}
              {(plugin.tags || []).length > 0 && (
                <DetailCell
                  label={t(lang, 'filterCategory')}
                  value={(plugin.tags || []).map(categoryLabel).join(', ')}
                />
              )}
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}

function AppUpdateBanner({
  lang,
  latestVersion,
  applyMode,
  busy,
  onUpdate,
  onLater,
}: {
  lang: Lang;
  latestVersion: string;
  applyMode: AppUpdateInfo['applyMode'];
  busy: boolean;
  onUpdate: () => void;
  onLater: () => void;
}) {
  return (
    <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="font-semibold">{t(lang, 'appUpdateAvailable', latestVersion)}</div>
        <p className="mt-0.5 text-[12px] text-ink2">
          {t(lang, applyMode === 'install-script' ? 'appUpdateMacHelp' : 'appUpdateWinHelp')}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button className="btn-ghost" disabled={busy} onClick={onLater}>
          {t(lang, 'appUpdateLater')}
        </button>
        <button className="btn-primary" disabled={busy} onClick={onUpdate}>
          {t(lang, 'appUpdateNow')}
        </button>
      </div>
    </div>
  );
}

function GithubStarBanner({
  lang,
  onStar,
  onLater,
}: {
  lang: Lang;
  onStar: () => void;
  onLater: () => void;
}) {
  return (
    <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="font-semibold">{t(lang, 'githubStarPromptTitle')}</div>
        <p className="mt-0.5 text-[12px] text-ink2">{t(lang, 'githubStarPromptHelp')}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button className="btn-ghost" onClick={onLater}>
          {t(lang, 'githubStarPromptLater')}
        </button>
        <button className="btn-primary" onClick={onStar}>
          {t(lang, 'githubStarPromptStar')}
        </button>
      </div>
    </div>
  );
}

function SettingsView({
  lang,
  settings,
  setLang,
  setDeveloperMode,
  appUpdate,
  appUpdateBusy,
  onCheckAppUpdate,
  onApplyAppUpdate,
}: {
  lang: Lang;
  settings: Settings;
  setLang: (lang: Lang) => void;
  setDeveloperMode: (enabled: boolean) => void;
  appUpdate: AppUpdateInfo | null;
  appUpdateBusy: boolean;
  onCheckAppUpdate: () => void;
  onApplyAppUpdate: () => void;
}) {
  const version = appUpdate?.currentVersion || '—';
  const hasUpdate = Boolean(appUpdate?.updateAvailable && appUpdate.latestVersion);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
      <div className="max-w-2xl">
        <h2 className="mb-6 text-[26px] font-bold tracking-tight">{t(lang, 'settings')}</h2>

        <SettingsSection title={t(lang, 'settingsSectionPreferences')}>
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
        </SettingsSection>

        <SettingsSection title={t(lang, 'settingsSectionSupport')}>
          <div className="flex items-center justify-between gap-6 py-4">
            <div>
              <h3 className="font-semibold">{t(lang, 'githubStar')}</h3>
              <p className="mt-0.5 text-[12px] text-ink2">{t(lang, 'githubStarHelp')}</p>
            </div>
            <button
              className="btn-ghost shrink-0"
              onClick={() => void window.api.openExternal(REPO_URL)}
            >
              {t(lang, 'githubStarButton')}
            </button>
          </div>
          <div className="flex items-center justify-between gap-6 py-4">
            <div>
              <h3 className="font-semibold">{t(lang, 'reportProblem')}</h3>
              <p className="mt-0.5 text-[12px] text-ink2">{t(lang, 'reportProblemHelp')}</p>
            </div>
            <button
              className="btn-ghost shrink-0"
              onClick={() => void window.api.openExternal(`${REPO_URL}/issues/new`)}
            >
              {t(lang, 'reportProblemButton')}
            </button>
          </div>
        </SettingsSection>

        <SettingsSection title={t(lang, 'settingsSectionAbout')}>
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <h3 className="font-semibold">{t(lang, 'appAbout')}</h3>
              <p className="mt-0.5 text-[12px] text-ink2">{t(lang, 'appVersion', version)}</p>
              {hasUpdate && appUpdate?.latestVersion ? (
                <p className="mt-1 text-[12px] text-accent">
                  {t(lang, 'appUpdateAvailable', appUpdate.latestVersion)}
                  {' · '}
                  {t(lang, appUpdate.applyMode === 'install-script' ? 'appUpdateMacHelp' : 'appUpdateWinHelp')}
                </p>
              ) : (
                appUpdate && (
                  <p className="mt-1 text-[12px] text-ink3">{t(lang, 'appUpdateUpToDate')}</p>
                )
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button className="btn-ghost" disabled={appUpdateBusy} onClick={onCheckAppUpdate}>
                {appUpdateBusy ? t(lang, 'appUpdateChecking') : t(lang, 'appUpdateCheck')}
              </button>
              {hasUpdate && (
                <button className="btn-primary" disabled={appUpdateBusy} onClick={onApplyAppUpdate}>
                  {t(lang, 'appUpdateNow')}
                </button>
              )}
            </div>
          </div>
        </SettingsSection>

        <p className="mt-4 px-1 text-[11px] text-ink3">{t(lang, 'unofficial')}</p>
      </div>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink3">{title}</h3>
      <div className="card divide-y divide-stroke/60 px-5">{children}</div>
    </section>
  );
}

type SubmitFix = {
  id: string;
  titleKey: string;
  bodyKey: string;
  cmd?: string;
  severity: 'fail' | 'warn';
};

function buildSubmitFixes(result: SubmitCheckResult): SubmitFix[] {
  const byId = Object.fromEntries(result.checks.map((check) => [check.id, check])) as Partial<
    Record<SubmitCheck['id'], SubmitCheck>
  >;
  const fixes: SubmitFix[] = [];

  if (byId.repo?.status === 'fail') {
    fixes.push({ id: 'repo', titleKey: 'submitFix_repo_title', bodyKey: 'submitFix_repo', severity: 'fail' });
  }
  if (byId.release?.status === 'fail') {
    fixes.push({
      id: 'release',
      titleKey: 'submitFix_release_title',
      bodyKey: 'submitFix_release',
      cmd: RELEASE_TAG_CMD,
      severity: 'fail',
    });
  } else if (byId.asset?.status === 'fail') {
    fixes.push({
      id: 'asset',
      titleKey: 'submitFix_asset_title',
      bodyKey: 'submitFix_asset',
      cmd: RELEASE_TAG_CMD,
      severity: 'fail',
    });
  }
  if (byId.manifest?.status === 'fail' || byId.manifest?.status === 'warn') {
    fixes.push({
      id: 'manifest',
      titleKey: 'submitFix_manifest_title',
      bodyKey: 'submitFix_manifest',
      cmd: STARTER_INIT_CMD,
      severity: byId.manifest.status === 'fail' ? 'fail' : 'warn',
    });
  }
  // Store warn on a failed run is included here; on a successful run it becomes a soft nudge instead.
  if (!result.ok && byId.store?.status === 'warn') {
    const invalid = byId.store.value === 'invalid';
    fixes.push({
      id: 'store',
      titleKey: 'submitFix_store_title',
      bodyKey: invalid ? 'submitFix_store_invalid' : 'submitFix_store',
      cmd: STARTER_STORE_CMD,
      severity: 'warn',
    });
  }

  return fixes;
}

function SubmitCopyCommand({
  command,
  lang,
  className = '',
}: {
  command: string;
  lang: Lang;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border border-stroke bg-raised px-3.5 py-2.5 ${className}`}>
      <code className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap font-mono text-[13px] text-accent">
        {command}
      </code>
      <button
        type="button"
        className="btn-ghost shrink-0 !min-h-0 !px-3 !py-1.5 !text-[12px]"
        onClick={async () => {
          await navigator.clipboard.writeText(command);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? t(lang, 'submitCopied') : t(lang, 'submitCopyCmd')}
      </button>
    </div>
  );
}

function SubmitView({ lang }: { lang: Lang }) {
  const [repoInput, setRepoInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<SubmitCheckResult | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fixes = result && !result.ok ? buildSubmitFixes(result) : [];
  const storeNudge =
    result?.ok &&
    result.checks.some((check) => check.id === 'store' && check.status === 'warn');

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
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
      <div className="max-w-3xl space-y-5">
        <div>
          <h2 className="text-[26px] font-bold tracking-tight">{t(lang, 'submit')}</h2>
          <p className="mt-0.5 leading-6 text-ink2">{t(lang, 'submitSubtitle')}</p>
        </div>

        {/* Happy path — starter-first */}
        <section className="card p-5">
          <h3 className="text-[15px] font-semibold text-ink">{t(lang, 'submitHappyPathTitle')}</h3>
          <ol className="mt-3.5 space-y-3">
            {(['submitStep1', 'submitStep2', 'submitStep3'] as const).map((key, index) => (
              <li key={key} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/10 text-[11px] font-bold text-accent">
                  {index + 1}
                </span>
                <span className="leading-6 text-ink2">{renderInlineMarkdown(t(lang, key))}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Two developer paths — stacked so the full CLI command fits */}
        <div className="space-y-4">
          <section className="card p-5">
            <div className="mb-3 inline-flex w-fit items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
              {t(lang, 'submitPathNewBadge')}
            </div>
            <h3 className="text-[15px] font-semibold">{t(lang, 'submitPathNewTitle')}</h3>
            <p className="mt-1.5 text-[13px] leading-6 text-ink2">{renderInlineMarkdown(t(lang, 'submitPathNewBody'))}</p>
            <div className="mt-4 space-y-1.5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-ink3">{t(lang, 'submitCmdInitLabel')}</div>
              <SubmitCopyCommand command={STARTER_INIT_CMD} lang={lang} />
            </div>
          </section>

          <section className="card p-5">
            <div className="mb-3 inline-flex w-fit items-center rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[11px] font-semibold text-ink2 dark:bg-white/[0.08]">
              {t(lang, 'submitPathExistingBadge')}
            </div>
            <h3 className="text-[15px] font-semibold">{t(lang, 'submitPathExistingTitle')}</h3>
            <p className="mt-1.5 text-[13px] leading-6 text-ink2">{renderInlineMarkdown(t(lang, 'submitPathExistingBody'))}</p>
            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink3">{t(lang, 'submitCmdInitLabel')}</div>
                <SubmitCopyCommand command={STARTER_INIT_CMD} lang={lang} />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink3">{t(lang, 'submitCmdStoreLabel')}</div>
                <SubmitCopyCommand command={STARTER_STORE_CMD} lang={lang} />
              </div>
            </div>
          </section>
        </div>

        <p className="px-0.5 text-[12px] leading-5 text-ink3">
          {t(lang, 'submitStarterNote')}{' '}
          <button
            type="button"
            className="font-medium text-accent underline-offset-2 hover:underline"
            onClick={() => void window.api.openExternal(STARTER_DOCS_URL)}
          >
            {t(lang, 'submitStarterDocs')}
          </button>
        </p>

        {/* Validate & submit — primary action */}
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
            <div className="mt-4 space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
              <div className="text-[13px] font-semibold text-amber-800 dark:text-amber-200">{t(lang, 'submitFixTitle')}</div>
              {fixes.length === 0 ? (
                <p className="text-[13px] leading-6 text-amber-800/90 dark:text-amber-100/90">{t(lang, 'submitFixGeneric')}</p>
              ) : (
                <ul className="space-y-3">
                  {fixes.map((fix) => (
                    <li
                      key={fix.id}
                      className="rounded-lg border border-amber-500/15 bg-surface/70 p-3.5 dark:bg-surface/40"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                            fix.severity === 'fail'
                              ? 'bg-red-500/15 text-red-500'
                              : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {fix.severity === 'fail' ? '✕' : '!'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold text-ink">{t(lang, fix.titleKey)}</div>
                          <p className="mt-1 text-[12.5px] leading-6 text-ink2">{renderInlineMarkdown(t(lang, fix.bodyKey))}</p>
                          {fix.cmd && <SubmitCopyCommand command={fix.cmd} lang={lang} className="mt-2.5" />}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {result?.ok && (
            <div className="mt-5 rounded-xl border border-accent/25 bg-accent/[0.05] p-5">
              <div className="flex items-center gap-3">
                {result.plugin?.icon && (
                  <img src={result.plugin.icon} alt="" className="h-10 w-10 rounded-[10px] object-cover shadow-card" />
                )}
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
                <pre className="selectable mt-2 overflow-x-auto font-mono text-[12px] leading-5 text-ink">
                  {result.registryJson.trim()}
                </pre>
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

              {storeNudge && (
                <div className="mt-4 rounded-lg border border-stroke bg-surface/80 p-3.5">
                  <div className="text-[13px] font-semibold text-ink">{t(lang, 'submitStoreNudgeTitle')}</div>
                  <p className="mt-1 text-[12.5px] leading-6 text-ink2">{renderInlineMarkdown(t(lang, 'submitStoreNudgeBody'))}</p>
                  <SubmitCopyCommand command={STARTER_STORE_CMD} lang={lang} className="mt-2.5" />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Checklist + secondary links */}
        <section className="card overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-raised/60"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
          >
            <span className="text-[15px] font-semibold">{t(lang, 'submitDetailsTitle')}</span>
            <span className="text-[12px] font-medium text-accent">{detailsOpen ? t(lang, 'submitDetailsHide') : t(lang, 'submitDetailsShow')}</span>
          </button>
          {detailsOpen && (
            <div className="border-t border-stroke px-5 pb-5 pt-4">
              <Markdown className="text-[13px]" text={t(lang, 'submitMarkdown')} />
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={() => void window.api.openExternal(STARTER_DOCS_URL)}>
                  {t(lang, 'submitStarterDocs')}
                </button>
                <button className="btn-ghost" onClick={() => void window.api.openExternal(SDK_URL)}>
                  {t(lang, 'submitSdk')}
                </button>
                <button className="btn-ghost" onClick={() => void window.api.openExternal(`${REPO_URL}/tree/main/registry`)}>
                  {t(lang, 'submitRegistry')}
                </button>
              </div>
            </div>
          )}
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

function PopularityBadges({ plugin, className = '' }: { plugin: CatalogPlugin; className?: string }) {
  const hasStars = typeof plugin.stars === 'number';
  const hasDownloads = typeof plugin.downloads === 'number';
  if (!hasStars && !hasDownloads) return null;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white shadow-sm backdrop-blur-sm ${className}`}
    >
      {hasStars && (
        <span className="inline-flex items-center gap-1">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 shrink-0 opacity-90">
            <path d="M12 2.5l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 16.4 6.6 19.3l1-6.1L3.2 8.9l6.1-.9L12 2.5z" />
          </svg>
          {formatDownloads(plugin.stars!)}
        </span>
      )}
      {hasDownloads && (
        <span className="inline-flex items-center gap-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0">
            <path d="M12 4v11" />
            <path d="M7 11l5 5 5-5" />
            <path d="M5 20h14" />
          </svg>
          {formatDownloads(plugin.downloads!)}
        </span>
      )}
    </div>
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
          {categoryLabel(item)}
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

function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(count);
}

function deviceLabel(value: string): string {
  if (value === 'deck') return 'Deck';
  if (value === 'dial') return 'Dial';
  return value;
}

/** Title-case store tags for UI (productivity → Productivity). */
function categoryLabel(value: string): string {
  return String(value || '')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function platformFilterLabel(value: PlatformFilter | string): string {
  if (value === 'mac') return 'macOS';
  if (value === 'windows') return 'Windows';
  return platformLabel(value);
}

function platformLabel(value: string): string {
  const lower = value.toLowerCase();
  if (lower.startsWith('mac') || lower === 'darwin') return 'macOS';
  if (lower.startsWith('win')) return 'Windows';
  return value;
}
