import { City, GameState, Player } from '../types/game';
import { Game } from '../game/Game';
import { ProductionManager, ProductionOption } from '../game/ProductionManager';
import { TemplateLoader } from '../utils/TemplateLoader';
import { UNIT_DEFINITIONS } from '../game/UnitDefinitions';
import { getWonderStats } from '../game/WonderDefinitions';
import { WaterAccess } from '../utils/WaterAccess';
import { DebugSystem } from '../utils/DebugSystem';
import { t } from '../i18n/I18nService.js';

export class ProductionSelectionModal {
  private modal: HTMLElement | null = null;
  private productionList: HTMLElement | null = null;
  private militaryAdvice: HTMLElement | null = null;
  private domesticAdvice: HTMLElement | null = null;
  private cityNameElement: HTMLElement | null = null;
  private currentCity: City | null = null;
  private game: Game;
  private availableOptions: ProductionOption[] = [];
  private selectedOption: ProductionOption | null = null;
  private onSelectionCallback: ((option: ProductionOption) => void) | null = null;
  private keyboardHandler: (event: KeyboardEvent) => void = () => {};

  // Drag state
  private isDragging: boolean = false;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  private productionDialog: HTMLElement | null = null;

  constructor(game: Game) {
    this.game = game;
    this.initializeModal();
  }

  private async initializeModal(): Promise<void> {
    try {
      // Load the template
      const template = await TemplateLoader.loadTemplate('/templates/production-selection-modal.html');
      
      // Create modal element
      const modalContainer = document.createElement('div');
      modalContainer.innerHTML = template;
      document.body.appendChild(modalContainer.firstElementChild!);

      // Get DOM elements
      this.modal = document.getElementById('production-selection-modal');
      this.productionDialog = this.modal?.querySelector('.production-dialog') || null;
      this.productionList = document.getElementById('production-options-list');
      this.militaryAdvice = document.getElementById('military-advice');
      this.domesticAdvice = document.getElementById('domestic-advice');
      this.cityNameElement = document.getElementById('production-city-name');
      this.applyStaticTranslations();

      // Make modal focusable
      if (this.modal) {
        this.modal.setAttribute('tabindex', '-1');
      }

      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize production selection modal:', error);
    }
  }

  private setupEventListeners(): void {
    if (!this.modal) return;

    // Button event listeners
    const helpBtn = document.getElementById('production-help-btn');
    const cancelBtn = document.getElementById('production-cancel-btn');
    const okBtn = document.getElementById('production-ok-btn');

    helpBtn?.addEventListener('click', () => this.handleHelp());
    cancelBtn?.addEventListener('click', () => this.handleCancel());
    okBtn?.addEventListener('click', () => this.handleOk());

    // Keyboard event listeners - bind to the modal itself, not document
    this.keyboardHandler = (event: KeyboardEvent) => {
      if (!this.isOpen()) return;
      
      // Stop the event immediately to prevent any other handlers from running
      event.preventDefault();
      event.stopImmediatePropagation();
      
      switch (event.key) {
        case 'Escape':
          this.handleCancel();
          break;
        case 'Enter':
        case ' ': // Spacebar
          this.handleOk();
          break;
        case 'ArrowUp':
          this.selectPreviousOption();
          break;
        case 'ArrowDown':
          this.selectNextOption();
          break;
      }
    };

    // Window resize listener to keep modal in viewport
    window.addEventListener('resize', () => {
      if (this.isOpen()) {
        this.ensureDialogInViewport();
      }
    });

    // Close on clicking outside modal - removed since there's no overlay
    // this.modal.addEventListener('click', (event) => {
    //   if (event.target === this.modal) {
    //     this.handleCancel();
    //   }
    // });

    // Add drag functionality
    this.setupDragFunctionality();
  }

  private applyStaticTranslations(): void {
    if (!this.modal) return;

    const militaryTitle = this.modal.querySelector('.advisor-title.military');
    const domesticTitle = this.modal.querySelector('.advisor-title.domestic');
    const helpBtn = document.getElementById('production-help-btn');
    const cancelBtn = document.getElementById('production-cancel-btn');
    const okBtn = document.getElementById('production-ok-btn');

    if (militaryTitle) {
      militaryTitle.textContent = t('templates.production.militaryAdvisor');
    }
    if (domesticTitle) {
      domesticTitle.textContent = t('templates.production.domesticAdvisor');
    }
    if (helpBtn) {
      helpBtn.textContent = t('templates.production.help');
    }
    if (cancelBtn) {
      cancelBtn.textContent = t('templates.production.cancel');
    }
    if (okBtn) {
      okBtn.textContent = t('templates.production.ok');
    }
    if (this.militaryAdvice) {
      this.militaryAdvice.textContent = t('templates.production.militaryAdviceDefault');
    }
    if (this.domesticAdvice) {
      this.domesticAdvice.textContent = t('templates.production.domesticAdviceDefault');
    }
  }

