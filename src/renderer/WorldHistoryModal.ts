import { t } from '../i18n/I18nService.js';
import type { GameHistoryEntry } from '../types/game.js';

export class WorldHistoryModal {
  private modal: HTMLElement | null = null;
  private listEl: HTMLOListElement | null = null;
  private emptyEl: HTMLElement | null = null;

  constructor() {
    this.modal = document.getElementById('world-history-modal');
    this.listEl = document.getElementById('world-history-list') as HTMLOListElement | null;
    this.emptyEl = document.getElementById('world-history-empty');

    document.getElementById('world-history-close')?.addEventListener('click', () => this.hide());
    document.getElementById('world-history-ok')?.addEventListener('click', () => this.hide());
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) this.hide();
    });
  }

  private formatLine(entry: GameHistoryEntry): string {
    const msg = t(entry.messageKey, entry.params ?? {});
    return t('templates.history.line', {
      year: entry.yearLabel,
      turn: entry.turn,
      text: msg,
    });
  }

  public show(entries: GameHistoryEntry[]): void {
    if (!this.modal || !this.listEl || !this.emptyEl) return;

    this.listEl.innerHTML = '';
    if (entries.length === 0) {
      this.listEl.style.display = 'none';
      this.emptyEl.style.display = 'block';
    } else {
      this.listEl.style.display = 'block';
      this.emptyEl.style.display = 'none';
      for (const entry of entries) {
        const li = document.createElement('li');
        li.textContent = this.formatLine(entry);
        this.listEl.appendChild(li);
      }
    }

    this.modal.style.display = 'flex';
  }

  public hide(): void {
    if (this.modal) this.modal.style.display = 'none';
  }
}
