import { GameState, Unit, City, Position, UnitType, TerrainType, Player } from '../types/game';
import { getUnitStats } from './UnitDefinitions';
import { TerrainManager } from '../terrain/index';
import { getCivilization } from './CivilizationDefinitions';
import { CityGrowthSystem } from './CityGrowthSystem';
import { TechnologyType } from './TechnologyDefinitions';

// Forward declaration to avoid circular import
interface GameInterface {
  moveUnit(unitId: string, newPosition: Position): boolean;
  foundCity(unitId: string): boolean;
  buildRoad(unitId: string): boolean;
  buildIrrigation(unitId: string): boolean;
  fortifyUnit(unitId: string): boolean;
  wakeUnit(unitId: string): boolean;
}

export class AIPlayer {
  
  /**
   * Execute a full AI turn for the given player
   */
  public static async executeTurn(gameState: GameState, playerId: string, game?: GameInterface): Promise<void> {
    console.log(`AI Player ${playerId} starting turn`);
    
    // Get all units for this AI player
    const aiUnits = gameState.units.filter(unit => unit.playerId === playerId);
    
    // Process each unit with AI decision making
    for (const unit of aiUnits) {
      if (unit.movementPoints > 0 && !unit.fortified && unit.fortifying !== true && unit.sleeping !== true) {
        this.processAIUnit(unit, gameState, game);
      }
      // Occasionally re-evaluate fortified defenders (every few turns)
      else if (unit.fortified && gameState.turn % 5 === 0) {
        this.reevaluateFortifiedUnit(unit, gameState, game);
      }
    }
    
    // Process AI cities
    this.processAICities(gameState, playerId);
    
    console.log(`AI Player ${playerId} completed turn`);
  }
  
  /**
   * Process an individual AI unit
   */
  private static processAIUnit(unit: Unit, gameState: GameState, game?: GameInterface): void {
    const unitStats = getUnitStats(unit.type);
    
    switch (unit.type) {
      case UnitType.SETTLERS:
        this.handleSettlerAI(unit, gameState, game);
        break;
      case UnitType.MILITIA:
      case UnitType.WARRIOR:
      case UnitType.PHALANX:
      case UnitType.LEGION:
      case UnitType.KNIGHTS:
      case UnitType.MUSKETEERS:
      case UnitType.RIFLEMEN:
      case UnitType.ARTILLERY:
      case UnitType.ARMOR:
      case UnitType.MECH_INF:
        this.handleMilitaryAI(unit, gameState, game);
        break;
      default:
        this.handleDefaultUnitAI(unit, gameState, game);
        break;
    }
  }
  
  /**
   * AI logic for settler units - find good city locations
   */
  private static handleSettlerAI(unit: Unit, gameState: GameState, game?: GameInterface): void {
    // Check if we should build infrastructure around existing cities first
    const nearbyCity = this.findNearbyCity(unit.position, gameState, unit.playerId, 3);
    
    if (nearbyCity) {
      // Priority: build infrastructure around cities
      const infrastructureAction = this.findBestInfrastructureAction(unit, nearbyCity, gameState);
      
      if (infrastructureAction) {
        if (infrastructureAction.action === 'buildRoad') {
          console.log(`AI settler ${unit.id} building road at`, unit.position);
          this.buildRoadAI(unit, gameState, game);
          return;
        } else if (infrastructureAction.action === 'buildIrrigation') {
          console.log(`AI settler ${unit.id} building irrigation at`, unit.position);
          this.buildIrrigationAI(unit, gameState, game);
          return;
        } else if (infrastructureAction.action === 'moveTo' && infrastructureAction.target) {
          console.log(`AI settler ${unit.id} moving to build infrastructure at`, infrastructureAction.target);
          this.moveUnitTowards(unit, infrastructureAction.target, gameState, game);
          return;
        }
      }
    }
    
    // In early game (first 10 turns), be more aggressive about founding cities
    const isEarlyGame = gameState.turn <= 10;
    
    // Check current position first - if it's decent and early game, just found here
    if (isEarlyGame && this.isValidCityLocation(unit.position, gameState)) {
      const currentScore = this.evaluateCityLocation(unit.position, gameState);
      // In early game, accept any location with score > 1 (very low threshold)
      if (currentScore > 1) {
        this.foundAICity(unit, gameState);
        return;
      }
    }
    
    // Look for good city founding locations
    const bestLocation = this.findBestCityLocation(unit.position, gameState, isEarlyGame);
    if (bestLocation) {
      if (this.isAtPosition(unit.position, bestLocation)) {
        // We're at a good location, found a city
        if (game) {
          game.foundCity(unit.id);
        } else {
          this.foundAICity(unit, gameState);
        }
      } else {
        // Move towards the best location
        this.moveUnitTowards(unit, bestLocation, gameState, game);
      }
    } else {
      // No good location found
      if (isEarlyGame && this.isValidCityLocation(unit.position, gameState)) {
        // In early game, found city at current position if it's valid
        if (game) {
          game.foundCity(unit.id);
        } else {
          this.foundAICity(unit, gameState);
        }
      } else {
        // Explore to find a better location
        this.exploreRandomly(unit, gameState, game);
      }
    }
  }
  
