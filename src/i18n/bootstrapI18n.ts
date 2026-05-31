import enUi from '../locales/en.json';
import enGame from '../locales/en.game.json';
import ruUi from '../locales/ru.json';
import ruGame from '../locales/ru.game.json';
import { deepMerge } from './deepMerge.js';
import { I18nService, type LocaleCode, t } from './I18nService.js';
import { applyI18nToRoot } from './applyI18nToDom.js';
import { SettingsManager } from '../utils/SettingsManager.js';

function asRecord(x: unknown): Record<string, unknown> {
  return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}

/** Load merged catalogs and apply saved locale. Call once at startup after DOM is ready. */
export function bootstrapI18n(): void {
  const en = deepMerge(asRecord(enUi), asRecord(enGame));
  const ruFragment = deepMerge(asRecord(ruUi), asRecord(ruGame));
  const ru = deepMerge(en, ruFragment);
  const i18n = I18nService.getInstance();
  i18n.registerLocale('en', en);
  i18n.registerLocale('ru', ru);

  const saved = SettingsManager.getInstance().getSetting('locale') as LocaleCode;
  const code: LocaleCode = saved === 'ru' ? 'ru' : 'en';
  i18n.setLocale(code, false);
  applyI18nToRoot(document.body);
  document.title = t('app.title');
}

export function refreshDomI18n(): void {
  applyI18nToRoot(document.body);
}
