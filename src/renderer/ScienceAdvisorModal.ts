import { TechnologyType } from '../game/TechnologyDefinitions.js';
import { getTechnology, canResearch, getResearchCost } from '../game/TechnologyDefinitions.js';
import { TechnologySprites } from './TechnologySprites.js';
import type { Player } from '../types/game.js';
import type { Game } from '../game/Game.js';

/**
 * @description Manages the Science Advisor modal that prompts for technology selection
 */
export class ScienceAdvisorModal {
  private modal: HTMLElement | null = null;
  private technologyList: HTMLElement | null = null;
  private selectedTechnology: TechnologyType | null = null;
  private game: Game | null = null;
  private player: Player | null = null;
  private onTechnologySelected: ((technology: TechnologyType) => void) | null = null;
  private isVisible: boolean = false;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    this.initializeModal();
  }

  /**
   * Initialize the modal and set up event handlers
   */
  private initializeModal(): void {
    console.log('ScienceAdvisorModal: Initializing modal');
    this.modal = document.getElementById('science-advisor-modal');
    this.technologyList = document.getElementById('science-advisor-tech-list');

    console.log('ScienceAdvisorModal: Modal element:', this.modal);
    console.log('ScienceAdvisorModal: Technology list element:', this.technologyList);

    if (!this.modal || !this.technologyList) {
      console.error('Science Advisor modal elements not found');
      console.error('Modal element found:', !!this.modal);
      console.error('Technology list element found:', !!this.technologyList);
      return;
    }

    // Set up event handlers
    const closeBtn = document.getElementById('science-advisor-close');
    const helpBtn = document.getElementById('science-advisor-help');
    const okBtn = document.getElementById('science-advisor-ok');

    closeBtn?.addEventListener('click', () => this.hide());
    helpBtn?.addEventListener('click', () => this.showHelp());
    okBtn?.addEventListener('click', () => this.confirmSelection());

    // Close modal when clicking outside
    this.modal.addEventListener('click', (event) => {
      if (event.target === this.modal) {
        this.hide();
      }
    });

    // Create keyboard handler function that we can add/remove
    this.keydownHandler = (event: KeyboardEvent) => {
      console.log('ScienceAdvisorModal: Keydown event:', event.key, this.isVisible);
      if (!this.isVisible) return;
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
    };


  }

  /**
   * Show the Science Advisor modal
   */
  public show(game: Game, player: Player, onSelected?: (technology: TechnologyType) => void): void {
    console.log('ScienceAdvisorModal: show() called');
    if (!this.modal) {
      console.error('ScienceAdvisorModal: No modal element found');
      return;
    }

    this.game = game;
    this.player = player;
    this.onTechnologySelected = onSelected || null;
    this.selectedTechnology = null;

    const firstTech = this.loadAvailableTechnologies();

    this.isVisible = true;

    console.log('ScienceAdvisorModal: Setting modal display and active class');
    this.modal.style.display = 'flex';
    this.modal.classList.add('active');
    if (firstTech) {
      this.selectedTechnology = firstTech;
    }

    // Add keyboard event listener when modal is shown
    if (this.keydownHandler) {
      document.addEventListener('keydown', this.keydownHandler);
    }
  }

  /**
   * Hide the Science Advisor modal
   */
  public hide(): void {
    if (!this.modal) return;

    // Remove keyboard event listener when modal is hidden
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
    }

    this.modal.style.display = 'none';
    this.modal.classList.remove('active');
    this.selectedTechnology = null;
    this.game = null;
    this.player = null;
    this.onTechnologySelected = null;
    this.isVisible = false;
  }

  /**
   * Load available technologies for selection
   */
  private loadAvailableTechnologies(): TechnologyType | undefined {
    if (!this.game || !this.player || !this.technologyList) return;

    const availableTechs = this.game.getAvailableTechnologies(this.player.id);
    console.log('ScienceAdvisorModal: Available technologies:', availableTechs);

    // Clear existing content
    this.technologyList.innerHTML = '';

    if (availableTechs.length === 0) {
      this.technologyList.innerHTML = '<div class="tech-option">No technologies available to research</div>';
      return;
    }

    // Sort technologies by cost (cheapest first)
    const sortedTechs = availableTechs.sort((a, b) => {
      const costA = getResearchCost(a);
      const costB = getResearchCost(b);
      return costA - costB;
    });
    let firstTech = sortedTechs[0];

    // Create radio button options for each technology
    sortedTechs.forEach(async (techType, index) => {
      const techInfo = getTechnology(techType);

      const techOption = document.createElement('div');
      techOption.className = 'tech-option';

      const radioId = `tech-${techType}`;
      techOption.innerHTML = `
        <input type="radio" id="${radioId}" name="tech-selection" value="${techType}" ${index === 0 ? 'checked' : ''}>
        <span class="tech-symbol">⚬</span>
        <label for="${radioId}">${techInfo.name}</label>
      `;

      // Try to load and add technology sprite
      try {
        const sprite = await TechnologySprites.getTechnologySprite(techType, 24);
        const symbolSpan = techOption.querySelector('.tech-symbol') as HTMLElement;
        if (symbolSpan && sprite) {
          symbolSpan.innerHTML = '';
          symbolSpan.appendChild(sprite);
          symbolSpan.style.display = 'inline-block';
          symbolSpan.style.width = '24px';
          symbolSpan.style.height = '24px';
        }
      } catch (error) {
        console.warn(`Failed to load sprite for ${techType}:`, error);
      }

      // Add click handler
      techOption.addEventListener('click', () => {
        const radio = techOption.querySelector('input[type="radio"]') as HTMLInputElement;
        if (radio) {
          radio.checked = true;
          this.selectedTechnology = techType;
          this.updateOKButton();
        }
      });

      if (this.technologyList) {
        this.technologyList.appendChild(techOption);
      }


    });
    this.updateOKButton();

    return firstTech;
  }

  /**
   * Navigate between technology options using arrow keys
   */
  private navigateTechnologies(direction: number): void {
    if (!this.technologyList) return;

    const techOptions = this.technologyList.querySelectorAll('.tech-option');
    if (techOptions.length === 0) return;

    // Find currently selected technology index
    let currentIndex = -1;
    techOptions.forEach((option, index) => {
      const radio = option.querySelector('input[type="radio"]') as HTMLInputElement;
      if (radio && radio.checked) {
        currentIndex = index;
      }
    });

    // Calculate new index (with wrapping)
    let newIndex = currentIndex + direction;
    if (newIndex < 0) {
      newIndex = techOptions.length - 1;
    } else if (newIndex >= techOptions.length) {
      newIndex = 0;
    }

    // Select the new technology option
    const newOption = techOptions[newIndex];
    const newRadio = newOption.querySelector('input[type="radio"]') as HTMLInputElement;
    if (newRadio) {
      newRadio.checked = true;
      this.selectedTechnology = newRadio.value as TechnologyType;
      this.updateOKButton();

      // Scroll the option into view if it's outside the visible area
      newOption.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }

  /**
   * Update OK button state based on selection
   */
  private updateOKButton(): void {
    const okBtn = document.getElementById('science-advisor-ok') as HTMLButtonElement;
    if (okBtn) {
      okBtn.disabled = !this.selectedTechnology;
    }
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    alert('Select a technology to research. Some technologies may require more science points than others, but you must discover the costs through experimentation!');
  }

  /**
   * Confirm technology selection
   */
  private confirmSelection(): void {
    if (!this.selectedTechnology || !this.onTechnologySelected) return;

    console.log('ScienceAdvisorModal: Confirming selection:', this.selectedTechnology);
    this.onTechnologySelected(this.selectedTechnology);
    this.hide();
  }
}
