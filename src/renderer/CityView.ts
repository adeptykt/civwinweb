import { City, GameState } from '../types/game';
import { pickResourceEmoji } from '../constants/resource-emoji';
import { Game } from '../game/Game';
import { getCivilization } from '../game/CivilizationDefinitions';
import { ProductionManager } from '../game/ProductionManager';
import { ProductionSelectionModal } from './ProductionSelectionModal';
import { UNIT_DEFINITIONS } from '../game/UnitDefinitions';
import { getBuildingStats } from '../game/BuildingDefinitions';
import { getWonderStats } from '../game/WonderDefinitions';
import { TerrainManager } from '../terrain/index';
import { CityGrowthSystem } from '../game/CityGrowthSystem';
import { getCityPopulationDisplay } from '../utils/CityPopulationDisplay';
import { getWonderDisplayName, getUnitDisplayName, getBuildingDisplayName, getTerrainDisplayName, getImprovementDisplayName } from '../utils/DisplayNames';
import { TaxSystem } from '../game/TaxSystem';
import { UnitSprites } from './UnitSprites';
import { applyResourceBonuses } from '../game/ResourceBonuses';
import { t } from '../i18n/I18nService.js';

// Enhanced resource calculation interface
interface CityResources {
  food: number;
  foodSurplus: number;
  production: number;
  productionSurplus: number;
  trade: number;       // raw trade from tiles (TaxSystem.rawTrade)
  corruption: number;  // trade lost to corruption
  luxuries: number;    // final luxury output (after rates + building bonuses + specialists)
  tax: number;         // final gold output
  science: number;     // final science output
}

export class CityView {
  private cityModal: HTMLElement;
  private cityDialog: HTMLElement;
  private cityNameTitle: HTMLElement;
  private cityPopulationTitle: HTMLElement;
  private cityFood: HTMLElement;
  private cityProduction: HTMLElement;
  private cityTrade: HTMLElement;
  private cityScience: HTMLElement;
  private cityLuxuries: HTMLElement;
  private cityTax: HTMLElement;
  private cityCorruption: HTMLElement | null = null;
  private foodSurplus: HTMLElement;
  private productionSurplus: HTMLElement;
  private foodStorageUnits: HTMLElement;
  private foodStorageCurrent: HTMLElement;
  private foodStorageCapacity: HTMLElement;
  private populationDetails: HTMLElement;
  private currentProduction: HTMLElement;
  private productionTurns: HTMLElement;
  private productionQueueList: HTMLElement | null = null;
  private buildingsList: HTMLElement;
  private unitsList: HTMLElement;
  private cityMapCanvas: HTMLCanvasElement;
  private cityMapContext: CanvasRenderingContext2D;
  private tilePopover: HTMLElement;
  private game: Game;
  private currentCity: City | null = null;
  private productionModal: ProductionSelectionModal;

