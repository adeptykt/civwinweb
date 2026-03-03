import { TechnologyType, TechnologyEra } from '../game/TechnologyDefinitions.js';
import type { Technology } from '../game/TechnologyDefinitions.js';
import { getTechnology, canResearch, getResearchCost } from '../game/TechnologyDefinitions.js';
import { TechnologySprites } from './TechnologySprites.js';
import type { Player } from '../types/game.js';
import type { Game } from '../game/Game.js';

/**
 * Manages the technology selection modal interface
 */
export class TechnologySelectionModal {
  private modal: HTMLElement | null = null;
  private technologyList: HTMLElement | null = null;
  private selectedTechnology: TechnologyType | null = null;
  private game: Game | null = null;
  private player: Player | null = null;
  private onTechnologySelected: ((technology: TechnologyType) => void) | null = null;

  constructor() {
    console.log('TechnologySelectionModal: Constructor called');
    this.initializeModal();
  }

  /**
   * Initialize the modal and set up event handlers
   */
  private initializeModal(): void {
    console.log('TechnologySelectionModal: Initializing modal');
    this.modal = document.getElementById('technology-selection-modal');
    this.technologyList = document.getElementById('technology-list');

    console.log('TechnologySelectionModal: Modal element:', this.modal);
    console.log('TechnologySelectionModal: Technology list element:', this.technologyList);

    if (!this.modal || !this.technologyList) {
      console.error('Technology selection modal elements not found');
      console.error('Modal element found:', !!this.modal);
      console.error('Technology list element found:', !!this.technologyList);
      return;
    }

    // Set up event handlers
    const closeBtn = document.getElementById('tech-close');
    const cancelBtn = document.getElementById('tech-cancel');
    const researchBtn = document.getElementById('tech-research');

    closeBtn?.addEventListener('click', () => this.hide());
    cancelBtn?.addEventListener('click', () => this.hide());
    researchBtn?.addEventListener('click', () => this.confirmSelection());

    // Close modal when clicking outside
    this.modal.addEventListener('click', (event) => {
      if (event.target === this.modal) {
        this.hide();
      }
    });

    // Add keyboard handler for Enter/Space to confirm selection and arrow keys for navigation
    document.addEventListener('keydown', (event) => {
      if (this.modal?.style.display === 'flex') {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.confirmSelection();
        }
        else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          this.navigateTechnologies(event.key === 'ArrowUp' ? -1 : 1);
        }
      }
    });
  }

  /**
   * Show the technology selection modal
   */
  public show(game: Game, player: Player, onSelected?: (technology: TechnologyType) => void): void {
    console.log('TechnologySelectionModal: show() called');
    if (!this.modal) {
      console.error('TechnologySelectionModal: No modal element found');
      return;
    }

    this.game = game;
    this.player = player;
    this.onTechnologySelected = onSelected || null;
    this.selectedTechnology = null;

    this.updateCurrentResearch();
    this.updateScienceRate();
    this.loadAvailableTechnologies();
    this.clearTechnologyDetails();

    console.log('TechnologySelectionModal: Setting modal display and active class');
    console.log('TechnologySelectionModal: Modal element before show:', this.modal);
    console.log('TechnologySelectionModal: Modal computed style before:', window.getComputedStyle(this.modal));

    this.modal.style.display = 'flex';
    this.modal.classList.add('active');

    console.log('TechnologySelectionModal: Modal display set to:', this.modal.style.display);
    console.log('TechnologySelectionModal: Modal classes:', this.modal.className);
    console.log('TechnologySelectionModal: Modal computed style after:', window.getComputedStyle(this.modal));
  }

  /**
   * Hide the technology selection modal
   */
  public hide(): void {
    if (!this.modal) return;

    this.modal.style.display = 'none';
    this.modal.classList.remove('active');
    this.selectedTechnology = null;
    this.game = null;
    this.player = null;
    this.onTechnologySelected = null;
  }

  /**
   * Update current research display
   */
  private updateCurrentResearch(): void {
    if (!this.player) return;

    const currentTechElement = document.getElementById('current-tech');
    const progressElement = document.getElementById('research-progress');

    if (currentTechElement && progressElement) {
      if (this.player.currentResearch) {
        // Show current research technology
        const techInfo = getTechnology(this.player.currentResearch);
        currentTechElement.textContent = techInfo.name;
        
        const cityCount = this.game!.getGameState().cities.filter(c => c.playerId === this.player!.id).length;
        const cost = getResearchCost(this.player.currentResearch, this.player.technologies.length, cityCount);
        const needed = Math.max(0, cost - this.player.science);
        progressElement.textContent = `(${this.player.science}/${cost} science points, ${needed} more needed)`;
      } else {
        // No current research
        currentTechElement.textContent = 'None - Choose from available technologies';
        progressElement.textContent = `(${this.player.science} science points available)`;
      }
    }
  }

  /**
   * Update science per turn display
   */
  private updateScienceRate(): void {
    if (!this.player) return;

    const scienceElement = document.getElementById('science-per-turn');
    if (scienceElement) {
      // Calculate science per turn (this would normally come from cities)
      const sciencePerTurn = this.calculateSciencePerTurn();
      scienceElement.textContent = sciencePerTurn.toString();
    }
  }

  /**
   * Calculate science per turn for the player
   */
  private calculateSciencePerTurn(): number {
    if (!this.game || !this.player) return 0;

    // This is a simplified calculation - in a real implementation,
    // this would be calculated from cities and their science output
    return Math.max(1, Math.floor(this.player.science / 10));
  }

  /**
   * Load and display available technologies (limited to 6 random selections)
   */
  private loadAvailableTechnologies(): void {
    if (!this.game || !this.player || !this.technologyList) return;

    const availableTechnologies = this.game.getAvailableTechnologies(this.player.id);
    
    // Limit to exactly 6 random technologies from available ones
    const limitedTechnologies = this.selectRandomTechnologies(availableTechnologies, 6);
    
    console.log(`Displaying ${limitedTechnologies.length} technologies (max 6)`);

    // Clear existing content
    this.technologyList.innerHTML = '';

    // Simply display all technologies in a single list without era grouping
    // to ensure we show exactly the number we selected
    limitedTechnologies.forEach(techType => {
      const technology = getTechnology(techType);
      const techElement = this.createTechnologyElement(technology);
      this.technologyList!.appendChild(techElement);
    });
  }

  /**
   * Select a random subset of technologies from available ones
   */
  private selectRandomTechnologies(technologies: TechnologyType[], maxCount: number): TechnologyType[] {
    if (technologies.length <= maxCount) {
      return [...technologies]; // Return all if we have 6 or fewer
    }

    // Create a copy and shuffle it
    const shuffled = [...technologies];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Return the first maxCount items
    return shuffled.slice(0, maxCount);
  }

  /**
   * Group technologies by their era
   */
  private groupTechnologiesByEra(technologies: TechnologyType[]): Record<TechnologyEra, TechnologyType[]> {
    const grouped: Record<TechnologyEra, TechnologyType[]> = {
      [TechnologyEra.ANCIENT]: [],
      [TechnologyEra.CLASSICAL]: [],
      [TechnologyEra.MEDIEVAL]: [],
      [TechnologyEra.RENAISSANCE]: [],
      [TechnologyEra.INDUSTRIAL]: [],
      [TechnologyEra.MODERN]: [],
      [TechnologyEra.INFORMATION]: []
    };

    technologies.forEach(techType => {
      const technology = getTechnology(techType);
      grouped[technology.era].push(techType);
    });

    return grouped;
  }

  /**
   * Create a technology list item element
   */
  private createTechnologyElement(technology: Technology): HTMLElement {
    const techDiv = document.createElement('div');
    techDiv.className = 'technology-item';
    techDiv.dataset.techType = technology.type;

    const cityCount = this.player ? this.game!.getGameState().cities.filter(c => c.playerId === this.player!.id).length : 0;
    const knownCount = this.player ? this.player.technologies.length : 0;
    const cost = getResearchCost(technology.type, knownCount, cityCount);
    const canAfford = this.player ? this.player.science >= cost : false;

    // Create the icon container
    const iconContainer = document.createElement('div');
    iconContainer.className = 'tech-icon';

    // Try to get cached sprite first (for immediate display)
    const cachedSprite = TechnologySprites.getCachedSprite(technology.type, 32);
    if (cachedSprite) {
      iconContainer.appendChild(cachedSprite);
    } else {
      // Load sprite asynchronously
      TechnologySprites.getTechnologySprite(technology.type, 32).then(sprite => {
        if (sprite) {
          iconContainer.innerHTML = '';
          iconContainer.appendChild(sprite);
        }
      });
    }

    techDiv.innerHTML = `
      <div class="tech-name">${technology.name}</div>
      <div class="tech-cost-display">${cost} research points</div>
      <div class="tech-era-badge">${this.formatEraName(technology.era)}</div>
      ${!canAfford ? '<div class="tech-insufficient">Insufficient Science</div>' : ''}
    `;

    // Insert icon as the first element
    techDiv.insertBefore(iconContainer, techDiv.firstChild);

    if (!canAfford) {
      techDiv.classList.add('insufficient-science');
    }

    techDiv.addEventListener('click', () => {
      this.selectTechnology(technology.type);
    });

    techDiv.addEventListener('dblclick', () => {
      this.selectTechnology(technology.type);
      this.confirmSelection();
    });

    return techDiv;
  }

  /**
   * Select a technology and update the details panel
   */
  private selectTechnology(technologyType: TechnologyType): void {
    // Remove previous selection
    const previousSelected = this.technologyList?.querySelector('.technology-item.selected');
    previousSelected?.classList.remove('selected');

    // Select new technology
    const selectedElement = this.technologyList?.querySelector(`[data-tech-type="${technologyType}"]`);
    selectedElement?.classList.add('selected');

    this.selectedTechnology = technologyType;
    this.updateTechnologyDetails(technologyType);
    this.updateResearchButton();
  }

  /**
   * Navigate between technology options using arrow keys
   */
  private navigateTechnologies(direction: number): void {
    if (!this.technologyList) return;

    const techItems = this.technologyList.querySelectorAll('.technology-item');
    if (techItems.length === 0) return;

    // Find currently selected technology index
    let currentIndex = -1;
    techItems.forEach((item, index) => {
      if (item.classList.contains('selected')) {
        currentIndex = index;
      }
    });

    // If no item is selected, start from the first one
    if (currentIndex === -1) {
      currentIndex = direction > 0 ? -1 : 0;
    }

    // Calculate new index (with wrapping)
    let newIndex = currentIndex + direction;
    if (newIndex < 0) {
      newIndex = techItems.length - 1;
    } else if (newIndex >= techItems.length) {
      newIndex = 0;
    }

    // Select the new technology option
    const newItem = techItems[newIndex] as HTMLElement;
    const techType = newItem.dataset.techType as TechnologyType;
    if (techType) {
      this.selectTechnology(techType);
      
      // Scroll the item into view if it's outside the visible area
      newItem.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }
  }

  /**
   * Update the technology details panel
   */
  private updateTechnologyDetails(technologyType: TechnologyType): void {
    if (!this.player) return;

    const technology = getTechnology(technologyType);
    const cityCount = this.game!.getGameState().cities.filter(c => c.playerId === this.player!.id).length;
    const cost = getResearchCost(technologyType, this.player.technologies.length, cityCount);

    // Update technology name
    const nameElement = document.getElementById('selected-tech-name');
    if (nameElement) {
      nameElement.textContent = technology.name;
    }

    // Update technology icon in details panel
    const iconElement = document.getElementById('selected-tech-icon');
    if (iconElement) {
      // Clear existing icon
      iconElement.innerHTML = '';
      
      // Try to get cached sprite first
      const cachedSprite = TechnologySprites.getCachedSprite(technologyType, 48);
      if (cachedSprite) {
        iconElement.appendChild(cachedSprite);
      } else {
        // Load sprite asynchronously
        TechnologySprites.getTechnologySprite(technologyType, 48).then(sprite => {
          if (sprite) {
            iconElement.innerHTML = '';
            iconElement.appendChild(sprite);
          }
        });
      }
    }

    // Update era
    const eraElement = document.getElementById('selected-tech-era');
    if (eraElement) {
      eraElement.innerHTML = `<strong>Era:</strong> ${this.formatEraName(technology.era)}`;
    }

    // Update cost
    const costElement = document.getElementById('selected-tech-cost');
    if (costElement) {
      const canAfford = this.player.science >= cost;
      costElement.innerHTML = `<strong>Cost:</strong> ${cost} research points ${canAfford ? '✓' : '✗'}`;
      costElement.className = canAfford ? 'tech-cost affordable' : 'tech-cost unaffordable';
    }

    // Update description
    const descElement = document.getElementById('selected-tech-description');
    if (descElement) {
      descElement.innerHTML = `<strong>Description:</strong> ${technology.description}`;
    }

    // Update unlocks
    const unlocksElement = document.getElementById('selected-tech-unlocks');
    if (unlocksElement) {
      const unlocks = this.formatUnlocks(technology);
      unlocksElement.innerHTML = unlocks ? `<strong>Unlocks:</strong> ${unlocks}` : '';
    }

    // Update prerequisites
    const prereqElement = document.getElementById('selected-tech-prerequisites');
    if (prereqElement) {
      const prereqs = this.formatPrerequisites(technology);
      prereqElement.innerHTML = prereqs ? `<strong>Prerequisites:</strong> ${prereqs}` : '<strong>Prerequisites:</strong> None';
    }
  }

  /**
   * Format technology unlocks for display
   */
  private formatUnlocks(technology: Technology): string {
    const unlocks: string[] = [];

    if (technology.unlocks.units?.length) {
      unlocks.push(`Units: ${technology.unlocks.units.join(', ')}`);
    }
    if (technology.unlocks.buildings?.length) {
      unlocks.push(`Buildings: ${technology.unlocks.buildings.join(', ')}`);
    }
    if (technology.unlocks.governments?.length) {
      unlocks.push(`Governments: ${technology.unlocks.governments.join(', ')}`);
    }
    if (technology.unlocks.improvements?.length) {
      unlocks.push(`Improvements: ${technology.unlocks.improvements.join(', ')}`);
    }
    if (technology.unlocks.wonders?.length) {
      unlocks.push(`Wonders: ${technology.unlocks.wonders.join(', ')}`);
    }

    return unlocks.join('; ');
  }

  /**
   * Format technology prerequisites for display
   */
  private formatPrerequisites(technology: Technology): string {
    if (!technology.prerequisites.length) return '';

    return technology.prerequisites
      .map(prereq => getTechnology(prereq).name)
      .join(', ');
  }

  /**
   * Format era name for display
   */
  private formatEraName(era: TechnologyEra): string {
    return era.charAt(0).toUpperCase() + era.slice(1);
  }

  /**
   * Update the research button state
   */
  private updateResearchButton(): void {
    const researchBtn = document.getElementById('tech-research') as HTMLButtonElement;
    if (!researchBtn || !this.selectedTechnology || !this.player) return;

    const cityCount = this.game!.getGameState().cities.filter(c => c.playerId === this.player!.id).length;
    const cost = getResearchCost(this.selectedTechnology, this.player.technologies.length, cityCount);
    const canAfford = this.player.science >= cost;

    researchBtn.disabled = !canAfford;
    researchBtn.textContent = canAfford ? 'Research' : 'Insufficient Science';
  }

  /**
   * Clear technology details panel
   */
  private clearTechnologyDetails(): void {
    const nameElement = document.getElementById('selected-tech-name');
    const eraElement = document.getElementById('selected-tech-era');
    const costElement = document.getElementById('selected-tech-cost');
    const descElement = document.getElementById('selected-tech-description');
    const unlocksElement = document.getElementById('selected-tech-unlocks');
    const prereqElement = document.getElementById('selected-tech-prerequisites');

    if (nameElement) nameElement.textContent = 'Select a technology';
    if (eraElement) eraElement.textContent = '';
    if (costElement) costElement.textContent = '';
    if (descElement) descElement.textContent = '';
    if (unlocksElement) unlocksElement.textContent = '';
    if (prereqElement) prereqElement.textContent = '';

    this.updateResearchButton();
  }

  /**
   * Confirm technology selection
   */
  private confirmSelection(): void {
    if (!this.selectedTechnology || !this.game || !this.player) return;

    const cityCount = this.game!.getGameState().cities.filter(c => c.playerId === this.player!.id).length;
    const cost = getResearchCost(this.selectedTechnology, this.player.technologies.length, cityCount);
    if (this.player.science < cost) return;

    // Call the callback if provided
    if (this.onTechnologySelected) {
      this.onTechnologySelected(this.selectedTechnology);
    }

    this.hide();
  }

  /**
   * Check if the modal is currently visible
   */
  public isVisible(): boolean {
    return this.modal?.style.display === 'flex';
  }

  /**
   * Test function to show modal directly (for debugging)
   */
  public testShow(): void {
    console.log('TechnologySelectionModal: testShow() called');
    if (!this.modal) {
      console.error('TechnologySelectionModal: No modal element for test');
      return;
    }

    console.log('TechnologySelectionModal: Force showing modal for test');
    this.modal.style.display = 'flex';
    this.modal.style.zIndex = '10000';
    this.modal.classList.add('active');
    
    // Add some test content
    const techList = document.getElementById('technology-list');
    if (techList) {
      techList.innerHTML = '<div style="padding: 20px; color: red; font-weight: bold;">TEST MODAL VISIBLE</div>';
    }
  }
}
