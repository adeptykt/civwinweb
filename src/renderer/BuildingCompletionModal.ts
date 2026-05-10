import { getBuildingStats } from '../game/BuildingDefinitions.js';
import { getWonderStats } from '../game/WonderDefinitions.js';
import type { City, BuildingType } from '../types/game.js';
import { t } from '../i18n/I18nService.js';

/**
 * @description Manages the Building Completion modal that shows when buildings/wonders are completed
 */
export class BuildingCompletionModal {
  private modal: HTMLElement | null = null;
  private isVisible: boolean = false;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    this.initializeModal();
  }

  /**
   * Initialize the modal and set up event handlers
   */
  private initializeModal(): void {
    console.log('BuildingCompletionModal: Initializing modal');
    this.modal = document.getElementById('building-completion-modal');

    if (!this.modal) {
      console.error('Building completion modal elements not found');
      return;
    }

    // Set up event handlers
    const closeBtn = document.getElementById('completion-close');
    closeBtn?.addEventListener('click', () => this.hide());

    // Close modal when clicking outside
    this.modal.addEventListener('click', (event) => {
      if (event.target === this.modal) {
        this.hide();
      }
    });

    // Create keyboard handler function
    this.keydownHandler = (event: KeyboardEvent) => {
      if (!this.isVisible) return;
      
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
        event.preventDefault();
        this.hide();
      }
    };
  }

  /**
   * Show the Building Completion modal
   */
  public show(buildingType: BuildingType | string, city: City, isWonder: boolean = false, foreignCivName?: string | null): void {
    console.log('BuildingCompletionModal: show() called', buildingType, city.name);
    if (!this.modal) {
      console.error('BuildingCompletionModal: No modal elements found');
      return;
    }

    // Get building information
    const buildingInfo = this.getBuildingInfo(buildingType, isWonder);

    // Update modal content
    this.updateModalContent(buildingInfo, city, isWonder, buildingType, foreignCivName ?? null);

    // Show modal
    this.isVisible = true;
    this.modal.style.display = 'flex';
    this.modal.classList.add('active');

    // Add keyboard event listener
    if (this.keydownHandler) {
      document.addEventListener('keydown', this.keydownHandler);
    }
  }

  /**
   * Hide the modal
   */
  public hide(): void {
    if (!this.modal) return;

    // Remove keyboard event listener
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
    }

    this.modal.style.display = 'none';
    this.modal.classList.remove('active');
    this.isVisible = false;
  }

  /**
   * Get building information
   */
  private getBuildingInfo(buildingType: BuildingType | string, isWonder: boolean) {
    if (isWonder) {
      const wonderDef = getWonderStats(buildingType as string);
      if (wonderDef) {
        return {
          name: wonderDef.name,
          description: wonderDef.description,
          effects: wonderDef.effects
        };
      }
      return {
        name: this.formatWonderName(buildingType as string),
        description: this.getWonderDescription(buildingType as string),
        effects: this.getWonderEffects(buildingType as string)
      };
    } else {
      // Handle regular buildings
      const buildingDef = getBuildingStats(buildingType as BuildingType);
      if (buildingDef) {
        return {
          name: buildingDef.name,
          description: buildingDef.description,
          effects: this.getBuildingEffects(buildingDef)
        };
      } else {
        return {
          name: this.formatBuildingName(buildingType as string),
          description: t('templates.buildingCompletion.defaultDescription'),
          effects: []
        };
      }
    }
  }

  /**
   * Update modal content with building information
   */
  private updateModalContent(buildingInfo: any, city: City, isWonder: boolean, buildingType: string, foreignCivName: string | null = null): void {
    // Update header content
    const nameElement = document.getElementById('completed-building-name');
    const cityElement = document.getElementById('completed-building-city');
    const iconElement = this.modal?.querySelector('.building-icon');
    const titleElement = this.modal?.querySelector('.discovery-title span');
    
    // Handle wonder dialog image
    const wonderImageContainer = document.getElementById('wonder-dialog-image-container');
    const wonderImage = document.getElementById('wonder-dialog-image') as HTMLImageElement;
    const techIconContainer = document.getElementById('building-tech-icon');

    if (wonderImageContainer) wonderImageContainer.style.display = 'none';
    if (techIconContainer) techIconContainer.style.display = '';

    if (isWonder && wonderImageContainer && wonderImage) {
      const fileName = this.getWonderImageFileName(buildingType);
      const imagePath = `/src/assets/wonders-dialogs/${fileName}.png`;
      
      const img = new Image();
      img.onload = () => {
        wonderImage.src = imagePath;
        wonderImageContainer.style.display = 'block';
        if (techIconContainer) {
          techIconContainer.style.display = 'none';
        }
      };
      img.onerror = () => {
        // Silently fail, leaves default icon visible
        console.warn(`Wonder image not found: ${imagePath}`);
      };
      img.src = imagePath;
    }

    if (nameElement) nameElement.textContent = buildingInfo.name;
    if (iconElement) iconElement.textContent = isWonder ? '🏛\uFE0F' : '🏗\uFE0F';

    const discoveryText = this.modal?.querySelector('.discovery-text');
    if (foreignCivName) {
      // Foreign civilization built this wonder
      if (titleElement) titleElement.textContent = t('templates.buildingCompletion.titleForeignWonder');
      if (cityElement) cityElement.textContent = '';
      if (discoveryText) {
        discoveryText.innerHTML = t('templates.buildingCompletion.bodyForeignWonder', {
          name: buildingInfo.name,
          civ: foreignCivName
        });
      }
    } else {
      if (titleElement) {
        titleElement.textContent = isWonder
          ? t('templates.buildingCompletion.titleWonder')
          : t('templates.buildingCompletion.titleConstruction');
      }
      if (cityElement) cityElement.textContent = city.name;
      if (discoveryText) {
        discoveryText.textContent = t('templates.buildingCompletion.bodyInCity', { city: city.name });
      }
    }

    // Update detailed content
    const locationElement = document.getElementById('completion-building-location');
    const descriptionElement = document.getElementById('completion-building-description');
    const effectsList = document.getElementById('completion-building-effects');

    if (locationElement) {
      locationElement.textContent = foreignCivName
        ? t('templates.buildingCompletion.locationForeign', { civ: foreignCivName })
        : city.name;
    }
    if (descriptionElement) descriptionElement.textContent = buildingInfo.description;

    if (effectsList) {
      effectsList.innerHTML = '';
      buildingInfo.effects.forEach((effect: string) => {
        const li = document.createElement('li');
        li.textContent = effect;
        effectsList.appendChild(li);
      });
    }
  }

  /**
   * Format building name for display
   */
  private formatBuildingName(buildingType: string): string {
    return buildingType.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }

  /**
   * Format wonder name for display
   */
  private formatWonderName(wonderType: string): string {
    return wonderType.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }

  /**
   * Get building effects from definition
   */
  private getBuildingEffects(buildingDef: any): string[] {
    const effects: string[] = [];
    
    if (buildingDef.effects) {
      if (buildingDef.effects.scienceBonus) {
        effects.push(t('templates.buildingCompletion.effectScienceBonus', { value: buildingDef.effects.scienceBonus }));
      }
      if (buildingDef.effects.productionBonus) {
        effects.push(t('templates.buildingCompletion.effectProductionBonus', { value: buildingDef.effects.productionBonus }));
      }
      if (buildingDef.effects.tradeBonus) {
        effects.push(t('templates.buildingCompletion.effectTradeBonus', { value: buildingDef.effects.tradeBonus }));
      }
      if (buildingDef.effects.foodBonus) {
        effects.push(t('templates.buildingCompletion.effectFoodBonus', { value: buildingDef.effects.foodBonus }));
      }
      if (buildingDef.effects.happyFaces) {
        effects.push(t('templates.buildingCompletion.effectHappyFaces', { value: buildingDef.effects.happyFaces }));
      }
      if (buildingDef.effects.reducesCorruption) {
        effects.push(t('templates.buildingCompletion.effectReduceCorruption', { value: buildingDef.effects.reducesCorruption }));
      }
      if (buildingDef.effects.triplesCityDefense) {
        effects.push(t('templates.buildingCompletion.effectTripleCityDefense'));
      }
      if (buildingDef.effects.populationGrowthLimit) {
        effects.push(t('templates.buildingCompletion.effectPopulationLimit', { value: buildingDef.effects.populationGrowthLimit }));
      }
      if (buildingDef.effects.veteranUnits) {
        effects.push(t('templates.buildingCompletion.effectVeteranUnits'));
      }
      if (buildingDef.effects.preventsFamine) {
        effects.push(t('templates.buildingCompletion.effectPreventsFamine'));
      }
      if (buildingDef.effects.preventsFireAndPlague) {
        effects.push(t('templates.buildingCompletion.effectPreventsFireAndPlague'));
      }
      if (buildingDef.effects.preventsVolcano) {
        effects.push(t('templates.buildingCompletion.effectPreventsVolcano'));
      }
      if (buildingDef.effects.preventsFlood) {
        effects.push(t('templates.buildingCompletion.effectPreventsFlood'));
      }
      if (buildingDef.effects.preventsPirateRaids) {
        effects.push(t('templates.buildingCompletion.effectPreventsPirateRaids'));
      }
      if (buildingDef.effects.reducesNuclearMeltdownRisk) {
        effects.push(t('templates.buildingCompletion.effectReduceMeltdownRisk'));
      }
      if (buildingDef.effects.reducesPollution) {
        effects.push(t('templates.buildingCompletion.effectReducePollution'));
      }
      if (buildingDef.effects.eliminatesPopulationPollution) {
        effects.push(t('templates.buildingCompletion.effectEliminatePopulationPollution'));
      }
      if (buildingDef.effects.powerBonus) {
        effects.push(t('templates.buildingCompletion.effectPowerBonus', { value: buildingDef.effects.powerBonus }));
      }
    }

    if (buildingDef.maintenanceCost) {
      effects.push(t('templates.buildingCompletion.effectMaintenance', { value: buildingDef.maintenanceCost }));
    }

    return effects;
  }

  /**
   * Get wonder description
   */
  private getWonderDescription(wonderType: string): string {
    const descriptions: { [key: string]: string } = {
      'hanging_gardens': 'One of the seven wonders of the ancient world. Increases happiness and population growth.',
      'colossus': 'A giant statue that increases trade and gold income.',
      'lighthouse': 'Increases naval movement and trade routes.',
      'pyramids': 'A monumental tomb that provides cultural benefits.',
      'great_wall': 'A massive fortification that provides defense bonuses.'
    };
    
    return descriptions[wonderType] || 'A magnificent wonder that brings glory to your civilization.';
  }

  /**
   * Get wonder effects
   */
  private getWonderEffects(wonderType: string): string[] {
    const effects: { [key: string]: string[] } = {
      'hanging_gardens': ['Population growth +1 in all cities', '+1 happiness in all cities'],
      'colossus': ['+1 trade in all coastal cities', '+50% gold from trade'],
      'lighthouse': ['+1 movement for all naval units', '+50% trade route income'],
      'pyramids': ['+2 culture per turn', 'Granary effect in all cities'],
      'great_wall': ['Land units defending cities get +100% defense', 'Prevents barbarian attacks']
    };
    
    return effects[wonderType] || ['Provides civilization-wide benefits', 'Increases your civilization\'s prestige'];
  }

  /**
   * Helper to map wonder types to their main dialog image names
   */
  private getWonderImageFileName(wonderType: string): string {
    const WONDER_IMAGE_MAP: Record<string, string> = {
      'colossus': 'colossus',
      'copernicus_observatory': 'copernicus',
      'darwins_voyage': 'darwins',
      'great_library': 'greatlibrary',
      'great_wall': 'greatwall',
      'hanging_gardens': 'hanginggardens',
      'isaac_newtons_college': 'isaacnewton',
      'lighthouse': 'lighthouse',
      'oracle': 'oracle',
      'pyramids': 'pyramids'
    };
    return WONDER_IMAGE_MAP[wonderType] || wonderType.replace(/_/g, '');
  }
}

