import { randomUUID } from 'crypto';
import type { CDPSession } from '../cdp/client.js';
import type {
  RequestWillBeSentEvent,
  ResponseReceivedEvent,
  LoadingFinishedEvent,
  LoadingFailedEvent,
  RequestPausedEvent,
  GetResponseBodyResult,
  FulfillRequestParams,
  HeaderEntry,
} from '../types/cdp.js';

export interface NetworkRequestEntry {
  requestId: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  timestamp: number;
  status?: number;
  statusText?: string;
  responseHeaders?: Record<string, string>;
  mimeType?: string;
  responseBody?: string;
  responseBodyBase64?: boolean;
  error?: string;
  duration?: number; // ms
  type?: string;
}

export interface MockRule {
  id: string;
  urlPattern: string;
  method?: string;
  responseCode: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '##DOUBLE##')
    .replace(/\*/g, '[^/]*')
    .replace(/##DOUBLE##/g, '.*');
  return new RegExp(`^${escaped}$`);
}

export class NetworkDomain {
  private requests = new Map<string, NetworkRequestEntry>();
  private mocks: MockRule[] = [];
  private recording = false;
  private mockingEnabled = false;

  private requestHandler?: (event: RequestWillBeSentEvent) => void;
  private responseHandler?: (event: ResponseReceivedEvent) => void;
  private finishedHandler?: (event: LoadingFinishedEvent) => Promise<void>;
  private failedHandler?: (event: LoadingFailedEvent) => void;
  private pausedHandler?: (event: RequestPausedEvent) => Promise<void>;

  constructor(private readonly session: CDPSession) {}

  async startRecording(): Promise<void> {
    if (this.recording) return;
    this.recording = true;

    await this.session.send('Network.enable', {
      maxResourceBufferSize: 10 * 1024 * 1024, // 10MB
      maxTotalBufferSize: 50 * 1024 * 1024,     // 50MB
    });

    this.requestHandler = (event: RequestWillBeSentEvent) => {
      const entry: NetworkRequestEntry = {
        requestId: event.requestId,
        url: event.request.url,
        method: event.request.method,
        headers: event.request.headers,
        postData: event.request.postData,
        timestamp: event.timestamp * 1000,
        type: event.type,
      };
      this.requests.set(event.requestId, entry);
    };

    this.responseHandler = (event: ResponseReceivedEvent) => {
      const entry = this.requests.get(event.requestId);
      if (entry) {
        entry.status = event.response.status;
        entry.statusText = event.response.statusText;
        entry.responseHeaders = event.response.headers;
        entry.mimeType = event.response.mimeType;
      }
    };

    this.finishedHandler = async (event: LoadingFinishedEvent) => {
      const entry = this.requests.get(event.requestId);
      if (entry) {
        entry.duration = event.timestamp * 1000 - entry.timestamp;
        try {
          const body = await this.session.send<GetResponseBodyResult>('Network.getResponseBody', {
            requestId: event.requestId,
          });
          entry.responseBody = body.body;
          entry.responseBodyBase64 = body.base64Encoded;
        } catch {
          // Body may not be available (e.g., for streaming responses)
        }
      }
    };

    this.failedHandler = (event: LoadingFailedEvent) => {
      const entry = this.requests.get(event.requestId);
      if (entry) {
        entry.error = event.errorText;
        entry.duration = event.timestamp * 1000 - entry.timestamp;
      }
    };

    this.session.on('Network.requestWillBeSent', this.requestHandler as (e: unknown) => void);
    this.session.on('Network.responseReceived', this.responseHandler as (e: unknown) => void);
    this.session.on('Network.loadingFinished', this.finishedHandler as (e: unknown) => void);
    this.session.on('Network.loadingFailed', this.failedHandler as (e: unknown) => void);
  }

  async stopRecording(): Promise<void> {
    if (!this.recording) return;
    this.recording = false;

    if (this.requestHandler) {
      this.session.off('Network.requestWillBeSent', this.requestHandler as (e: unknown) => void);
      this.requestHandler = undefined;
    }
    if (this.responseHandler) {
      this.session.off('Network.responseReceived', this.responseHandler as (e: unknown) => void);
      this.responseHandler = undefined;
    }
    if (this.finishedHandler) {
      this.session.off('Network.loadingFinished', this.finishedHandler as (e: unknown) => void);
      this.finishedHandler = undefined;
    }
    if (this.failedHandler) {
      this.session.off('Network.loadingFailed', this.failedHandler as (e: unknown) => void);
      this.failedHandler = undefined;
    }

    await this.session.send('Network.disable');
  }

