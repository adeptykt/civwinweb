import { beforeEach } from 'vitest';
import enUi from '../src/locales/en.json';
import enGame from '../src/locales/en.game.json';
import ruUi from '../src/locales/ru.json';
import ruGame from '../src/locales/ru.game.json';
import { I18nService } from '../src/i18n/I18nService.js';
import { deepMerge } from '../src/i18n/deepMerge.js';

function asRecord(x: unknown): Record<string, unknown> {
  return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}

beforeEach(() => {
  const en = deepMerge(asRecord(enUi), asRecord(enGame));
  const ruFragment = deepMerge(asRecord(ruUi), asRecord(ruGame));
  const ru = deepMerge(en, ruFragment);
  const i18n = I18nService.getInstance();
  i18n.registerLocale('en', en);
  i18n.registerLocale('ru', ru);
  i18n.setLocale('en', false);
});
