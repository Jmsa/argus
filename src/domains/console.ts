import type { CDPSession } from '../cdp/client.js';
import type { ConsoleAPICalledEvent, ExceptionThrownEvent, RemoteObject } from '../types/cdp.js';

export interface ConsoleLogEntry {
  type: string;
  text: string;
  timestamp: number;
  url?: string;
  lineNumber?: number;
  args: RemoteObject[];
  isException: boolean;
}

export type ConsoleLogType = ConsoleAPICalledEvent['type'] | 'exception';

export class ConsoleDomain {
  private logs: ConsoleLogEntry[] = [];
  private recording = false;
  private consoleHandler?: (event: ConsoleAPICalledEvent) => void;
  private exceptionHandler?: (event: ExceptionThrownEvent) => void;

  constructor(private readonly session: CDPSession) {}

  async startRecording(): Promise<void> {
    if (this.recording) return;
    this.recording = true;

    await this.session.send('Runtime.enable');

    this.consoleHandler = (event: ConsoleAPICalledEvent) => {
      const text = event.args
        .map((arg) => {
          if (arg.value !== undefined) return String(arg.value);
          if (arg.description) return arg.description;
          return arg.type;
        })
        .join(' ');

      const entry: ConsoleLogEntry = {
        type: event.type,
        text,
        timestamp: event.timestamp,
        url: event.stackTrace?.callFrames[0]?.url,
        lineNumber: event.stackTrace?.callFrames[0]?.lineNumber,
        args: event.args,
        isException: false,
      };
      this.logs.push(entry);
    };

    this.exceptionHandler = (event: ExceptionThrownEvent) => {
      const details = event.exceptionDetails;
      const text = details.exception?.description ?? details.text;
      const entry: ConsoleLogEntry = {
        type: 'error',
        text,
        timestamp: event.timestamp,
        url: details.url ?? details.stackTrace?.callFrames[0]?.url,
        lineNumber: details.lineNumber,
        args: details.exception ? [details.exception] : [],
        isException: true,
      };
      this.logs.push(entry);
    };

    this.session.on('Runtime.consoleAPICalled', this.consoleHandler as (e: unknown) => void);
    this.session.on('Runtime.exceptionThrown', this.exceptionHandler as (e: unknown) => void);
  }

  async stopRecording(): Promise<void> {
    if (!this.recording) return;
    this.recording = false;

    if (this.consoleHandler) {
      this.session.off('Runtime.consoleAPICalled', this.consoleHandler as (e: unknown) => void);
      this.consoleHandler = undefined;
    }
    if (this.exceptionHandler) {
      this.session.off('Runtime.exceptionThrown', this.exceptionHandler as (e: unknown) => void);
      this.exceptionHandler = undefined;
    }

    await this.session.send('Runtime.disable');
  }

  getLogs(filter?: { type?: string; search?: string; limit?: number }): ConsoleLogEntry[] {
    let result = [...this.logs];

    if (filter?.type) {
      result = result.filter((l) => l.type === filter.type);
    }
    if (filter?.search) {
      const search = filter.search.toLowerCase();
      result = result.filter((l) => l.text.toLowerCase().includes(search));
    }
    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  clearLogs(): void {
    this.logs = [];
  }

  isRecording(): boolean {
    return this.recording;
  }
}