  private setupDragFunctionality(): void {
    if (!this.productionDialog) return;

    const productionHeader = this.productionDialog.querySelector('.production-header') as HTMLElement;
    if (!productionHeader) return;

    // Add cursor style to indicate draggability
    productionHeader.style.cursor = 'move';
    productionHeader.style.userSelect = 'none'; // Prevent text selection during drag

    // Mouse down on header starts dragging
    productionHeader.addEventListener('mousedown', (event: MouseEvent) => {
      this.isDragging = true;
      const rect = this.productionDialog!.getBoundingClientRect();
      this.dragOffset.x = event.clientX - rect.left;
      this.dragOffset.y = event.clientY - rect.top;

      // Add global mouse move and mouse up listeners
      document.addEventListener('mousemove', this.onDragMove);
      document.addEventListener('mouseup', this.onDragEnd);
      
      event.preventDefault(); // Prevent text selection
    });
  }

  private onDragMove = (event: MouseEvent): void => {
    if (!this.isDragging || !this.productionDialog) return;

    const newX = event.clientX - this.dragOffset.x;
    const newY = event.clientY - this.dragOffset.y;

    // Get current dialog dimensions
    const dialogRect = this.productionDialog.getBoundingClientRect();
    
    // Keep the dialog within the viewport bounds with some padding
    const padding = 20;
    const maxX = window.innerWidth - dialogRect.width - padding;
    const maxY = window.innerHeight - dialogRect.height - padding;
    
    const clampedX = Math.max(padding, Math.min(newX, maxX));
    const clampedY = Math.max(padding, Math.min(newY, maxY));

    this.productionDialog.style.position = 'fixed';
    this.productionDialog.style.left = `${clampedX}px`;
    this.productionDialog.style.top = `${clampedY}px`;
    
    // Update modal positioning to not interfere
    if (this.modal) {
      this.modal.style.transform = 'none';
      this.modal.style.top = '0';
      this.modal.style.left = '0';
    }
  };

  private onDragEnd = (): void => {
    this.isDragging = false;
    
    // Remove global listeners
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
  };

  private resetDialogPosition(): void {
    if (!this.productionDialog || !this.modal) return;
    
    // Reset to centered position
    this.productionDialog.style.position = '';
    this.productionDialog.style.left = '';
    this.productionDialog.style.top = '';
    
    // Reset modal positioning
    this.modal.style.transform = 'translate(-50%, -50%)';
    this.modal.style.top = '50%';
    this.modal.style.left = '50%';
    
    // Ensure the dialog fits within the viewport
    this.ensureDialogInViewport();
  }

  private ensureDialogInViewport(): void {
    if (!this.productionDialog || !this.modal) return;
    
    // Wait for next frame to get accurate dimensions
    requestAnimationFrame(() => {
      const dialogRect = this.productionDialog!.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Check if dialog extends beyond viewport
      const padding = 20;
      let needsRepositioning = false;
      let newX = dialogRect.left;
      let newY = dialogRect.top;
      
      if (dialogRect.right > viewportWidth - padding) {
        newX = viewportWidth - dialogRect.width - padding;
        needsRepositioning = true;
      }
      if (newX < padding) {
        newX = padding;
        needsRepositioning = true;
      }
      
      if (dialogRect.bottom > viewportHeight - padding) {
        newY = viewportHeight - dialogRect.height - padding;
        needsRepositioning = true;
      }
      if (newY < padding) {
        newY = padding;
        needsRepositioning = true;
      }
      
      if (needsRepositioning) {
        this.productionDialog!.style.position = 'fixed';
        this.productionDialog!.style.left = `${newX}px`;
        this.productionDialog!.style.top = `${newY}px`;
        
        if (this.modal) {
          this.modal.style.transform = 'none';
          this.modal.style.top = '0';
          this.modal.style.left = '0';
        }
      }
    });
  }

  public show(city: City, onSelection: (option: ProductionOption) => void): void {
    if (!this.modal) return;

    this.applyStaticTranslations();
    this.currentCity = city;
    this.onSelectionCallback = onSelection;
    this.selectedOption = null;

    // Update city name
    if (this.cityNameElement) {
      this.cityNameElement.textContent = t('templates.production.whatBuild', { city: city.name });
    }

    // Get available production options
    this.updateProductionOptions();

    // Update advisor recommendations
    this.updateAdvisorRecommendations();

    // Reset dialog position to center
    this.resetDialogPosition();

    // Show modal
    this.modal.style.display = 'flex';
    
    // Add keyboard event listener with capture to intercept before other handlers
    document.addEventListener('keydown', this.keyboardHandler, { capture: true });
    
    // Focus the modal to ensure it can receive keyboard events
    this.modal.focus();
  }

