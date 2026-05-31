import { t } from './I18nService.js';

/**
 * Apply [data-i18n="path.to.key"] to textContent, or data-i18n-attr="title" etc.
 * Optional data-i18n-html="true" sets innerHTML (trusted catalog strings only).
 */
export function applyI18nToRoot(root: ParentNode = document.body): void {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    const attr = el.getAttribute('data-i18n-attr');
    const asHtml = el.getAttribute('data-i18n-html') === 'true';
    const translated = t(key);
    if (attr) {
      el.setAttribute(attr, translated);
    } else if (asHtml) {
      el.innerHTML = translated;
    } else {
      el.textContent = translated;
    }
  });
}
