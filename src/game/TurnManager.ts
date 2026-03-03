import type { GameState, Unit, City, UnitType, Tile } from '../types/game';
import { ImprovementType, TerrainType, ProductionType, GovernmentType } from '../types/game';
import { createUnit } from './Units';
import { getUnitStats } from './UnitDefinitions';
import { getResearchCost } from './TechnologyDefinitions';
import { ProductionManager } from './ProductionManager';
import { UNIT_DEFINITIONS } from './UnitDefinitions';
import { CityGrowthSystem } from './CityGrowthSystem';
import { WaterAccess } from '../utils/WaterAccess';
import { VisibilitySystem } from './VisibilitySystem';
import { applyResourceBonuses } from './ResourceBonuses';
import { TerrainManager } from '../terrain';
import { AIPlayer } from './AIPlayer';
import { TaxSystem } from './TaxSystem';

export class TurnManager {
  
  // Callback for building completion events
  private onBuildingCompleted?: (city: City, buildingType: string, isWonder: boolean) => void;
  // Callback for terrain improvement completion (mine)
  private onTerrainImproved?: (position: { x: number; y: number }) => void;

  constructor(
    onBuildingCompleted?: (city: City, buildingType: string, isWonder: boolean) => void,
    onTerrainImproved?: (position: { x: number; y: number }) => void
  ) {
    this.onBuildingCompleted = onBuildingCompleted;
    this.onTerrainImproved = onTerrainImproved;
  }
  
  // Process end of turn
  public processTurn(gameState: GameState): void {
    // Process fortification progression for current player's units
    this.processFortificationProgression(gameState);
    
    // Process road building progression for current player's units
    this.processRoadBuilding(gameState);

    // Process mine building progression for current player's units
    this.processMineBuilding(gameState);
    
    // Restore movement points for current player's units
    this.restoreMovementPoints(gameState);
    
    // Process cities for current player
    this.processCities(gameState);
    
    // Update player resources
    this.updatePlayerResources(gameState);
    
    // Update visibility for current player (refresh vision)
    VisibilitySystem.updateVisibilityForPlayer(gameState, gameState.currentPlayer);

    // Decrement revolution timer for the current player
    this.decrementRevolution(gameState);

    // Move to next player
    this.nextPlayer(gameState);
    
    // If back to first player, increment turn counter
    if (gameState.currentPlayer === gameState.players[0].id) {
      gameState.turn++;
    }
  }

  // Update movement points for all units of current player using new unit system
  private restoreMovementPoints(gameState: GameState): void {
    const currentPlayer = gameState.currentPlayer;
    
    gameState.units
      .filter(unit => unit.playerId === currentPlayer)
      .forEach(unit => {
        const stats = getUnitStats(unit.type);
        unit.maxMovementPoints = stats.movement;
        unit.movementPoints = stats.movement;
      });
  }

  // Process all cities for current player
  private processCities(gameState: GameState): void {
    const currentPlayerId = gameState.currentPlayer;
    const player = gameState.players.find(p => p.id === currentPlayerId);
    const playerCities = gameState.cities.filter(city => city.playerId === currentPlayerId);

    playerCities.forEach(city => {
      this.processCityGrowth(city, gameState);
      this.processCityProduction(city, gameState);
    });

    // Deduct shield drain from excess units (Despotism / Monarchy only).
    // In Civ 1 this comes out of the home city; since we don't track home cities
    // we spread the cost evenly across all cities, flooring per city.
    if (player && playerCities.length > 0) {
      const shieldDrain = TaxSystem.calculateUnitShieldDrain(player, gameState);
      if (shieldDrain > 0) {
        const drainPerCity = Math.floor(shieldDrain / playerCities.length);
        let remainder = shieldDrain - drainPerCity * playerCities.length;
        for (const city of playerCities) {
          const cityDrain = drainPerCity + (remainder > 0 ? 1 : 0);
          if (remainder > 0) remainder--;
          city.production_points = Math.max(0, city.production_points - cityDrain);
        }
      }
    }
  }

