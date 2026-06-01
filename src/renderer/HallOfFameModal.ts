import { t } from '../i18n/I18nService.js';
import { clearHallOfFame, getHallOfFameEntries, type HallOfFameEntry } from '../game/HallOfFame.js';

export class HallOfFameModal {
  private modal: HTMLElement | null = null;
  private listEl: HTMLOListElement | null = null;
  private emptyEl: HTMLElement | null = null;
  private isVisible = false;
  private onClosed: (() => void) | null = null;

  constructor() {
    this.initializeModal();
  }

  private initializeModal(): void {
    this.modal = document.getElementById('hall-of-fame-modal');
    this.listEl = document.getElementById('hall-of-fame-list') as HTMLOListElement | null;
    this.emptyEl = document.getElementById('hall-of-fame-empty');

    if (!this.modal || !this.listEl) {
      console.error('Hall of Fame modal elements not found');
      return;
    }

    document.getElementById('hall-of-fame-close')?.addEventListener('click', () => this.close());
    document.getElementById('hall-of-fame-ok')?.addEventListener('click', () => this.close());
    document.getElementById('hall-of-fame-clear')?.addEventListener('click', () => this.clearAndRefresh());

    this.modal.addEventListener('click', (event) => {
      if (event.target === this.modal) this.close();
    });
  }

  private civDisplayName(type: string): string {
    const key = `civilizations.${type}.name`;
    const translated = t(key);
    return translated !== key ? translated : type;
  }

  private formatEntry(entry: HallOfFameEntry, rank: number): string {
    const civ = this.civDisplayName(String(entry.civilizationType));
    const diffKey = `difficulty.${entry.difficulty}`;
    const diff = t(diffKey) !== diffKey ? t(diffKey) : entry.difficulty;
    return t('templates.hallOfFame.entry', {
      rank,
      leader: entry.leaderName,
      civ,
      ranking: entry.ranking,
      year: entry.yearLabel,
      diff,
      civs: entry.totalCivs,
    });
  }

  public refreshList(): void {
    if (!this.listEl || !this.emptyEl) return;

    const entries = getHallOfFameEntries();
    this.listEl.innerHTML = '';

    if (entries.length === 0) {
      this.listEl.style.display = 'none';
      this.emptyEl.style.display = 'block';
      return;
    }

    this.listEl.style.display = 'block';
    this.emptyEl.style.display = 'none';

    entries.forEach((entry, index) => {
      const li = document.createElement('li');
      li.textContent = this.formatEntry(entry, index + 1);
      this.listEl!.appendChild(li);
    });
  }

  public show(onClosed?: () => void): void {
    if (!this.modal) return;
    this.onClosed = onClosed ?? null;
    this.refreshList();
    this.modal.style.display = 'flex';
    this.isVisible = true;
  }

  public close(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
      this.isVisible = false;
      const cb = this.onClosed;
      this.onClosed = null;
      cb?.();
    }
  }

  private clearAndRefresh(): void {
    if (!confirm(t('templates.hallOfFame.confirmClear'))) return;
    clearHallOfFame();
    this.refreshList();
  }

  public isOpen(): boolean {
    return this.isVisible;
  }
}