  /**
   * AI logic for military units - patrol and defend
   */
  private static handleMilitaryAI(unit: Unit, gameState: GameState, game?: GameInterface): void {
    // First, check if this unit should stay and defend a city
    const shouldDefendCity = this.shouldUnitDefendCity(unit, gameState);
    
    if (shouldDefendCity) {
      // Unit should stay and defend - fortify if not already fortified
      if (!unit.fortified && !unit.fortifying) {
        console.log(`AI unit ${unit.id} (${unit.type}) fortifying to defend city`);
        if (game) {
          game.fortifyUnit(unit.id);
        } else {
          // Fallback: set fortifying flag manually
          unit.fortifying = true;
          unit.movementPoints = 0;
        }
      }
      return;
    }
    
    // Use smart targeting to find the best enemy target (cities prioritized)
    const bestTarget = this.findBestEnemyTarget(unit, gameState);
    
    if (bestTarget && this.getDistance(unit.position, bestTarget.position) <= 6) {
      if (bestTarget.type === 'city') {
        console.log(`AI unit ${unit.id} targeting enemy city ${(bestTarget.target as City).name}`);
      } else {
        console.log(`AI unit ${unit.id} targeting enemy unit ${(bestTarget.target as Unit).type}`);
      }
      this.moveUnitTowards(unit, bestTarget.position, gameState, game);
      return;
    }
    
    // Fallback: look for any nearby enemies using old method
    const enemyTarget = this.findNearestEnemy(unit, gameState);
    
    if (enemyTarget && this.getDistance(unit.position, enemyTarget.position) <= 3) {
      // Move towards enemy unit
      this.moveUnitTowards(unit, enemyTarget.position, gameState, game);
    } else {
      // Check if any cities need defense before going on patrol
      const cityNeedingDefense = this.findCityNeedingDefense(unit, gameState);
      if (cityNeedingDefense) {
        console.log(`AI unit ${unit.id} moving to defend ${cityNeedingDefense.name}`);
        this.moveUnitTowards(unit, cityNeedingDefense.position, gameState, game);
      } else {
        // Patrol around cities or explore
        const nearestCity = this.findNearestFriendlyCity(unit, gameState);
        if (nearestCity && this.getDistance(unit.position, nearestCity.position) > 2) {
          // Move towards city to defend
          this.moveUnitTowards(unit, nearestCity.position, gameState, game);
        } else {
          // Patrol randomly
          this.exploreRandomly(unit, gameState, game);
        }
      }
    }
  }
  
  /**
   * Default AI logic for other unit types
   */
  private static handleDefaultUnitAI(unit: Unit, gameState: GameState, game?: GameInterface): void {
    // Simple exploration behavior
    this.exploreRandomly(unit, gameState, game);
  }
  
  /**
   * Move a unit towards a target position with some randomness
   */
  private static moveUnitTowards(unit: Unit, target: Position, gameState: GameState, game?: GameInterface): void {
    if (unit.movementPoints <= 0) return;
    
    const possibleMoves = this.getValidMoves(unit.position, gameState);
    if (possibleMoves.length === 0) return;
    
    // Add randomness for settlers to make exploration more varied
    const isSettler = unit.type === UnitType.SETTLERS;
    const randomnessChance = isSettler ? 0.3 : 0.1; // 30% chance for settlers, 10% for others
    
    if (Math.random() < randomnessChance) {
      // Take a random move instead of optimal
      const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      if (game) {
        game.moveUnit(unit.id, randomMove);
      } else {
        unit.position = randomMove;
        unit.movementPoints = Math.max(0, unit.movementPoints - 1);
      }
      return;
    }
    
    // Find moves that get us closer to the target
    const goodMoves: Array<{ move: Position; distance: number }> = [];
    let bestDistance = this.getDistance(unit.position, target);
    
    for (const move of possibleMoves) {
      const distance = this.getDistance(move, target);
      if (distance < bestDistance) {
        goodMoves.push({ move, distance });
        bestDistance = distance;
      }
    }
    
    // If we have good moves, pick randomly among the best ones
    let chosenMove;
    if (goodMoves.length > 0) {
      // Group moves by distance and pick randomly from the best group
      const bestMoves = goodMoves.filter(m => m.distance === bestDistance);
      chosenMove = bestMoves[Math.floor(Math.random() * bestMoves.length)].move;
    } else {
      // No improving moves, pick randomly
      chosenMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    }
    
    // Execute the move using game's moveUnit method if available (for proper combat)
    if (game) {
      game.moveUnit(unit.id, chosenMove);
    } else {
      // Fallback to direct movement (old behavior)
      unit.position = chosenMove;
      unit.movementPoints = Math.max(0, unit.movementPoints - 1);
    }
  }
  
  /**
   * Make a unit explore randomly with some directional bias for settlers
   */
  private static exploreRandomly(unit: Unit, gameState: GameState, game?: GameInterface): void {
    if (unit.movementPoints <= 0) return;
    
    const possibleMoves = this.getValidMoves(unit.position, gameState);
    if (possibleMoves.length === 0) return;
    
    let chosenMove;
    
    // For settlers, add some bias towards unexplored areas and away from other cities
    if (unit.type === UnitType.SETTLERS) {
      const weightedMoves: Array<{ move: Position; weight: number }> = [];
      
      for (const move of possibleMoves) {
        let weight = 1; // Base weight
        
        // Bias away from existing cities (both friendly and enemy)
        const nearestCity = this.findNearestCityAny(move, gameState);
        if (nearestCity) {
          const distanceToCity = this.getDistance(move, nearestCity.position);
          if (distanceToCity < 4) {
            weight *= 0.3; // Strongly avoid areas near cities
          } else if (distanceToCity < 6) {
            weight *= 0.7; // Moderately avoid areas near cities
          }
        }
        
        // Bias towards areas with good terrain for cities
        const tile = gameState.worldMap[move.y]?.[move.x];
        if (tile) {
          switch (tile.terrain) {
            case TerrainType.GRASSLAND:
            case TerrainType.RIVER:
              weight *= 1.5; // Prefer good city locations
              break;
            case TerrainType.PLAINS:
            case TerrainType.HILLS:
              weight *= 1.2; // Slightly prefer decent locations
              break;
            case TerrainType.DESERT:
            case TerrainType.SWAMP:
              weight *= 0.5; // Avoid poor locations
              break;
          }
        }
        
        weightedMoves.push({ move, weight });
      }
      
      // Choose move based on weights
      const totalWeight = weightedMoves.reduce((sum, item) => sum + item.weight, 0);
      let random = Math.random() * totalWeight;
      
      for (const weightedMove of weightedMoves) {
        random -= weightedMove.weight;
        if (random <= 0) {
          chosenMove = weightedMove.move;
          break;
        }
      }
      
      // Fallback to first move if something went wrong
      chosenMove = chosenMove || weightedMoves[0].move;
    } else {
      // For non-settlers, just choose randomly
      chosenMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    }
    
    // Execute the move using game's moveUnit method if available (for proper combat)
    if (game) {
      game.moveUnit(unit.id, chosenMove);
    } else {
      // Fallback to direct movement (old behavior)
      unit.position = chosenMove;
      unit.movementPoints = Math.max(0, unit.movementPoints - 1);
    }
  }
  
