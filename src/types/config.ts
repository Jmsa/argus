import { existsSync } from 'fs';

export interface CdpConfig {
  port: number;
  host: string;
  connectTimeout: number; // ms to wait for Chrome to start
  commandTimeout: number; // ms before a CDP command times out
  reconnectDelay: number; // initial reconnect delay ms
  reconnectMaxDelay: number; // max reconnect delay ms
}

export interface ServerConfig {
  headless: boolean;
  executablePath?: string; // override Chrome path
  userDataDir?: string;
  extraFlags?: string[];
  cdp: CdpConfig;
}

export const DEFAULT_CONFIG: ServerConfig = {
  headless: false,
  cdp: {
    port: 9222,
    host: 'localhost',
    connectTimeout: 15000,
    commandTimeout: 30000,
    reconnectDelay: 500,
    reconnectMaxDelay: 5000,
  },
};

const CHROME_CANDIDATES: Record<string, string[]> = {
  darwin: [
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ],
  linux: [
    '/usr/bin/google-chrome-canary',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ],
  win32: [
    `${process.env['LOCALAPPDATA'] ?? ''}\\Google\\Chrome SxS\\Application\\chrome.exe`,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
};

export function getDefaultChromePath(): string {
  const candidates = CHROME_CANDIDATES[process.platform];
  if (candidates) {
    for (const p of candidates) {
      if (p && existsSync(p)) return p;
    }
  }
  return 'google-chrome';
}
