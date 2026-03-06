import { EventEmitter } from 'events';
import WebSocket from 'ws';
import type { CDPMessage, CDPCommand } from '../types/cdp.js';

interface PendingCommand {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class CDPClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingCommand>();
  private sessions = new Map<string, CDPSession>();
  private readonly commandTimeout: number;
  private readonly reconnectDelay: number;
  private readonly reconnectMaxDelay: number;
  private reconnecting = false;
  private closed = false;

  constructor(
    private readonly wsUrl: string,
    options: { commandTimeout?: number; reconnectDelay?: number; reconnectMaxDelay?: number } = {}
  ) {
    super();
    this.commandTimeout = options.commandTimeout ?? 30000;
    this.reconnectDelay = options.reconnectDelay ?? 500;
    this.reconnectMaxDelay = options.reconnectMaxDelay ?? 5000;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;

      ws.once('open', () => {
        this.reconnecting = false;
        resolve();
      });

      ws.once('error', (err) => {
        if (!this.reconnecting) reject(err);
      });

      ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      ws.on('close', () => {
        if (!this.closed) {
          this.rejectAllPending(new Error('WebSocket disconnected'));
          this.scheduleReconnect(this.reconnectDelay);
        }
      });
    });
  }

  private scheduleReconnect(delay: number): void {
    if (this.closed) return;
    this.reconnecting = true;
    setTimeout(() => {
      this.connect().catch(() => {
        const nextDelay = Math.min(delay * 2, this.reconnectMaxDelay);
        this.scheduleReconnect(nextDelay);
      });
    }, delay);
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  private handleMessage(raw: string): void {
    let msg: CDPMessage;
    try {
      msg = JSON.parse(raw) as CDPMessage;
    } catch {
      return;
    }

    if (msg.id !== undefined) {
      // Response to a command
      const pending = this.pending.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(`CDP error ${msg.error.code}: ${msg.error.message}${msg.error.data ? ` — ${msg.error.data}` : ''}`));
        } else {
          pending.resolve(msg.result ?? {});
        }
      }
    } else if (msg.method) {
      // Event
      if (msg.sessionId) {
        const session = this.sessions.get(msg.sessionId);
        if (session) {
          session.emit(msg.method, msg.params ?? {});
        }
      } else {
        this.emit(msg.method, msg.params ?? {});
      }
    }
  }

  send<T = Record<string, unknown>>(
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      const id = this.nextId++;
      const command: CDPCommand = { id, method };
      if (params) command.params = params;
      if (sessionId) command.sessionId = sessionId;

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method} (${this.commandTimeout}ms)`));
      }, this.commandTimeout);

      this.pending.set(id, {
        resolve,
        reject,
        timer,
      });

      this.ws.send(JSON.stringify(command));
    });
  }

  createSession(sessionId: string): CDPSession {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;
    const session = new CDPSession(this, sessionId);
    this.sessions.set(sessionId, session);
    return session;
  }

  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  close(): void {
    this.closed = true;
    this.rejectAllPending(new Error('Client closed'));
    this.ws?.close();
    this.ws = null;
  }
}

export class CDPSession extends EventEmitter {
  constructor(
    private readonly client: CDPClient,
    public readonly sessionId: string
  ) {
    super();
    // Increase max listeners to avoid warnings with many domain subscriptions
    this.setMaxListeners(50);
  }

  send<T = Record<string, unknown>>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    return this.client.send<T>(method, params, this.sessionId);
  }
}
