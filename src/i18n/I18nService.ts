import { deepMerge } from './deepMerge.js';

export const I18N_LOCALE_CHANGED = 'i18n:localeChanged';

export type LocaleCode = 'en' | 'ru';

export type MessageParams = Record<string, string | number>;

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') {
      return undefined;
    }
    if (Array.isArray(cur)) {
      const idx = parseInt(p, 10);
      if (Number.isNaN(idx) || idx < 0 || idx >= cur.length) {
        return undefined;
      }
      cur = cur[idx];
    } else if (Object.prototype.hasOwnProperty.call(cur, p)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  let s = template;
  for (const [k, v] of Object.entries(params)) {
    s = s.replaceAll(`{{${k}}}`, String(v)).replaceAll(`{${k}}`, String(v));
  }
  return s;
}

export class I18nService {
  private static instance: I18nService | null = null;

  private catalogs: Map<LocaleCode, Record<string, unknown>> = new Map();
  private fallback: LocaleCode = 'en';
  private current: LocaleCode = 'en';

  static getInstance(): I18nService {
    if (!I18nService.instance) {
      I18nService.instance = new I18nService();
    }
    return I18nService.instance;
  }

  /** Register or replace a locale catalog (nested object, dot-path keys in t()). */
  registerLocale(code: LocaleCode, messages: Record<string, unknown>): void {
    this.catalogs.set(code, messages);
  }

  /** Merge extra messages into an existing locale (e.g. game strings). */
  mergeLocale(code: LocaleCode, fragment: Record<string, unknown>): void {
    const prev = this.catalogs.get(code) ?? {};
    this.catalogs.set(code, deepMerge(prev, fragment));
  }

  getLocale(): LocaleCode {
    return this.current;
  }

  setLocale(code: LocaleCode, emit: boolean = true): void {
    if (!this.catalogs.has(code)) {
      console.warn(`I18n: unknown locale "${code}", falling back to ${this.fallback}`);
      this.current = this.fallback;
    } else {
      this.current = code;
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = this.current === 'en' ? 'en' : 'ru';
      if (emit) {
        document.dispatchEvent(
          new CustomEvent(I18N_LOCALE_CHANGED, { detail: { locale: this.current } })
        );
      }
    }
  }

  /** Translate key; falls back to fallback locale, then returns key. */
  t(key: string, params?: MessageParams): string {
    const resolved = this.lookup(key);
    if (resolved === undefined) {
      if (import.meta.env?.DEV) {
        console.warn(`[i18n] missing key: ${key}`);
      }
      return key;
    }
    if (typeof resolved !== 'string') {
      return key;
    }
    return interpolate(resolved, params);
  }

  private lookup(key: string): string | undefined {
    const tryLocale = (code: LocaleCode): string | undefined => {
      const cat = this.catalogs.get(code);
      if (!cat) return undefined;
      const v = getByPath(cat, key);
      return typeof v === 'string' ? v : undefined;
    };
    return tryLocale(this.current) ?? tryLocale(this.fallback);
  }
}

/** Shortcut for I18nService.getInstance().t */
export function t(key: string, params?: MessageParams): string {
  return I18nService.getInstance().t(key, params);
}
