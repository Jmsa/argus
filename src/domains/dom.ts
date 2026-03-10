import type { CDPSession } from '../cdp/client.js';
import { ArgusError } from '../types/errors.js';

export interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  value?: string;
  attributes: Record<string, string>;
  rect?: { x: number; y: number; width: number; height: number };
  visible: boolean;
}

// JS expression to extract ElementInfo from a given element variable name.
// The variable `__el` must be defined in the wrapping expression.
const ELEMENT_INFO_EXPR = `(function(__el) {
  var rect = __el.getBoundingClientRect();
  var style = window.getComputedStyle(__el);
  var visible = !!(rect.width || rect.height) && style.visibility !== 'hidden' && style.display !== 'none';
  var attrs = {};
  for (var i = 0; i < __el.attributes.length; i++) {
    attrs[__el.attributes[i].name] = __el.attributes[i].value;
  }
  return {
    tagName: __el.tagName.toLowerCase(),
    id: __el.id || undefined,
    className: __el.className || undefined,
    text: (__el.textContent || '').trim() || undefined,
    value: __el.value !== undefined ? String(__el.value) : undefined,
    attributes: attrs,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    visible: visible
  };
})(__el)`;

interface EvaluateResult {
  result: {
    type: string;
    value?: unknown;
    subtype?: string;
    description?: string;
  };
  exceptionDetails?: {
    text: string;
    exception?: {
      description?: string;
    };
  };
}

export class DOMDomain {
  constructor(private readonly session: CDPSession) {}

  private async evaluate<T>(expression: string): Promise<T> {
    const result = await this.session.send<EvaluateResult>('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      const ex = result.exceptionDetails;
      throw new ArgusError('EVALUATE_FAILED', ex.exception?.description ?? ex.text);
    }
    return result.result.value as T;
  }

  async query(selector: string): Promise<ElementInfo | null> {
    const s = JSON.stringify(selector);
    return this.evaluate<ElementInfo | null>(`(function() {
      var __el = document.querySelector(${s});
      if (!__el) return null;
      return ${ELEMENT_INFO_EXPR};
    })()`);
  }

  async queryAll(selector: string, limit = 50): Promise<ElementInfo[]> {
    const s = JSON.stringify(selector);
    return this.evaluate<ElementInfo[]>(`(function() {
      var nodes = Array.from(document.querySelectorAll(${s})).slice(0, ${limit});
      return nodes.map(function(__el) { return ${ELEMENT_INFO_EXPR}; });
    })()`);
  }

  async click(selector: string): Promise<void> {
    const s = JSON.stringify(selector);
    await this.evaluate<null>(`(function() {
      var __el = document.querySelector(${s});
      if (!__el) throw new Error('Element not found: ' + ${s});
      __el.scrollIntoView({ block: 'center' });
      __el.click();
      return null;
    })()`);
  }

  async inputValue(selector: string, text: string, options: { clear?: boolean } = {}): Promise<void> {
    const s = JSON.stringify(selector);
    const t = JSON.stringify(text);
    const clear = options.clear ? 'true' : 'false';
    await this.evaluate<null>(`(function() {
      var __el = document.querySelector(${s});
      if (!__el) throw new Error('Element not found: ' + ${s});
      __el.focus();
      if (${clear}) {
        __el.value = '';
        __el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var proto = __el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value');
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(__el, ${t});
      } else {
        __el.value = ${t};
      }
      __el.dispatchEvent(new Event('input', { bubbles: true }));
      __el.dispatchEvent(new Event('change', { bubbles: true }));
      return null;
    })()`);
  }

  async getValue(selector: string): Promise<string | null> {
    const s = JSON.stringify(selector);
    return this.evaluate<string | null>(`(function() {
      var __el = document.querySelector(${s});
      if (!__el) return null;
      return __el.value !== undefined ? String(__el.value) : null;
    })()`);
  }

  async setValue(selector: string, value: string): Promise<void> {
    await this.inputValue(selector, value, { clear: true });
  }

  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    const s = JSON.stringify(selector);
    const a = JSON.stringify(attribute);
    return this.evaluate<string | null>(`(function() {
      var __el = document.querySelector(${s});
      if (!__el) return null;
      return __el.getAttribute(${a});
    })()`);
  }

  async waitFor(selector: string, options: { timeout?: number; visible?: boolean } = {}): Promise<ElementInfo> {
    const timeout = options.timeout ?? 5000;
    const checkVisible = options.visible ?? false;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const info = await this.query(selector);
      if (info && (!checkVisible || info.visible)) return info;
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }

    throw new ArgusError('WAIT_TIMEOUT', `Timeout after ${timeout}ms waiting for element: ${selector}`, { selector, timeout });
  }
}
