export type Settings = {
  developerMode: boolean;
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
  prUrl: string;
};