  /**
   * Get all valid moves from a position
   */
  private static getValidMoves(position: Position, gameState: GameState): Position[] {
    const moves: Position[] = [];
    // Allow all 8 directions (including diagonals)
    const directions = [
      [-1, -1], [0, -1], [1, -1], // Northwest, North, Northeast
      [-1,  0],          [1,  0], // West, East
      [-1,  1], [0,  1], [1,  1]  // Southwest, South, Southeast
    ];
    
    for (const [dx, dy] of directions) {
      const newPos = {
        x: position.x + dx,
        y: position.y + dy
      };
      
      if (this.isValidPosition(newPos, gameState)) {
        moves.push(newPos);
      }
    }
    
    return moves;
  }
  
  /**
   * Check if a position is valid for movement
   */
  private static isValidPosition(position: Position, gameState: GameState): boolean {
    const mapWidth = gameState.worldMap[0]?.length || 80;
    const mapHeight = gameState.worldMap.length || 50;
    
    // Handle horizontal wrapping
    let { x, y } = position;
    x = ((x % mapWidth) + mapWidth) % mapWidth;
    
    // Check vertical bounds
    if (y < 0 || y >= mapHeight) return false;
    
    // Check terrain
    const tile = gameState.worldMap[y]?.[x];
    if (!tile) return false;
    
    // Can't move to ocean (simple check for land units)
    if (tile.terrain === TerrainType.OCEAN) return false;
    
    return TerrainManager.isPassable(tile.terrain);
  }
  
