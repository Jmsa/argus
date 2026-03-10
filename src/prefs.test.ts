import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { isFirstRun, readPrefs, writePrefs } from './prefs.js';

describe('isFirstRun', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when config file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(isFirstRun()).toBe(true);
  });

  it('returns false when config file exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    expect(isFirstRun()).toBe(false);
  });
});

describe('readPrefs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns defaults when file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(readPrefs()).toEqual({ autoLaunch: false });
  });

  it('returns stored value when file exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{"autoLaunch":true}' as unknown as Buffer);
    expect(readPrefs()).toEqual({ autoLaunch: true });
  });

  it('returns defaults when file is malformed JSON', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('not json' as unknown as Buffer);
    expect(readPrefs()).toEqual({ autoLaunch: false });
  });
});

describe('writePrefs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{"autoLaunch":false}' as unknown as Buffer);
  });

  it('merges partial update and writes JSON', () => {
    const result = writePrefs({ autoLaunch: true });
    expect(result).toEqual({ autoLaunch: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('config.json'),
      JSON.stringify({ autoLaunch: true }, null, 2),
      'utf-8',
    );
  });

  it('creates ~/.argus directory if it does not exist', () => {
    writePrefs({ autoLaunch: false });
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('.argus'),
      { recursive: true },
    );
  });
});
