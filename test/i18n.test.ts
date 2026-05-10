import { describe, it, expect, beforeEach } from 'vitest';
import { I18nService } from '../src/i18n/I18nService.js';
import { deepMerge } from '../src/i18n/deepMerge.js';

describe('I18nService', () => {
  beforeEach(() => {
    const i18n = I18nService.getInstance();
    i18n.registerLocale('en', {
      app: { title: 'Test Game' },
      nested: { key: 'Hello {{name}}' },
      arr: ['a', 'b']
    });
    i18n.registerLocale('ru', deepMerge(
      { app: { title: 'Test Game' }, nested: { key: 'Hello {{name}}' }, arr: ['a', 'b'] },
      { app: { title: 'Тест' } }
    ));
    i18n.setLocale('en', false);
  });

  it('resolves dot paths', () => {
    expect(I18nService.getInstance().t('app.title')).toBe('Test Game');
  });

  it('interpolates placeholders', () => {
    expect(I18nService.getInstance().t('nested.key', { name: 'World' })).toBe('Hello World');
  });

  it('uses ru string when present', () => {
    const i18n = I18nService.getInstance();
    i18n.setLocale('ru', false);
    expect(i18n.t('app.title')).toBe('Тест');
  });

  it('resolves array index paths', () => {
    expect(I18nService.getInstance().t('arr.1')).toBe('b');
  });
});
