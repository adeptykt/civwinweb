import type { GameState, Unit, City, UnitType } from '../types/game';
import { createUnit } from './Units';
import { getUnitStats } from './UnitDefinitions';
import { getResearchCost } from './TechnologyDefinitions';
import { ProductionManager } from './ProductionManager';
import { UNIT_DEFINITIONS } from './UnitDefinitions';
import { CityGrowthSystem } from './CityGrowthSystem';
import { WaterAccess } from '../utils/WaterAccess';
import { VisibilitySystem } from './VisibilitySystem';

export class TurnManager {
  
  // Process end of turn
  public processTurn(gameState: GameState): void {
    // Process fortification progression for current player's units
    this.processFortificationProgression(gameState);
    
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
    if (!city.production) return;

    const productionPerTurn = this.calculateProductionOutput(city);
    city.production_points += productionPerTurn;

    // Check if production is complete
    city.production.turnsRemaining--;
    
    if (city.production.turnsRemaining <= 0) {
      this.completeProduction(city, gameState);
    }
  }

  // Calculate production output for a city
  private calculateProductionOutput(city: City): number {
    // Base production
    let production = 1;
    
    // Add production from buildings
    if (city.buildings.some(b => b.type === 'barracks')) {
      production += 1;
    }
    
    return production;
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
        // Handle wonder construction
        break;
    }

    // Implement Civ1 behavior: 
    // - If unit completed: reset shields and auto-start another land unit
    // - If building completed: keep shields for next building (the famous "shield bug")
    if (completedType === 'unit') {
      // Reset production shields and auto-start another land unit
      city.production_points = 0;
      this.autoStartNextLandUnit(city, player, gameState);
    } else if (completedType === 'building') {
      // Keep accumulated shields for next building (Civ1 "shield bug" feature)
      // This allows switching to wonders and potentially being close to completion
      // Only clear production item, keep the shields
      city.production = null;
      // Note: city.production_points is NOT reset here - this is the key feature!
    } else {
      // For wonders and other items, clear everything
      city.production = null;
      city.production_points = 0;
    }
  }

  // Auto-start the next available land unit (Civ1 behavior)
  private autoStartNextLandUnit(city: City, player: any, gameState: GameState): void {
    const existingBuildings = city.buildings.map(b => b.type as any);
    
    // Get available land units
    const availableOptions = ProductionManager.getAvailableProduction(
      player.technologies,
      existingBuildings,
      this.calculateProductionOutput(city),
      city.production_points,
      city,
      gameState.worldMap
    );
    
    // Filter for land units only
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
    } else {
      // No land units available, clear production
      city.production = null;
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
