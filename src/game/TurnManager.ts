import type { GameState, Unit, City, UnitType, Tile } from '../types/game';
import { ImprovementType, TerrainType } from '../types/game';
import { createUnit } from './Units';
import { getUnitStats } from './UnitDefinitions';
import { getResearchCost } from './TechnologyDefinitions';
import { ProductionManager } from './ProductionManager';
import { UNIT_DEFINITIONS } from './UnitDefinitions';
import { CityGrowthSystem } from './CityGrowthSystem';
import { WaterAccess } from '../utils/WaterAccess';
import { VisibilitySystem } from './VisibilitySystem';
import { TerrainManager } from '../terrain';

export class TurnManager {
  
  // Callback for building completion events
  private onBuildingCompleted?: (city: City, buildingType: string, isWonder: boolean) => void;

  constructor(onBuildingCompleted?: (city: City, buildingType: string, isWonder: boolean) => void) {
    this.onBuildingCompleted = onBuildingCompleted;
  }
  
  // Process end of turn
  public processTurn(gameState: GameState): void {
    // Process fortification progression for current player's units
    this.processFortificationProgression(gameState);
    
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
    const currentPlayer = gameState.currentPlayer;
    
    gameState.cities
      .filter(city => city.playerId === currentPlayer)
      .forEach(city => {
        this.processCityGrowth(city, gameState);
        this.processCityProduction(city, gameState);
      });
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
      // For now, just log the growth event
      console.log(`City ${city.name} grew to population ${city.population}`);
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
    
    // Debug logging for production calculation
    if (productionPerTurn > 2) {
      console.log(`City ${city.name} (pop: ${city.population}) producing ${productionPerTurn} shields per turn`);
    }
    
    // Always accumulate shields, even when producing "nothing" (Civ1 shield bug)
    city.production_points += productionPerTurn;

    // If something is being produced, check for completion
    if (city.production) {
      city.production.turnsRemaining--;
      
      if (city.production.turnsRemaining <= 0) {
        this.completeProduction(city, gameState);
      }
    }
  }

  // Calculate production output for a city based on worked tiles
  private calculateProductionOutput(city: City, gameState?: GameState): number {
    let totalProduction = 0;
    
    // If no gameState provided, fall back to simple calculation
    if (!gameState) {
      return Math.max(1, Math.floor(city.population / 2));
    }
    
    // City center always produces 1 food, 1 shield, 1 trade
    totalProduction += 1;
    
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
    
    // Add production from buildings
    if (city.buildings.some(b => b.type === 'barracks')) {
      totalProduction += 1;
    }
    
    // Add production from other buildings that boost production
    if (city.buildings.some(b => b.type === 'factory')) {
      totalProduction = Math.floor(totalProduction * 1.5); // Factory adds 50% production
    }
    
    // Subtract unit support costs (placeholder - would need unit homeCity implementation)
    // const unitSupportCost = this.calculateUnitSupportCost(city, gameState);
    // totalProduction -= unitSupportCost;
    
    return Math.max(0, totalProduction);
  }
  
  // Get production yield from a single tile
  private getTileProductionYield(tile: Tile): number {
    const terrain = TerrainManager.getTerrain(tile.terrain);
    let production = terrain.productionYield;
    
    // Add resource bonuses (simplified)
    if (tile.resources && tile.resources.length > 0) {
      // Most resources that boost production add +1 shield
      const productionResources = ['coal', 'iron', 'horses'];
      for (const resource of tile.resources) {
        if (productionResources.includes(resource)) {
          production += 1;
        }
      }
    }
    
    // Add improvement bonuses
    if (tile.improvements) {
      for (const improvement of tile.improvements) {
        if (improvement.type === ImprovementType.MINE) {
          // Mine bonuses based on terrain type
          switch (tile.terrain) {
            case TerrainType.DESERT:
              production += 1;
              break;
            case TerrainType.HILLS:
              production += 3;
              break;
            case TerrainType.MOUNTAINS:
              production += 2;
              break;
            default:
              // All other land tiles get +1 production from mines
              if (tile.terrain !== TerrainType.OCEAN) {
                production += 1;
              }
              break;
          }
        }
        // if (improvement.type === 'railroad') production += 1;
      }
    }
    
    return production;
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
    const canStillProduce = ProductionManager.canProduce(
      productionType as 'unit' | 'building',
      productionItem as string,
      player.technologies,
      existingBuildings,
      hasWaterAccess
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
      // Units: reset shields and auto-start the same unit type
      city.production_points = 0;
      this.autoStartSameUnit(city, player, gameState, completedItem as UnitType);
    } else if (completedType === 'building' || completedType === 'wonder') {
      // Buildings/Wonders: clear production but keep shields (Civ1 shield bug)
      // This allows shields to accumulate for the next production choice
      city.production = null; // No active production
      // Keep city.production_points intact - shields continue to accumulate!
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

  // Update player resources (gold, science, culture)
  private updatePlayerResources(gameState: GameState): void {
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!currentPlayer) return;

    // Calculate income from cities
    const playerCities = gameState.cities.filter(c => c.playerId === currentPlayer.id);
    
    let goldIncome = 0;
    let scienceIncome = 0;
    let cultureIncome = 0;

    playerCities.forEach(city => {
      goldIncome += this.calculateCityGoldIncome(city);
      scienceIncome += this.calculateCityScienceIncome(city);
      cultureIncome += this.calculateCityCultureIncome(city);
    });

    // Update player resources
    currentPlayer.gold += goldIncome;
    currentPlayer.culture += cultureIncome;
    
    // Science accumulation: if player has current research, accumulate toward it
    if (currentPlayer.currentResearch && scienceIncome > 0) {
      currentPlayer.currentResearchProgress = (currentPlayer.currentResearchProgress || 0) + scienceIncome;
      
      // Check if research is complete
      const researchCost = getResearchCost(currentPlayer.currentResearch);
      if (currentPlayer.currentResearchProgress >= researchCost) {
        // Research completed! Emit event for discovery modal
        gameState.events = gameState.events || [];
        gameState.events.push({
          type: 'technologyCompleted',
          playerId: currentPlayer.id,
          technologyType: currentPlayer.currentResearch,
          player: currentPlayer
        });
      }
    } else {
      // If no current research, accumulate general science points
      currentPlayer.science += scienceIncome;
    }
  }

  // Calculate gold income from a city
  private calculateCityGoldIncome(city: City): number {
    let income = city.population; // Base income per population
    
    // Building bonuses
    if (city.buildings.some(b => b.type === 'temple')) {
      income += 2;
    }
    
    return income;
  }

  // Calculate science income from a city
  private calculateCityScienceIncome(city: City): number {
    let income = Math.floor(city.population / 2);
    
    // Building bonuses
    if (city.buildings.some(b => b.type === 'library')) {
      income += 3;
    }
    
    return income;
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
        if (unit.mineBuildingTurns !== undefined) {
          unit.mineBuildingTurns++;
          
          // Mine building takes 2 turns to complete
          if (unit.mineBuildingTurns >= 2) {
            const tile = gameState.worldMap[unit.position.y]?.[unit.position.x];
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
                
                console.log(`Mine completed at (${unit.position.x}, ${unit.position.y})`);
                
                // Emit terrain improved event
                // Note: This would be better emitted from the Game class, but we don't have access here
                // The renderer should listen for mine completion via other means
              }
            }
            
            // Reset mine building state
            unit.buildingMine = false;
            unit.mineBuildingTurns = 0;
          }
        }
      });
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
  }
}
