import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface ArgusPrefs {
  autoLaunch: boolean;
}

const PREFS_DIR = join(homedir(), '.argus');
const PREFS_PATH = join(PREFS_DIR, 'config.json');
const DEFAULTS: ArgusPrefs = { autoLaunch: false };

export function isFirstRun(): boolean {
  return !existsSync(PREFS_PATH);
}

export function readPrefs(): ArgusPrefs {
  if (!existsSync(PREFS_PATH)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(PREFS_PATH, 'utf-8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writePrefs(partial: Partial<ArgusPrefs>): ArgusPrefs {
  mkdirSync(PREFS_DIR, { recursive: true });
  const current = readPrefs();
  const sanitized: Partial<ArgusPrefs> = {};
  if (typeof partial.autoLaunch === 'boolean') sanitized.autoLaunch = partial.autoLaunch;
  const updated = { ...current, ...sanitized };
  writeFileSync(PREFS_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}
