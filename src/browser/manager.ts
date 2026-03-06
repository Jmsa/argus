import { spawn, type ChildProcess } from 'child_process';
import http from 'http';
import { homedir } from 'os';
import { join } from 'path';
import { CDPClient, CDPSession } from '../cdp/client.js';
import type { TabInfo, AttachToTargetResult, CreateTargetResult } from '../types/cdp.js';
import { DEFAULT_CONFIG, getDefaultChromePath, type ServerConfig } from '../types/config.js';

const REQUIRED_FLAGS = [
  '--no-first-run',
  '--no-default-browser-check',
  '--no-profile-picker',
  '--profile-directory=Default',
  '--disable-extensions',
  '--disable-background-networking',
  '--password-store=basic',
  '--use-mock-keychain',
];

const HEADLESS_FLAGS = [
  '--headless=new',
  '--hide-scrollbars',
  '--mute-audio',
];

export class BrowserManager {
  private process: ChildProcess | null = null;
  private client: CDPClient | null = null;
  private config: ServerConfig;
  private shutdownRegistered = false;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      cdp: { ...DEFAULT_CONFIG.cdp, ...config.cdp },
    };
  }

  async launch(): Promise<void> {
    if (this.client) {
      throw new Error('Browser already launched');
    }

    const executablePath = this.config.executablePath ?? getDefaultChromePath();
    const port = this.config.cdp.port;

    // Chrome Canary requires a non-default user-data-dir for remote debugging.
    // Use a persistent directory so Chrome doesn't re-initialise on every launch.
    const userDataDir = this.config.userDataDir ?? join(homedir(), '.argus', 'chrome-profile');

    const flags = [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      ...REQUIRED_FLAGS,
      ...(this.config.headless ? HEADLESS_FLAGS : []),
      ...(this.config.extraFlags ?? []),
    ];

    process.stderr.write(`[argus] Spawning: ${executablePath}\n`);
    process.stderr.write(`[argus] Flags: ${flags.join(' ')}\n`);

    this.process = spawn(executablePath, flags, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    process.stderr.write(`[argus] Chrome PID: ${this.process.pid}\n`);

    // Discard stdout — never needed
    this.process.stdout?.resume();

    this.process.on('error', (err) => {
      process.stderr.write(`[argus] spawn error: ${err.message}\n`);
    });

    // Parse stderr for the "DevTools listening on ws://..." line Chrome emits when ready.
    const wsUrl = await this.waitForChrome(this.process, this.config.cdp.connectTimeout);

    this.process.on('exit', (code) => {
      this.process = null;
      this.client?.close();
      this.client = null;
    });

    // Drain remaining stderr after we have the URL
    this.process.stderr?.resume();

    this.client = new CDPClient(wsUrl, {
      commandTimeout: this.config.cdp.commandTimeout,
      reconnectDelay: this.config.cdp.reconnectDelay,
      reconnectMaxDelay: this.config.cdp.reconnectMaxDelay,
    });
    await this.client.connect();

    this.registerShutdownHooks();
  }

  async connect(wsUrl?: string): Promise<void> {
    if (this.client) {
      throw new Error('Already connected');
    }

    const url = wsUrl ?? await this.getWebSocketUrl(this.config.cdp.port);
    this.client = new CDPClient(url, {
      commandTimeout: this.config.cdp.commandTimeout,
      reconnectDelay: this.config.cdp.reconnectDelay,
      reconnectMaxDelay: this.config.cdp.reconnectMaxDelay,
    });
    await this.client.connect();
    this.registerShutdownHooks();
  }

  private async getWebSocketUrl(port: number): Promise<string> {
    const data = await this.httpGet(`http://localhost:${port}/json/version`);
    const parsed = JSON.parse(data) as { webSocketDebuggerUrl: string };
    return parsed.webSocketDebuggerUrl;
  }

  private waitForChrome(child: ChildProcess, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Chrome did not start within ${timeout}ms`));
      }, timeout);

      const onData = (chunk: Buffer | string) => {
        const text = chunk.toString();
        process.stderr.write(`[argus] chrome stderr: ${text.trimEnd()}\n`);
        // Chrome writes this line to stderr as soon as the debug port is open
        const match = text.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) {
          cleanup();
          resolve(match[1]);
        }
      };

      const onExit = (code: number | null, signal: string | null) => {
        process.stderr.write(`[argus] Chrome exited early — code: ${code}, signal: ${signal}\n`);
        cleanup();
        reject(new Error(`Chrome exited (code ${code ?? 'null'}) before debug port was ready`));
      };

      const cleanup = () => {
        clearTimeout(timer);
        child.stderr?.off('data', onData);
        child.off('exit', onExit);
      };

      child.stderr?.on('data', onData);
      child.once('exit', onExit);
    });
  }

  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  async listTabs(): Promise<TabInfo[]> {
    const port = this.config.cdp.port;
    const data = await this.httpGet(`http://localhost:${port}/json`);
    const tabs = JSON.parse(data) as TabInfo[];
    return tabs.filter((t) => t.type === 'page');
  }

  async openTab(url = 'about:blank'): Promise<string> {
    this.assertConnected();
    const result = await this.client!.send<CreateTargetResult>('Target.createTarget', { url });
    return result.targetId;
  }

  async closeTab(targetId: string): Promise<void> {
    this.assertConnected();
    await this.client!.send('Target.closeTarget', { targetId });
  }

  async attachToTab(targetId: string): Promise<CDPSession> {
    this.assertConnected();
    const result = await this.client!.send<AttachToTargetResult>(
      'Target.attachToTarget',
      { targetId, flatten: true }
    );
    return this.client!.createSession(result.sessionId);
  }

  getClient(): CDPClient {
    this.assertConnected();
    return this.client!;
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  isLaunched(): boolean {
    return this.process !== null;
  }

  disconnect(): void {
    this.client?.close();
    this.client = null;
  }

  async shutdown(): Promise<void> {
    this.client?.close();
    this.client = null;

    if (this.process) {
      this.process.kill('SIGTERM');
      // Give it 3s to exit gracefully, then SIGKILL
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          this.process?.kill('SIGKILL');
          resolve();
        }, 3000);
        this.process!.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      this.process = null;
    }
  }

  private assertConnected(): void {
    if (!this.client) {
      throw new Error('Not connected to Chrome. Call launch() or connect() first.');
    }
  }

  private registerShutdownHooks(): void {
    if (this.shutdownRegistered) return;
    this.shutdownRegistered = true;

    const handler = () => {
      this.shutdown().finally(() => process.exit(0));
    };

    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);
    process.on('exit', () => {
      if (this.process) {
        this.process.kill('SIGKILL');
      }
    });
  }
}