  // Process city growth using Civilization I mechanics
  private processCityGrowth(city: City, gameState: GameState): void {
    // Initialize food storage system if not already done
    if (city.foodStorageCapacity === undefined) {
      CityGrowthSystem.initializeCityFoodStorage(city);
    }
    
    // Calculate actual food production from city tiles and buildings
    const foodProduction = this.calculateCityFoodProduction(city, gameState);
    
    // Process growth using proper Civ1 mechanics
    const cityGrew = CityGrowthSystem.processCityGrowth(city, foodProduction);
    
    if (cityGrew) {
      // City growth is handled by the event system
    }
  }

  // Calculate total food production for a city
  private calculateCityFoodProduction(city: City, gameState: GameState): number {
    // This is a placeholder - in the full implementation, this would calculate
    // food from worked tiles based on terrain, improvements, and buildings
    
    // Base food production (simplified)
    let foodProduction = 2; // City center always produces at least 2 food
    
    // Add food per population (simplified - each citizen working produces some food)
    foodProduction += Math.floor(city.population * 1.5);
    
    // Building bonuses
    if (city.buildings.some(b => b.type === 'granary')) {
      foodProduction += 1; // Granary doesn't increase production, but helps with storage
    }
    
    // TODO: Use gameState to calculate yields from worked tiles based on terrain and improvements
    // For now, just add some basic variation based on map size to acknowledge the parameter
    const mapSize = gameState.worldMap.length * gameState.worldMap[0].length;
    const sizeBonus = mapSize > 3000 ? 1 : 0; // Slightly more food on larger maps
    
    return foodProduction + sizeBonus;
  }

  // Calculate food production for a city
  private calculateFoodProduction(city: City): number {
    // Base food production
    let food = 2;
    
    // Add food from buildings
    if (city.buildings.some(b => b.type === 'granary')) {
      food += 1;
    }
    
    return food;
  }

  // Process city production
  private processCityProduction(city: City, gameState: GameState): void {
    const productionPerTurn = this.calculateProductionOutput(city, gameState);

    // Always accumulate shields, even when producing "nothing" (Civ1 shield bug)
    city.production_points += productionPerTurn;

    // If something is being produced, check for completion
    if (city.production) {
      const totalCost = ProductionManager.getProductionCost(
        city.production.type as ProductionType,
        city.production.item as any
      );

      // Primary completion trigger: shields accumulated >= production cost
      if (totalCost > 0 && city.production_points >= totalCost) {
        this.completeProduction(city, gameState);
        return;
      }

      // Keep turnsRemaining as a live estimate for UI display
      if (totalCost > 0) {
        const remaining = Math.max(0, totalCost - city.production_points);
        city.production.turnsRemaining = productionPerTurn > 0
          ? Math.max(1, Math.ceil(remaining / productionPerTurn))
          : 999;
      }
    }
  }

  // Calculate production output for a city based on worked tiles
  public calculateProductionOutput(city: City, gameState?: GameState): number {
    let totalProduction = 0;
    
    // If no gameState provided, fall back to simple calculation
    if (!gameState) {
      return Math.max(1, Math.floor(city.population / 2));
    }
    
    // Calculate city center production based on underlying terrain (minimum 1)
    const cityTile = gameState.worldMap[city.position.y][city.position.x];
    const cityCenterYield = Math.max(1, this.getTileProductionYield(cityTile));
    totalProduction += cityCenterYield;
    
    // Calculate production from worked tiles
    if (city.workedTiles && city.workedTiles.length > 0) {
      // Use manually selected worked tiles
      for (const workedTile of city.workedTiles) {
        const tileX = city.position.x + workedTile.dx;
        const tileY = city.position.y + workedTile.dy;
        
        // Ensure tile is within map bounds
        if (tileX >= 0 && tileX < gameState.worldMap[0].length && 
            tileY >= 0 && tileY < gameState.worldMap.length) {
          const tile = gameState.worldMap[tileY][tileX];
          totalProduction += this.getTileProductionYield(tile);
        }
      }
    } else {
      // Auto-select tiles based on population (simplified AI selection)
      const availableTiles = this.getAvailableTiles(city, gameState);
      const maxWorkedTiles = Math.min(city.population, availableTiles.length);
      
      // Sort tiles by production yield (prioritize production for this calculation)
      availableTiles.sort((a, b) => this.getTileProductionYield(b) - this.getTileProductionYield(a));
      
      for (let i = 0; i < maxWorkedTiles; i++) {
        totalProduction += this.getTileProductionYield(availableTiles[i]);
      }
    }
    
    // Add production from other buildings that boost production
    if (city.buildings.some(b => b.type === 'factory')) {
      totalProduction = Math.floor(totalProduction * 1.5); // Factory adds 50% production
    }

    // AI production bonus: AI civilizations build ~50% faster, matching the
    // classic Civ 1 difficulty cheat where AI had reduced effective unit costs.
    const cityPlayer = gameState.players.find(p => p.id === city.playerId);
    if (cityPlayer && !cityPlayer.isHuman) {
      totalProduction = Math.ceil(totalProduction * 1.5);
    }

    return Math.max(0, totalProduction);
  }
  