  public hide(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
    
    // Remove keyboard event listener when modal closes (with same options as when added)
    document.removeEventListener('keydown', this.keyboardHandler, { capture: true });
    
    this.currentCity = null;
    this.onSelectionCallback = null;
    this.selectedOption = null;
  }

  public isOpen(): boolean {
    return this.modal?.style.display === 'flex';
  }

  private updateProductionOptions(): void {
    if (!this.productionList || !this.currentCity) return;

    // Get game state and player
    const gameState = this.game.getGameState();
    const player = gameState.players.find(p => p.id === this.currentCity!.playerId);
    if (!player) return;

    // Get existing buildings
    const existingBuildings = this.currentCity.buildings.map(b => b.type as any);

    // Get available production options
    this.availableOptions = ProductionManager.getAvailableProduction(
      player.technologies,
      existingBuildings,
      this.calculateProductionCapacity(),
      this.currentCity.production_points,
      this.currentCity,
      this.game.getGameState().worldMap,
      this.game.getGameState() // Add game state for wonder checking
    );

    // Clear existing options
    this.productionList.innerHTML = '';

    // Add each option to the list
    this.availableOptions.forEach((option, index) => {
      const optionElement = this.createProductionOptionElement(option, index);
      this.productionList!.appendChild(optionElement);
    });

    // Select first option by default
    if (this.availableOptions.length > 0) {
      this.selectOption(this.availableOptions[0]);
    }
  }

