import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { ConsoleDomain, type ConsoleLogEntry } from './console.js';
import type { CDPSession } from '../cdp/client.js';

function makeSession(): CDPSession {
  const emitter = new EventEmitter();
  return {
    send: vi.fn().mockResolvedValue({}),
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    emit: emitter.emit.bind(emitter),
    once: emitter.once.bind(emitter),
    removeAllListeners: emitter.removeAllListeners.bind(emitter),
    addListener: emitter.addListener.bind(emitter),
    removeListener: emitter.removeListener.bind(emitter),
  } as unknown as CDPSession;
}

function makeEntry(overrides: Partial<ConsoleLogEntry> = {}): ConsoleLogEntry {
  return {
    type: 'log',
    text: 'hello',
    timestamp: Date.now(),
    args: [],
    isException: false,
    ...overrides,
  };
}

describe('ConsoleDomain.getLogs', () => {
  let domain: ConsoleDomain;

  beforeEach(() => {
    domain = new ConsoleDomain(makeSession());
    // Manually populate logs via the private field
    const logs = [
      makeEntry({ type: 'log', text: 'info message' }),
      makeEntry({ type: 'error', text: 'something failed' }),
      makeEntry({ type: 'warning', text: 'be careful' }),
      makeEntry({ type: 'error', text: 'another error' }),
      makeEntry({ type: 'log', text: 'debug output' }),
    ];
    (domain as unknown as { logs: ConsoleLogEntry[] }).logs = logs;
  });

  it('returns all logs when no filter applied', () => {
    expect(domain.getLogs()).toHaveLength(5);
  });

  it('filters by type', () => {
    const errors = domain.getLogs({ type: 'error' });
    expect(errors).toHaveLength(2);
    expect(errors.every((l) => l.type === 'error')).toBe(true);
  });

  it('filters by search (case-insensitive)', () => {
    const result = domain.getLogs({ search: 'ERROR' });
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('another error');
  });

  it('limit returns the last N entries', () => {
    const result = domain.getLogs({ limit: 2 });
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('another error');
    expect(result[1].text).toBe('debug output');
  });

  it('combines type filter and limit', () => {
    const result = domain.getLogs({ type: 'error', limit: 1 });
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('another error');
  });

  it('clearLogs empties the buffer', () => {
    domain.clearLogs();
    expect(domain.getLogs()).toHaveLength(0);
  });
});

describe('ConsoleDomain recording', () => {
  it('starts not recording', () => {
    const domain = new ConsoleDomain(makeSession());
    expect(domain.isRecording()).toBe(false);
  });

  it('calls Runtime.enable on startRecording', async () => {
    const session = makeSession();
    const domain = new ConsoleDomain(session);
    await domain.startRecording();
    expect(session.send).toHaveBeenCalledWith('Runtime.enable');
    expect(domain.isRecording()).toBe(true);
  });

  it('calls Runtime.disable on stopRecording', async () => {
    const session = makeSession();
    const domain = new ConsoleDomain(session);
    await domain.startRecording();
    await domain.stopRecording();
    expect(session.send).toHaveBeenCalledWith('Runtime.disable');
    expect(domain.isRecording()).toBe(false);
  });

  it('captures consoleAPICalled events into logs', async () => {
    const session = makeSession();
    const domain = new ConsoleDomain(session);
    await domain.startRecording();

    (session as unknown as EventEmitter).emit('Runtime.consoleAPICalled', {
      type: 'log',
      args: [{ type: 'string', value: 'test message' }],
      timestamp: 1000,
      stackTrace: undefined,
    });

    const logs = domain.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('log');
    expect(logs[0].text).toBe('test message');
  });

  it('serializes RemoteObject using .value when present', async () => {
    const session = makeSession();
    const domain = new ConsoleDomain(session);
    await domain.startRecording();

    (session as unknown as EventEmitter).emit('Runtime.consoleAPICalled', {
      type: 'log',
      args: [
        { type: 'number', value: 42 },
        { type: 'object', description: 'Object{foo:1}' },
      ],
      timestamp: 1000,
      stackTrace: undefined,
    });

    const logs = domain.getLogs();
    expect(logs[0].text).toBe('42 Object{foo:1}');
  });

  it('does not capture events after stopRecording', async () => {
    const session = makeSession();
    const domain = new ConsoleDomain(session);
    await domain.startRecording();
    await domain.stopRecording();

    (session as unknown as EventEmitter).emit('Runtime.consoleAPICalled', {
      type: 'log',
      args: [{ type: 'string', value: 'should not appear' }],
      timestamp: 2000,
      stackTrace: undefined,
    });

    expect(domain.getLogs()).toHaveLength(0);
  });
});