  // Get production yield from a single tile
  private getTileProductionYield(tile: Tile): number {
    return TaxSystem.getTileYields(tile).production;
  }
  
  // Get available tiles around a city (within working radius)
  private getAvailableTiles(city: City, gameState: GameState): Tile[] {
    const availableTiles: Tile[] = [];
    const workRadius = 2; // Cities can work tiles within 2 squares
    
    for (let dy = -workRadius; dy <= workRadius; dy++) {
      for (let dx = -workRadius; dx <= workRadius; dx++) {
        // Skip city center (already counted)
        if (dx === 0 && dy === 0) continue;
        
        const tileX = city.position.x + dx;
        const tileY = city.position.y + dy;
        
        // Ensure tile is within map bounds
        if (tileX >= 0 && tileX < gameState.worldMap[0].length && 
            tileY >= 0 && tileY < gameState.worldMap.length) {
          const tile = gameState.worldMap[tileY][tileX];
          
          // Check if tile is not worked by another city
          const isWorkedByOtherCity = gameState.cities.some(otherCity => 
            otherCity.id !== city.id && 
            otherCity.workedTiles?.some(workedTile => 
              otherCity.position.x + workedTile.dx === tileX &&
              otherCity.position.y + workedTile.dy === tileY
            )
          );
          
          if (!isWorkedByOtherCity) {
            availableTiles.push(tile);
          }
        }
      }
    }
    
    return availableTiles;
  }

  // Complete a production item
  private completeProduction(city: City, gameState: GameState): void {
    if (!city.production) return;

    // Get the player to validate they still have the required technologies
    const player = gameState.players.find(p => p.id === city.playerId);
    if (!player) return;

    const productionType = city.production.type;
    const productionItem = city.production.item;

    // Validate that the player can still produce this item
    const existingBuildings = city.buildings.map(b => b.type as any);
    const hasWaterAccess = WaterAccess.hasWaterAccess(city, gameState.worldMap);
    // Gather all wonders already built across the entire game (wonders are unique)
    const existingWonders = gameState.cities
      .flatMap((c: any) => c.buildings || [])
      .filter((b: any) => b.type && (b.type as string).startsWith('wonder_'))
      .map((b: any) => (b.type as string).replace('wonder_', ''));
    const canStillProduce = ProductionManager.canProduce(
      productionType,
      productionItem as string,
      player.technologies,
      existingBuildings,
      hasWaterAccess,
      existingWonders,
      true // isCurrentlyProducing = true (allows finishing obsolete units)
    );

    if (!canStillProduce) {
      console.warn(`Cannot complete production of ${productionItem} - requirements no longer met`);
      // Clear current production instead of completing it
      city.production = null;
      city.production_points = 0;
      return;
    }

    // Store info about what was completed for auto-production logic
    const completedType = productionType;
    const completedItem = productionItem;

    switch (productionType) {
      case 'unit':
        this.createUnit(city, productionItem as any, gameState);
        break;
      case 'building':
        this.createBuilding(city, productionItem as any);
        break;
      case 'wonder':
        this.createWonder(city, productionItem as string);
        break;
    }

    // Handle production completion based on Civilization 1 mechanics
    if (completedType === 'unit') {
      // Units: reset shields and handle production restart
      city.production_points = 0;
      
      // Check if this is an AI player
      if (!player.isHuman) {
        // For AI players, clear production so AI can re-evaluate what to build
        city.production = null;
        console.log(`AI City ${city.name} completed ${completedItem}, production cleared for AI re-evaluation`);
      } else {
        // For human players, auto-start the same unit type (original Civ1 behavior)
        this.autoStartSameUnit(city, player, gameState, completedItem as UnitType);
      }
    } else if (completedType === 'building' || completedType === 'wonder') {
      // Buildings/Wonders: clear production and reset shields
      city.production = null; // No active production
      city.production_points = 0; // Reset shields
    }
  }