  private createProductionOptionElement(option: ProductionOption, index: number): HTMLElement {
    const element = document.createElement('div');
    element.className = 'production-option';
    element.dataset.index = index.toString();

    // Add special class for wonders
    if (option.type === 'wonder') {
      element.classList.add('wonder-option');
    }

    // Check if this is the currently producing item
    const isCurrentlyProducing = this.currentCity?.production && 
      this.currentCity.production.type === option.type && 
      this.currentCity.production.item === option.id;
    
    if (isCurrentlyProducing) {
      element.classList.add('currently-producing');
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'production-option-name';
    nameSpan.textContent = option.name;
    
    if (isCurrentlyProducing) {
      nameSpan.textContent += ' 🛠️';
    }

    const detailsSpan = document.createElement('span');
    detailsSpan.className = 'production-option-details';
    
    // Format details based on whether it's a unit, building, or wonder
    if (option.type === 'unit') {
      // Get unit stats for ADM display
      const unitStats = this.getUnitStatsForOption(option.id as any);
      if (unitStats) {
        detailsSpan.textContent = t('templates.production.optionUnitDetails', {
          turns: option.turns,
          adm: t('templates.production.admLabel'),
          attack: unitStats.attack,
          defense: unitStats.defense,
          movement: unitStats.movement,
        });
      } else {
        detailsSpan.textContent = t('templates.production.optionTurns', { turns: option.turns });
      }
    } else if (option.type === 'wonder') {
      // Wonders show turn count and special icon
      detailsSpan.textContent = `${t('templates.production.optionTurns', { turns: option.turns })} ✨`;
    } else {
      // Buildings just show turn count
      detailsSpan.textContent = t('templates.production.optionTurns', { turns: option.turns });
    }

    element.appendChild(nameSpan);
    element.appendChild(detailsSpan);

    // Single click selects; double-click selects and confirms
    element.addEventListener('click', () => {
      this.selectOption(option);
    });

    element.addEventListener('dblclick', () => {
      this.selectOption(option);
      this.handleOk();
    });

    return element;
  }

  private getUnitStatsForOption(unitType: any): any {
    try {
      return UNIT_DEFINITIONS[unitType];
    } catch (error) {
      console.warn('Could not get unit stats for', unitType);
      return null;
    }
  }

  private selectOption(option: ProductionOption): void {
    this.selectedOption = option;

    // Update visual selection
    const allOptions = this.productionList?.querySelectorAll('.production-option');
    allOptions?.forEach(el => el.classList.remove('selected'));

    const selectedIndex = this.availableOptions.indexOf(option);
    const selectedElement = this.productionList?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedElement?.classList.add('selected');
    
    // Scroll selected element into view
    selectedElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  private selectPreviousOption(): void {
    if (this.availableOptions.length === 0) return;
    
    const currentIndex = this.selectedOption ? 
      this.availableOptions.indexOf(this.selectedOption) : 0;
    
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : this.availableOptions.length - 1;
    this.selectOption(this.availableOptions[previousIndex]);
  }

  private selectNextOption(): void {
    if (this.availableOptions.length === 0) return;
    
    const currentIndex = this.selectedOption ? 
      this.availableOptions.indexOf(this.selectedOption) : -1;
    
    const nextIndex = currentIndex < this.availableOptions.length - 1 ? currentIndex + 1 : 0;
    this.selectOption(this.availableOptions[nextIndex]);
  }

  private calculateProductionCapacity(): number {
    if (!this.currentCity) return 1;
    // Query actual current production output per turn
    return Math.max(1, this.game.getCityProductionOutput(this.currentCity.id));
  }

  private updateAdvisorRecommendations(): void {
    if (!this.currentCity || !this.militaryAdvice || !this.domesticAdvice) return;

    // Check water access for naval advice
    const hasWaterAccess = this.game.getGameState().worldMap ? 
      WaterAccess.hasWaterAccess(this.currentCity, this.game.getGameState().worldMap) : false;

    // Find military and domestic recommendations
    const baseMilitaryUnits = ['militia', 'phalanx'];
    const civ2MilitaryUnits = ['warrior', 'archer'];
    
    // Include Civ 2 units only if enhancements are enabled
    const militaryUnits = DebugSystem.getInstance().isCiv2EnhancementsEnabled() 
      ? [...baseMilitaryUnits, ...civ2MilitaryUnits]
      : baseMilitaryUnits;
    
    const militaryOptions = this.availableOptions.filter(opt => 
      opt.type === 'unit' && militaryUnits.includes(opt.id)
    );
    
    const navalOptions = this.availableOptions.filter(opt => 
      opt.type === 'unit' && ['trireme', 'sail', 'frigate', 'ironclad'].includes(opt.id)
    );
    
    const domesticOptions = this.availableOptions.filter(opt => 
      opt.type === 'building' && ['granary', 'temple', 'library'].includes(opt.id)
    );
    
    const wonderOptions = this.availableOptions.filter(opt => opt.type === 'wonder');

    // Set military advice
    if (navalOptions.length > 0 && hasWaterAccess) {
      const recommended = navalOptions[0];
      this.militaryAdvice.textContent = t('templates.production.militaryAdviceNaval', { name: recommended.name });
    } else if (militaryOptions.length > 0) {
      const recommended = militaryOptions[0];
      this.militaryAdvice.textContent = t('templates.production.militaryAdviceDefend', { name: recommended.name });
    } else if (!hasWaterAccess) {
      this.militaryAdvice.textContent = t('templates.production.militaryAdviceNoWater');
    } else {
      this.militaryAdvice.textContent = t('templates.production.militaryAdvicePrepared');
    }

    // Set domestic advice - prioritize wonders if available
    if (wonderOptions.length > 0) {
      const recommended = wonderOptions[0];
      this.domesticAdvice.textContent = t('templates.production.domesticAdviceWonder', { name: recommended.name });
    } else if (domesticOptions.length > 0) {
      const recommended = domesticOptions[0];
      let advice = '';
      if (recommended.id === 'granary') {
        advice = t('templates.production.domesticAdviceGranary');
      } else if (recommended.id === 'temple') {
        advice = t('templates.production.domesticAdviceTemple');
      } else if (recommended.id === 'library') {
        advice = t('templates.production.domesticAdviceLibrary');
      } else {
        advice = t('templates.production.domesticAdviceGeneric', { name: recommended.name });
      }
      this.domesticAdvice.textContent = advice;
    } else {
      // Check if hydro plant is missing due to water access
      const player = this.game.getGameState().players.find(p => p.id === this.currentCity!.playerId);
      if (player && !hasWaterAccess && player.technologies.includes('electronics' as any)) {
        this.domesticAdvice.textContent = t('templates.production.domesticAdviceHydroNoWater');
      } else {
        this.domesticAdvice.textContent = t('templates.production.domesticAdviceInOrder');
      }
    }
  }

  private handleHelp(): void {
    if (this.selectedOption) {
      let helpText = `${this.selectedOption.name}\n\n${t('templates.production.helpCost', { cost: this.selectedOption.cost })}\n${t('templates.production.helpTime', { turns: this.selectedOption.turns })}\n\n`;
      
      if (this.selectedOption.type === 'wonder') {
        // Special help text for wonders
        helpText += `${t('templates.production.helpWonderIntro')}\n\n`;
        
        // Add wonder effects if available from our definitions
        const wonderStats = getWonderStats(this.selectedOption.id);
        if (wonderStats && wonderStats.effects) {
          helpText += `${t('templates.production.helpEffectsHeading')}\n${wonderStats.effects.map(effect => `• ${effect}`).join('\n')}\n\n`;
        }
      }
      
      helpText += this.selectedOption.description || t('templates.production.helpNoAdditionalInfo');
      
      alert(helpText);
    } else {
      alert(t('templates.production.helpSelectOptionFirst'));
    }
  }

  private handleCancel(): void {
    this.hide();
  }

  private handleOk(): void {
    if (this.selectedOption && this.onSelectionCallback) {
      this.onSelectionCallback(this.selectedOption);
    }
    this.hide();
  }
}
