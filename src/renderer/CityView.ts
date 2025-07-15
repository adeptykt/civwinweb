import { City, GameState } from '../types/game';
import { Game } from '../game/Game';
import { getCivilization } from '../game/CivilizationDefinitions';
import { ProductionManager } from '../game/ProductionManager';
import { ProductionSelectionModal } from './ProductionSelectionModal';
import { UNIT_DEFINITIONS } from '../game/UnitDefinitions';
import { BUILDING_DEFINITIONS } from '../game/BuildingDefinitions';
import { WonderDefinitions } from '../game/WonderDefinitions';
import { TerrainManager } from '../terrain/index';
import { CityGrowthSystem } from '../game/CityGrowthSystem';
import { getCityPopulationDisplay } from '../utils/CityPopulationDisplay';
import { getWonderDisplayName } from '../utils/DisplayNames';

// Enhanced resource calculation interface
interface CityResources {
  food: number;
  foodSurplus: number;
  production: number;
  productionSurplus: number;
  trade: number;
  luxuries: number;
  tax: number;
  science: number;
}

export class CityView {
  private cityModal: HTMLElement;
  private cityDialog: HTMLElement;
  private cityNameTitle: HTMLElement;
  private cityPopulationTitle: HTMLElement;
  private cityPopulation: HTMLElement;
  private cityFood: HTMLElement;
  private cityProduction: HTMLElement;
  private cityTrade: HTMLElement;
  private cityScience: HTMLElement;
  private cityLuxuries: HTMLElement;
  private cityTax: HTMLElement;
  private foodSurplus: HTMLElement;
  private productionSurplus: HTMLElement;
  private foodStorageUnits: HTMLElement;
  private foodStorageCurrent: HTMLElement;
  private foodStorageCapacity: HTMLElement;
  private populationDetails: HTMLElement;
  private currentProduction: HTMLElement;
  private productionTurns: HTMLElement;
  private buildingsList: HTMLElement;
  private unitsList: HTMLElement;
  private cityMapCanvas: HTMLCanvasElement;
  private cityMapContext: CanvasRenderingContext2D;
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
    this.cityPopulation = document.getElementById('city-population')!;
    this.cityFood = document.getElementById('city-food')!;
    this.cityProduction = document.getElementById('city-production')!;
    this.cityTrade = document.getElementById('city-trade')!;
    this.cityScience = document.getElementById('city-science')!;
    this.cityLuxuries = document.getElementById('city-luxuries')!;
    this.cityTax = document.getElementById('city-tax')!;
    this.foodSurplus = document.getElementById('food-surplus')!;
    this.productionSurplus = document.getElementById('production-surplus')!;
    this.foodStorageUnits = document.getElementById('food-storage-units')!;
    this.foodStorageCurrent = document.getElementById('food-storage-current')!;
    this.foodStorageCapacity = document.getElementById('food-storage-capacity')!;;
    this.populationDetails = document.getElementById('population-details')!;
    this.currentProduction = document.getElementById('current-production')!;
    this.productionTurns = document.getElementById('production-turns')!;
    this.buildingsList = document.getElementById('buildings-list')!;
    this.unitsList = document.getElementById('units-list')!;
    this.cityMapCanvas = document.getElementById('city-map-canvas') as HTMLCanvasElement;
    this.cityMapContext = this.cityMapCanvas.getContext('2d')!;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Close button
    const closeButton = document.getElementById('city-close')!;
    closeButton.addEventListener('click', () => this.close());

    // OK button
    const okButton = document.getElementById('city-ok')!;
    okButton.addEventListener('click', () => this.close());

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

    // Add click handler for city map
    this.cityMapCanvas.addEventListener('click', (event) => this.handleCityMapClick(event));
    this.cityMapCanvas.addEventListener('dblclick', (event) => this.handleCityMapDoubleClick(event));
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