  // Auto-start the same unit type that was just completed
  private autoStartSameUnit(city: City, player: any, gameState: GameState, completedUnitType: UnitType): void {
    const existingBuildings = city.buildings.map(b => b.type as any);
    
    // Get available production options
    const availableOptions = ProductionManager.getAvailableProduction(
      player.technologies,
      existingBuildings,
      this.calculateProductionOutput(city, gameState),
      city.production_points,
      city,
      gameState.worldMap
    );
    
    // Look for the same unit type that was just completed
    const sameUnitOption = availableOptions.find(option => 
      option.type === 'unit' && option.id === completedUnitType
    );
    
    if (sameUnitOption) {
      // Start building the same unit type again
      city.production = {
        type: 'unit',
        item: completedUnitType,
        turnsRemaining: sameUnitOption.turns
      };
      console.log(`City ${city.name} continuing to build ${completedUnitType}`);
    } else {
      // If the same unit type is no longer available, fallback to first available land unit
      const landUnits = availableOptions.filter(option => {
        if (option.type !== 'unit') return false;
        
        // Check if unit is a land unit using imported definitions
        try {
          const unitStats = UNIT_DEFINITIONS[option.id as any];
          return unitStats && unitStats.category === 'land';
        } catch (error) {
          // Fallback: assume basic units are land units
          const basicLandUnits = ['militia', 'settlers', 'phalanx', 'legion', 'cavalry', 'chariot'];
          return basicLandUnits.includes(option.id);
        }
      });
      
      if (landUnits.length > 0) {
        // Start building the first available land unit
        const selectedUnit = landUnits[0];
        city.production = {
          type: 'unit',
          item: selectedUnit.id as any,
          turnsRemaining: selectedUnit.turns
        };
        console.log(`City ${city.name} falling back to building ${selectedUnit.id} (${completedUnitType} no longer available)`);
      } else {
        // No land units available, clear production
        city.production = null;
        console.log(`City ${city.name} has no available units to build`);
      }
    }
  }

  // Create a new unit
  private createUnit(city: City, unitType: string, gameState: GameState): void {
    const newUnit = createUnit(
      `unit-${Date.now()}-${Math.random()}`,
      unitType as UnitType,
      city.position,
      city.playerId
    );

    gameState.units.push(newUnit);
  }

  // Create a new building
  private createBuilding(city: City, buildingType: string): void {
    city.buildings.push({
      type: buildingType as any,
      completedTurn: 0 // Would be set to current turn
    });

    // Notify about building completion
    if (this.onBuildingCompleted) {
      this.onBuildingCompleted(city, buildingType, false);
    }
  }

  // Create a new wonder
  private createWonder(city: City, wonderType: string): void {
    // For now, add wonders to the buildings array with a special prefix
    // In a full implementation, wonders might have their own system
    city.buildings.push({
      type: ('wonder_' + wonderType) as any,
      completedTurn: 0 // Would be set to current turn
    });

    // Notify about wonder completion
    if (this.onBuildingCompleted) {
      this.onBuildingCompleted(city, wonderType, true);
    }
  }

  // Update player resources (gold, science, culture) using the TaxSystem
  private updatePlayerResources(gameState: GameState): void {
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!currentPlayer) return;

