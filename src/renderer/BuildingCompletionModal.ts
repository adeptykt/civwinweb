import { BUILDING_DEFINITIONS } from '../game/BuildingDefinitions.js';
import type { City, BuildingType } from '../types/game.js';

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
  public show(buildingType: BuildingType | string, city: City, isWonder: boolean = false): void {
    console.log('BuildingCompletionModal: show() called', buildingType, city.name);
    if (!this.modal) {
      console.error('BuildingCompletionModal: No modal elements found');
      return;
    }

    // Get building information
    const buildingInfo = this.getBuildingInfo(buildingType, isWonder);

    // Update modal content
    this.updateModalContent(buildingInfo, city, isWonder);

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
      // Handle wonders - these might not be in BUILDING_DEFINITIONS
      return {
        name: this.formatWonderName(buildingType as string),
        description: this.getWonderDescription(buildingType as string),
        effects: this.getWonderEffects(buildingType as string)
      };
    } else {
      // Handle regular buildings
      const buildingDef = BUILDING_DEFINITIONS[buildingType as BuildingType];
      if (buildingDef) {
        return {
          name: buildingDef.name,
          description: buildingDef.description,
          effects: this.getBuildingEffects(buildingDef)
        };
      } else {
        return {
          name: this.formatBuildingName(buildingType as string),
          description: 'A new building has been constructed.',
          effects: []
        };
      }
    }
  }

  /**
   * Update modal content with building information
   */
  private updateModalContent(buildingInfo: any, city: City, isWonder: boolean): void {
    // Update header content
    const nameElement = document.getElementById('completed-building-name');
    const cityElement = document.getElementById('completed-building-city');
    const iconElement = this.modal?.querySelector('.building-icon');
    const titleElement = this.modal?.querySelector('.discovery-title span');

    if (nameElement) nameElement.textContent = buildingInfo.name;
    if (cityElement) cityElement.textContent = city.name;
    
    if (iconElement) {
      iconElement.textContent = isWonder ? '🏛️' : '🏗️';
    }
    
    if (titleElement) {
      titleElement.textContent = isWonder ? 'Wonder Complete!' : 'Construction Complete!';
    }

    // Update detailed content
    const locationElement = document.getElementById('completion-building-location');
    const descriptionElement = document.getElementById('completion-building-description');
    const effectsList = document.getElementById('completion-building-effects');

    if (locationElement) locationElement.textContent = city.name;
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
      if (buildingDef.effects.goldBonus) {
        effects.push(`+${buildingDef.effects.goldBonus}% gold`);
      }
      if (buildingDef.effects.scienceBonus) {
        effects.push(`+${buildingDef.effects.scienceBonus}% science`);
      }
      if (buildingDef.effects.productionBonus) {
        effects.push(`+${buildingDef.effects.productionBonus}% production`);
      }
      if (buildingDef.effects.happinessBonus) {
        effects.push(`+${buildingDef.effects.happinessBonus} happiness`);
      }
      if (buildingDef.effects.foodBonus) {
        effects.push(`${buildingDef.effects.foodBonus}% less food needed for growth`);
      }
      if (buildingDef.effects.defenseBonus) {
        effects.push(`+${buildingDef.effects.defenseBonus}% city defense`);
      }
      if (buildingDef.effects.preventsFamine) {
        effects.push('Prevents famine');
      }
      if (buildingDef.effects.preventsDisorder) {
        effects.push('Prevents disorder');
      }
    }

    if (buildingDef.maintenanceCost) {
      effects.push(`Maintenance: ${buildingDef.maintenanceCost} gold per turn`);
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
}
