import { t } from '../i18n/I18nService.js';
import type { CivilopediaEntry } from '../game/CivilopediaData.js';

export type { CivilopediaEntry };

export class CivilopediaReferenceModal {
  private listModal: HTMLElement | null = null;
  private detailsModal: HTMLElement | null = null;
  private listTitle: HTMLElement | null = null;
  private listContainer: HTMLElement | null = null;
  private detailsTitle: HTMLElement | null = null;
  private detailsBody: HTMLElement | null = null;
  private entries: CivilopediaEntry[] = [];

  constructor() {
    this.listModal = document.getElementById('civilopedia-ref-modal');
    this.detailsModal = document.getElementById('civilopedia-ref-details-modal');
    this.listTitle = document.getElementById('civilopedia-ref-title');
    this.listContainer = document.getElementById('civilopedia-ref-list');
    this.detailsTitle = document.getElementById('civilopedia-ref-details-title');
    this.detailsBody = document.getElementById('civilopedia-ref-details-body');

    document.getElementById('civilopedia-ref-close')?.addEventListener('click', () => this.hideList());
    document.getElementById('civilopedia-ref-details-close')?.addEventListener('click', () => this.hideDetails());
    document.getElementById('civilopedia-ref-details-back')?.addEventListener('click', () => this.backToList());
  }

  public show(sectionTitleKey: string, entries: CivilopediaEntry[]): void {
    if (!this.listModal || !this.listContainer) return;
    this.entries = entries;
    if (this.listTitle) {
      this.listTitle.textContent = t(sectionTitleKey);
    }
    this.renderList();
    this.listModal.style.display = 'flex';
  }

  private renderList(): void {
    if (!this.listContainer) return;
    this.listContainer.innerHTML = '';
    const sorted = [...this.entries].sort((a, b) => a.title.localeCompare(b.title));

    for (const entry of sorted) {
      const row = document.createElement('button');
      row.className = 'civ-unit-row';
      row.style.width = '100%';
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.marginBottom = '4px';
      row.style.padding = '8px 10px';
      row.style.border = '1px solid #808080';
      row.style.background = '#f0f0f0';
      row.style.color = '#000000';
      row.style.cursor = 'pointer';

      const name = document.createElement('span');
      name.textContent = entry.title;
      row.appendChild(name);
      row.addEventListener('click', () => this.showDetails(entry));
      this.listContainer.appendChild(row);
    }
  }

  private showDetails(entry: CivilopediaEntry): void {
    if (!this.detailsModal || !this.detailsTitle || !this.detailsBody) return;
    this.detailsTitle.textContent = entry.title;
    this.detailsBody.innerHTML = entry.body.replace(/\n/g, '<br>');
    this.listModal!.style.display = 'none';
    this.detailsModal.style.display = 'flex';
  }

  private hideList(): void {
    if (this.listModal) this.listModal.style.display = 'none';
  }

  private hideDetails(): void {
    if (this.detailsModal) this.detailsModal.style.display = 'none';
    this.hideList();
  }

  private backToList(): void {
    if (this.detailsModal) this.detailsModal.style.display = 'none';
    if (this.listModal) this.listModal.style.display = 'flex';
  }
}
