import { SettingsManager } from './SettingsManager.js';

/**
 * Centralized logger — gate-keeps all console.log output behind the
 * "Enable Debug Logging" toggle in Settings → Dev Menu.
 *
 * Disabled by default; enable in-game under Settings → Dev Menu.
 *
 * Usage in any class:
 *   import { logger } from '../utils/Logger.js';
 *   logger.log('Something happened', detail);
 *   logger.warn('Something unexpected');
 *   logger.error('Something broke', err);
 *
 * Additionally, calling `Logger.getInstance().install()` once at app startup
 * automatically intercepts all existing `console.log` / `console.info` calls
 * across the entire codebase so nothing needs to be rewritten.
 *
 * console.warn and console.error are never suppressed so real problems
 * are always visible.
 */
export class Logger {
  private static instance: Logger;

  // Saved originals — the Logger itself always has access to real console methods
  private readonly _origLog:   typeof console.log;
  private readonly _origWarn:  typeof console.warn;
  private readonly _origError: typeof console.error;
  private readonly _origInfo:  typeof console.info;
  private readonly _origDebug: typeof console.debug;

  private _installed = false;

  private constructor() {
    this._origLog   = console.log.bind(console);
    this._origWarn  = console.warn.bind(console);
    this._origError = console.error.bind(console);
    this._origInfo  = console.info.bind(console);
    this._origDebug = console.debug.bind(console);
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Call once at app startup to intercept all global console.log /
   * console.info / console.debug calls site-wide.
   * console.warn and console.error are intentionally left untouched.
   */
  install(): void {
    if (this._installed) return;
    this._installed = true;

    const self = this;

    console.log = (...args: unknown[]) => {
      if (self._isEnabled()) self._origLog(...args);
    };

    console.info = (...args: unknown[]) => {
      if (self._isEnabled()) self._origInfo(...args);
    };

    console.debug = (...args: unknown[]) => {
      if (self._isEnabled()) self._origDebug(...args);
    };

    // warn / error are left as-is — always surface
  }

  /** Check the live setting value each call so toggling takes effect instantly */
  private _isEnabled(): boolean {
    try {
      return SettingsManager.getInstance().getSetting('enableLogging');
    } catch {
      return false;
    }
  }

  // ─── Named methods for explicit Logger usage in classes ──────────────────

  /** Guarded log — respects the enableLogging toggle */
  log(...args: unknown[]): void {
    if (this._isEnabled()) this._origLog(...args);
  }

  /** Guarded info — respects the enableLogging toggle */
  info(...args: unknown[]): void {
    if (this._isEnabled()) this._origInfo(...args);
  }

  /** Guarded debug — respects the enableLogging toggle */
  debug(...args: unknown[]): void {
    if (this._isEnabled()) this._origDebug(...args);
  }

  /** Warn always surfaces regardless of toggle */
  warn(...args: unknown[]): void {
    this._origWarn(...args);
  }

  /** Error always surfaces regardless of toggle */
  error(...args: unknown[]): void {
    this._origError(...args);
  }

  /** Programmatically enable logging */
  enable(): void {
    SettingsManager.getInstance().setSetting('enableLogging', true);
  }

  /** Programmatically disable logging */
  disable(): void {
    SettingsManager.getInstance().setSetting('enableLogging', false);
  }

  /** Whether logging is currently active */
  isEnabled(): boolean {
    return this._isEnabled();
  }
}

/** Pre-built singleton — import this anywhere instead of console.log */
export const logger = Logger.getInstance();