    // Calculate empire-wide income using proper Civ-1 tax mechanics
    const summary = TaxSystem.calculatePlayerTaxSummary(currentPlayer, gameState);

    // Apply net gold (income minus maintenance and unit support)
    currentPlayer.gold = Math.max(0, currentPlayer.gold + summary.netGoldIncome);

    // Culture from temples (keep simple flat calculation)
    const playerCities = gameState.cities.filter(c => c.playerId === currentPlayer.id);
    const cultureIncome = playerCities.reduce((sum, city) => {
      let culture = 1;
      if (city.buildings.some(b => b.type === 'temple')) culture += 2;
      return sum + culture;
    }, 0);
    currentPlayer.culture += cultureIncome;

    // Science accumulation
    const scienceIncome = summary.scienceIncome;
    if (scienceIncome > 0) {
      if (currentPlayer.currentResearch) {
        currentPlayer.currentResearchProgress = (currentPlayer.currentResearchProgress || 0) + scienceIncome;

        // Check if research is complete
        const cityCount = playerCities.length;
        const knownCount = currentPlayer.technologies.length;
        const researchCost = getResearchCost(currentPlayer.currentResearch, knownCount, cityCount);
        if (currentPlayer.currentResearchProgress >= researchCost) {
          gameState.events = gameState.events || [];
          gameState.events.push({
            type: 'technologyCompleted',
            playerId: currentPlayer.id,
            technologyType: currentPlayer.currentResearch,
            player: currentPlayer
          });
        }
      } else {
        currentPlayer.science += scienceIncome;
      }
    }
  }

  // Calculate gold income from a city (kept for backward-compat callers; now delegates to TaxSystem)
  private calculateCityGoldIncome(city: City): number {
    // Legacy – not called by processTurn any more but kept in case anything else references it
    return city.population;
  }

  // Calculate science income from a city (kept for backward-compat callers)
  private calculateCityScienceIncome(city: City): number {
    return Math.floor(city.population / 2);
  }

  // Calculate culture income from a city
  private calculateCityCultureIncome(city: City): number {
    let income = 1; // Base culture
    
    // Building bonuses
    if (city.buildings.some(b => b.type === 'temple')) {
      income += 2;
    }
    
    return income;
  }

  // Process fortification progression for current player's units
  private processFortificationProgression(gameState: GameState): void {
    const currentPlayer = gameState.currentPlayer;
    
    gameState.units
      .filter(unit => unit.playerId === currentPlayer)
      .forEach(unit => {
        // Only process units that are in the process of fortifying
        if (unit.fortifying && unit.fortificationTurns === 1) {
          // Complete the 2-turn fortification process
          unit.fortified = true;
          unit.fortifying = false;
          unit.fortificationTurns = 2;
        }
      });
  }

  private processMineBuilding(gameState: GameState): void {
    const currentPlayer = gameState.currentPlayer;
    
    gameState.units
      .filter(unit => unit.playerId === currentPlayer && unit.buildingMine)
      .forEach(unit => {
        // Safely increment regardless of whether mineBuildingTurns was initialised
        unit.mineBuildingTurns = (unit.mineBuildingTurns ?? 0) + 1;
        
        const tile = gameState.worldMap[unit.position.y]?.[unit.position.x];
        const requiredTurns = tile ? this.getMineBuildingTurns(tile.terrain) : 3;
        
        if (unit.mineBuildingTurns >= requiredTurns) {
          if (tile) {
            // Check if mine already exists (in case of race condition)
            const hasMine = tile.improvements?.some(imp => imp.type === ImprovementType.MINE);
            if (!hasMine) {
              // Add mine improvement
              if (!tile.improvements) {
                tile.improvements = [];
              }
              
              tile.improvements.push({
                type: ImprovementType.MINE,
                completedTurn: gameState.turn
              });
              
              // Notify game layer so it can emit terrainImproved
              this.onTerrainImproved?.(unit.position);
            }
          }
          
          // Reset mine building state
          unit.buildingMine = false;
          unit.mineBuildingTurns = 0;
        }
      });
  }

  private processRoadBuilding(gameState: GameState): void {
    const currentPlayer = gameState.currentPlayer;
    
    gameState.units
      .filter(unit => unit.playerId === currentPlayer && unit.buildingRoad)
      .forEach(unit => {
        // Safely increment regardless of whether roadBuildingTurns was initialised
        unit.roadBuildingTurns = (unit.roadBuildingTurns ?? 0) + 1;
        
        const tile = gameState.worldMap[unit.position.y]?.[unit.position.x];
        const requiredTurns = tile ? this.getRoadBuildingTurns(tile.terrain) : 1;
        
        if (unit.roadBuildingTurns >= requiredTurns) {
          if (tile) {
              const hasRoad = tile.improvements?.some(imp => imp.type === ImprovementType.ROAD);
              const hasRailroad = tile.improvements?.some(imp => imp.type === ImprovementType.RAILROAD);
              
              if (!hasRailroad) {
                if (!tile.improvements) {
                  tile.improvements = [];
                }
                
                if (hasRoad) {
                  // Upgrade to railroad
                  tile.improvements = tile.improvements.filter(imp => imp.type !== ImprovementType.ROAD);
                  tile.improvements.push({
                    type: ImprovementType.RAILROAD,
                    completedTurn: gameState.turn
                  });
                } else {
                  // Add road
                  tile.improvements.push({
                    type: ImprovementType.ROAD,
                    completedTurn: gameState.turn
                  });
                }
              this.onTerrainImproved?.(unit.position);
            }
          }
          
          // Reset road building state
          unit.buildingRoad = false;
          unit.roadBuildingTurns = 0;
        }
      });
  }

  /** Returns the number of turns required to build a road on the given terrain. */
  private getRoadBuildingTurns(terrain: TerrainType): number {
    switch (terrain) {
      case TerrainType.GRASSLAND:
      case TerrainType.DESERT:
      case TerrainType.PLAINS:
        return 1;
      case TerrainType.FOREST:
      case TerrainType.JUNGLE:
      case TerrainType.HILLS:
      case TerrainType.MOUNTAINS:
      case TerrainType.RIVER:
        return 2;
      default:
        return 1;
    }
  }

  /** Returns the number of turns required to build a mine on the given terrain. */
  private getMineBuildingTurns(terrain: TerrainType): number {
    switch (terrain) {
      case TerrainType.GRASSLAND:
      case TerrainType.PLAINS:
        return 3;
      case TerrainType.DESERT:
        return 4;
      case TerrainType.HILLS:
        return 4;
      case TerrainType.FOREST:
        return 4;
      case TerrainType.MOUNTAINS:
        return 5;
      case TerrainType.JUNGLE:
        return 5;
      case TerrainType.RIVER:
        return 3;
      default:
        return 3;
    }
  }

  /**
   * Decrement the current player's revolution counter by one turn.
   * When it reaches 0 the flag stays at 0 – Game.ts will detect that and
   * either prompt the human or call AI government selection.
   */
  private decrementRevolution(gameState: GameState): void {
    const player = gameState.players.find((p) => p.id === gameState.currentPlayer);
    if (!player || player.government !== GovernmentType.ANARCHY) return;
    if (player.revolutionTurns !== undefined && player.revolutionTurns > 0) {
      player.revolutionTurns--;
    }
  }

  // Move to next player
  private nextPlayer(gameState: GameState): void {
    const currentIndex = gameState.players.findIndex(p => p.id === gameState.currentPlayer);
    let nextIndex = (currentIndex + 1) % gameState.players.length;
    
    // Skip defeated players
    let attempts = 0;
    while (gameState.players[nextIndex].defeated && attempts < gameState.players.length) {
      nextIndex = (nextIndex + 1) % gameState.players.length;
      attempts++;
    }
    
    // If all players are defeated except current (shouldn't happen), stay with current
    if (attempts >= gameState.players.length) {
      console.warn('All players except current are defeated - this should not happen');
      return;
    }
    
    gameState.currentPlayer = gameState.players[nextIndex].id;
    gameState.currentPlayerIsHuman = gameState.players[nextIndex].isHuman;
  }
}
