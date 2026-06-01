import {
  TECHNOLOGY_DEFINITIONS,
  TechnologyType,
  Technology,
  TechnologyEra,
  getTechnology,
} from '../game/TechnologyDefinitions.js';
import { UnitType } from '../types/game.js';
import { t } from '../i18n/I18nService.js';
import {
  getBuildingDisplayName,
  getGovernmentDisplayName,
  getImprovementDisplayName,
  getUnitDisplayName,
  getWonderDisplayName,
} from '../utils/DisplayNames.js';

const ERA_SORT_ORDER: TechnologyEra[] = [
  TechnologyEra.ANCIENT,
  TechnologyEra.CLASSICAL,
  TechnologyEra.MEDIEVAL,
  TechnologyEra.RENAISSANCE,
  TechnologyEra.INDUSTRIAL,
  TechnologyEra.MODERN,
  TechnologyEra.INFORMATION,
];

function eraSortIndex(era: TechnologyEra): number {
  const i = ERA_SORT_ORDER.indexOf(era);
  return i === -1 ? 999 : i;
}

function formatEra(era: TechnologyEra): string {
  const key = `technologyEra.${era}`;
  const tr = t(key);
  return tr === key ? era : tr;
}

export class CivilopediaTechnologiesModal {
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
    this.listModal = document.getElementById('civilopedia-technologies-modal');
    this.detailsModal = document.getElementById('civilopedia-tech-details-modal');
    this.listContainer = document.getElementById('civ-tech-list');
    this.detailsTitle = document.getElementById('civ-tech-details-title');
    this.detailsBody = document.getElementById('civ-tech-details-body');
  }

  private bindEvents(): void {
    document.getElementById('civ-tech-close')?.addEventListener('click', () => this.hideList());
    document.getElementById('civ-tech-details-close')?.addEventListener('click', () => this.hideDetails());
    document.getElementById('civ-tech-details-back')?.addEventListener('click', () => this.backToList());
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

    const types = (Object.keys(TECHNOLOGY_DEFINITIONS) as TechnologyType[]).sort((a, b) => {
      const da = TECHNOLOGY_DEFINITIONS[a];
      const db = TECHNOLOGY_DEFINITIONS[b];
      const ia = eraSortIndex(da.era);
      const ib = eraSortIndex(db.era);
      if (ia !== ib) return ia - ib;
      return getTechnology(a).name.localeCompare(getTechnology(b).name, undefined, { sensitivity: 'base' });
    });

    for (const techType of types) {
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
      name.textContent = getTechnology(techType).name;

      const meta = document.createElement('span');
      meta.style.opacity = '0.75';
      meta.textContent = `${formatEra(TECHNOLOGY_DEFINITIONS[techType].era)} · ${TECHNOLOGY_DEFINITIONS[techType].cost}`;

      row.appendChild(name);
      row.appendChild(meta);
      row.addEventListener('click', () => this.showDetails(techType));
      this.listContainer.appendChild(row);
    }
  }

  private appendUnlockList(technology: Technology, ul: HTMLUListElement): void {
    if (technology.unlocks.units?.length) {
      for (const unit of technology.unlocks.units) {
        const li = document.createElement('li');
        li.textContent = t('templates.techDiscovery.unlockUnit', { name: getUnitDisplayName(unit as UnitType) });
        ul.appendChild(li);
      }
    }
    if (technology.unlocks.buildings?.length) {
      for (const building of technology.unlocks.buildings) {
        const li = document.createElement('li');
        li.textContent = t('templates.techDiscovery.unlockBuilding', { name: getBuildingDisplayName(building) });
        ul.appendChild(li);
      }
    }
    if (technology.unlocks.governments?.length) {
      for (const government of technology.unlocks.governments) {
        const li = document.createElement('li');
        li.textContent = t('templates.techDiscovery.unlockGovernment', { name: getGovernmentDisplayName(government) });
        ul.appendChild(li);
      }
    }
    if (technology.unlocks.improvements?.length) {
      for (const improvement of technology.unlocks.improvements) {
        const li = document.createElement('li');
        li.textContent = t('templates.techDiscovery.unlockImprovement', {
          name: getImprovementDisplayName(improvement),
        });
        ul.appendChild(li);
      }
    }
    if (technology.unlocks.wonders?.length) {
      for (const wonder of technology.unlocks.wonders) {
        const li = document.createElement('li');
        li.textContent = t('templates.techDiscovery.unlockWonder', { name: getWonderDisplayName(wonder) });
        ul.appendChild(li);
      }
    }
    if (ul.children.length === 0) {
      const li = document.createElement('li');
      li.textContent = t('templates.techDiscovery.unlocksNone');
      li.style.fontStyle = 'italic';
      ul.appendChild(li);
    }
  }

  private showDetails(techType: TechnologyType): void {
    if (!this.detailsModal || !this.detailsTitle || !this.detailsBody) return;
    const technology = getTechnology(techType);
    const def = TECHNOLOGY_DEFINITIONS[techType];

    const prereqNames = def.prerequisites.map((p) => getTechnology(p).name).join(', ');
    const prereqHtml = def.prerequisites.length
      ? `<p><strong>${t('templates.techSelection.prerequisitesLabel')}</strong> ${prereqNames}</p>`
      : `<p><strong>${t('templates.techSelection.prerequisitesLabel')}</strong> ${t('templates.techSelection.none')}</p>`;

    const ul = document.createElement('ul');
    ul.style.margin = '4px 0 8px 1.2em';
    ul.style.padding = '0';
    this.appendUnlockList(technology, ul);

    this.detailsTitle.textContent = `${technology.name} (${techType})`;

    const unlockHeading = document.createElement('p');
    unlockHeading.innerHTML = `<strong>${t('templates.techDiscovery.unlocksHeading')}</strong>`;

    const unlockWrap = document.createElement('div');
    unlockWrap.appendChild(unlockHeading);
    unlockWrap.appendChild(ul);

    this.detailsBody.innerHTML = [
      `<p><strong>${t('templates.civilopediaTechnologies.eraLabel')}:</strong> ${formatEra(def.era)}</p>`,
      `<p><strong>${t('templates.civilopediaTechnologies.baseCostLabel')}:</strong> ${def.cost}</p>`,
      prereqHtml,
      `<p><strong>${t('templates.techSelection.descriptionLabel')}</strong> ${technology.description}</p>`,
    ].join('');
    this.detailsBody.appendChild(unlockWrap);

    this.hideList();
    this.detailsModal.style.display = 'flex';
    this.detailsModal.classList.add('active');
  }
}
