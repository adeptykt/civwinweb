import { GameState, Unit, City, Position, UnitType, TerrainType, Player } from '../types/game';
import { getUnitStats } from './UnitDefinitions';
import { TerrainManager } from '../terrain/index';
import { getCivilization } from './CivilizationDefinitions';
import { CityGrowthSystem } from './CityGrowthSystem';
import { 
  TechnologyType, 
  MILITARY_TECHS, 
  ECONOMIC_TECHS, 
  EXPANSION_TECHS, 
  SCIENCE_TECHS, 
  CIVILIZATION_TECHS, 
  CONSTRUCTION_TECHS,
  canResearch 
} from './TechnologyDefinitions';
import type { AITraits, AggressionLevel, DevelopmentStyle, MilitarismLevel } from './CivilizationDefinitions';
import { CITY_PREFIXES, CITY_SUFFIXES } from '../constants/city-names';

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
   * Get AI traits for a player based on their civilization
   */
  private static getAITraits(gameState: GameState, playerId: string): AITraits {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      // Default traits if player not found
      return {
        aggression: 'normal' as AggressionLevel,
        development: 'normal' as DevelopmentStyle,
        militarism: 'normal' as MilitarismLevel
      };
    }

    const civilization = getCivilization(player.civilizationType);
    return civilization.aiTraits;
  }

  /**
   * Calculate aggressiveness score based on AI traits
   * Higher score = more aggressive behavior
   */
  private static getAggressivenessScore(traits: AITraits): number {
    let score = 0;

    // Base aggression
    switch (traits.aggression) {
      case 'friendly': score -= 2; break;
      case 'normal': score += 0; break;
      case 'aggressive': score += 2; break;
    }

    // Development style affects aggression
    switch (traits.development) {
      case 'perfectionist': score -= 1; break;
      case 'normal': score += 0; break;
      case 'expansionist': score += 1; break;
    }

    // Militarism affects aggression
    switch (traits.militarism) {
      case 'civilized': score -= 1; break;
      case 'normal': score += 0; break;
      case 'militaristic': score += 2; break;
    }

    return score;
  }

  /**
   * Execute a full AI turn for the given player
   */
  public static async executeTurn(gameState: GameState, playerId: string, game: GameInterface): Promise<void> {
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

    // Process AI technology preferences
    this.processAITechnology(gameState, playerId);

    console.log(`AI Player ${playerId} completed turn`);
  }

  /**
   * Process an individual AI unit
   */
  private static processAIUnit(unit: Unit, gameState: GameState, game: GameInterface): void {
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
  private static handleSettlerAI(unit: Unit, gameState: GameState, game: GameInterface): void {
    // Get AI traits for this player
    const aiTraits = this.getAITraits(gameState, unit.playerId);

    // Perfectionist civilizations prioritize building infrastructure around existing cities
    // Expansionist civilizations prioritize founding new cities
    const shouldPrioritizeInfrastructure = aiTraits.development === 'perfectionist';
    const shouldRushExpansion = aiTraits.development === 'expansionist';

    // Check if we should build infrastructure around existing cities first
    const nearbyCity = this.findNearbyCity(unit.position, gameState, unit.playerId, 3);

    if (nearbyCity && (shouldPrioritizeInfrastructure || Math.random() < 0.5)) {
      // Priority: build infrastructure around cities (perfectionist civs do this more often)
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

    // Determine expansion behavior based on civilization traits
    const isEarlyGame = gameState.turn <= 10;
    const expansionThreshold = shouldRushExpansion ? 15 : 10; // Expansionist civs expand longer
    const isExpansionPhase = gameState.turn <= expansionThreshold;

    // Adjust city location standards based on development style
    let cityLocationThreshold = 1; // Default threshold for founding cities
    if (aiTraits.development === 'perfectionist') {
      cityLocationThreshold = 3; // Perfectionist civs want better locations
    } else if (aiTraits.development === 'expansionist') {
      cityLocationThreshold = 0.5; // Expansionist civs accept mediocre locations
    }

    // Check current position first - expansionist civs are more likely to settle immediately
    if ((isEarlyGame || shouldRushExpansion) && this.isValidCityLocation(unit.position, gameState)) {
      const currentScore = this.evaluateCityLocation(unit.position, gameState);
      if (currentScore > cityLocationThreshold) {
        game.foundCity(unit.id);
        return;
      }
    }

    // Look for good city founding locations
    const bestLocation = this.findBestCityLocation(unit.position, gameState, isExpansionPhase, aiTraits);
    if (bestLocation) {
      if (this.isAtPosition(unit.position, bestLocation)) {
        // We're at a good location, found a city
        game.foundCity(unit.id);

      } else {
        // Move towards the best location
        this.moveUnitTowards(unit, bestLocation, gameState, game);
      }
    } else {
      // No good location found
      if (isEarlyGame && this.isValidCityLocation(unit.position, gameState)) {
        // In early game, found city at current position if it's valid
        game.foundCity(unit.id);
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
    // Get AI traits for this player
    const aiTraits = this.getAITraits(gameState, unit.playerId);
    const aggressivenessScore = this.getAggressivenessScore(aiTraits);

    // First, check if this unit should stay and defend a city
    const shouldDefendCity = this.shouldUnitDefendCity(unit, gameState);

    // Aggressive civs are less likely to stay and defend, preferring offense
    const defenseChance = aiTraits.aggression === 'aggressive' ? 0.6 :
      aiTraits.aggression === 'friendly' ? 0.9 : 0.75;

    if (shouldDefendCity && Math.random() < defenseChance) {
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

    // Determine search radius for enemies based on aggressiveness
    const searchRadius = aggressivenessScore >= 2 ? 8 : // Very aggressive (Mongols, Greeks)
      aggressivenessScore >= 1 ? 6 : // Moderately aggressive 
        aggressivenessScore >= 0 ? 4 : // Normal
          2; // Defensive/friendly civs

    // Use smart targeting to find the best enemy target (cities prioritized)
    const bestTarget = this.findBestEnemyTarget(unit, gameState);

    if (bestTarget && this.getDistance(unit.position, bestTarget.position) <= searchRadius) {
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

    if (enemyTarget && this.getDistance(unit.position, enemyTarget.position) <= Math.max(3, searchRadius / 2)) {
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
      [-1, 0], [1, 0], // West, East
      [-1, 1], [0, 1], [1, 1]  // Southwest, South, Southeast
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
  private static findBestCityLocation(currentPos: Position, gameState: GameState, isEarlyGame: boolean = false, aiTraits?: AITraits): Position | null {
    const searchRadius = isEarlyGame ? 2 : 5; // Much smaller search radius in early game

    // Adjust thresholds based on AI traits
    let baseThreshold = isEarlyGame ? 1 : 3;
    if (aiTraits) {
      if (aiTraits.development === 'perfectionist') {
        baseThreshold += 1; // Perfectionist civs want better locations
      } else if (aiTraits.development === 'expansionist') {
        baseThreshold -= 0.5; // Expansionist civs accept worse locations
      }
    }

    let bestLocation: Position | null = null;
    let bestScore = baseThreshold;

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
      case TerrainType.PLAINS:
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
    let randomName: string;
    let attempts = 0;
    const maxAttempts = 50; // Prevent infinite loops

    do {
      const prefix = CITY_PREFIXES[Math.floor(Math.random() * CITY_PREFIXES.length)];
      const suffix = CITY_SUFFIXES[Math.floor(Math.random() * CITY_SUFFIXES.length)];
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
        console.log(`AICity: ${city.name} (${city.id}) has no production set, determining production...`);
        // Choose what to produce
        this.setAICityProduction(city, gameState);
      }
    }
  }

  /**
   * Set production for an AI city
   */
  private static setAICityProduction(city: City, gameState: GameState): void {
    // Get AI traits for this player
    const aiTraits = this.getAITraits(gameState, city.playerId);
    const aggressivenessScore = this.getAggressivenessScore(aiTraits);

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

    // Determine production priorities based on AI traits
    const isExpansionist = aiTraits.development === 'expansionist';
    const isPerfectionist = aiTraits.development === 'perfectionist';
    const isMilitaristic = aiTraits.militarism === 'militaristic';

    // Adjust settler and military ratios based on AI traits
    const baseSettlerRatio = isExpansionist ? 0.4 : isPerfectionist ? 0.15 : 0.25;
    const baseMilitaryRatio = isMilitaristic ? 0.5 : aiTraits.militarism === 'civilized' ? 0.2 : 0.35;

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

    // Determine optimal settler count based on AI traits and game stage
    const isEarlyGame = gameState.turn <= (isExpansionist ? 25 : 15); // Expansionists expand longer
    const isMidGame = gameState.turn > (isExpansionist ? 25 : 15) && gameState.turn <= 50;

    let maxDesiredSettlers: number;
    if (isEarlyGame) {
      // Early game: adjusted by civilization type
      if (isExpansionist) {
        maxDesiredSettlers = Math.min(playerCities.length + 2, 6); // More aggressive expansion
      } else if (isPerfectionist) {
        maxDesiredSettlers = Math.min(Math.floor(playerCities.length * 0.75), 3); // Conservative expansion
      } else {
        maxDesiredSettlers = Math.min(playerCities.length + 1, 4); // Normal expansion
      }
    } else if (isMidGame) {
      // Mid game: expansion style affects continued settling
      if (isExpansionist) {
        maxDesiredSettlers = Math.max(3, Math.floor(playerCities.length * 0.6));
      } else if (isPerfectionist) {
        maxDesiredSettlers = Math.max(1, Math.floor(playerCities.length * 0.25));
      } else {
        maxDesiredSettlers = Math.max(2, Math.floor(playerCities.length * 0.5));
      }
    } else {
      // Late game: minimal settlers except for expansionists
      if (isExpansionist) {
        maxDesiredSettlers = Math.max(2, Math.floor(playerCities.length * 0.3));
      } else {
        maxDesiredSettlers = Math.max(1, Math.floor(playerCities.length * 0.2));
      }
    }

    // Calculate desired military based on threats and militarism
    const baseMilitaryNeeds = Math.max(2, Math.floor(playerCities.length * baseMilitaryRatio));
    const threatMultiplier = hasNearbyThreats ? (aggressivenessScore >= 1 ? 2.5 : 2) : 1;
    const desiredMilitary = Math.floor(baseMilitaryNeeds * threatMultiplier);

    // Production priority logic with some randomization for variety
    // 1. HIGHEST PRIORITY: City lacks adequate defense
    if (needsDefense) {
      console.log(`AICity: ${city.name} needs defense: ${defendersInCity}/${desiredDefenders} defenders - producing defensive military`);
      const bestMilitaryUnit = this.getBestMilitaryUnit(city.playerId, gameState, 'defense');
      city.production = {
        type: 'unit',
        item: bestMilitaryUnit.type,
        turnsRemaining: bestMilitaryUnit.turns
      };
    }
    // 2. HIGH PRIORITY: Threats nearby and insufficient military
    else if (hasNearbyThreats && militaryCount < desiredMilitary) {
      console.log(`AICity: ${city.name} producing military due to nearby threats (${nearbyEnemyCities.length} cities, ${nearbyEnemyUnits.length} units)`);
      // For threats, prefer offensive units that can eliminate the threat
      const bestMilitaryUnit = this.getBestMilitaryUnit(city.playerId, gameState, 'offense');
      city.production = {
        type: 'unit',
        item: bestMilitaryUnit.type,
        turnsRemaining: bestMilitaryUnit.turns
      };
    }
    // 3. MEDIUM PRIORITY: Early game expansion needs
    else if (totalSettlers < maxDesiredSettlers && isEarlyGame) {
      console.log(`AICity: ${city.name} producing settler for early expansion (${totalSettlers}/${maxDesiredSettlers})`);
      city.production = {
        type: 'unit',
        item: UnitType.SETTLERS,
        turnsRemaining: 3
      };
    }
    // 4. MEDIUM PRIORITY: Basic military needs
    else if (militaryCount < baseMilitaryNeeds) {
      console.log(`AICity: ${city.name} producing military for basic needs (${militaryCount}/${baseMilitaryNeeds})`);
      // For general military needs, use balanced approach
      const bestMilitaryUnit = this.getBestMilitaryUnit(city.playerId, gameState, 'general');
      city.production = {
        type: 'unit',
        item: bestMilitaryUnit.type,
        turnsRemaining: bestMilitaryUnit.turns
      };
    }
    // 5. LOW PRIORITY: Mid/late game settlers
    else if (totalSettlers < maxDesiredSettlers) {
      console.log(`AICity: ${city.name} producing settler for continued expansion (${totalSettlers}/${maxDesiredSettlers})`);
      city.production = {
        type: 'unit',
        item: UnitType.SETTLERS,
        turnsRemaining: 3
      };
    }
    // 6. LOWEST PRIORITY: Mixed production for variety
    else {
      // Add variety to prevent getting stuck building the same thing
      const productionOptions: Array<{ type: string, item: any, turns: number, weight: number }> = [];

      // Always consider infrastructure for perfectionist civs
      if (isPerfectionist) {
        productionOptions.push(
          { type: 'building', item: 'granary', turns: 4, weight: 3 },
          { type: 'building', item: 'temple', turns: 6, weight: 2 }
        );
      } else {
        productionOptions.push(
          { type: 'building', item: 'granary', turns: 4, weight: 2 }
        );
      }

      // Consider additional military for militaristic civs
      if (isMilitaristic || aggressivenessScore >= 1) {
        const militaryUnit = this.getBestMilitaryUnit(city.playerId, gameState, 'general');
        productionOptions.push({
          type: 'unit',
          item: militaryUnit.type,
          turns: militaryUnit.turns,
          weight: isMilitaristic ? 3 : 2
        });
      }

      // Consider settlers for expansionist civs
      if (isExpansionist && totalSettlers < maxDesiredSettlers + 1) {
        productionOptions.push({
          type: 'unit',
          item: UnitType.SETTLERS,
          turns: 3,
          weight: 2
        });
      }

      // Select weighted random option
      const totalWeight = productionOptions.reduce((sum, option) => sum + option.weight, 0);
      let random = Math.random() * totalWeight;

      let selectedOption = productionOptions[0]; // fallback
      for (const option of productionOptions) {
        random -= option.weight;
        if (random <= 0) {
          selectedOption = option;
          break;
        }
      }

      console.log(`AICity: ${city.name} choosing varied production: ${selectedOption.type} ${selectedOption.item}`);
      city.production = {
        type: selectedOption.type as any,
        item: selectedOption.item,
        turnsRemaining: selectedOption.turns
      };
    }

    console.log(`AICity: ${city.name} production set:`, city.production);
  }

  /**
   * Force AI to re-evaluate production for a specific city
   * Useful when production completes or city conditions change
   */
  public static reevaluateCityProduction(city: City, gameState: GameState): void {
    if (city.production) {
      console.log(`AI re-evaluating production for ${city.name} - current: ${city.production.type} ${city.production.item}`);
    }

    // Clear current production and let AI decide what's best
    city.production = null;
    this.setAICityProduction(city, gameState);
  }

  /**
   * Get the best military unit available to a player based on their technologies, AI traits, and intended purpose
   */
  private static getBestMilitaryUnit(
    playerId: string, 
    gameState: GameState, 
    purpose: 'defense' | 'offense' | 'general' = 'general'
  ): { type: UnitType; turns: number } {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { type: UnitType.MILITIA, turns: 2 };
    }

    const aiTraits = this.getAITraits(gameState, playerId);

    // Get all available military units with their stats
    const allMilitaryUnits = [
      { type: UnitType.MECH_INF, cost: 8, requiredTech: TechnologyType.LABOR_UNION },
      { type: UnitType.ARMOR, cost: 10, requiredTech: TechnologyType.AUTOMOBILE },
      { type: UnitType.ARTILLERY, cost: 8, requiredTech: TechnologyType.ROBOTICS },
      { type: UnitType.RIFLEMEN, cost: 6, requiredTech: TechnologyType.CONSCRIPTION },
      { type: UnitType.CANNON, cost: 6, requiredTech: TechnologyType.METALLURGY },
      { type: UnitType.MUSKETEERS, cost: 5, requiredTech: TechnologyType.GUNPOWDER },
      { type: UnitType.KNIGHTS, cost: 5, requiredTech: TechnologyType.CHIVALRY },
      { type: UnitType.CATAPULT, cost: 5, requiredTech: TechnologyType.MATHEMATICS },
      { type: UnitType.CHARIOT, cost: 4, requiredTech: TechnologyType.THE_WHEEL },
      { type: UnitType.LEGION, cost: 3, requiredTech: TechnologyType.IRON_WORKING },
      { type: UnitType.CAVALRY, cost: 3, requiredTech: TechnologyType.HORSEBACK_RIDING },
      { type: UnitType.PHALANX, cost: 3, requiredTech: TechnologyType.BRONZE_WORKING },
      { type: UnitType.MILITIA, cost: 2, requiredTech: null }
    ];

    // Filter to buildable units
    const availableUnits = allMilitaryUnits.filter(unitInfo =>
      !unitInfo.requiredTech || player.technologies.includes(unitInfo.requiredTech)
    );

    if (availableUnits.length === 0) {
      return { type: UnitType.MILITIA, turns: 2 };
    }

    // Filter by purpose if specified
    let candidateUnits = availableUnits;
    
    if (purpose === 'defense') {
      // For defense, prefer units with high defense relative to attack (good defenders)
      candidateUnits = availableUnits.filter(unit => this.isDefensiveUnit(unit.type));
      // If no defensive units available, fall back to general units but limit to 2-3 best
      if (candidateUnits.length === 0) {
        candidateUnits = availableUnits.slice(0, Math.min(3, availableUnits.length));
      } else {
        // Limit defensive units to 2-3 as per user request
        candidateUnits = candidateUnits.slice(0, Math.min(3, candidateUnits.length));
      }
    } else if (purpose === 'offense') {
      // For offense, prefer units with high attack relative to defense (good attackers)
      candidateUnits = availableUnits.filter(unit => this.isOffensiveUnit(unit.type));
      // If no offensive units available, fall back to all available
      if (candidateUnits.length === 0) {
        candidateUnits = availableUnits;
      }
    }

    // Select unit based on AI traits
    let selectedUnit;

    if (aiTraits.militarism === 'militaristic') {
      // 70% chance for best unit, 30% for second best
      if (Math.random() < 0.7) {
        selectedUnit = candidateUnits[0];
      } else {
        selectedUnit = candidateUnits[Math.min(1, candidateUnits.length - 1)];
      }
    } else if (aiTraits.militarism === 'civilized') {
      // More variety for civilized civs - prefer cheaper units sometimes
      if (Math.random() < 0.4) {
        // 40% chance for best unit
        selectedUnit = candidateUnits[0];
      } else {
        // 60% chance for cheaper alternatives
        const cheaperUnits = candidateUnits.slice(1);
        selectedUnit = cheaperUnits[Math.floor(Math.random() * cheaperUnits.length)] || candidateUnits[0];
      }
    } else {
      // Normal militarism - balanced approach
      if (Math.random() < 0.6) {
        selectedUnit = candidateUnits[0];
      } else {
        selectedUnit = candidateUnits[Math.floor(Math.random() * Math.min(3, candidateUnits.length))];
      }
    }

    const turns = Math.ceil(selectedUnit.cost / 1); // Base production capacity
    return {
      type: selectedUnit.type,
      turns: turns
    };
  }

  /**
   * Determine if a unit is primarily defensive (high defense relative to attack)
   */
  private static isDefensiveUnit(unitType: UnitType): boolean {
    const stats = getUnitStats(unitType);
    if (!stats) return false;
    
    // Units with defense >= attack are considered defensive
    // Also include units with very high defense even if attack is similar
    return stats.defense >= stats.attack || stats.defense >= 3;
  }

  /**
   * Determine if a unit is primarily offensive (high attack relative to defense)
   */
  private static isOffensiveUnit(unitType: UnitType): boolean {
    const stats = getUnitStats(unitType);
    if (!stats) return false;
    
    // Units with attack > defense are considered offensive
    // Special cases for siege units (high attack, siege abilities)
    const hasSiegeAbilities = stats.specialAbilities?.includes('siege_warfare') || 
                              stats.specialAbilities?.includes('ignore_city_walls');
    
    return stats.attack > stats.defense || hasSiegeAbilities || stats.attack >= 6;
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

    return Math.min(baseDefenders, 3); // Cap at 3 defenders max (AI builds 2-3 defensive units per city as requested)
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

  /**
   * Process AI technology research preferences based on civilization traits
   */
  private static processAITechnology(gameState: GameState, playerId: string): void {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player || player.currentResearch) {
      return; // Already researching something or player not found
    }

    const aiTraits = this.getAITraits(gameState, playerId);

    // Get available technologies to research
    const availableTechs = this.getAvailableTechnologies(player);
    if (availableTechs.length === 0) {
      return;
    }

    // Score technologies based on AI traits
    const techScores = new Map<TechnologyType, number>();

    for (const tech of availableTechs) {
      let score = 1; // Base score

      // Militaristic civs prefer military techs
      if (MILITARY_TECHS.includes(tech)) {
        if (aiTraits.militarism === 'militaristic') {
          score += 3;
        } else if (aiTraits.militarism === 'normal') {
          score += 1;
        } else { // civilized
          score -= 1;
        }
      }

      // Economic techs appeal to all but especially perfectionist civs
      if (ECONOMIC_TECHS.includes(tech)) {
        if (aiTraits.development === 'perfectionist') {
          score += 2;
        } else {
          score += 1;
        }
      }

      // Expansion techs appeal to expansionist civs
      if (EXPANSION_TECHS.includes(tech)) {
        if (aiTraits.development === 'expansionist') {
          score += 2;
        } else if (aiTraits.development === 'perfectionist') {
          score -= 1;
        }
      }

      // Science techs appeal to perfectionist civs
      if (SCIENCE_TECHS.includes(tech)) {
        if (aiTraits.development === 'perfectionist') {
          score += 2;
        } else {
          score += 1;
        }
      }

      // Civilization techs have broad appeal
      if (CIVILIZATION_TECHS.includes(tech)) {
        score += 1;
        if (aiTraits.development === 'perfectionist') {
          score += 1; // Perfectionist civs like government/culture techs
        }
      }

      // Construction techs have moderate appeal
      if (CONSTRUCTION_TECHS.includes(tech)) {
        score += 1;
      }

      // Aggressive civs slightly favor military-enabling techs
      if (aiTraits.aggression === 'aggressive' && MILITARY_TECHS.includes(tech)) {
        score += 1;
      }

      techScores.set(tech, score);
    }

    // Select the highest-scoring technology
    let bestTech: TechnologyType | null = null;
    let bestScore = -1;

    for (const [tech, score] of techScores) {
      if (score > bestScore) {
        bestScore = score;
        bestTech = tech;
      }
    }

    if (bestTech) {
      player.currentResearch = bestTech;
      player.currentResearchProgress = 0;
      console.log(`AI Player ${playerId} (${aiTraits.aggression}/${aiTraits.development}/${aiTraits.militarism}) chose to research ${bestTech}`);
    }
  }

  /**
   * Get available technologies for research
   */
  private static getAvailableTechnologies(player: Player): TechnologyType[] {
    // Get all possible technologies
    const allTechs = Object.values(TechnologyType);
    
    // Filter out technologies the player already has
    return allTechs.filter(tech => {
      if (player.technologies.includes(tech)) {
        return false;
      }

      return canResearch(tech, player.technologies);
    });
  }
}
