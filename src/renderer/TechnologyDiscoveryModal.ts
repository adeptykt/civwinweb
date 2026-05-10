import { TechnologyType } from '../game/TechnologyDefinitions.js';
import { getTechnology } from '../game/TechnologyDefinitions.js';
import { TechnologySprites } from './TechnologySprites.js';
import type { Player } from '../types/game.js';
import type { Game } from '../game/Game.js';
import { 
  getBuildingDisplayName, 
  getUnitDisplayName, 
  getWonderDisplayName, 
  getGovernmentDisplayName, 
  getImprovementDisplayName 
} from '../utils/DisplayNames.js';
import { t } from '../i18n/I18nService.js';

/**
 * Manages the technology discovery modal that shows when a technology is completed
 */
export class TechnologyDiscoveryModal {
  private modal: HTMLElement | null = null;
  private step1: HTMLElement | null = null;
  private step2: HTMLElement | null = null;
  private currentStep = 1;
  private onComplete: (() => void) | null = null;

  constructor() {
    this.initializeModal();
  }

  /**
   * Initialize the modal and set up event handlers
   */
  private initializeModal(): void {
    console.log('TechnologyDiscoveryModal: Initializing modal');
    this.modal = document.getElementById('technology-discovery-modal');
    this.step1 = document.getElementById('discovery-step-1');
    this.step2 = document.getElementById('discovery-step-2');

    console.log('TechnologyDiscoveryModal: Elements found:');
    console.log('- modal:', this.modal);
    console.log('- step1:', this.step1);
    console.log('- step2:', this.step2);

    if (!this.modal || !this.step1 || !this.step2) {
      console.error('Technology discovery modal elements not found');
      return;
    }

    // Set up event handlers
    const continueBtn = document.getElementById('discovery-continue');
    const closeBtn = document.getElementById('discovery-close');

    continueBtn?.addEventListener('click', () => {
      console.log('TechnologyDiscoveryModal: Continue button clicked');
      this.nextStep();
    });
    closeBtn?.addEventListener('click', () => {
      console.log('TechnologyDiscoveryModal: Close button clicked');
      this.close();
    });

    // Prevent closing by clicking outside during discovery
    this.modal.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    // Add keyboard handler for Enter/Space to advance
    document.addEventListener('keydown', (event) => {
      if (this.modal?.style.display === 'flex') {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (this.currentStep === 1) {
            this.nextStep();
          } else {
            this.close();
          }
        }
      }
    });
  }

  /**
   * Show the discovery modal for a specific technology
   */
  public async show(technology: TechnologyType, onComplete?: () => void): Promise<void> {
    console.log('TechnologyDiscoveryModal: Showing discovery for:', technology);
    
    if (!this.modal || !this.step1 || !this.step2) {
      console.error('TechnologyDiscoveryModal: Modal elements not found');
      console.log('Modal:', this.modal);
      console.log('Step1:', this.step1);
      console.log('Step2:', this.step2);
      return;
    }

    this.onComplete = onComplete || null;
    this.currentStep = 1;

    // Populate step 1 content
    await this.populateStep1(technology);
    
    // Populate step 2 content
    await this.populateStep2(technology);

    // Show step 1, hide step 2
    console.log('TechnologyDiscoveryModal: Setting step 1 to display: block');
    this.step1.style.display = 'block';
    console.log('TechnologyDiscoveryModal: Setting step 2 to display: none');
    this.step2.style.display = 'none';

    // Show modal
    console.log('TechnologyDiscoveryModal: Setting modal to display: flex');
    this.modal.style.display = 'flex';
    this.modal.classList.add('active');
    
    console.log('TechnologyDiscoveryModal: Modal should now be visible with step 1');
  }

  /**
   * Populate step 1 content (basic announcement)
   */
  private async populateStep1(technologyType: TechnologyType): Promise<void> {
    const technology = getTechnology(technologyType);
    
    const nameElement = document.getElementById('discovered-tech-name');
    if (nameElement) {
      nameElement.textContent = technology.name;
    }

    // Load and display technology sprite
    try {
      const sprite = await TechnologySprites.getTechnologySprite(technologyType, 96);
      const iconElement = document.querySelector('.tech-icon') as HTMLElement;
      if (iconElement && sprite) {
        // Clear existing content and append the canvas sprite
        iconElement.innerHTML = '';
        iconElement.appendChild(sprite);
      }
    } catch (error) {
      console.warn(`Failed to load sprite for ${technologyType}:`, error);
      // Fallback to default icon
    }
  }

  /**
   * Populate step 2 content (detailed description)
   */
  private async populateStep2(technologyType: TechnologyType): Promise<void> {
    const technology = getTechnology(technologyType);
    
    // Update title
    const titleElement = document.getElementById('discovery-tech-title');
    if (titleElement) {
      titleElement.textContent = technology.name;
    }

    // Load and display large technology sprite
    try {
      const sprite = await TechnologySprites.getTechnologySprite(technologyType, 120);
      const iconElement = document.querySelector('.tech-icon-large') as HTMLElement;
      if (iconElement && sprite) {
        // Clear existing content and append the canvas sprite
        iconElement.innerHTML = '';
        iconElement.appendChild(sprite);
      }
    } catch (error) {
      console.warn(`Failed to load large sprite for ${technologyType}:`, error);
      // Fallback to default icon
    }

    // Update era
    const eraElement = document.getElementById('discovery-tech-era');
    if (eraElement) {
      eraElement.textContent = this.formatEraName(technology.era);
    }

    // Update description
    const descElement = document.getElementById('discovery-tech-description');
    if (descElement) {
      descElement.textContent = technology.description;
    }

    // Update unlocks
    const unlocksElement = document.getElementById('discovery-tech-unlocks');
    if (unlocksElement) {
      unlocksElement.innerHTML = '';
      
      const unlocks: string[] = [];
      
      if (technology.unlocks.units?.length) {
        technology.unlocks.units.forEach(unit => {
          const li = document.createElement('li');
          li.textContent = t('templates.techDiscovery.unlockUnit', { name: getUnitDisplayName(unit) });
          unlocksElement.appendChild(li);
        });
      }
      
      if (technology.unlocks.buildings?.length) {
        technology.unlocks.buildings.forEach(building => {
          const li = document.createElement('li');
          li.textContent = t('templates.techDiscovery.unlockBuilding', { name: getBuildingDisplayName(building) });
          unlocksElement.appendChild(li);
        });
      }
      
      if (technology.unlocks.governments?.length) {
        technology.unlocks.governments.forEach(government => {
          const li = document.createElement('li');
          li.textContent = t('templates.techDiscovery.unlockGovernment', { name: getGovernmentDisplayName(government) });
          unlocksElement.appendChild(li);
        });
      }
      
      if (technology.unlocks.improvements?.length) {
        technology.unlocks.improvements.forEach(improvement => {
          const li = document.createElement('li');
          li.textContent = t('templates.techDiscovery.unlockImprovement', { name: getImprovementDisplayName(improvement) });
          unlocksElement.appendChild(li);
        });
      }
      
      if (technology.unlocks.wonders?.length) {
        technology.unlocks.wonders.forEach(wonder => {
          const li = document.createElement('li');
          li.textContent = t('templates.techDiscovery.unlockWonder', { name: getWonderDisplayName(wonder) });
          unlocksElement.appendChild(li);
        });
      }

      // If no unlocks, show a message
      if (unlocksElement.children.length === 0) {
        const li = document.createElement('li');
        li.textContent = t('templates.techDiscovery.unlocksNone');
        li.style.fontStyle = 'italic';
        unlocksElement.appendChild(li);
      }
    }
  }

  /**
   * Move to the next step
   */
  private nextStep(): void {
    console.log('TechnologyDiscoveryModal: nextStep() called, currentStep:', this.currentStep);
    if (!this.step1 || !this.step2) return;

    if (this.currentStep === 1) {
      // Move from step 1 to step 2
      console.log('TechnologyDiscoveryModal: Hiding step 1, showing step 2');
      this.step1.style.display = 'none';
      this.step2.style.display = 'block';
      this.currentStep = 2;
    }
  }

  /**
   * Close the modal and call completion callback
   */
  private close(): void {
    if (!this.modal) return;

    this.modal.style.display = 'none';
    this.modal.classList.remove('active');
    this.currentStep = 1;

    // Call completion callback
    if (this.onComplete) {
      this.onComplete();
      this.onComplete = null;
    }
  }

  /**
   * Format era name for display
   */
  private formatEraName(era: string): string {
    const key = `technologyEra.${era}`;
    const localized = t(key);
    if (localized !== key) return localized;
    return era.charAt(0).toUpperCase() + era.slice(1).replace('_', ' ');
  }

  /**
   * Check if the modal is currently visible
   */
  public isVisible(): boolean {
    return this.modal?.style.display === 'flex' || false;
  }

  /**
   * Programmatically close the modal and fire the completion callback (used by AI dev test mode)
   */
  public forceClose(): void {
    if (this.modal?.style.display === 'flex') {
      this.close();
    }
  }
}
