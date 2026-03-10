import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { DOMDomain } from './dom.js';
import { ArgusError } from '../types/errors.js';
import type { CDPSession } from '../cdp/client.js';

function makeSession(sendImpl?: (method: string, params?: unknown) => Promise<unknown>): CDPSession {
  const emitter = new EventEmitter();
  return {
    send: vi.fn(sendImpl ?? vi.fn().mockResolvedValue({})),
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    emit: emitter.emit.bind(emitter),
    once: emitter.once.bind(emitter),
    removeAllListeners: emitter.removeAllListeners.bind(emitter),
    addListener: emitter.addListener.bind(emitter),
    removeListener: emitter.removeListener.bind(emitter),
  } as unknown as CDPSession;
}

describe('DOMDomain.waitFor', () => {
  it('resolves immediately when element is found', async () => {
    const elementInfo = {
      tagName: 'button', id: 'btn', className: '', text: 'Click',
      attributes: {}, rect: { x: 0, y: 0, width: 100, height: 40 }, visible: true,
    };
    const session = makeSession(() => Promise.resolve({
      result: { type: 'object', value: elementInfo },
    }));
    const domain = new DOMDomain(session);
    const result = await domain.waitFor('#btn');
    expect(result.tagName).toBe('button');
  });

  it('rejects with WAIT_TIMEOUT when element never appears', async () => {
    const session = makeSession(() => Promise.resolve({
      result: { type: 'object', value: null },
    }));
    const domain = new DOMDomain(session);

    await expect(domain.waitFor('#missing', { timeout: 150 }))
      .rejects
      .toMatchObject({ code: 'WAIT_TIMEOUT' });
  });

  it('throws ArgusError with selector in detail on timeout', async () => {
    const session = makeSession(() => Promise.resolve({
      result: { type: 'object', value: null },
    }));
    const domain = new DOMDomain(session);

    try {
      await domain.waitFor('.nope', { timeout: 150 });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ArgusError);
      const err = e as ArgusError;
      expect(err.code).toBe('WAIT_TIMEOUT');
      expect(err.detail).toMatchObject({ selector: '.nope' });
    }
  });

  it('waits for visible:true before resolving', async () => {
    let calls = 0;
    const session = makeSession(() => {
      calls++;
      const visible = calls >= 3;
      return Promise.resolve({
        result: {
          type: 'object',
          value: {
            tagName: 'div', attributes: {},
            rect: { x: 0, y: 0, width: 100, height: 50 },
            visible,
          },
        },
      });
    });
    const domain = new DOMDomain(session);
    const result = await domain.waitFor('.box', { visible: true, timeout: 2000 });
    expect(result.visible).toBe(true);
    expect(calls).toBeGreaterThanOrEqual(3);
  });
});

describe('DOMDomain evaluate error handling', () => {
  it('throws EVALUATE_FAILED when CDP returns exceptionDetails', async () => {
    const session = makeSession(() => Promise.resolve({
      result: { type: 'undefined' },
      exceptionDetails: {
        text: 'ReferenceError',
        exception: { description: 'ReferenceError: foo is not defined' },
      },
    }));
    const domain = new DOMDomain(session);
    await expect(domain.query('#test')).rejects.toMatchObject({ code: 'EVALUATE_FAILED' });
  });
});
