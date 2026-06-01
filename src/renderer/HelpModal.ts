import { t } from '../i18n/I18nService.js';

export type HelpSection = 'index' | 'keyboard' | 'touch';

export class HelpModal {
  private modal: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private bodyEl: HTMLElement | null = null;

  constructor() {
    this.modal = document.getElementById('help-modal');
    this.titleEl = document.getElementById('help-modal-title');
    this.bodyEl = document.getElementById('help-modal-body');

    document.getElementById('help-modal-close')?.addEventListener('click', () => this.hide());
    document.getElementById('help-modal-ok')?.addEventListener('click', () => this.hide());
    this.modal?.addEventListener('click', e => {
      if (e.target === this.modal) this.hide();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.isVisible()) this.hide();
    });
  }

  public show(section: HelpSection): void {
    if (!this.modal || !this.bodyEl) return;

    if (this.titleEl) {
      const titleKey =
        section === 'keyboard'
          ? 'templates.help.keyboardTitle'
          : section === 'touch'
            ? 'mobile.touchControlsTitle'
            : 'templates.help.title';
      this.titleEl.textContent = t(titleKey);
    }

    if (section === 'keyboard') {
      this.bodyEl.innerHTML = this.renderKeyboardSection();
    } else if (section === 'touch') {
      this.bodyEl.innerHTML = this.renderTouchSection();
    } else {
      this.bodyEl.innerHTML = this.renderIndexSection();
    }

    this.modal.style.display = 'flex';
  }

  public hide(): void {
    if (this.modal) this.modal.style.display = 'none';
  }

  public isVisible(): boolean {
    return this.modal?.style.display === 'flex';
  }

  private renderIndexSection(): string {
    const topics = t('templates.help.topics')
      .split('\n')
      .filter(Boolean)
      .map(line => `<li>${line}</li>`)
      .join('');
    return `
      <div class="help-section">
        <h3>${t('templates.help.indexHeading')}</h3>
        <ul>${topics}</ul>
      </div>
      <div class="help-section">
        <p>${t('templates.help.indexHint')}</p>
        <p>${t('templates.help.touchHint')}</p>
      </div>`;
  }

  private renderTouchSection(): string {
    const keys = [
      ['templates.help.touchTap', 'templates.help.touchTapDesc'],
      ['templates.help.touchPan', 'templates.help.touchPanDesc'],
      ['templates.help.touchLongPress', 'templates.help.touchLongPressDesc'],
      ['templates.help.touchPinch', 'templates.help.touchPinchDesc'],
      ['templates.help.touchMenu', 'templates.help.touchMenuDesc'],
      ['templates.help.touchEndTurn', 'templates.help.touchEndTurnDesc'],
    ] as const;

    const items = keys
      .map(([labelKey, descKey]) => `<li><strong>${t(labelKey)}</strong> — ${t(descKey)}</li>`)
      .join('');

    return `
      <div class="help-section">
        <h3>${t('templates.help.touchHeading')}</h3>
        <ul>${items}</ul>
      </div>`;
  }

  private renderKeyboardSection(): string {
    const keys = [
      ['templates.help.keyEndTurn', 'space, enter'],
      ['templates.help.keyMove', 'arrows, numpad'],
      ['templates.help.keyNextUnit', 'tab'],
      ['templates.help.keyPrevUnit', 'shift+tab'],
      ['templates.help.keyWait', 'w'],
      ['templates.help.keyFortify', 'f'],
      ['templates.help.keySleep', 's'],
      ['templates.help.keyGoto', 'g'],
      ['templates.help.keyTech', 't'],
      ['templates.help.keyCenter', 'c'],
      ['templates.help.keyBuildCity', 'b'],
      ['templates.help.keyRoad', 'r'],
      ['templates.help.keyIrrigate', 'i'],
      ['templates.help.keyMine', 'm'],
      ['templates.help.keyDelete', 'd'],
      ['templates.help.keySave', 'ctrl+s'],
      ['templates.help.keyLoad', 'ctrl+o'],
      ['templates.help.keyEscape', 'escape'],
    ] as const;

    const items = keys
      .map(([labelKey, key]) => {
        const label = t(labelKey);
        const parts = key.split(',').map(k => `<span class="help-kbd">${k.trim()}</span>`);
        return `<li>${label}: ${parts.join(' ')}</li>`;
      })
      .join('');

    return `
      <div class="help-section">
        <h3>${t('templates.help.keyboardHeading')}</h3>
        <ul>${items}</ul>
      </div>`;
  }
}
