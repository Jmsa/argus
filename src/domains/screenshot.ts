import type { CDPSession } from '../cdp/client.js';
import type { ScreenshotResult, LayoutMetricsResult } from '../types/cdp.js';

export interface ScreenshotOptions {
  format?: 'jpeg' | 'png' | 'webp';
  quality?: number;
  fullPage?: boolean;
  clip?: { x: number; y: number; width: number; height: number };
}

export interface ScreenshotData {
  data: string; // base64
  mimeType: string;
  width: number;
  height: number;
}

export class ScreenshotDomain {
  constructor(private readonly session: CDPSession) {}

  async capture(options: ScreenshotOptions = {}): Promise<ScreenshotData> {
    const format = options.format ?? 'png';
    const mimeType = `image/${format}`;

    let width: number;
    let height: number;
    const params: Record<string, unknown> = {
      format,
      captureBeyondViewport: true,
    };

    if (options.quality !== undefined && format !== 'png') {
      params.quality = options.quality;
    }

    if (options.clip) {
      params.clip = { ...options.clip, scale: 1 };
      width = options.clip.width;
      height = options.clip.height;
    } else if (options.fullPage) {
      const metrics = await this.session.send<LayoutMetricsResult>('Page.getLayoutMetrics');
      const { width: w, height: h } = metrics.cssContentSize;
      width = Math.ceil(w);
      height = Math.ceil(h);
      params.clip = { x: 0, y: 0, width, height, scale: 1 };
    } else {
      const metrics = await this.session.send<LayoutMetricsResult>('Page.getLayoutMetrics');
      width = metrics.cssLayoutViewport.clientWidth;
      height = metrics.cssLayoutViewport.clientHeight;
    }

    const result = await this.session.send<ScreenshotResult>('Page.captureScreenshot', params);

    return {
      data: result.data,
      mimeType,
      width,
      height,
    };
  }
}
