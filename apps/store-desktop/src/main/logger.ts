import { app, shell } from 'electron';
import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Rotate rather than let a stuck install loop grow this file unbounded.
const MAX_LOG_BYTES = 2 * 1024 * 1024;

function logDir(): string {
  return path.join(app.getPath('userData'), 'logs');
}

export function errorLogPath(): string {
  return path.join(logDir(), 'error.log');
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** Appends a technical entry (context + error detail) to the error log for later diagnosis. */
export async function logError(context: string, error: unknown): Promise<void> {
  const entry = [
    `[${new Date().toISOString()}] ${context}`,
    `  platform: ${process.platform} ${process.arch} · app v${app.getVersion()} · electron ${process.versions.electron}`,
    `  ${formatError(error).replace(/\n/g, '\n  ')}`,
    '',
  ].join('\n');

  try {
    const file = errorLogPath();
    await mkdir(logDir(), { recursive: true });
    try {
      const stats = await stat(file);
      if (stats.size > MAX_LOG_BYTES) {
        const current = await readFile(file, 'utf8');
        await writeFile(file, current.slice(-MAX_LOG_BYTES / 2));
      }
    } catch {
      // File doesn't exist yet — appendFile below creates it.
    }
    await appendFile(file, entry);
  } catch {
    // Logging must never break the flow it's meant to diagnose.
  }
}

/** Opens the error log in the OS default text viewer, creating an empty one first if needed. */
export async function openErrorLog(): Promise<void> {
  const file = errorLogPath();
  await mkdir(logDir(), { recursive: true });
  try {
    await stat(file);
  } catch {
    await writeFile(file, 'Ulanzi Community Store — error log\n\n');
  }
  const result = await shell.openPath(file);
  if (result) throw new Error(`Could not open log file: ${result}`);
}