  /**
   * Find the best location for founding a city with some randomness
   */
  private static findBestCityLocation(currentPos: Position, gameState: GameState, isEarlyGame: boolean = false): Position | null {
    const searchRadius = isEarlyGame ? 2 : 5; // Much smaller search radius in early game
    let bestLocation: Position | null = null;
    let bestScore = isEarlyGame ? 1 : 3; // Much lower threshold in early game
    
    // Collect all valid locations with their scores
    const validLocations: Array<{ position: Position; score: number }> = [];
    
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        const pos = {
          x: currentPos.x + dx,
          y: currentPos.y + dy
        };
        
        if (this.isValidCityLocation(pos, gameState)) {
          const score = this.evaluateCityLocation(pos, gameState);
          if (score > bestScore) {
            validLocations.push({ position: pos, score });
          }
        }
      }
    }
    
    // If we have valid locations, add some randomness to the selection
    if (validLocations.length > 0) {
      // Sort by score (best first)
      validLocations.sort((a, b) => b.score - a.score);
      
      // Add randomness: 60% chance to pick the best, 30% for second best, 10% for others
      const rand = Math.random();
      if (rand < 0.6) {
        // Pick the best location
        bestLocation = validLocations[0].position;
      } else if (rand < 0.9 && validLocations.length > 1) {
        // Pick the second best location
        bestLocation = validLocations[1].position;
      } else if (validLocations.length > 2) {
        // Pick randomly from remaining locations
        const randomIndex = Math.floor(Math.random() * Math.min(3, validLocations.length - 2)) + 2;
        bestLocation = validLocations[Math.min(randomIndex, validLocations.length - 1)].position;
      } else {
        // Fallback to best if we don't have enough options
        bestLocation = validLocations[0].position;
      }
    }
    
    return bestLocation;
  }
  
  /**
   * Check if a location is valid for founding a city
   */
  private static isValidCityLocation(position: Position, gameState: GameState): boolean {
    const mapWidth = gameState.worldMap[0]?.length || 80;
    const mapHeight = gameState.worldMap.length || 50;
    
    // Handle wrapping
    let { x, y } = position;
    x = ((x % mapWidth) + mapWidth) % mapWidth;
    
    if (y < 0 || y >= mapHeight) return false;
    
    const tile = gameState.worldMap[y]?.[x];
    if (!tile) return false;
    
    // Check if terrain allows city founding
    if (!TerrainManager.canFoundCity(tile.terrain)) return false;
    
    // Check if there's already a city nearby
    // Enforce minimum distance of 3 squares between cities
    const minDistance = 3;
    
    for (const city of gameState.cities) {
      if (this.getDistance(position, city.position) < minDistance) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Evaluate how good a location is for a city
   */
  private static evaluateCityLocation(position: Position, gameState: GameState): number {
    let score = 0;
    
    const tile = gameState.worldMap[position.y]?.[position.x];
    if (!tile) return 0;
    
    // Base score for any valid land
    score += 2;
    
    // Prefer certain terrain types
    switch (tile.terrain) {
      case TerrainType.GRASSLAND:
        score += 3;
        break;
      case TerrainType.RIVER:
        score += 5;
        break;
      case TerrainType.HILLS:
        score += 2;
        break;
      default:
        score += 1;
        break;
    }
    
    // Bonus for being near water but not on it
    const nearWater = this.isNearTerrain(position, TerrainType.OCEAN, gameState);
    if (nearWater) score += 2;
    
    // Small bonus for being near rivers
    const nearRiver = this.isNearTerrain(position, TerrainType.RIVER, gameState);
    if (nearRiver) score += 1;
    
    return score;
  }
  
  /**
   * Check if a position is near a specific terrain type
   */
  private static isNearTerrain(position: Position, terrainType: TerrainType, gameState: GameState): boolean {
    const neighbors = this.getValidMoves(position, gameState);
    for (const neighbor of neighbors) {
      const tile = gameState.worldMap[neighbor.y]?.[neighbor.x];
      if (tile && tile.terrain === terrainType) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Generate a city name for an AI player based on their civilization
   */
  private static generateCityNameForPlayer(player: Player): string {
    const civilization = getCivilization(player.civilizationType);
    
    // Get available city names (not yet used)
    const availableCityNames = civilization.cities.filter(cityName => 
      !player.usedCityNames.includes(cityName)
    );
    
    // If we have available civilization-specific names, use the first one
    if (availableCityNames.length > 0) {
      return availableCityNames[0];
    }
    
    // If all civilization names are used, generate a random name
    const cityPrefixes = [
      'New', 'Old', 'Great', 'Little', 'Upper', 'Lower', 'North', 'South', 'East', 'West',
      'Fort', 'Port', 'Mount', 'Lake', 'River', 'Valley', 'Hill', 'Stone', 'Golden', 'Silver'
    ];
    
    const citySuffixes = [
      'town', 'city', 'burg', 'holm', 'ford', 'haven', 'port', 'field', 'wood', 'hill',
      'vale', 'stead', 'bridge', 'marsh', 'grove', 'ridge', 'fall', 'glen', 'moor', 'wick'
    ];
    
    let randomName: string;
    let attempts = 0;
    const maxAttempts = 50; // Prevent infinite loops
    
    do {
      const prefix = cityPrefixes[Math.floor(Math.random() * cityPrefixes.length)];
      const suffix = citySuffixes[Math.floor(Math.random() * citySuffixes.length)];
      randomName = `${prefix} ${suffix}`;
      attempts++;
    } while (player.usedCityNames.includes(randomName) && attempts < maxAttempts);
    
    // If we still have a duplicate after max attempts, add a number
    if (player.usedCityNames.includes(randomName)) {
      randomName = `${randomName} ${player.usedCityNames.length + 1}`;
    }
    
    return randomName;
  }
  
  /**
   * Found a city with an AI settler
   */
  private static foundAICity(settler: Unit, gameState: GameState): void {
    // Get the player to access their civilization for proper city naming
    const player = gameState.players.find(p => p.id === settler.playerId);
    if (!player) {
      console.warn('foundAICity: Player not found for settler', settler.playerId);
      return;
    }

    // Generate a proper city name based on the AI player's civilization
    const cityName = this.generateCityNameForPlayer(player);
    
    // Create the city
    const city: City = {
      id: `city-${Date.now()}-${Math.random()}`,
      name: cityName,
      position: settler.position,
      population: 1,
      playerId: settler.playerId,
      buildings: [],
      production: null,
      food: 0,
      foodStorage: 0,
      foodStorageCapacity: 0,
      production_points: 0,
      science: 0,
      culture: 0
    };
    
    // Initialize food storage system
    CityGrowthSystem.initializeCityFoodStorage(city);
    
    gameState.cities.push(city);
    
    // Mark the city name as used
    if (!player.usedCityNames.includes(cityName)) {
      player.usedCityNames.push(cityName);
    }
    
    // Remove the settler
    gameState.units = gameState.units.filter(u => u.id !== settler.id);
  }
  
  /**
   * Find the nearest enemy unit
   */
  private static findNearestEnemy(unit: Unit, gameState: GameState): Unit | null {
    let nearestEnemy: Unit | null = null;
    let nearestDistance = Infinity;
    
    for (const otherUnit of gameState.units) {
      if (otherUnit.playerId !== unit.playerId) {
        const distance = this.getDistance(unit.position, otherUnit.position);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestEnemy = otherUnit;
        }
      }
    }
    
    return nearestEnemy;
  }
  
  /**
   * Find the nearest enemy city
   */
  private static findNearestEnemyCity(unit: Unit, gameState: GameState): City | null {
    let nearestCity: City | null = null;
    let nearestDistance = Infinity;
    
    for (const city of gameState.cities) {
      if (city.playerId !== unit.playerId) {
        const distance = this.getDistance(unit.position, city.position);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestCity = city;
        }
      }
    }
    
    return nearestCity;
  }

  /**
   * Find the nearest friendly city
   */
  private static findNearestFriendlyCity(unit: Unit, gameState: GameState): City | null {
    let nearestCity: City | null = null;
    let nearestDistance = Infinity;
    
    for (const city of gameState.cities) {
      if (city.playerId === unit.playerId) {
        const distance = this.getDistance(unit.position, city.position);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestCity = city;
        }
      }
    }
    
    return nearestCity;
  }
  
  /**
   * Find the best enemy target (prioritizing undefended cities, then weak units)
   */
  private static findBestEnemyTarget(unit: Unit, gameState: GameState): { position: Position; type: 'city' | 'unit'; target: City | Unit } | null {
    const searchRadius = 8;
    let bestTarget: { position: Position; type: 'city' | 'unit'; target: City | Unit; priority: number } | null = null;
    
    // Check enemy cities first (highest priority)
    for (const city of gameState.cities) {
      if (city.playerId !== unit.playerId) {
        const distance = this.getDistance(unit.position, city.position);
        if (distance <= searchRadius) {
          // Check if city is defended
          const defenders = gameState.units.filter(u => 
            u.position.x === city.position.x && 
            u.position.y === city.position.y && 
            u.playerId === city.playerId
          );
          
          let priority = 100; // Base city priority
          if (defenders.length === 0) {
            priority += 50; // Undefended city bonus
          }
          priority -= distance * 2; // Closer is better
          
          if (!bestTarget || priority > bestTarget.priority) {
            bestTarget = {
              position: city.position,
              type: 'city',
              target: city,
              priority
            };
          }
        }
      }
    }
    
    // Check enemy units (lower priority than cities)
    for (const enemyUnit of gameState.units) {
      if (enemyUnit.playerId !== unit.playerId) {
        const distance = this.getDistance(unit.position, enemyUnit.position);
        if (distance <= searchRadius) {
          let priority = 40; // Base unit priority (lower than cities)
          priority -= distance * 3; // Distance penalty
          
          // Prefer attacking weaker or valuable units
          const enemyStats = getUnitStats(enemyUnit.type);
          if (enemyStats.defense < 2) priority += 10; // Weak units
          if (enemyUnit.type === UnitType.SETTLERS) priority += 15; // Settlers are valuable targets
          
          if (!bestTarget || priority > bestTarget.priority) {
            bestTarget = {
              position: enemyUnit.position,
              type: 'unit',
              target: enemyUnit,
              priority
            };
          }
        }
      }
    }
    
    return bestTarget;
  }
  
  /**
   * Calculate distance between two positions (considering map wrapping)
   */
  private static getDistance(pos1: Position, pos2: Position): number {
    // Get map dimensions from a sample tile (assuming standard 80x50 world)
    const mapWidth = 80; // Standard world width with wrapping
    
    // Calculate direct distance
    const directDx = Math.abs(pos1.x - pos2.x);
    
    // Calculate wrapped distance (shortest path around the world)
    const wrappedDx = mapWidth - directDx;
    
    // Use shorter distance for X axis
    const dx = Math.min(directDx, wrappedDx);
    const dy = Math.abs(pos1.y - pos2.y);
    
    return dx + dy; // Manhattan distance with wrapping
  }
  
  /**
   * Check if two positions are the same
   */
  private static isAtPosition(pos1: Position, pos2: Position): boolean {
    return pos1.x === pos2.x && pos1.y === pos2.y;
  }
  
  /**
   * Process AI cities - set production, etc.
   */
  private static processAICities(gameState: GameState, playerId: string): void {
    const aiCities = gameState.cities.filter(city => city.playerId === playerId);
    
    for (const city of aiCities) {
      if (!city.production) {
        // Choose what to produce
        this.setAICityProduction(city, gameState);
      }
    }
  }
  
  /**
   * Set production for an AI city
   */
  private static setAICityProduction(city: City, gameState: GameState): void {
    const playerUnits = gameState.units.filter(u => u.playerId === city.playerId);
    const playerCities = gameState.cities.filter(c => c.playerId === city.playerId);
    
    const settlerCount = playerUnits.filter(u => u.type === UnitType.SETTLERS).length;
    
    // Count all military units
    const militaryTypes: UnitType[] = [
      UnitType.MILITIA, UnitType.WARRIOR, UnitType.PHALANX, UnitType.LEGION,
      UnitType.KNIGHTS, UnitType.MUSKETEERS, UnitType.RIFLEMEN, UnitType.ARTILLERY,
      UnitType.ARMOR, UnitType.MECH_INF, UnitType.CAVALRY, UnitType.CHARIOT,
      UnitType.CATAPULT, UnitType.CANNON
    ];
    const militaryCount = playerUnits.filter(u => militaryTypes.includes(u.type)).length;
    
    // Count settlers already in production
    const settlersInProduction = playerCities.filter(c => 
      c.production && c.production.type === 'unit' && c.production.item === UnitType.SETTLERS
    ).length;
    
    // Total settlers (existing + in production)
    const totalSettlers = settlerCount + settlersInProduction;
    
    // Check city defense needs first - highest priority
    const defendersInCity = this.countCityDefenders(city, gameState);
    const desiredDefenders = this.calculateDesiredDefenders(city, gameState);
    const needsDefense = defendersInCity < desiredDefenders;
    
    // Check for nearby enemy cities to determine if we need more military
    const nearbyEnemyCities = gameState.cities.filter(enemyCity => 
      enemyCity.playerId !== city.playerId && 
      this.getDistance(city.position, enemyCity.position) <= 8
    );
    
    // Check for nearby enemy units
    const nearbyEnemyUnits = gameState.units.filter(enemyUnit => 
      enemyUnit.playerId !== city.playerId && 
      this.getDistance(city.position, enemyUnit.position) <= 5
    );
    
    const hasNearbyThreats = nearbyEnemyCities.length > 0 || nearbyEnemyUnits.length > 0;
    
    // Determine optimal settler count based on game stage and cities
    const isEarlyGame = gameState.turn <= 15;
    const isMidGame = gameState.turn > 15 && gameState.turn <= 50;
    
    let maxDesiredSettlers: number;
    if (isEarlyGame) {
      // Early game: 1 settler per city + 1 spare
      maxDesiredSettlers = Math.min(playerCities.length + 1, 4);
    } else if (isMidGame) {
      // Mid game: fewer settlers, focus on expansion completion
      maxDesiredSettlers = Math.max(2, Math.floor(playerCities.length * 0.5));
    } else {
      // Late game: minimal settlers, focus on infrastructure
      maxDesiredSettlers = Math.max(1, Math.floor(playerCities.length * 0.25));
    }
    
    // Calculate desired military based on threats
    const baseMilitaryNeeds = Math.max(2, playerCities.length);
    const threatMultiplier = hasNearbyThreats ? 2 : 1;
    const desiredMilitary = baseMilitaryNeeds * threatMultiplier;
    
    // Production priority logic
    // 1. HIGHEST PRIORITY: City lacks adequate defense
    if (needsDefense) {
      console.log(`AI city ${city.name} needs defense: ${defendersInCity}/${desiredDefenders} defenders - producing military`);
      const bestMilitaryUnit = this.getBestMilitaryUnit(city.playerId, gameState);
      city.production = {
        type: 'unit',
        item: bestMilitaryUnit.type,
        turnsRemaining: bestMilitaryUnit.turns
      };
    }
    // 2. HIGH PRIORITY: Threats nearby and insufficient military
    else if (hasNearbyThreats && militaryCount < desiredMilitary) {
      console.log(`AI city ${city.name} producing military due to nearby threats (${nearbyEnemyCities.length} cities, ${nearbyEnemyUnits.length} units)`);
      const bestMilitaryUnit = this.getBestMilitaryUnit(city.playerId, gameState);
      city.production = {
        type: 'unit',
        item: bestMilitaryUnit.type,
        turnsRemaining: bestMilitaryUnit.turns
      };
    }
    // 3. MEDIUM PRIORITY: Early game expansion needs
    else if (totalSettlers < maxDesiredSettlers && isEarlyGame) {
      city.production = {
        type: 'unit',
        item: UnitType.SETTLERS,
        turnsRemaining: 3
      };
    }
    // 4. MEDIUM PRIORITY: Basic military needs
    else if (militaryCount < baseMilitaryNeeds) {
      const bestMilitaryUnit = this.getBestMilitaryUnit(city.playerId, gameState);
      city.production = {
        type: 'unit',
        item: bestMilitaryUnit.type,
        turnsRemaining: bestMilitaryUnit.turns
      };
    }
    // 5. LOW PRIORITY: Mid/late game settlers
    else if (totalSettlers < maxDesiredSettlers) {
      city.production = {
        type: 'unit',
        item: UnitType.SETTLERS,
        turnsRemaining: 3
      };
    }
    // 6. LOWEST PRIORITY: Infrastructure
    else {
      // Focus on infrastructure and buildings
      city.production = {
        type: 'building',
        item: 'granary',
        turnsRemaining: 4
      };
    }
  }

  /**
   * Get the best military unit available to a player based on their technologies
   */
  private static getBestMilitaryUnit(playerId: string, gameState: GameState): { type: UnitType; turns: number } {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { type: UnitType.MILITIA, turns: 2 };
    }

    // Military units in order of preference (best to worst)
    const militaryUnits = [
      { type: UnitType.RIFLEMEN, cost: 8, requiredTech: TechnologyType.CONSCRIPTION },
      { type: UnitType.MUSKETEERS, cost: 6, requiredTech: TechnologyType.GUNPOWDER },
      { type: UnitType.KNIGHTS, cost: 5, requiredTech: TechnologyType.CHIVALRY },
      { type: UnitType.LEGION, cost: 4, requiredTech: TechnologyType.IRON_WORKING },
      { type: UnitType.PHALANX, cost: 3, requiredTech: TechnologyType.BRONZE_WORKING },
      { type: UnitType.MILITIA, cost: 2, requiredTech: null }
    ];

    // Find the best unit the player can build
    for (const unitInfo of militaryUnits) {
      if (!unitInfo.requiredTech || player.technologies.includes(unitInfo.requiredTech)) {
        const turns = Math.ceil(unitInfo.cost / 1); // Base production capacity
        return {
          type: unitInfo.type,
          turns: turns
        };
      }
    }

    // Fallback to militia
    return { type: UnitType.MILITIA, turns: 2 };
  }

  /**
   * Find a nearby city belonging to the specified player
   */
  private static findNearbyCity(position: Position, gameState: GameState, playerId: string, maxDistance: number): City | null {
    const playerCities = gameState.cities.filter(c => c.playerId === playerId);
    
    for (const city of playerCities) {
      if (this.getDistance(position, city.position) <= maxDistance) {
        return city;
      }
    }
    
    return null;
  }

  /**
   * Find the best infrastructure action for a settler near a city
   */
  private static findBestInfrastructureAction(unit: Unit, city: City, gameState: GameState): { action: string; target?: Position } | null {
    const currentTile = gameState.worldMap[unit.position.y]?.[unit.position.x];
    if (!currentTile) return null;

    // Priority 1: Build road on current tile if it doesn't have one
    const hasRoad = currentTile.improvements?.some(imp => imp.type === 'road');
    if (!hasRoad && this.canBuildRoad(currentTile)) {
      return { action: 'buildRoad' };
    }

    // Priority 2: Build irrigation on current tile if beneficial
    const hasIrrigation = currentTile.improvements?.some(imp => imp.type === 'irrigation');
    if (!hasIrrigation && this.canBuildIrrigation(currentTile, unit.position, gameState)) {
      return { action: 'buildIrrigation' };
    }

    // Priority 3: Move to nearby tiles around the city that need infrastructure
    const searchRadius = 2;
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        const targetPos = {
          x: city.position.x + dx,
          y: city.position.y + dy
        };

        // Skip if out of bounds
        if (targetPos.y < 0 || targetPos.y >= gameState.worldMap.length ||
            targetPos.x < 0 || targetPos.x >= gameState.worldMap[0].length) {
          continue;
        }

        const targetTile = gameState.worldMap[targetPos.y][targetPos.x];
        const targetHasRoad = targetTile.improvements?.some(imp => imp.type === 'road');
        
        // Look for tiles that need roads
        if (!targetHasRoad && this.canBuildRoad(targetTile)) {
          return { action: 'moveTo', target: targetPos };
        }
      }
    }

    return null;
  }

  /**
   * Check if a road can be built on a tile
   */
  private static canBuildRoad(tile: any): boolean {
    // Roads can be built on most land terrains
    const roadableTerrains = ['grassland', 'plains', 'desert', 'hills', 'forest', 'jungle'];
    return roadableTerrains.includes(tile.terrain);
  }

  /**
   * Check if irrigation can be built on a tile
   */
  private static canBuildIrrigation(tile: any, position: Position, gameState: GameState): boolean {
    // Irrigation can be built on specific terrains
    const irrigatableTerrains = ['desert', 'grassland', 'hills', 'plains'];
    if (!irrigatableTerrains.includes(tile.terrain)) {
      return false;
    }

    // Check water access (simplified - check for adjacent river or ocean)
    return this.hasWaterAccess(position, gameState);
  }

  /**
   * Check if a position has water access for irrigation
   */
  private static hasWaterAccess(position: Position, gameState: GameState): boolean {
    const directions = [
      { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }
    ];

    for (const dir of directions) {
      const adjX = position.x + dir.dx;
      const adjY = position.y + dir.dy;

      if (adjY >= 0 && adjY < gameState.worldMap.length &&
          adjX >= 0 && adjX < gameState.worldMap[0].length) {
        const adjTile = gameState.worldMap[adjY][adjX];
        
        // Water access from river or ocean
        if (adjTile.terrain === 'river' || adjTile.terrain === 'ocean') {
          return true;
        }

        // Water access from irrigated tile
        const hasIrrigation = adjTile.improvements?.some(imp => imp.type === 'irrigation');
        if (hasIrrigation) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * AI logic for building roads
   */
  private static buildRoadAI(unit: Unit, _gameState: GameState, game?: GameInterface): void {
    if (game) {
      // Use the game's buildRoad method for proper implementation
      const success = game.buildRoad(unit.id);
      if (success) {
        console.log(`AI settler ${unit.id} built road at (${unit.position.x}, ${unit.position.y})`);
      } else {
        console.log(`AI settler ${unit.id} failed to build road at (${unit.position.x}, ${unit.position.y})`);
      }
    } else {
      // Fallback: simulate road building by ending the unit's turn
      unit.movementPoints = 0;
      console.log(`AI settler ${unit.id} building road at (${unit.position.x}, ${unit.position.y})`);
    }
  }

  /**
   * AI logic for building irrigation
   */
  private static buildIrrigationAI(unit: Unit, _gameState: GameState, game?: GameInterface): void {
    if (game) {
      // Use the game's buildIrrigation method for proper implementation
      const success = game.buildIrrigation(unit.id);
      if (success) {
        console.log(`AI settler ${unit.id} built irrigation at (${unit.position.x}, ${unit.position.y})`);
      } else {
        console.log(`AI settler ${unit.id} failed to build irrigation at (${unit.position.x}, ${unit.position.y})`);
      }
    } else {
      // Fallback: simulate irrigation building by ending the unit's turn
      unit.movementPoints = 0;
      console.log(`AI settler ${unit.id} building irrigation at (${unit.position.x}, ${unit.position.y})`);
    }
  }

  /**
   * Find the nearest city (any player) to a position
   */
  private static findNearestCityAny(position: Position, gameState: GameState): City | null {
    let nearestCity: City | null = null;
    let nearestDistance = Infinity;
    
    for (const city of gameState.cities) {
      const distance = this.getDistance(position, city.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestCity = city;
      }
    }
    
    return nearestCity;
  }

  /**
   * Determine if a unit should stay and defend a city
   */
  private static shouldUnitDefendCity(unit: Unit, gameState: GameState): boolean {
    // Find if the unit is in a city
    const cityAtPosition = gameState.cities.find(city =>
      city.playerId === unit.playerId &&
      city.position.x === unit.position.x &&
      city.position.y === unit.position.y
    );
    
    if (!cityAtPosition) {
      return false; // Unit is not in a city
    }
    
    // Count how many military units are already defending this city
    const defendersInCity = this.countCityDefenders(cityAtPosition, gameState);
    
    // Determine desired number of defenders based on city importance and threats
    const desiredDefenders = this.calculateDesiredDefenders(cityAtPosition, gameState);
    
    // If we have fewer defenders than desired, this unit should stay
    if (defendersInCity < desiredDefenders) {
      console.log(`City ${cityAtPosition.name} needs defense: ${defendersInCity}/${desiredDefenders} defenders`);
      return true;
    }
    
    return false;
  }

  /**
   * Count military units defending a city
   */
  private static countCityDefenders(city: City, gameState: GameState): number {
    return gameState.units.filter(unit =>
      unit.playerId === city.playerId &&
      unit.position.x === city.position.x &&
      unit.position.y === city.position.y &&
      this.isMilitaryUnit(unit.type) &&
      (unit.fortified || unit.fortifying)
    ).length;
  }

  /**
   * Calculate desired number of defenders for a city
   */
  private static calculateDesiredDefenders(city: City, gameState: GameState): number {
    let baseDefenders = 1; // Every city should have at least 1 defender
    
    // Larger cities need more defense
    if (city.population >= 4) {
      baseDefenders = 2;
    }
    
    // Cities near enemies need more defense
    const nearbyEnemies = this.countNearbyEnemies(city, gameState, 5);
    if (nearbyEnemies > 0) {
      baseDefenders += Math.min(nearbyEnemies, 2); // Up to 2 additional defenders
    }
    
    // Capital or first city needs extra defense
    const playerCities = gameState.cities.filter(c => c.playerId === city.playerId);
    if (playerCities.length === 1 || city.name.toLowerCase().includes('capital')) {
      baseDefenders += 1;
    }
    
    return Math.min(baseDefenders, 3); // Cap at 3 defenders max
  }

  /**
   * Count nearby enemy units or cities
   */
  private static countNearbyEnemies(city: City, gameState: GameState, radius: number): number {
    let enemyCount = 0;
    
    // Count enemy units
    for (const unit of gameState.units) {
      if (unit.playerId !== city.playerId) {
        const distance = this.getDistance(city.position, unit.position);
        if (distance <= radius) {
          enemyCount++;
        }
      }
    }
    
    // Count enemy cities (less weight)
    for (const enemyCity of gameState.cities) {
      if (enemyCity.playerId !== city.playerId) {
        const distance = this.getDistance(city.position, enemyCity.position);
        if (distance <= radius) {
          enemyCount += 0.5; // Enemy cities count as half threat
        }
      }
    }
    
    return Math.floor(enemyCount);
  }

  /**
   * Find a city that needs additional defense
   */
  private static findCityNeedingDefense(unit: Unit, gameState: GameState): City | null {
    const playerCities = gameState.cities.filter(city => city.playerId === unit.playerId);
    
    for (const city of playerCities) {
      const defendersInCity = this.countCityDefenders(city, gameState);
      const desiredDefenders = this.calculateDesiredDefenders(city, gameState);
      
      if (defendersInCity < desiredDefenders) {
        // Check if the unit can reasonably reach this city
        const distance = this.getDistance(unit.position, city.position);
        if (distance <= 8) { // Only consider cities within reasonable distance
          return city;
        }
      }
    }
    
    return null;
  }

  /**
   * Check if a unit type is considered a military unit for defense
   */
  private static isMilitaryUnit(unitType: UnitType): boolean {
    const militaryTypes: UnitType[] = [
      UnitType.MILITIA, UnitType.WARRIOR, UnitType.PHALANX, UnitType.LEGION,
      UnitType.KNIGHTS, UnitType.MUSKETEERS, UnitType.RIFLEMEN, UnitType.ARTILLERY,
      UnitType.ARMOR, UnitType.MECH_INF, UnitType.CAVALRY, UnitType.CHARIOT,
      UnitType.CATAPULT, UnitType.CANNON
    ];
    return militaryTypes.includes(unitType);
  }

  /**
   * Re-evaluate a fortified unit to see if it's still needed in its current position
   */
  private static reevaluateFortifiedUnit(unit: Unit, gameState: GameState, game?: GameInterface): void {
    // Check if the unit is in a city
    const cityAtPosition = gameState.cities.find(city =>
      city.playerId === unit.playerId &&
      city.position.x === unit.position.x &&
      city.position.y === unit.position.y
    );
    
    if (!cityAtPosition) {
      // Unit is fortified but not in a city - wake it up to find better position
      console.log(`AI unit ${unit.id} fortified outside city - waking up`);
      this.wakeUpUnit(unit, game);
      return;
    }
    
    // Count current defenders
    const defendersInCity = this.countCityDefenders(cityAtPosition, gameState);
    const desiredDefenders = this.calculateDesiredDefenders(cityAtPosition, gameState);
    
    // If city has too many defenders, consider moving one out
    if (defendersInCity > desiredDefenders + 1) {
      // Check if there are other cities that need defense more urgently
      const cityNeedingDefense = this.findCityNeedingDefense(unit, gameState);
      if (cityNeedingDefense) {
        console.log(`AI unit ${unit.id} moving from over-defended ${cityAtPosition.name} to ${cityNeedingDefense.name}`);
        this.wakeUpUnit(unit, game);
        // Unit will be processed next turn to move to the new city
      }
    }
  }

  /**
   * Wake up a fortified unit
   */
  private static wakeUpUnit(unit: Unit, game?: GameInterface): void {
    if (game && 'wakeUnit' in game) {
      (game as any).wakeUnit(unit.id);
    } else {
      // Fallback: manually wake up
      unit.fortified = false;
      unit.fortifying = false;
      unit.fortificationTurns = 0;
      // Don't restore movement points - that should happen at turn start
    }
  }

  /**
   * Log AI defensive status for debugging
   */
  private static logDefensiveStatus(gameState: GameState, playerId: string): void {
    const playerCities = gameState.cities.filter(city => city.playerId === playerId);
    
    console.log(`=== AI Defensive Status for Player ${playerId} ===`);
    for (const city of playerCities) {
      const defendersInCity = this.countCityDefenders(city, gameState);
      const desiredDefenders = this.calculateDesiredDefenders(city, gameState);
      const defenseStatus = defendersInCity >= desiredDefenders ? '✅' : '❌';
      
      console.log(`${defenseStatus} ${city.name}: ${defendersInCity}/${desiredDefenders} defenders (pop: ${city.population})`);
    }
  }
}