  getRequests(filter?: {
    url?: string;
    method?: string;
    status?: number;
    hasError?: boolean;
    limit?: number;
  }): NetworkRequestEntry[] {
    let result = Array.from(this.requests.values());

    if (filter?.url) {
      const urlPattern = filter.url.toLowerCase();
      result = result.filter((r) => r.url.toLowerCase().includes(urlPattern));
    }
    if (filter?.method) {
      const method = filter.method.toUpperCase();
      result = result.filter((r) => r.method === method);
    }
    if (filter?.status !== undefined) {
      result = result.filter((r) => r.status === filter.status);
    }
    if (filter?.hasError !== undefined) {
      result = filter.hasError
        ? result.filter((r) => r.error !== undefined)
        : result.filter((r) => r.error === undefined);
    }
    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  clearRequests(): void {
    this.requests.clear();
  }

  async addMock(rule: Omit<MockRule, 'id'>): Promise<string> {
    const id = randomUUID();
    this.mocks.push({ ...rule, id });
    await this.refreshFetchDomain();
    return id;
  }

  async removeMock(id: string): Promise<boolean> {
    const idx = this.mocks.findIndex((m) => m.id === id);
    if (idx === -1) return false;
    this.mocks.splice(idx, 1);
    await this.refreshFetchDomain();
    return true;
  }

  async clearMocks(): Promise<void> {
    this.mocks = [];
    await this.refreshFetchDomain();
  }

  listMocks(): MockRule[] {
    return [...this.mocks];
  }

  private async refreshFetchDomain(): Promise<void> {
    // Remove old handler first
    if (this.pausedHandler) {
      this.session.off('Fetch.requestPaused', this.pausedHandler as (e: unknown) => void);
      this.pausedHandler = undefined;
    }

    if (this.mocks.length === 0) {
      if (this.mockingEnabled) {
        await this.session.send('Fetch.disable');
        this.mockingEnabled = false;
      }
      return;
    }

    // Enable Fetch with patterns for all mocked URLs
    const patterns = this.mocks.map((mock) => ({
      urlPattern: mock.urlPattern,
      requestStage: 'Request',
    }));

    await this.session.send('Fetch.enable', { patterns });
    this.mockingEnabled = true;

    this.pausedHandler = async (event: RequestPausedEvent) => {
      try {
        const match = this.findMatchingMock(event.request.url, event.request.method);

        if (match) {
          const responseHeaders: HeaderEntry[] = [
            { name: 'content-type', value: match.responseHeaders?.['content-type'] ?? 'application/json' },
          ];

          if (match.responseHeaders) {
            for (const [name, value] of Object.entries(match.responseHeaders)) {
              if (name.toLowerCase() !== 'content-type') {
                responseHeaders.push({ name, value });
              }
            }
          }

          const fulfillParams: FulfillRequestParams = {
            requestId: event.requestId,
            responseCode: match.responseCode,
            responseHeaders,
          };

          if (match.responseBody !== undefined) {
            fulfillParams.body = Buffer.from(match.responseBody).toString('base64');
          }

          await this.session.send('Fetch.fulfillRequest', fulfillParams as unknown as Record<string, unknown>);
        } else {
          // CRITICAL: must always respond to avoid hanging Chrome
          await this.session.send('Fetch.continueRequest', { requestId: event.requestId });
        }
      } catch (err) {
        // Last resort — try to continue to avoid hanging
        try {
          await this.session.send('Fetch.continueRequest', { requestId: event.requestId });
        } catch {
          // Ignore if already handled
        }
      }
    };

    this.session.on('Fetch.requestPaused', this.pausedHandler as (e: unknown) => void);
  }

  private findMatchingMock(url: string, method: string): MockRule | undefined {
    return this.mocks.find((mock) => {
      if (mock.method && mock.method.toUpperCase() !== method.toUpperCase()) return false;
      const regex = globToRegex(mock.urlPattern);
      return regex.test(url);
    });
  }

  isRecording(): boolean {
    return this.recording;
  }

  isMocking(): boolean {
    return this.mockingEnabled;
  }
}
