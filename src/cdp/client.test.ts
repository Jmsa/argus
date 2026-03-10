import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// We test the logic extracted from CDPClient without spawning a real WebSocket.
// The key behaviors are: send/receive, timeout, session routing, and disconnect rejection.

// A minimal fake WebSocket that lets us simulate server messages.
class FakeWebSocket extends EventEmitter {
  static OPEN = 1;
  readyState = FakeWebSocket.OPEN;
  sent: string[] = [];

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    this.emit('close');
  }

  // Simulate Chrome sending a message back
  receive(data: object) {
    this.emit('message', { toString: () => JSON.stringify(data) });
  }
}

// Re-implement the minimal CDPClient message-handling logic to test it in isolation.
// This avoids mocking the 'ws' module and keeps tests fast.

interface PendingCommand {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function buildClient(ws: FakeWebSocket, commandTimeout = 5000) {
  let nextId = 1;
  const pending = new Map<number, PendingCommand>();
  const sessions = new Map<string, EventEmitter>();

  ws.on('message', (data: { toString(): string }) => {
    const msg = JSON.parse(data.toString()) as {
      id?: number; method?: string; sessionId?: string;
      result?: unknown; error?: { code: number; message: string };
      params?: unknown;
    };

    if (msg.id !== undefined) {
      const p = pending.get(msg.id);
      if (p) {
        clearTimeout(p.timer);
        pending.delete(msg.id);
        if (msg.error) {
          p.reject(new Error(`CDP error ${msg.error.code}: ${msg.error.message}`));
        } else {
          p.resolve(msg.result ?? {});
        }
      }
    } else if (msg.method) {
      if (msg.sessionId) {
        sessions.get(msg.sessionId)?.emit(msg.method, msg.params ?? {});
      }
    }
  });

  function send(method: string, params?: object, sessionId?: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (ws.readyState !== FakeWebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      const id = nextId++;
      const cmd: Record<string, unknown> = { id, method };
      if (params) cmd['params'] = params;
      if (sessionId) cmd['sessionId'] = sessionId;

      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, commandTimeout);

      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify(cmd));
    });
  }

  function rejectAllPending(error: Error) {
    for (const [id, p] of pending) {
      clearTimeout(p.timer);
      p.reject(error);
      pending.delete(id);
    }
  }

  function createSession(sessionId: string): EventEmitter {
    const session = new EventEmitter();
    sessions.set(sessionId, session);
    return session;
  }

  return { send, rejectAllPending, createSession, pending, sessions };
}

describe('CDPClient message handling', () => {
  let ws: FakeWebSocket;
  let client: ReturnType<typeof buildClient>;

  beforeEach(() => {
    ws = new FakeWebSocket();
    client = buildClient(ws);
  });

  it('resolves send() when matching response arrives', async () => {
    const promise = client.send('Browser.getVersion');
    const sent = JSON.parse(ws.sent[0]);
    ws.receive({ id: sent.id, result: { product: 'Chrome/120' } });
    const result = await promise;
    expect((result as { product: string }).product).toBe('Chrome/120');
  });

  it('rejects send() on CDP error response', async () => {
    const promise = client.send('Page.enable');
    const sent = JSON.parse(ws.sent[0]);
    ws.receive({ id: sent.id, error: { code: -32601, message: 'Method not found' } });
    await expect(promise).rejects.toThrow('Method not found');
  });

  it('rejects send() on timeout', async () => {
    vi.useFakeTimers();
    const client2 = buildClient(ws, 1000);
    const promise = client2.send('Target.createTarget');
    vi.advanceTimersByTime(1001);
    await expect(promise).rejects.toThrow('timed out');
    vi.useRealTimers();
  });

  it('rejectAllPending rejects all in-flight commands', async () => {
    const p1 = client.send('Tab.list');
    const p2 = client.send('Tab.screenshot');
    client.rejectAllPending(new Error('WebSocket disconnected'));
    await expect(p1).rejects.toThrow('WebSocket disconnected');
    await expect(p2).rejects.toThrow('WebSocket disconnected');
  });

  it('rejects immediately when WebSocket is not open', async () => {
    ws.readyState = 3; // CLOSED
    await expect(client.send('Page.enable')).rejects.toThrow('not connected');
  });

  it('routes events to the correct session by sessionId', () => {
    const session = client.createSession('sess-1');
    const handler = vi.fn();
    session.on('Page.loadEventFired', handler);

    // Event for session sess-1
    ws.receive({ method: 'Page.loadEventFired', sessionId: 'sess-1', params: { timestamp: 1.0 } });
    expect(handler).toHaveBeenCalledWith({ timestamp: 1.0 });
  });

  it('does not route events to wrong session', () => {
    const session1 = client.createSession('sess-1');
    const session2 = client.createSession('sess-2');
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    session1.on('Network.requestWillBeSent', handler1);
    session2.on('Network.requestWillBeSent', handler2);

    ws.receive({ method: 'Network.requestWillBeSent', sessionId: 'sess-1', params: {} });
    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('includes sessionId in outbound commands', () => {
    client.send('Runtime.enable', {}, 'sess-abc');
    const cmd = JSON.parse(ws.sent[0]);
    expect(cmd.sessionId).toBe('sess-abc');
  });
});
