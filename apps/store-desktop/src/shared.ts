export type Settings = {
  developerMode: boolean;
  /** Merge the Ulanzi Studio official marketplace into the local catalog. Off by default. */
  officialCatalog: boolean;
  /** Merge the Ulanzi Studio creator portal (ugc.ulanzistudio.com) into the local catalog. Off by default. */
  ugcCatalog: boolean;
};

/** Result of checking whether a newer desktop app build is on GitHub Releases. */
export type AppUpdateInfo = {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string;
  /** How the "Update" action behaves on this platform. */
  applyMode: 'install-script' | 'open-releases';
};

export type InstallProgress = {
  id: string;
  pct: number;
  msg: string;
};

export type SubmitCheckId = 'repo' | 'release' | 'asset' | 'manifest' | 'store';

export type SubmitCheck = {
  id: SubmitCheckId;
  status: 'ok' | 'warn' | 'fail';
  value?: string;
};

export type SubmitCheckResult = {
  ok: boolean;
  repo: string;
  checks: SubmitCheck[];
  plugin: { id: string; name: string; version: string; icon: string | null } | null;
  registryFileName: string;
  registryJson: string;
  issueUrl: string;
};
