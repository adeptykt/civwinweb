import { UNIT_DEFINITIONS } from '../game/UnitDefinitions.js';
import { getTechnology } from '../game/TechnologyDefinitions.js';
import { UnitType, UnitStats } from '../types/game.js';
import { t } from '../i18n/I18nService.js';
import { getUnitDisplayName } from '../utils/DisplayNames.js';

export class CivilopediaUnitsModal {
  private listModal: HTMLElement | null = null;
  private detailsModal: HTMLElement | null = null;
  private listContainer: HTMLElement | null = null;
  private detailsTitle: HTMLElement | null = null;
  private detailsBody: HTMLElement | null = null;

  constructor() {
    this.bindElements();
    this.bindEvents();
  }

  public showList(): void {
    if (!this.listModal || !this.listContainer) return;
    this.renderList();
    this.listModal.style.display = 'flex';
    this.listModal.classList.add('active');
  }

  private bindElements(): void {
    this.listModal = document.getElementById('civilopedia-units-modal');
    this.detailsModal = document.getElementById('civilopedia-unit-details-modal');
    this.listContainer = document.getElementById('civ-units-list');
    this.detailsTitle = document.getElementById('civ-unit-details-title');
    this.detailsBody = document.getElementById('civ-unit-details-body');
  }

  private bindEvents(): void {
    document.getElementById('civ-units-close')?.addEventListener('click', () => this.hideList());
    document.getElementById('civ-unit-details-close')?.addEventListener('click', () => this.hideDetails());
    document.getElementById('civ-unit-details-back')?.addEventListener('click', () => this.backToList());
  }

  private hideList(): void {
    if (!this.listModal) return;
    this.listModal.style.display = 'none';
    this.listModal.classList.remove('active');
  }

  private hideDetails(): void {
    if (!this.detailsModal) return;
    this.detailsModal.style.display = 'none';
    this.detailsModal.classList.remove('active');
  }

  private backToList(): void {
    this.hideDetails();
    this.showList();
  }

  private renderList(): void {
    if (!this.listContainer) return;
    this.listContainer.innerHTML = '';

    const entries = (Object.entries(UNIT_DEFINITIONS) as [UnitType, UnitStats][])
      .sort((a, b) => getUnitDisplayName(a[0]).localeCompare(getUnitDisplayName(b[0])));

    for (const [unitType] of entries) {
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
      name.textContent = getUnitDisplayName(unitType);

      const id = document.createElement('span');
      id.style.opacity = '0.75';
      id.textContent = unitType;

      row.appendChild(name);
      row.appendChild(id);
      row.addEventListener('click', () => this.showDetails(unitType));
      this.listContainer.appendChild(row);
    }
  }

  private showDetails(unitType: UnitType): void {
    if (!this.detailsModal || !this.detailsTitle || !this.detailsBody) return;
    const stats = UNIT_DEFINITIONS[unitType];

    const categoryKey = `dialogs.unitCategory.${stats.category}`;
    const category = t(categoryKey) === categoryKey ? stats.category : t(categoryKey);
    const requiredTech = stats.requiredTechnology
      ? getTechnology(stats.requiredTechnology).name
      : t('dialogs.unitNoRequirement');
    const obsoletedBy = stats.obsoletedBy
      ? getTechnology(stats.obsoletedBy).name
      : t('dialogs.unitNotObsoleted');

    this.detailsTitle.textContent = `${getUnitDisplayName(unitType)} (${unitType})`;
    this.detailsBody.innerHTML = [
      `<p><strong>${t('dialogs.unitStats')}:</strong> ${stats.attack}/${stats.defense}/${stats.movement}</p>`,
      `<p><strong>${t('dialogs.unitCost')}:</strong> ${stats.productionCost}</p>`,
      `<p><strong>${t('dialogs.unitCategoryLabel')}:</strong> ${category}</p>`,
      `<p><strong>${t('dialogs.unitRequiredTech')}:</strong> ${requiredTech}</p>`,
      `<p><strong>${t('dialogs.unitObsoletedBy')}:</strong> ${obsoletedBy}</p>`,
      `<p><strong>${t('templates.civilopediaUnits.canAttack')}:</strong> ${stats.canAttack ? t('templates.civilopediaUnits.yes') : t('templates.civilopediaUnits.no')}</p>`,
      `<p><strong>${t('templates.civilopediaUnits.canFortify')}:</strong> ${stats.canFortify ? t('templates.civilopediaUnits.yes') : t('templates.civilopediaUnits.no')}</p>`,
    ].join('');

    this.hideList();
    this.detailsModal.style.display = 'flex';
    this.detailsModal.classList.add('active');
  }
}