  private updateCityInformation(): void {
    if (!this.currentCity || !this.game) return;

    const gameState = this.game.getGameState();
    
    // Apply civilization-specific background
    this.applyCivilizationBackground();

    // Update city name and population in title
    this.cityNameTitle.textContent = this.currentCity.name;
    this.cityPopulationTitle.textContent = `(Pop: ${getCityPopulationDisplay(this.currentCity.population)})`;

    // Update basic city stats
    this.cityPopulation.textContent = getCityPopulationDisplay(this.currentCity.population);
    
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
          productionName = this.formatUnitName(this.currentCity.production.item as string);
        }
      } else if (this.currentCity.production.type === 'building') {
        // Get building stats to determine cost
        const buildingStats = this.getBuildingStatsForProduction(this.currentCity.production.item as any);
        if (buildingStats) {
          totalCost = buildingStats.productionCost;
          productionName = buildingStats.name;
        }
      }
      
      // Show production with accumulated shields
      const accumulatedShields = this.currentCity.production_points || 0;
      this.currentProduction.textContent = `${productionName} (${accumulatedShields}/${totalCost} shields)`;
      this.productionTurns.textContent = `(${this.currentCity.production.turnsRemaining} turns)`;
    } else {
      this.currentProduction.textContent = 'Nothing';
      this.productionTurns.textContent = '(-- turns)';
    }

    // Update buildings list
    this.updateBuildingsList();

    // Update units list
    this.updateUnitsList(gameState);
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
        trade: 0, luxuries: 0, tax: 0, science: 0
      };
    }

    // Calculate resources from worked tiles
    const workedTileYields = this.calculateWorkedTileYields();
    
    // Total yields from all worked tiles
    const totalFood = workedTileYields.food;
    const totalProduction = workedTileYields.production;
    const totalTrade = workedTileYields.trade;
    
    // Food calculation
    const foodConsumption = this.currentCity.population * 2; // Each citizen eats 2 food
    const foodSurplus = totalFood - foodConsumption;

    // Production (no consumption for now - all goes to surplus)
    const productionSurplus = totalProduction;
    
    // Trade breakdown (simplified government effects)
    const luxuries = Math.floor(totalTrade * 0.2); // 20% to luxuries
    const tax = Math.floor(totalTrade * 0.4);      // 40% to tax
    const science = totalTrade - luxuries - tax;   // Remainder to science

    return {
      food: totalFood,
      foodSurplus,
      production: totalProduction,
      productionSurplus,
      trade: totalTrade,
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

    // Add population summary
    const popSummary = document.createElement('div');
    popSummary.className = 'population-summary';
    popSummary.innerHTML = `
      <div class="population-info">
        <span class="population-label">City Size:</span>
        <span class="population-value">${this.currentCity.population}</span>
      </div>
      <div class="population-info">
        <span class="population-label">Population:</span>
        <span class="population-value">${getCityPopulationDisplay(this.currentCity.population)}</span>
      </div>
    `;
    this.populationDetails.appendChild(popSummary);

    // Add separator
    const separator = document.createElement('div');
    separator.className = 'population-separator';
    this.populationDetails.appendChild(separator);

    // Create population units (simplified - all workers for now)
    const unitsContainer = document.createElement('div');
    unitsContainer.className = 'population-units';
    
    for (let i = 0; i < this.currentCity.population; i++) {
      const popUnit = document.createElement('div');
      popUnit.className = 'population-unit worker';
      popUnit.textContent = '👷';
      popUnit.title = `Worker ${i + 1} - produces food and resources`;
      unitsContainer.appendChild(popUnit);
    }
    
    this.populationDetails.appendChild(unitsContainer);
  }

  private updateTradeBreakdown(resources: CityResources): void {
    // Update trade breakdown elements
    if (this.cityLuxuries) {
      this.cityLuxuries.textContent = resources.luxuries.toString();
    }
    if (this.cityTax) {
      this.cityTax.textContent = resources.tax.toString();
    }
    if (this.cityScience) {
      this.cityScience.textContent = resources.science.toString();
    }
  }

  private updateBuildingsList(): void {
    if (!this.currentCity!.buildings || this.currentCity!.buildings.length === 0) {
      this.buildingsList.innerHTML = '<div class="building-item">None built yet</div>';
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
      const wonderStats = WonderDefinitions[wonderId];
      
      if (wonderStats) {
        // Create sprite image element for wonder
        const spriteImg = document.createElement('img');
        spriteImg.src = wonderStats.spritePath || '/src/assets/tinywonders/default.png';
        spriteImg.alt = wonderStats.name;
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
        nameSpan.textContent = `✨ ${wonderStats.name}`;
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
      const buildingStats = BUILDING_DEFINITIONS[building.type];
      if (buildingStats) {
        // Create sprite image element
        const spriteImg = document.createElement('img');
        spriteImg.src = buildingStats.spritePath;
        spriteImg.alt = buildingStats.name;
        spriteImg.className = 'building-sprite';
        spriteImg.style.width = '16px';
        spriteImg.style.height = '16px';
        spriteImg.style.marginRight = '6px';
        spriteImg.style.verticalAlign = 'middle';
        
        // Create text span for building name
        const nameSpan = document.createElement('span');
        nameSpan.textContent = buildingStats.name;
        nameSpan.style.verticalAlign = 'middle';
        
        // Add both sprite and name to the building item
        buildingItem.appendChild(spriteImg);
        buildingItem.appendChild(nameSpan);
      } else {
        // Fallback if building definition not found
        buildingItem.textContent = building.type;
      }
      
      this.buildingsList.appendChild(buildingItem);
    });
  }

  private updateUnitsList(gameState: GameState): void {
    // Find units in the city
    const unitsInCity = gameState.units.filter(unit => 
      unit.position.x === this.currentCity!.position.x && 
      unit.position.y === this.currentCity!.position.y &&
      unit.playerId === this.currentCity!.playerId
    );

    if (unitsInCity.length === 0) {
      this.unitsList.innerHTML = '<div class="unit-item">No units present</div>';
      return;
    }

    this.unitsList.innerHTML = '';
    unitsInCity.forEach(unit => {
      const unitItem = document.createElement('div');
      unitItem.className = 'unit-item clickable';
      unitItem.textContent = `${unit.type}${unit.fortified ? ' (Fortified)' : ''}`;
      
      // Add click handler to select the unit
      unitItem.addEventListener('click', () => {
        this.selectUnit(unit);
      });
      
      // Add hover effect styling
      unitItem.style.cursor = 'pointer';
      unitItem.addEventListener('mouseenter', () => {
        unitItem.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      });
      unitItem.addEventListener('mouseleave', () => {
        unitItem.style.backgroundColor = '';
      });
      
      this.unitsList.appendChild(unitItem);
    });
  }

  private renderCityMap(): void {
    if (!this.currentCity) return;

    const canvas = this.cityMapCanvas;
    const ctx = this.cityMapContext;
    const tileSize = 32; // Increased tile size to accommodate repeated resource symbols
    
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
    
    ctx.fillText(
      `Click tiles to select (${selectedCount}/${totalWorkable}) • R: Reset • ${isCustom ? 'Custom' : 'Auto'}`,
      canvas.width / 2,
      canvas.height - 5
    );
    
    // Simplified legend
    ctx.textAlign = 'left';
    ctx.font = '8px Arial';
    const legendY = canvas.height - 25;
    
    // Green square for worked tiles
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(5, legendY - 8, 8, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Worked', 16, legendY);
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
    
    // Add bonus for special resources (simplified)
    if (terrain.resources && terrain.resources.length > 0) {
      // Different resources provide different bonuses
      for (const resource of terrain.resources) {
        switch (resource) {
          case 'wheat':
          case 'fish':
            baseYields.food += 1;
            break;
          case 'horses':
          case 'iron':
          case 'coal':
            baseYields.production += 1;
            break;
          case 'gold':
          case 'gem':
            baseYields.trade += 2;
            break;
        }
      }
    }
    
    // Add improvements bonuses
    if (terrain.improvements && terrain.improvements.length > 0) {
      for (const improvement of terrain.improvements) {
        switch (improvement.type) {
          case 'irrigation':
            // Irrigation adds +1 food to grassland, plains, and desert
            if (terrain.terrain === 'grassland' || terrain.terrain === 'plains' || terrain.terrain === 'desert') {
              baseYields.food += 1;
            }
            break;
            
          case 'mine':
            // Mines add +1 production to hills and mountains
            if (terrain.terrain === 'hills' || terrain.terrain === 'mountains') {
              baseYields.production += 1;
            }
            break;
            
          case 'road':
            // Roads add +1 trade to any terrain that already produces trade
            if (baseYields.trade > 0) {
              baseYields.trade += 1;
            }
            break;
            
          case 'farm':
            // Farms provide additional food bonus (usually on irrigated land)
            baseYields.food += 1;
            break;
        }
      }
    }
    
    return baseYields;
  }

  /**
   * Render resource yields on a tile
   */
  private renderTileResources(ctx: CanvasRenderingContext2D, x: number, y: number, _tileSize: number, yields: { food: number; production: number; trade: number }): void {
    const iconSize = 8;
    const margin = 2;
    
    ctx.font = '8px Arial';
    ctx.textAlign = 'center';
    
    // Food (top area) - wheat icon 🌾
    if (yields.food > 0) {
      for (let i = 0; i < Math.min(yields.food, 4); i++) { // Cap at 4 symbols to avoid overcrowding
        const posX = x + margin + (i * (iconSize + 1));
        ctx.fillStyle = '#FFD700'; // Gold background for food
        ctx.fillRect(posX, y + margin, iconSize, iconSize);
        ctx.fillStyle = '#000000';
        ctx.fillText('🌾', posX + iconSize/2, y + margin + iconSize - 1);
      }
    }
    
    // Production (middle area) - shield icon 🛡️
    if (yields.production > 0) {
      const startY = y + margin + iconSize + 2;
      for (let i = 0; i < Math.min(yields.production, 4); i++) { // Cap at 4 symbols
        const posX = x + margin + (i * (iconSize + 1));
        ctx.fillStyle = '#8B4513'; // Brown background for production
        ctx.fillRect(posX, startY, iconSize, iconSize);
        ctx.fillStyle = '#000000';
        ctx.fillText('🛡️', posX + iconSize/2, startY + iconSize - 1);
      }
    }
    
    // Trade (bottom area) - trade icon 💱
    if (yields.trade > 0) {
      const startY = y + margin + (iconSize + 2) * 2;
      for (let i = 0; i < Math.min(yields.trade, 4); i++) { // Cap at 4 symbols
        const posX = x + margin + (i * (iconSize + 1));
        ctx.fillStyle = '#4169E1'; // Blue background for trade
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
      this.game.changeCityProduction(this.currentCity!.id, selectedOption.name);
      this.updateCityInformation();
      this.productionModal.hide();
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
      return BUILDING_DEFINITIONS[buildingType];
    } catch (error) {
      console.warn('Could not get building stats for', buildingType);
      return null;
    }
  }

  private formatUnitName(unitType: string): string {
    // Convert enum value to display name
    return unitType.charAt(0).toUpperCase() + unitType.slice(1).replace(/_/g, ' ');
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
  private handleCityMapClick(event: MouseEvent): void {
    if (!this.currentCity) return;

    const canvas = this.cityMapCanvas;
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    const tileSize = 28;
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
   * Select a unit from the city unit list
   */
  private selectUnit(unit: any): void {
    console.log('Selected unit from city:', unit.type, unit.id);
    
    // Close the city modal
    this.close();
    
    // Emit a custom event that the main app can listen to
    // This allows the main app to handle unit selection without direct coupling
    const unitSelectEvent = new CustomEvent('cityUnitSelected', {
      detail: { unit: unit }
    });
    document.dispatchEvent(unitSelectEvent);
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