  // Drag state
  private isDragging: boolean = false;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };

  private keydownHandler: (event: KeyboardEvent) => void;

  constructor(game: Game) {
    this.game = game;
    this.productionModal = new ProductionSelectionModal(game);
    
    // Bind the keydown handler so we can remove it later
    this.keydownHandler = (event: KeyboardEvent) => this.handleKeydown(event);
    
    // Get DOM elements
    this.cityModal = document.getElementById('city-modal')!;
    this.cityDialog = this.cityModal.querySelector('.city-dialog')!;
    this.cityNameTitle = document.getElementById('city-name-title')!;
    this.cityPopulationTitle = document.getElementById('city-population-title')!;
    this.cityFood = document.getElementById('city-food')!;
    this.cityProduction = document.getElementById('city-production')!;
    this.cityTrade = document.getElementById('city-trade')!;
    this.cityScience = document.getElementById('city-science')!;
    this.cityLuxuries = document.getElementById('city-luxuries')!;
    this.cityTax = document.getElementById('city-tax')!;
    this.cityCorruption = document.getElementById('city-corruption');
    this.foodSurplus = document.getElementById('food-surplus')!;
    this.productionSurplus = document.getElementById('production-surplus')!;
    this.foodStorageUnits = document.getElementById('food-storage-units')!;
    this.foodStorageCurrent = document.getElementById('food-storage-current')!;
    this.foodStorageCapacity = document.getElementById('food-storage-capacity')!;;
    this.populationDetails = document.getElementById('population-details')!;
    this.currentProduction = document.getElementById('current-production')!;
    this.productionTurns = document.getElementById('production-turns')!;
    this.productionQueueList = document.getElementById('production-queue-list');
    this.buildingsList = document.getElementById('buildings-list')!;
    this.unitsList = document.getElementById('units-list')!;
    this.cityMapCanvas = document.getElementById('city-map-canvas') as HTMLCanvasElement;
    this.cityMapContext = this.cityMapCanvas.getContext('2d')!;

    // Create tile hover popover (appended to body so it escapes any overflow:hidden containers)
    this.tilePopover = document.createElement('div');
    this.tilePopover.id = 'city-tile-popover';
    this.tilePopover.style.display = 'none';
    document.body.appendChild(this.tilePopover);

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Close button
    const closeButton = document.getElementById('city-close')!;
    closeButton.addEventListener('click', () => this.close());

    // OK button
    const okButton = document.getElementById('city-ok')!;
    okButton.addEventListener('click', () => this.close());

    // Exit button (Civ 1 style centre button)
    const exitButton = document.getElementById('city-exit')!;
    exitButton.addEventListener('click', () => this.close());

    // Rename button
    const renameButton = document.getElementById('city-rename')!;
    renameButton.addEventListener('click', () => this.handleRename());

    // Buy button
    const buyButton = document.getElementById('city-buy')!;
    buyButton.addEventListener('click', () => this.handleBuy());

    // Change production button
    const changeProductionButton = document.getElementById('change-production')!;
    changeProductionButton.addEventListener('click', () => this.handleChangeProduction());

    // Make current production box clickable
    this.currentProduction.addEventListener('click', () => this.handleChangeProduction());
    this.currentProduction.style.cursor = 'pointer';

    // Add-to-queue and auto-fill toggle buttons
    const addToQueueBtn = document.getElementById('add-to-queue');
    addToQueueBtn?.addEventListener('click', () => this.handleAddToQueue());
    const autoFillBtn = document.getElementById('auto-fill-queue');
    autoFillBtn?.addEventListener('click', () => this.handleToggleAutoFill());

    // Add click handler for city map
    this.cityMapCanvas.addEventListener('click', (event) => this.handleCityMapClick(event));
    this.cityMapCanvas.addEventListener('dblclick', (event) => this.handleCityMapDoubleClick(event));
    this.cityMapCanvas.addEventListener('mousemove', (event) => this.handleCityMapMouseMove(event));
    this.cityMapCanvas.addEventListener('mouseleave', () => { this.tilePopover.style.display = 'none'; });
    this.cityMapCanvas.style.cursor = 'pointer';

    // Close on overlay click
    this.cityModal.addEventListener('click', (event) => {
      if (event.target === this.cityModal) {
        this.close();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen()) {
        // Check if production modal is open first
        const productionModal = document.getElementById('production-selection-modal');
        if (productionModal && productionModal.style.display === 'flex') {
          return; // Let production modal handle it
        }
        this.close();
      }
      // Handle Enter/Space to close (OK button)
      if ((event.key === 'Enter' || event.key === ' ') && this.isOpen()) {
        // Check if production modal is open first
        const productionModal = document.getElementById('production-selection-modal');
        if (productionModal && productionModal.style.display === 'flex') {
          return; // Let production modal handle it
        }
        event.preventDefault();
        this.close();
      }
    });

    // Add keyboard shortcuts for tile management
    document.addEventListener('keydown', this.keydownHandler);

    // Add drag functionality to city header
    this.setupDragFunctionality();
  }

  private setupDragFunctionality(): void {
    const cityHeader = this.cityDialog.querySelector('.city-header') as HTMLElement;
    if (!cityHeader) return;

    // Add cursor style to indicate draggability
    cityHeader.style.cursor = 'move';
    cityHeader.style.userSelect = 'none'; // Prevent text selection during drag

    // Mouse down on header starts dragging
    cityHeader.addEventListener('mousedown', (event: MouseEvent) => {
      this.isDragging = true;
      const rect = this.cityDialog.getBoundingClientRect();
      this.dragOffset.x = event.clientX - rect.left;
      this.dragOffset.y = event.clientY - rect.top;

      // Add global mouse move and mouse up listeners
      document.addEventListener('mousemove', this.onDragMove);
      document.addEventListener('mouseup', this.onDragEnd);
      
      event.preventDefault(); // Prevent text selection
    });
  }

  private onDragMove = (event: MouseEvent): void => {
    if (!this.isDragging) return;

    const newX = event.clientX - this.dragOffset.x;
    const newY = event.clientY - this.dragOffset.y;

    // Keep the dialog within the viewport bounds
    const maxX = window.innerWidth - this.cityDialog.offsetWidth;
    const maxY = window.innerHeight - this.cityDialog.offsetHeight;
    
    const clampedX = Math.max(0, Math.min(newX, maxX));
    const clampedY = Math.max(0, Math.min(newY, maxY));

    this.cityDialog.style.position = 'fixed';
    this.cityDialog.style.left = `${clampedX}px`;
    this.cityDialog.style.top = `${clampedY}px`;
    this.cityDialog.style.margin = '0'; // Remove any default centering margin
  };

  private onDragEnd = (): void => {
    this.isDragging = false;
    
    // Remove global listeners
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
  };

  public open(city: City): void {
    this.currentCity = city;
    
    // Reset dialog position to center
    this.resetDialogPosition();
    
    this.updateCityInformation();
    
    // Auto-select optimal tiles if needed
    this.autoSelectOptimalTiles();
    
    this.renderCityMap();
    this.cityModal.style.display = 'flex';
  }

  private resetDialogPosition(): void {
    // Reset to centered position
    this.cityDialog.style.position = '';
    this.cityDialog.style.left = '';
    this.cityDialog.style.top = '';
    this.cityDialog.style.margin = '';
  }

  public close(): void {
    this.cityModal.style.display = 'none';
    this.currentCity = null;
    // Clean up keyboard event listener
    document.removeEventListener('keydown', this.keydownHandler);
  }

  public isOpen(): boolean {
    return this.cityModal.style.display === 'flex';
  }

  /** Re-apply all city dialog strings when language changes while open. */
  public refreshI18nIfOpen(): void {
    if (!this.isOpen() || !this.currentCity) return;
    this.updateCityInformation();
    this.renderCityMap();
  }

  private updateCityInformation(): void {
    if (!this.currentCity || !this.game) return;

    const gameState = this.game.getGameState();
    
    // Apply civilization-specific background
    this.applyCivilizationBackground();

    // Update city name and population in title
    this.cityNameTitle.textContent = this.currentCity.name;
    this.cityPopulationTitle.textContent = t('templates.cityModal.popAbbrev', {
      n: getCityPopulationDisplay(this.currentCity.population),
    });

    // Update population icons at top
    this.updatePopulationIcons();
    
    // Calculate detailed city output
    const resources = this.calculateDetailedCityResources();
    
    // Update resource displays with icons and surplus/deficit indicators
    this.updateResourceDisplay(resources);
    
    // Update population breakdown
    this.updatePopulationBreakdown();
    
    // Update trade breakdown
    this.updateTradeBreakdown(resources);

    // Update current production
    if (this.currentCity.production) {
      // Get production cost for calculating progress
      let totalCost = 0;
      let productionName = this.currentCity.production.item as string;
      
      if (this.currentCity.production.type === 'unit') {
        // Get unit stats to determine cost
        const unitStats = this.getUnitStatsForProduction(this.currentCity.production.item as any);
        if (unitStats) {
          totalCost = unitStats.productionCost;
          productionName = getUnitDisplayName(this.currentCity.production.item as string);
        }
      } else if (this.currentCity.production.type === 'building') {
        // Get building stats to determine cost
        const buildingStats = this.getBuildingStatsForProduction(this.currentCity.production.item as any);
        if (buildingStats) {
          totalCost = buildingStats.productionCost;
          productionName = buildingStats.name;
        }
      } else if (this.currentCity.production.type === 'wonder') {
        // Get wonder stats to determine cost and display name
        const wonderStats = getWonderStats(this.currentCity.production.item as string);
        if (wonderStats) {
          totalCost = wonderStats.productionCost;
          productionName = wonderStats.name;
        }
      }
      
      // Show production name + turns remaining
      const accumulatedShields = this.currentCity.production_points || 0;
      this.currentProduction.textContent = productionName;
      this.productionTurns.textContent =
        totalCost > 0
          ? t('templates.cityModal.turnsRemaining', { n: this.currentCity.production.turnsRemaining })
          : t('templates.cityModal.turnsPending');
      this.buildShieldBar(accumulatedShields, totalCost);
    } else {
      this.currentProduction.textContent = t('templates.cityModal.nothing');
      this.productionTurns.textContent = t('templates.cityModal.turnsPending');
      this.buildShieldBar(0, 0);
    }

    // Update buildings list
    this.updateBuildingsList();

    // Update units list
    this.updateUnitsList(gameState);

    // Update production queue
    this.updateProductionQueue();
  }

  private applyCivilizationBackground(): void {
    if (!this.currentCity) return;

    const gameState = this.game.getGameState();
    const player = gameState.players.find(p => p.id === this.currentCity!.playerId);
    if (!player) return;

    // Get civilization information
    const civilization = getCivilization(player.civilizationType);
    
    // Remove all existing background classes
    this.cityDialog.className = this.cityDialog.className.replace(/\b\w+-bg\b/g, '');
    
    // Add civilization-specific background class
    const civName = civilization.name.toLowerCase().replace(/\s+/g, '');
    this.cityDialog.classList.add(`${civName}-bg`);
  }

  private calculateDetailedCityResources(): CityResources {
    if (!this.currentCity) {
      return {
        food: 0, foodSurplus: 0, production: 0, productionSurplus: 0,
        trade: 0, corruption: 0, luxuries: 0, tax: 0, science: 0
      };
    }

    // Calculate resources from worked tiles
    const workedTileYields = this.calculateWorkedTileYields();
    
    // Total yields from all worked tiles
    const totalFood = workedTileYields.food;
    // ALWAYS pull production from the single source-of-truth TurnManager (incl. factories)
    const totalProduction = this.game.getCityProductionOutput(this.currentCity.id);
    const totalTrade = workedTileYields.trade;
    
    // Food calculation
    const foodConsumption = this.currentCity.population * 2; // Each citizen eats 2 food
    const foodSurplus = totalFood - foodConsumption;

    // Production (no consumption for now - all goes to surplus)
    const productionSurplus = totalProduction;

    // Trade breakdown - use TaxSystem as the single source of truth for ALL trade numbers.
    // bd.rawTrade = trade arrows produced by worked tiles (matches what TaxSystem splits).
    // bd.corruption = arrows lost to corruption before the split.
    // bd.totalGold/Luxury/Science = final outputs after rates + building bonuses + specialists.
    const gameState = this.game.getGameState();
    const player = gameState.players.find(p => p.id === this.currentCity!.playerId);
    let trade = totalTrade; // fallback: raw tile sum
    let corruption = 0;
    let luxuries = 0;
    let tax = 0;
    let science = 0;

    if (player) {
      const bd = TaxSystem.calculateCityTaxBreakdown(this.currentCity, player, gameState);
      trade = bd.rawTrade;       // use TaxSystem's value so the header matches the split
      corruption = bd.corruption;
      tax = bd.totalGold;
      luxuries = bd.totalLuxury;
      science = bd.totalScience;
    } else {
      // Fallback if player not found
      luxuries = Math.floor(totalTrade * 0.2);
      tax = Math.floor(totalTrade * 0.4);
      science = totalTrade - luxuries - tax;
    }

    return {
      food: totalFood,
      foodSurplus,
      production: totalProduction,
      productionSurplus,
      trade,
      corruption,
      luxuries,
      tax,
      science
    };
  }

  /**
   * Calculate total yields from all currently worked tiles
   */
  private calculateWorkedTileYields(): { food: number; production: number; trade: number } {
    if (!this.currentCity) {
      return { food: 0, production: 0, trade: 0 };
    }

    let totalFood = 0;
    let totalProduction = 0;
    let totalTrade = 0;

    // Always include city center yields
    const cityCenterYields = this.getCityCenterYields();
    totalFood += cityCenterYields.food;
    totalProduction += cityCenterYields.production;
    totalTrade += cityCenterYields.trade;

    // Add yields from worked tiles
    const workedTiles = this.getWorkedTilesList();
    for (const { dx, dy } of workedTiles) {
      const tileYields = this.getTileYieldsAt(dx, dy);
      if (tileYields) {
        totalFood += tileYields.food;
        totalProduction += tileYields.production;
        totalTrade += tileYields.trade;
      }
    }

    return { food: totalFood, production: totalProduction, trade: totalTrade };
  }

  /**
   * Get the list of currently worked tiles (excluding city center)
   */
  private getWorkedTilesList(): Array<{ dx: number; dy: number }> {
    if (!this.currentCity) return [];

    // If city has manual tile selection, use only those
    if (this.currentCity.workedTiles && this.currentCity.workedTiles.length > 0) {
      return this.currentCity.workedTiles;
    }

    // Otherwise, use automatic optimal tile selection
    const optimalTiles = this.getOptimalWorkedTiles();
    return optimalTiles.map(tile => ({ dx: tile.dx, dy: tile.dy }));
  }

  /**
   * Get yields for city center tile
   */
  private getCityCenterYields(): { food: number; production: number; trade: number } {
    if (!this.currentCity) {
      return { food: 0, production: 0, trade: 0 };
    }

    const gameState = this.game.getGameState();
    const cityTile = gameState.worldMap[this.currentCity.position.y][this.currentCity.position.x];
    const baseYields = this.getTerrainYields(cityTile);
    
    // City center gets minimum yields
    return {
      food: Math.max(2, baseYields.food),
      production: Math.max(1, baseYields.production),
      trade: Math.max(1, baseYields.trade)
    };
  }

  /**
   * Get yields for a tile at relative position from city center
   */
  private getTileYieldsAt(dx: number, dy: number): { food: number; production: number; trade: number } | null {
    if (!this.currentCity) return null;

    const tileX = this.currentCity.position.x + dx;
    const tileY = this.currentCity.position.y + dy;
    const gameState = this.game.getGameState();
    
    // Check bounds
    if (tileY < 0 || tileY >= gameState.worldMap.length) {
      return null;
    }
    
    // Handle world wrapping for X coordinate
    const normalizedX = tileX < 0 ? 
      tileX + gameState.worldMap[0].length : 
      tileX % gameState.worldMap[0].length;
    
    const tile = gameState.worldMap[tileY][normalizedX];
    return this.getTerrainYields(tile);
  }

  /**
   * Render a row of shield icons showing production progress, matching the
   * Civ-1 visual: filled red shields up to accumulated count, empty grey
   * shields for the remaining cost.
   */
  private buildShieldBar(accumulated: number, totalCost: number): void {
    const bar = document.getElementById('shield-bar');
    const text = document.getElementById('shield-bar-text');
    const container = document.getElementById('shield-bar-container');
    if (!bar || !text || !container) return;

    bar.innerHTML = '';

    if (totalCost <= 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = '';

    const filled = Math.min(accumulated, totalCost);
    const SHIELD = '🛡';
    const SHIELD_EMPTY = '🛡';
    const ICONS_PER_ROW = 20; // max before wrapping (CSS flex-wrap handles it)
    const displayTotal = Math.min(totalCost, ICONS_PER_ROW * 4); // cap at 80 icons

    for (let i = 0; i < displayTotal; i++) {
      const span = document.createElement('span');
      span.className = 'shield-icon ' + (i < filled ? 'filled' : 'empty');
      span.textContent = i < filled ? SHIELD : SHIELD_EMPTY;
      bar.appendChild(span);
    }

    text.textContent = t('templates.cityModal.shieldsProgress', { acc: accumulated, total: totalCost });
  }

  private updateResourceDisplay(resources: CityResources): void {
    // Update food display
    this.cityFood.textContent = resources.food.toString();
    if (this.foodSurplus) {
      this.updateSurplusDisplay(this.foodSurplus, resources.foodSurplus);
    }

    // Update food storage display
    this.updateFoodStorageDisplay();

    // Update production display
    this.cityProduction.textContent = resources.production.toString();
    if (this.productionSurplus) {
      this.updateSurplusDisplay(this.productionSurplus, resources.productionSurplus);
    }

    // Update trade display
    this.cityTrade.textContent = resources.trade.toString();

    // Dynamically update the turns remaining estimate when resources change
    if (this.currentCity?.production && resources.production > 0) {
      let totalCost = 0;
      if (this.currentCity.production.type === 'unit') {
        const unitStats = this.getUnitStatsForProduction(this.currentCity.production.item);
        if (unitStats) totalCost = unitStats.productionCost;
      } else if (this.currentCity.production.type === 'building') {
        const buildingStats = this.getBuildingStatsForProduction(this.currentCity.production.item);
        if (buildingStats) totalCost = buildingStats.productionCost;
      } else if (this.currentCity.production.type === 'wonder') {
        const wonderStats = getWonderStats(this.currentCity.production.item as string);
        if (wonderStats) totalCost = wonderStats.productionCost;
      }

      if (totalCost > 0) {
        const remaining = Math.max(0, totalCost - (this.currentCity.production_points || 0));
        const estimatedTurns = Math.max(1, Math.ceil(remaining / resources.production));
        
        // Update the cached value so other dialogue parts use it
        this.currentCity.production.turnsRemaining = estimatedTurns;
        this.productionTurns.textContent = t('templates.cityModal.turnsRemaining', { n: estimatedTurns });
      }
    } else if (this.currentCity?.production && resources.production <= 0) {
      this.currentCity.production.turnsRemaining = 999;
      this.productionTurns.textContent = t('templates.cityModal.turnsStalled');
    }
  }

  private updateSurplusDisplay(element: HTMLElement, surplus: number): void {
    element.textContent = surplus > 0 ? `+${surplus}` : surplus < 0 ? surplus.toString() : '0';
    element.className = 'resource-surplus ' + 
      (surplus > 0 ? 'positive' : surplus < 0 ? 'negative' : 'neutral');
  }

  private updateFoodStorageDisplay(): void {
    if (!this.currentCity) return;

    // Initialize food storage if not already done
    if (this.currentCity.foodStorageCapacity === undefined) {
      CityGrowthSystem.initializeCityFoodStorage(this.currentCity);
    }

    // Update food storage numbers
    this.foodStorageCurrent.textContent = this.currentCity.foodStorage.toString();
    this.foodStorageCapacity.textContent = this.currentCity.foodStorageCapacity.toString();

    // Show / hide the growth-blocked warning
    let warningEl = document.getElementById('food-storage-warning');
    const growthBlocked = !CityGrowthSystem.canCityGrow(this.currentCity);
    if (growthBlocked) {
      if (!warningEl) {
        warningEl = document.createElement('div');
        warningEl.id = 'food-storage-warning';
        warningEl.style.cssText = 'color:#ff9900;font-size:11px;margin-top:3px;font-style:italic;';
        this.foodStorageCapacity.closest('.food-storage-container')?.after(warningEl);
      }
      const hasAqueduct = this.currentCity.buildings.some(b => b.type === 'aqueduct');
      warningEl.textContent = hasAqueduct
        ? t('templates.cityModal.growthNeedsSewer')
        : t('templates.cityModal.growthNeedsAqueduct');
    } else if (warningEl) {
      warningEl.textContent = '';
    }

    // Clear and rebuild food storage units display
    this.foodStorageUnits.innerHTML = '';
    
    // Calculate how many units to show per row to fit nicely
    const unitsPerRow = Math.min(10, this.currentCity.foodStorageCapacity); // Max 10 per row
    const totalRows = Math.ceil(this.currentCity.foodStorageCapacity / unitsPerRow);
    
    for (let row = 0; row < totalRows; row++) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'food-storage-row';
      
      const startIndex = row * unitsPerRow;
      const endIndex = Math.min(startIndex + unitsPerRow, this.currentCity.foodStorageCapacity);
      
      for (let i = startIndex; i < endIndex; i++) {
        const unitDiv = document.createElement('span');
        unitDiv.className = 'food-unit';
        
        if (i < this.currentCity.foodStorage) {
          // Filled unit
          unitDiv.textContent = '🌾';
          unitDiv.classList.add('filled');
        } else {
          // Empty unit
          unitDiv.textContent = '⬜';
          unitDiv.classList.add('empty');
        }
        
        rowDiv.appendChild(unitDiv);
      }
      
      this.foodStorageUnits.appendChild(rowDiv);
    }
  }

  private updatePopulationBreakdown(): void {
    if (!this.currentCity || !this.populationDetails) return;

    // Clear existing population units
    this.populationDetails.innerHTML = '';

    // Create population units (simplified - all workers for now)
    const unitsContainer = document.createElement('div');
    unitsContainer.className = 'population-units';
    
    for (let i = 0; i < this.currentCity.population; i++) {
      const popUnit = document.createElement('div');
      popUnit.className = 'population-unit worker';
      popUnit.textContent = '👷';
      popUnit.title = t('templates.cityModal.workerTitle', { n: i + 1 });
      unitsContainer.appendChild(popUnit);
    }
    
    this.populationDetails.appendChild(unitsContainer);
  }

  private updateTradeBreakdown(resources: CityResources): void {
    if (this.cityLuxuries) {
      this.cityLuxuries.textContent = resources.luxuries.toString();
    }
    if (this.cityTax) {
      this.cityTax.textContent = resources.tax.toString();
    }
    if (this.cityScience) {
      this.cityScience.textContent = resources.science.toString();
    }
    // Show corruption row only when there is actual corruption
    const corruptionRow = document.getElementById('trade-corruption-row');
    if (corruptionRow) {
      corruptionRow.style.display = resources.corruption > 0 ? '' : 'none';
    }
    if (this.cityCorruption) {
      this.cityCorruption.textContent = `-${resources.corruption}`;
    }
  }

  private updateBuildingsList(): void {
    if (!this.currentCity!.buildings || this.currentCity!.buildings.length === 0) {
      this.buildingsList.innerHTML = `<div class="building-item">${t('templates.cityModal.noneBuilt')}</div>`;
      return;
    }

    this.buildingsList.innerHTML = '';
    
    // Separate wonders from regular buildings
    const wonders: any[] = [];
    const buildings: any[] = [];
    
    this.currentCity!.buildings.forEach(building => {
      if (building.type.startsWith('wonder_')) {
        wonders.push(building);
      } else {
        buildings.push(building);
      }
    });
    
    // Add wonders first
    wonders.forEach(wonder => {
      const buildingItem = document.createElement('div');
      buildingItem.className = 'building-item wonder-item';
      
      // Extract wonder ID by removing 'wonder_' prefix
      const wonderId = wonder.type.replace('wonder_', '');
      const wonderStats = getWonderStats(wonderId);
      
      if (wonderStats) {
        // Create sprite image element for wonder
        const spriteImg = document.createElement('img');
        spriteImg.src = wonderStats.spritePath || '/src/assets/tinywonders/default.png';
        spriteImg.alt = getWonderDisplayName(wonderId);
        spriteImg.className = 'building-sprite wonder-sprite';
        spriteImg.style.width = '16px';
        spriteImg.style.height = '16px';
        spriteImg.style.marginRight = '6px';
        spriteImg.style.verticalAlign = 'middle';
        
        // Add error handling for missing images
        spriteImg.onerror = () => {
          // If the specific wonder sprite fails to load, use a generic wonder icon
          spriteImg.style.display = 'none';
          const iconSpan = document.createElement('span');
          iconSpan.textContent = '✨';
          iconSpan.style.marginRight = '6px';
          iconSpan.style.fontSize = '14px';
          iconSpan.style.verticalAlign = 'middle';
          spriteImg.parentNode?.insertBefore(iconSpan, spriteImg);
        };
        
        // Create text span for wonder name with special styling
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `✨ ${getWonderDisplayName(wonderId)}`;
        nameSpan.style.verticalAlign = 'middle';
        nameSpan.style.color = '#FFD700'; // Gold color for wonders
        nameSpan.style.fontWeight = 'bold';
        
        // Add both sprite and name to the building item
        buildingItem.appendChild(spriteImg);
        buildingItem.appendChild(nameSpan);
      } else {
        // Fallback if wonder definition not found
        const displayName = getWonderDisplayName(wonderId);
        
        // Create text span for wonder name with special styling
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `✨ ${displayName}`;
        nameSpan.style.verticalAlign = 'middle';
        nameSpan.style.color = '#FFD700';
        nameSpan.style.fontWeight = 'bold';
        buildingItem.appendChild(nameSpan);
      }
      
      this.buildingsList.appendChild(buildingItem);
    });
    
    // Add regular buildings after wonders
    buildings.forEach(building => {
      const buildingItem = document.createElement('div');
      buildingItem.className = 'building-item';
      
      // Get building stats to access name and sprite path
      const buildingStats = getBuildingStats(building.type);
      if (buildingStats) {
        // Create sprite image element
        const spriteImg = document.createElement('img');
        spriteImg.src = buildingStats.spritePath;
        spriteImg.alt = getBuildingDisplayName(building.type);
        spriteImg.className = 'building-sprite';
        spriteImg.style.width = '16px';
        spriteImg.style.height = '16px';
        spriteImg.style.marginRight = '6px';
        spriteImg.style.verticalAlign = 'middle';
        
        // Create text span for building name
        const nameSpan = document.createElement('span');
        nameSpan.textContent = getBuildingDisplayName(building.type);
        nameSpan.style.verticalAlign = 'middle';
        
        // Add both sprite and name to the building item
        buildingItem.appendChild(spriteImg);
        buildingItem.appendChild(nameSpan);
      } else {
        // Fallback if building definition not found
        buildingItem.textContent = getBuildingDisplayName(building.type);
      }
      
      this.buildingsList.appendChild(buildingItem);
    });
  }

  private async updateUnitsList(gameState: GameState): Promise<void> {
    // Find units in the city
    const unitsInCity = gameState.units.filter(unit => 
      unit.position.x === this.currentCity!.position.x && 
      unit.position.y === this.currentCity!.position.y &&
      unit.playerId === this.currentCity!.playerId
    );

    if (unitsInCity.length === 0) {
      this.unitsList.innerHTML = `<div class="unit-item-empty">${t('templates.cityModal.noUnits')}</div>`;
      return;
    }

    this.unitsList.innerHTML = '';
    const tileSize = 32;

    for (const unit of unitsInCity) {
      const player = gameState.players.find(p => p.id === unit.playerId);
      const playerColor = player?.color || '#FFFFFF';

      const wrapper = document.createElement('div');
      wrapper.className = 'unit-sprite-item';
      wrapper.title =
        getUnitDisplayName(unit.type) +
        (unit.isVeteran ? t('templates.cityModal.unitVeteranSuffix') : '') +
        (unit.fortified ? t('templates.cityModal.unitFortifiedSuffix') : '');

      const canvas = document.createElement('canvas');
      canvas.width = tileSize;
      canvas.height = tileSize;

      const drawSprite = (sprite: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, tileSize, tileSize);
        ctx.drawImage(sprite, 0, 0, tileSize, tileSize);
        drawOverlays(ctx);
      };

      const drawFallback = () => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = playerColor;
        ctx.fillRect(2, 2, tileSize - 4, tileSize - 4);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        const short = getUnitDisplayName(unit.type);
        const abbrev = Array.from(short)
          .slice(0, 3)
          .join('')
          .toUpperCase();
        ctx.fillText(abbrev || '?', tileSize / 2, tileSize / 2 + 3);
        drawOverlays(ctx);
      };

      const drawOverlays = (ctx: CanvasRenderingContext2D) => {
        if (unit.isVeteran) {
          ctx.font = 'bold 12px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // Dark backing disc for readability
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.beginPath();
          ctx.arc(tileSize - 8, tileSize - 8, 7, 0, 2 * Math.PI);
          ctx.fill();
          ctx.fillStyle = '#FFD700';
          ctx.fillText('V', tileSize - 8, tileSize - 7);
        }
      };

      const cached = UnitSprites.getCachedSprite(unit.type, playerColor, tileSize);
      if (cached) {
        drawSprite(cached);
      } else {
        drawFallback();
        UnitSprites.getUnitSprite(unit.type, playerColor, tileSize).then(sprite => {
          if (sprite) drawSprite(sprite);
        }).catch(() => {});
      }

      wrapper.appendChild(canvas);

      const label = document.createElement('div');
      label.className = 'unit-sprite-label';
      label.textContent = getUnitDisplayName(unit.type);
      wrapper.appendChild(label);

      wrapper.addEventListener('click', () => {
        // Highlight selected unit
        this.unitsList.querySelectorAll('.unit-sprite-item.selected').forEach(el => {
          el.classList.remove('selected');
        });
        wrapper.classList.add('selected');
        this.activateUnit(unit);
      });

      wrapper.addEventListener('dblclick', () => {
        this.activateUnit(unit);
        this.close();
      });

      this.unitsList.appendChild(wrapper);
    }
  }

  private renderCityMap(): void {
    if (!this.currentCity) return;

    const canvas = this.cityMapCanvas;
    const ctx = this.cityMapContext;
    const tileSize = 40;
    
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = Math.floor(canvas.width / 2);
    const centerY = Math.floor(canvas.height / 2);
    const gameState = this.game.getGameState();

    // Define the "L" shaped pattern: center + 2 out in cardinal directions + 1 left/right from those
    const workableTiles: Array<{dx: number, dy: number}> = [];
    
    // Center tile
    workableTiles.push({dx: 0, dy: 0});
    
    // Cardinal directions - 2 tiles out
    // North
    workableTiles.push({dx: 0, dy: -1}, {dx: 0, dy: -2});
    // South  
    workableTiles.push({dx: 0, dy: 1}, {dx: 0, dy: 2});
    // East
    workableTiles.push({dx: 1, dy: 0}, {dx: 2, dy: 0});
    // West
    workableTiles.push({dx: -1, dy: 0}, {dx: -2, dy: 0});
    
    // "L" extensions - 1 tile left/right from the cardinal extensions
    // From North extensions
    workableTiles.push({dx: -1, dy: -1}, {dx: 1, dy: -1}); // From (0,-1)
    workableTiles.push({dx: -1, dy: -2}, {dx: 1, dy: -2}); // From (0,-2)
    // From South extensions  
    workableTiles.push({dx: -1, dy: 1}, {dx: 1, dy: 1});   // From (0,1)
    workableTiles.push({dx: -1, dy: 2}, {dx: 1, dy: 2});   // From (0,2)
    // From East extensions
    workableTiles.push({dx: 1, dy: -1}, {dx: 1, dy: 1});   // From (1,0) - already added above
    workableTiles.push({dx: 2, dy: -1}, {dx: 2, dy: 1});   // From (2,0)
    // From West extensions
    workableTiles.push({dx: -1, dy: -1}, {dx: -1, dy: 1}); // From (-1,0) - already added above
    workableTiles.push({dx: -2, dy: -1}, {dx: -2, dy: 1}); // From (-2,0)

    // Remove duplicates by converting to Set and back
    const uniqueTiles = Array.from(new Set(workableTiles.map(t => `${t.dx},${t.dy}`)))
      .map(coord => {
        const [dx, dy] = coord.split(',').map(Number);
        return {dx, dy};
      });

    // Render each workable tile
    uniqueTiles.forEach(({dx, dy}) => {
      const worldX = this.currentCity!.position.x + dx;
      const worldY = this.currentCity!.position.y + dy;
      
      // Handle world wrapping for X coordinate
      const normalizedX = worldX < 0 ? 
        worldX + gameState.worldMap[0].length : 
        worldX % gameState.worldMap[0].length;
      
      if (worldY < 0 || worldY >= gameState.worldMap.length) return;

      const terrain = gameState.worldMap[worldY][normalizedX];
      const screenX = centerX + dx * tileSize - tileSize / 2;
      const screenY = centerY + dy * tileSize - tileSize / 2;

      // Color based on terrain type
      let color = '#006600'; // Default green for grassland
      switch (terrain.terrain) {
        case 'ocean':
          color = '#0066cc';
          break;
        case 'desert':
          color = '#ffcc00';
          break;
        case 'forest':
          color = '#003300';
          break;
        case 'hills':
          color = '#996633';
          break;
        case 'mountains':
          color = '#666666';
          break;
        case 'plains':
          color = '#cccc66';
          break;
        case 'jungle':
          color = '#009900';
          break;
        case 'swamp':
          color = '#556B2F';
          break;
        case 'river':
          color = '#87CEEB';
          break;
        case 'arctic':
          color = '#E0E0E0';
          break;
        case 'tundra':
          color = '#C0C0C0';
          break;
      }

      ctx.fillStyle = color;
      ctx.fillRect(screenX, screenY, tileSize, tileSize);

      // Get terrain yields and calculate actual yields with improvements and variants
      const baseYields = this.getTerrainYields(terrain);
      
      // Render resource yields on the tile
      this.renderTileResources(ctx, screenX, screenY, tileSize, baseYields);

      // Render improvements (roads, irrigation, mines, etc.)
      this.renderTileImprovements(ctx, screenX, screenY, tileSize, terrain);

      // Render special resource badge (top-right corner)
      if (terrain.resources && terrain.resources.length > 0) {
        this.renderTileResourceBadge(ctx, screenX, screenY, tileSize, terrain.resources[0], terrain.position.x, terrain.position.y);
      }

      // Highlight city center
      if (dx === 0 && dy === 0) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(screenX, screenY, tileSize, tileSize);
        
        // Draw city icon
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🏛️', screenX + tileSize/2, screenY + tileSize/2 + 4);
      } else {
        // Check if this tile is being worked
        const isWorked = this.isTileWorked(dx, dy);
        
        if (isWorked) {
          // Worked tiles get a green border
          ctx.strokeStyle = '#00FF00';
          ctx.lineWidth = 2;
          ctx.strokeRect(screenX + 1, screenY + 1, tileSize - 2, tileSize - 2);
        } else {
          // Unworked tiles - show basic border
          ctx.strokeStyle = '#666666';
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX, screenY, tileSize, tileSize);
        }
      }
    });
    
    // Add informational text below the minimap
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    
    const selectedCount = this.currentCity?.workedTiles?.length || 0;
    const totalWorkable = this.currentCity?.population || 0; // Non-city-center tiles
    const isCustom = selectedCount > 0;
    
    // ctx.fillText(
    //   `Click tiles to select (${selectedCount}/${totalWorkable}) • R: Reset • ${isCustom ? 'Custom' : 'Auto'}`,
    //   canvas.width / 2,
    //   canvas.height - 5
    // );
    
  }

  /**
   * Get terrain yields including terrain variants (like shield grassland)
   */
  private getTerrainYields(terrain: any): { food: number; production: number; trade: number } {
    const baseYields = TerrainManager.getTerrainYields(terrain.terrain);
    
    // Add bonus for shield variants
    if (terrain.terrainVariant === 'shield') {
      baseYields.production += 1;
    }
    
    // Special resources — authoritative Civ1 values from ResourceBonuses.ts
    applyResourceBonuses(baseYields, terrain.resources as string[] | undefined, terrain.terrain as string);
    
    // Apply improvement bonuses — values match TurnManager.getTileProductionYield
    // so the city map display is consistent with actual game mechanics.
    if (terrain.improvements && terrain.improvements.length > 0) {
      // Track whether a road is present (needed for road trade logic below)
      const hasRoad = terrain.improvements.some((imp: any) => imp.type === 'road');

      for (const improvement of terrain.improvements) {
        switch (improvement.type) {
          case 'irrigation':
            // Irrigation: +1 food on grassland, plains, desert, hills, river
            if (['grassland', 'plains', 'desert', 'hills', 'river'].includes(terrain.terrain)) {
              baseYields.food += 1;
            }
            break;

          case 'mine':
            // Mine bonuses match TurnManager.getTileProductionYield
            switch (terrain.terrain) {
              case 'hills':      baseYields.production += 3; break;
              case 'mountains':  baseYields.production += 2; break;
              case 'desert':     baseYields.production += 1; break;
              case 'ocean':      break; // cannot mine ocean
              default:           baseYields.production += 1; break;
            }
            break;

          case 'road':
            // Roads grant +1 trade to every non-ocean land tile (Civ 1 trade route)
            if (terrain.terrain !== 'ocean' && terrain.terrain !== 'arctic' && terrain.terrain !== 'tundra') {
              baseYields.trade += 1;
            }
            break;

          case 'farm':
            baseYields.food += 1;
            break;
        }
      }
    }

    return baseYields;
  }

  /**
   * Render resource yields on a tile using emoji icons.
   */
  private renderTileResources(ctx: CanvasRenderingContext2D, x: number, y: number, _tileSize: number, yields: { food: number; production: number; trade: number }): void {
    const iconSize = 8;
    const margin = 2;
    
    ctx.font = '8px Arial';
    ctx.textAlign = 'center';
    
    // Food (top area) - wheat icon 🌾
    if (yields.food > 0) {
      for (let i = 0; i < Math.min(yields.food, 4); i++) {
        const posX = x + margin + (i * (iconSize + 1));
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(posX, y + margin, iconSize, iconSize);
        ctx.fillStyle = '#000000';
        ctx.fillText('🌾', posX + iconSize/2, y + margin + iconSize - 1);
      }
    }
    
    // Production (middle area) - shield icon 🛡️
    if (yields.production > 0) {
      const startY = y + margin + iconSize + 2;
      for (let i = 0; i < Math.min(yields.production, 4); i++) {
        const posX = x + margin + (i * (iconSize + 1));
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(posX, startY, iconSize, iconSize);
        ctx.fillStyle = '#000000';
        ctx.fillText('🛡️', posX + iconSize/2, startY + iconSize - 1);
      }
    }
    
    // Trade (bottom area) - trade icon 💱
    if (yields.trade > 0) {
      const startY = y + margin + (iconSize + 2) * 2;
      for (let i = 0; i < Math.min(yields.trade, 4); i++) {
        const posX = x + margin + (i * (iconSize + 1));
        ctx.fillStyle = '#4169E1';
        ctx.fillRect(posX, startY, iconSize, iconSize);
        ctx.fillStyle = '#000000';
        ctx.fillText('💱', posX + iconSize/2, startY + iconSize - 1);
      }
    }
  }

  /**
   * Render improvements (roads, irrigation, mines, etc.) on a tile
   */
  private renderTileImprovements(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, terrain: any): void {
    if (!terrain.improvements || terrain.improvements.length === 0) return;
    
    const iconSize = 8;
    const margin = 1;
    
    ctx.font = '8px Arial';
    ctx.textAlign = 'center';
    
    // Check for each improvement type and render appropriate icon
    for (const improvement of terrain.improvements) {
      switch (improvement.type) {
        case 'road':
          // Road - show as brown line across tile
          ctx.strokeStyle = '#8B4513';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y + tileSize/2);
          ctx.lineTo(x + tileSize, y + tileSize/2);
          ctx.moveTo(x + tileSize/2, y);
          ctx.lineTo(x + tileSize/2, y + tileSize);
          ctx.stroke();
          break;
          
        case 'irrigation':
          // Irrigation - show as blue wavy lines
          ctx.strokeStyle = '#4169E1';
          ctx.lineWidth = 1;
          ctx.beginPath();
          // Draw wavy lines to represent irrigation
          for (let i = 0; i < 3; i++) {
            const yPos = y + 8 + i * 4;
            ctx.moveTo(x + 4, yPos);
            ctx.quadraticCurveTo(x + tileSize/2, yPos - 2, x + tileSize - 4, yPos);
          }
          ctx.stroke();
          break;
          
        case 'mine':
          // Mine - show as pickaxe icon ⛏️ in bottom-left corner
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Semi-transparent background
          ctx.fillRect(x + margin, y + tileSize - iconSize - margin, iconSize, iconSize);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText('⛏️', x + margin + iconSize/2, y + tileSize - margin - 1);
          break;
          
        case 'farm':
          // Farm - show as green squares pattern
          ctx.fillStyle = '#228B22';
          for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
              ctx.fillRect(x + 6 + i * 8, y + 6 + j * 8, 4, 4);
            }
          }
          break;
          
        case 'fortress':
          // Fortress - show as castle icon 🏰 in center
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(x + tileSize/2 - iconSize/2, y + tileSize/2 - iconSize/2, iconSize, iconSize);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText('🏰', x + tileSize/2, y + tileSize/2 + 2);
          break;
      }
    }
  }

  /**
   * Draw a small emoji resource badge in the top-right corner of a city-map tile.
   * Matches the style used on the main map (GameRenderer.renderResources).
   */
  private renderTileResourceBadge(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    tileSize: number,
    resource: string,
    tileX: number,
    tileY: number,
  ): void {
    const emoji = pickResourceEmoji(resource, tileX, tileY);
    if (!emoji) return;

    const fontSize = Math.max(10, Math.round(tileSize * 0.42));
    const cx = x + tileSize / 2;
    const cy = y + tileSize / 2;

    ctx.save();
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, cx, cy);
    ctx.restore();
  }

  private handleRename(): void {
    if (!this.currentCity) return;

    const newName = prompt('Enter new city name:', this.currentCity.name);
    if (newName && newName.trim() !== '' && newName !== this.currentCity.name) {
      // Update city name in game state
      this.game.renameCity(this.currentCity.id, newName.trim());
      this.currentCity.name = newName.trim();
      this.cityNameTitle.textContent = newName.trim();
    }
  }

  private handleBuy(): void {
    if (!this.currentCity) return;
    
    // Placeholder for buy functionality
    alert('Buy functionality not yet implemented');
  }

  private handleChangeProduction(): void {
    if (!this.currentCity) return;
    
    // Show the production selection modal
    this.productionModal.show(this.currentCity, (selectedOption) => {
      // Callback when user selects a production option
      // Pass the option ID (not display name) for reliable lookup
      this.game.changeCityProduction(this.currentCity!.id, selectedOption.id);
      this.updateCityInformation();
      this.productionModal.hide();
    });
  }

  /** Add an item to the build queue (opens the production selection modal in queue mode). */
  private handleAddToQueue(): void {
    if (!this.currentCity) return;
    this.productionModal.show(this.currentCity, (selectedOption) => {
      this.game.addToProductionQueue(this.currentCity!.id, selectedOption.id);
      this.updateCityInformation();
      this.productionModal.hide();
    });
  }

  /** Toggle the auto-fill flag. Immediately repopulates an empty queue when turned ON. */
  private handleToggleAutoFill(): void {
    if (!this.currentCity) return;
    this.game.toggleAutoFillQueue(this.currentCity.id);
    this.updateCityInformation();
  }

  /** Render the current city's production queue in the queue list element. */
  private updateProductionQueue(): void {
    if (!this.productionQueueList || !this.currentCity) return;

    // Update auto-fill toggle button appearance
    const autoFillBtn = document.getElementById('auto-fill-queue') as HTMLButtonElement | null;
    if (autoFillBtn) {
      const isOn = this.currentCity.autoFillQueue !== false; // undefined → true
      autoFillBtn.textContent = isOn ? t('templates.cityModal.autoOn') : t('templates.cityModal.autoOff');
      autoFillBtn.classList.toggle('queue-autofill-on', isOn);
      autoFillBtn.classList.toggle('queue-autofill-off', !isOn);
    }

    const queue = this.currentCity.productionQueue ?? [];
    this.productionQueueList.innerHTML = '';

    if (queue.length === 0) {
      this.productionQueueList.innerHTML = `<div class="queue-item-empty">${t('templates.cityModal.queueEmpty')}</div>`;
      return;
    }

    const gameState = this.game.getGameState();
    const player = gameState.players.find(p => p.id === this.currentCity!.playerId);
    const productionOutput = Math.max(1, this.game.getCityProductionOutput(this.currentCity.id));

    queue.forEach((qItem, index) => {
      // Resolve display name and estimated turns
      let name = qItem.item as string;
      let estimatedTurns = '?';

      try {
        if (qItem.type === 'unit') {
          const unitStats = UNIT_DEFINITIONS[qItem.item as any];
          if (unitStats) {
            name = getUnitDisplayName(qItem.item as string);
            const turns = Math.max(1, Math.ceil(unitStats.productionCost / productionOutput));
            estimatedTurns = `${turns}`;
          }
        } else if (qItem.type === 'building') {
          const buildingStats = getBuildingStats(qItem.item as any);
          if (buildingStats) {
            name = getBuildingDisplayName(qItem.item as string);
            const turns = Math.max(1, Math.ceil(buildingStats.productionCost / productionOutput));
            estimatedTurns = `${turns}`;
          }
        } else if (qItem.type === 'wonder') {
          const wonderStats = getWonderStats(qItem.item as string);
          if (wonderStats) {
            name = getWonderDisplayName(qItem.item as string);
            const turns = Math.max(1, Math.ceil(wonderStats.productionCost / productionOutput));
            estimatedTurns = `${turns}`;
          }
        }
      } catch (_e) {
        // leave defaults
      }

      const row = document.createElement('div');
      row.className = 'queue-item';

      row.innerHTML = `
        <div class="queue-item-info">
          <span class="queue-item-index">${index + 1}.</span>
          <span class="queue-item-name" title="${name}">${name}</span>
          <span class="queue-item-turns">${t('templates.cityModal.queueTurnsApprox', { n: estimatedTurns })}</span>
        </div>
        <div class="queue-item-controls">
          <button class="queue-ctrl-btn move-up-btn" title="${t('templates.cityModal.queueMoveUpTitle')}" ${index === 0 ? 'disabled' : ''}>▲</button>
          <button class="queue-ctrl-btn move-down-btn" title="${t('templates.cityModal.queueMoveDownTitle')}" ${index === queue.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="queue-ctrl-btn remove-btn" title="${t('templates.cityModal.queueRemoveTitle')}">×</button>
        </div>`;

      // Wire up buttons
      const moveUpBtn = row.querySelector('.move-up-btn') as HTMLButtonElement;
      const moveDownBtn = row.querySelector('.move-down-btn') as HTMLButtonElement;
      const removeBtn = row.querySelector('.remove-btn') as HTMLButtonElement;

      moveUpBtn?.addEventListener('click', () => {
        this.game.moveProductionQueueItem(this.currentCity!.id, index, index - 1);
        this.updateCityInformation();
      });
      moveDownBtn?.addEventListener('click', () => {
        this.game.moveProductionQueueItem(this.currentCity!.id, index, index + 1);
        this.updateCityInformation();
      });
      removeBtn?.addEventListener('click', () => {
        this.game.removeFromProductionQueue(this.currentCity!.id, index);
        this.updateCityInformation();
      });

      this.productionQueueList!.appendChild(row);
    });
  }

  private getUnitStatsForProduction(unitType: any): any {
    try {
      return UNIT_DEFINITIONS[unitType];
    } catch (error) {
      console.warn('Could not get unit stats for', unitType);
      return null;
    }
  }

  private getBuildingStatsForProduction(buildingType: any): any {
    try {
      return getBuildingStats(buildingType);
    } catch (error) {
      console.warn('Could not get building stats for', buildingType);
      return null;
    }
  }

  private resourceLabel(resource: string): string {
    const key = `tileInfo.resourceNames.${resource}`;
    const s = t(key);
    return s !== key ? s : resource.charAt(0).toUpperCase() + resource.slice(1);
  }

  /**
   * Check if a tile is currently being worked by city population
   */
  private isTileWorked(dx: number, dy: number): boolean {
    if (!this.currentCity) return false;
    
    // City center is always worked
    if (dx === 0 && dy === 0) return true;
    
    // If city has manual tile selection, use only those
    if (this.currentCity.workedTiles && this.currentCity.workedTiles.length > 0) {
      return this.currentCity.workedTiles.some(tile => tile.dx === dx && tile.dy === dy);
    }
    
    // Otherwise, use automatic optimal tile selection
    const optimalTiles = this.getOptimalWorkedTiles();
    return optimalTiles.some(tile => tile.dx === dx && tile.dy === dy);
  }

  /**
   * Get the list of tiles that should be worked based on city population
   * Returns exactly (population) tiles (not including city center which is always worked)
   * Prioritizes food and production (shields) over trade
   */
  private getOptimalWorkedTiles(): Array<{dx: number, dy: number, yields: {food: number, production: number, trade: number}, totalYield: number}> {
    if (!this.currentCity) return [];
    
    // Collect all available tiles within working radius (2 tiles from city center)
    const availableTiles: Array<{dx: number, dy: number, yields: {food: number, production: number, trade: number}, totalYield: number, priority: number}> = [];
    
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        // Skip city center (always worked, handled separately)
        if (dx === 0 && dy === 0) continue;
        
        // Skip tiles outside the maximum working distance
        const distance = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev distance (max of x,y distances)
        if (distance > 2) continue;
        
        // Get the actual tile
        const tileX = this.currentCity.position.x + dx;
        const tileY = this.currentCity.position.y + dy;
        const gameState = this.game.getGameState();
        
        // Check bounds
        if (tileY < 0 || tileY >= gameState.worldMap.length) {
          continue;
        }
        
        // Handle world wrapping for X coordinate
        const normalizedX = tileX < 0 ? 
          tileX + gameState.worldMap[0].length : 
          tileX % gameState.worldMap[0].length;
        
        const tile = gameState.worldMap[tileY][normalizedX];
        const yields = this.getTerrainYields(tile);
        const totalYield = yields.food + yields.production + yields.trade;
        
        // Calculate priority: heavily weight food and production over trade
        // Food and production are worth 2x trade for city growth and development
        const priority = (yields.food * 2) + (yields.production * 2) + yields.trade;
        
        availableTiles.push({
          dx,
          dy,
          yields,
          totalYield,
          priority
        });
      }
    }
    
    // Sort tiles by priority (food/production focused), then by total yield
    availableTiles.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      if (a.totalYield !== b.totalYield) {
        return b.totalYield - a.totalYield;
      }
      // Final tie-breaker: prefer food, then production, then trade
      if (a.yields.food !== b.yields.food) {
        return b.yields.food - a.yields.food;
      }
      if (a.yields.production !== b.yields.production) {
        return b.yields.production - a.yields.production;
      }
      return b.yields.trade - a.yields.trade;
    });
    
    // Return the best tiles up to the population limit
    return availableTiles.slice(0, this.currentCity.population);
  }

  /**
   * Reset tile selection to automatic (optimal) selection
   */
  private resetToOptimalTileSelection(): void {
    if (!this.currentCity) return;
    
    this.currentCity.workedTiles = [];
    this.renderCityMap();
    this.updateCityResourceDisplay();
  }

  /**
   * Automatically select optimal tiles when city grows or when no manual selection exists
   */
  private autoSelectOptimalTiles(): void {
    if (!this.currentCity) return;

    // Calculate how many tiles the city should work (population = non-city-center tiles)
    const maxWorkableTiles = this.currentCity.population; // This is the number of NON-city-center tiles

    // If user has made manual selections, don't interfere
    if (this.currentCity.workedTiles && this.currentCity.workedTiles.length > 0) {
      // Check if we need to add more tiles due to population growth
      const currentSelections = this.currentCity.workedTiles.length;
      
      if (currentSelections < maxWorkableTiles) {
        // Add optimal tiles to fill remaining slots
        this.fillRemainingWithOptimalTiles();
      }
      return;
    }

    // No manual selection - auto-select optimal tiles based on population
    const optimalTiles = this.getOptimalWorkedTiles();
    this.currentCity.workedTiles = optimalTiles
      .slice(0, maxWorkableTiles)
      .map(tile => ({ dx: tile.dx, dy: tile.dy }));
    
    console.log(`Auto-selected ${this.currentCity.workedTiles.length} optimal tiles for city ${this.currentCity.name} (pop ${this.currentCity.population})`);
  }

  /**
   * Fill remaining tile slots with optimal choices
   */
  private fillRemainingWithOptimalTiles(): void {
    if (!this.currentCity || !this.currentCity.workedTiles) return;

    const currentSelections = this.currentCity.workedTiles;
    const maxWorkableTiles = this.currentCity.population; // Non-city-center tiles
    const slotsNeeded = maxWorkableTiles - currentSelections.length;

    if (slotsNeeded <= 0) return;

    // Get all optimal tiles
    const optimalTiles = this.getOptimalWorkedTiles();
    const currentTileSet = new Set(currentSelections.map(t => `${t.dx},${t.dy}`));

    // Add best tiles that aren't already selected
    let added = 0;
    for (const tile of optimalTiles) {
      if (!currentTileSet.has(`${tile.dx},${tile.dy}`) && added < slotsNeeded) {
        currentSelections.push({ dx: tile.dx, dy: tile.dy });
        added++;
      }
    }

    console.log(`Auto-filled ${added} additional tiles for city growth (pop ${this.currentCity.population})`);
  }

  /**
   * Handle city population change - auto-select new tiles or remove excess
   */
  public handlePopulationChange(newPopulation: number): void {
    if (!this.currentCity) return;

    const oldPopulation = this.currentCity.population;
    this.currentCity.population = newPopulation;

    if (!this.currentCity.workedTiles) {
      this.currentCity.workedTiles = [];
    }

    const maxWorkableTiles = newPopulation; // Non-city-center tiles

    if (newPopulation > oldPopulation) {
      // City grew - auto-select additional optimal tiles
      this.fillRemainingWithOptimalTiles();
    } else if (newPopulation < oldPopulation) {
      // City shrunk - remove excess tiles (remove least valuable first)
      if (this.currentCity.workedTiles.length > maxWorkableTiles) {
        // Get yields for all current tiles and sort by value
        const tilesWithYields = this.currentCity.workedTiles.map(({ dx, dy }) => {
          const yields = this.getTileYieldsAt(dx, dy) || { food: 0, production: 0, trade: 0 };
          const totalYield = yields.food + yields.production + yields.trade;
          // Prioritize food for tie-breaking
          const priority = totalYield * 10 + yields.food;
          return { dx, dy, priority };
        });

        // Sort by priority (highest first) and keep only the best ones
        tilesWithYields.sort((a, b) => b.priority - a.priority);
        this.currentCity.workedTiles = tilesWithYields
          .slice(0, maxWorkableTiles)
          .map(({ dx, dy }) => ({ dx, dy }));
        
        console.log(`City shrunk: removed ${tilesWithYields.length - maxWorkableTiles} least valuable tiles`);
      }
    }

    // Update displays
    this.renderCityMap();
    this.updateCityResourceDisplay();
  }

  /**
   * Handle clicks on the city minimap to select/deselect tiles
   */
  private handleCityMapMouseMove(event: MouseEvent): void {
    if (!this.currentCity) return;

    const canvas = this.cityMapCanvas;
    const rect = canvas.getBoundingClientRect();
    // Canvas may be CSS-scaled, so convert client coords to canvas coords
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;

    const tileSize = 40;
    const centerX = Math.floor(canvas.width / 2);
    const centerY = Math.floor(canvas.height / 2);
    const gameState = this.game.getGameState();

    // Find the tile under the cursor
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const screenX = centerX + dx * tileSize - tileSize / 2;
        const screenY = centerY + dy * tileSize - tileSize / 2;
        if (mouseX >= screenX && mouseX < screenX + tileSize &&
            mouseY >= screenY && mouseY < screenY + tileSize) {

          const worldX = this.currentCity!.position.x + dx;
          const worldY = this.currentCity!.position.y + dy;
          const mapWidth = gameState.worldMap[0].length;
          const normalizedX = ((worldX % mapWidth) + mapWidth) % mapWidth;

          if (worldY < 0 || worldY >= gameState.worldMap.length) {
            this.tilePopover.style.display = 'none';
            return;
          }

          const terrain = gameState.worldMap[worldY][normalizedX];
          const yields = this.getTerrainYields(terrain);

          // Build popover content
          const terrainName = getTerrainDisplayName(terrain.terrain);
          const isCityCenter = dx === 0 && dy === 0;
          const isWorked = !isCityCenter && this.isTileWorked(dx, dy);

          const resourceNames: string[] = (terrain.resources ?? []).map((r: string) => this.resourceLabel(r));
          const improvementNames: string[] = (terrain.improvements ?? []).map((imp: any) =>
            getImprovementDisplayName(imp.type),
          );

          let html = `<div class="ctp-terrain">${terrainName}</div>`;
          html += `<div class="ctp-yields">`
            + `<span class="ctp-food">🌾 ${yields.food}</span>`
            + `<span class="ctp-prod">🛡️ ${yields.production}</span>`
            + `<span class="ctp-trade">💱 ${yields.trade}</span>`
            + `</div>`;
          if (resourceNames.length) {
            html += `<div class="ctp-resources">🔸 ${resourceNames.join(', ')}</div>`;
          }
          if (improvementNames.length) {
            html += `<div class="ctp-improvements">🔧 ${improvementNames.join(', ')}</div>`;
          }
          if (isCityCenter) {
            html += `<div class="ctp-status city-center">${t('templates.cityModal.tilePopoverCityCenter')}</div>`;
          } else {
            html += `<div class="ctp-status ${isWorked ? 'worked' : 'unworked'}">${isWorked ? t('templates.cityModal.tilePopoverWorked') : t('templates.cityModal.tilePopoverUnworked')}</div>`;
          }

          this.tilePopover.innerHTML = html;
          this.tilePopover.style.display = 'block';

          // Position just to the right of the cursor; flip left if near right edge
          const GAP = 12;
          let px = event.clientX + GAP;
          let py = event.clientY + GAP;
          const popW = 160;
          if (px + popW > window.innerWidth - 8) {
            px = event.clientX - popW - GAP;
          }
          this.tilePopover.style.left = px + 'px';
          this.tilePopover.style.top  = py + 'px';
          return;
        }
      }
    }

    // Cursor is over a black gap between tiles
    this.tilePopover.style.display = 'none';
  }

  private handleCityMapClick(event: MouseEvent): void {
    if (!this.currentCity) return;

    const canvas = this.cityMapCanvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (event.clientX - rect.left) * scaleX;
    const clickY = (event.clientY - rect.top) * scaleY;
    
    const tileSize = 40;
    const centerX = Math.floor(canvas.width / 2);
    const centerY = Math.floor(canvas.height / 2);
    
    // Find which tile was clicked
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        if (distance > 2) continue; // Skip tiles outside working radius
        
        const screenX = centerX + dx * tileSize - tileSize / 2;
        const screenY = centerY + dy * tileSize - tileSize / 2;
        
        if (clickX >= screenX && clickX < screenX + tileSize &&
            clickY >= screenY && clickY < screenY + tileSize) {
          
          // Skip city center (always worked, handled separately)
          if (dx === 0 && dy === 0) return;
          
          // Toggle tile selection
          this.toggleTileSelection(dx, dy);
          
          // Re-render to show the change
          this.renderCityMap();
          // Resource display is already updated in toggleTileSelection
          return;
        }
      }
    }
  }

  /**
   * Toggle the selection state of a tile
   */
  private toggleTileSelection(dx: number, dy: number): void {
    if (!this.currentCity) return;

    // Initialize workedTiles array if it doesn't exist
    if (!this.currentCity.workedTiles) {
      this.currentCity.workedTiles = [];
    }

    // Check if tile is currently selected
    const tileIndex = this.currentCity.workedTiles.findIndex(tile => tile.dx === dx && tile.dy === dy);
    
    const maxWorkableTiles = this.currentCity.population; // Non-city-center tiles
    
    if (tileIndex >= 0) {
      // Tile is selected, remove it
      this.currentCity.workedTiles.splice(tileIndex, 1);
    } else {
      // Tile is not selected, add it if we haven't reached the population limit
      if (this.currentCity.workedTiles.length < maxWorkableTiles) {
        this.currentCity.workedTiles.push({dx, dy});
      } else {
        // Population limit reached - replace the oldest selected tile (queue behavior)
        this.currentCity.workedTiles.shift(); // Remove first (oldest)
        this.currentCity.workedTiles.push({dx, dy}); // Add new one at end
      }
    }

    console.log(`Tile (${dx}, ${dy}) selection toggled. Current worked tiles: ${this.currentCity.workedTiles.length}/${maxWorkableTiles} (pop ${this.currentCity.population})`);
    
    // Update resource calculations to reflect the new tile selection
    this.updateCityResourceDisplay();
  }

  /**
   * Update just the resource display without recalculating everything
   */
  private updateCityResourceDisplay(): void {
    if (!this.currentCity) return;
    
    const resources = this.calculateDetailedCityResources();
    this.updateResourceDisplay(resources);
  }

  /**
   * Handle keyboard shortcuts for tile management
   */
  private handleKeydown(event: KeyboardEvent): void {
    // Only process if city modal is open
    if (!this.currentCity || this.cityModal.style.display === 'none') return;
    
    switch (event.key.toLowerCase()) {
      case 'r':
        // R key: Reset to automatic tile selection
        this.resetToOptimalTileSelection();
        event.preventDefault();
        break;
    }
  }

  /**
   * Public method to trigger auto-selection for a specific city
   * Can be called from game engine when cities grow
   */
  public autoSelectTilesForCity(city: City): void {
    const wasCurrentCity = this.currentCity === city;
    this.currentCity = city;
    
    this.autoSelectOptimalTiles();
    
    // If this was the currently viewed city, update the display
    if (wasCurrentCity && this.isOpen()) {
      this.renderCityMap();
      this.updateCityResourceDisplay();
    }
  }

  /**
   * Check if a city needs its worked tiles updated due to population change
   */
  public static shouldUpdateWorkedTiles(city: City): boolean {
    if (!city.workedTiles) return true;
    
    const maxWorkableTiles = city.population; // Non-city-center tiles
    
    // If population can work more tiles than currently selected
    if (city.workedTiles.length < maxWorkableTiles) return true;
    
    // If population decreased and we have too many tiles
    if (city.workedTiles.length > maxWorkableTiles) return true;
    
    return false;
  }

  /**
   * Handle double-click on city map to reset tile selection and auto-select optimal tiles
   */
  private handleCityMapDoubleClick(event: MouseEvent): void {
    if (!this.currentCity) return;

    const canvas = this.cityMapCanvas;
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    const tileSize = 28;
    const centerX = Math.floor(canvas.width / 2);
    const centerY = Math.floor(canvas.height / 2);
    
    // Check if double-click is in the black area (outside working tiles)
    let isInBlackArea = true;
    
    // Check if click is within any working tile
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        if (distance > 2) continue; // Skip tiles outside working radius
        
        const screenX = centerX + dx * tileSize - tileSize / 2;
        const screenY = centerY + dy * tileSize - tileSize / 2;
        
        if (clickX >= screenX && clickX < screenX + tileSize &&
            clickY >= screenY && clickY < screenY + tileSize) {
          isInBlackArea = false;
          break;
        }
      }
      if (!isInBlackArea) break;
    }
    
    // If double-click is in black area, reset and auto-select tiles
    if (isInBlackArea) {
      console.log('Double-click detected in black area - resetting tile selection');
      
      // Clear current manual selections
      this.currentCity.workedTiles = [];
      
      // Auto-select optimal tiles
      this.autoSelectOptimalTiles();
      
      // Re-render to show the changes
      this.renderCityMap();
      const resources = this.calculateDetailedCityResources();
      this.updateResourceDisplay(resources);
    }
  }

  /**
   * Wake and promote a unit to the front of the turn queue so it becomes the
   * active unit. Clears fortify/sleep/automation states if needed.
   * Only has an effect if the unit still has movement points this turn.
   */
  private activateUnit(unit: any): void {
    this.game.activateUnit(unit.id);
  }

  private updatePopulationIcons(): void {
    if (!this.currentCity) return;

    const populationIconsContainer = document.getElementById('population-icons');
    if (!populationIconsContainer) return;

    // Clear existing icons
    populationIconsContainer.innerHTML = '';

    // Create one person icon for each city size point
    for (let i = 0; i < this.currentCity.population; i++) {
      const icon = document.createElement('div');
      icon.className = 'population-icon content'; // Default to content citizens
      icon.textContent = '👤'; // Person silhouette icon
      icon.title = `Citizen ${i + 1}`;
      
      // TODO: In future, could differentiate happy/content/unhappy citizens
      // For now, all citizens are content
      
      populationIconsContainer.appendChild(icon);
    }
  }
}
