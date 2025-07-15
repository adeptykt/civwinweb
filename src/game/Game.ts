import { GamePhase, GameState, Player, Position, Unit, City, GovernmentType, GOVERNMENTS, GovernmentEffects, MapScenario, UnitType, TechnologyType, UnitCategory, TerrainType, ImprovementType, VisibilityMap } from '../types/game';
import { MapGenerator } from './MapGenerator';
import { TurnManager } from './TurnManager';
import { createUnit } from './Units';
import { getUnitStats, canUnitSleep } from './UnitDefinitions';
import { CombatSystem, CombatResult } from './CombatSystem';
import { getTechnology, canResearch, getResearchCost } from './TechnologyDefinitions';
import { TerrainManager } from '../terrain/index';
import { CIVILIZATION_DEFINITIONS, CivilizationType, getAllCivilizations, getCivilization, Civilization } from './CivilizationDefinitions';
import { AIPlayer } from './AIPlayer';
import { SoundEffects } from '../utils/SoundEffects';
import { ProductionManager } from './ProductionManager';
import { CityGrowthSystem } from './CityGrowthSystem';
import { VisibilitySystem } from './VisibilitySystem';
import { DebugSystem } from '../utils/DebugSystem';
import { BuildingCompletionModal } from '../renderer/BuildingCompletionModal';

export class Game {
  private gameState: GameState;
  private mapGenerator: MapGenerator;
  private turnManager: TurnManager;
  private combatSystem: CombatSystem;
  private buildingCompletionModal: BuildingCompletionModal;
  private eventListeners: Map<string, Function[]> = new Map();

  // Unit queue system
  private unitQueue: Unit[] = [];
  private currentUnitIndex: number = 0;
  private initialUnitQueueSize: number = 0; // Track initial queue size to determine auto-advance behavior
  private autoAdvanceTriggered: boolean = false; // Track if auto-advance was just triggered
  private blinkIntervalId: number | null = null;

  constructor() {
    this.mapGenerator = new MapGenerator();
    this.buildingCompletionModal = new BuildingCompletionModal();
    this.turnManager = new TurnManager((city, buildingType, isWonder) => {
      this.handleBuildingCompletion(city, buildingType, isWonder);
    });
    this.combatSystem = new CombatSystem();

    // Initialize game state
    this.gameState = {
      turn: 1,
      currentPlayer: '',
      players: [],
      worldMap: [],
      units: [],
      cities: [],
      gamePhase: GamePhase.SETUP,
      score: 0
    };
  }

  // Initialize a new game with scenario
  public initializeGame(playerNames: string[], scenario: MapScenario = 'earth', worldSize?: number): void {
    // Create players
    this.gameState.players = this.createPlayers(playerNames);
    this.gameState.currentPlayer = this.gameState.players[0].id;

    // Generate world map based on scenario (80x50 with horizontal wrapping)
    if (scenario === 'civ1' && worldSize !== undefined) {
      this.gameState.worldMap = this.mapGenerator.generateMapWithWorldSize(80, 50, scenario, worldSize);
    } else {
      this.gameState.worldMap = this.mapGenerator.generateMap(80, 50, scenario);
    }

    // Place initial units and cities for each player
    this.placeInitialUnits();

    // Initialize visibility system (fog of war)
    VisibilitySystem.initializeVisibility(this.gameState);

    // Set game phase to playing
    this.gameState.gamePhase = GamePhase.PLAYING;

    // Build initial unit queue and select first unit
    this.buildUnitQueue();
    if (this.unitQueue.length > 0) {
      this.selectCurrentUnit();
    }

    this.emit('gameInitialized', this.gameState);
  }

  // Create players with default settings
  private createPlayers(playerNames: string[]): Player[] {
    const availableCivs = getAllCivilizations();
    console.log('createPlayers: Available civilizations:', availableCivs.map(c => c.name));

    return playerNames.map((name, index) => {
      // Assign different civilizations to each player
      const civIndex = index % availableCivs.length;
      const civilization = availableCivs[civIndex];

      console.log(`createPlayers: Assigning ${civilization.name} to player ${name} (index ${index})`);

      return {
        id: `player-${index}`,
        name,
        civilizationType: civilization.id,
        color: civilization.color,
        isHuman: index === 0, // First player is human, others are AI
        science: 0, // Start with 0 science points - accumulate each turn
        gold: 50,
        culture: 0,
        technologies: index === 0 ? [] : this.getAIStartingTechnologies(), // Human starts with none, AI gets some starting techs
        currentResearchProgress: 0, // Start with 0 progress toward any research
        government: GovernmentType.DESPOTISM, // Start with Despotism
        usedCityNames: [] // Initialize empty array for tracking used city names
      };
    });
  }

  // Get starting technologies for AI players
  private getAIStartingTechnologies(): TechnologyType[] {
    return [
      TechnologyType.ALPHABET
    ];
  }

  // Place initial settler and warrior for each player
  private placeInitialUnits(): void {
    const mapWidth = this.gameState.worldMap[0].length;
    const mapHeight = this.gameState.worldMap.length;

    this.gameState.players.forEach((player: Player, index: number) => {
      // Find a suitable starting position
      const startPosition = this.findStartingPosition(mapWidth, mapHeight, index);

      // Create settler using the new unit factory
      const settler = createUnit(
        `settler-${player.id}`,
        UnitType.SETTLERS,
        startPosition,
        player.id
      );
      const warrior = createUnit(
        `militia-${player.id}`,
        UnitType.MILITIA,
        startPosition,
        player.id
      );

      this.gameState.units.push(settler, warrior);
    });
  }

  // Find a suitable starting position for a player
  private findStartingPosition(mapWidth: number, mapHeight: number, playerIndex: number): Position {
    // Simple placement algorithm - spread players across the map
    const spacing = Math.floor(mapWidth / this.gameState.players.length);
    const initialX = Math.min(spacing * playerIndex + 5, mapWidth - 1);
    const initialY = Math.floor(mapHeight / 2);

    // Check if the initial position is suitable
    if (this.isValidStartingPosition(initialX, initialY, mapWidth, mapHeight)) {
      return { x: initialX, y: initialY };
    }

    // If initial position is not suitable, search in expanding circles
    const maxSearchRadius = Math.min(mapWidth, mapHeight) / 4;

    for (let radius = 1; radius <= maxSearchRadius; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          // Only check positions on the current radius circle
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

          const x = initialX + dx;
          const y = initialY + dy;

          if (this.isValidStartingPosition(x, y, mapWidth, mapHeight)) {
            return { x, y };
          }
        }
      }
    }

    // Fallback: search entire map for any valid position
    console.warn(`Could not find suitable starting position for player ${playerIndex}, searching entire map`);
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        if (this.isValidStartingPosition(x, y, mapWidth, mapHeight)) {
          console.warn(`Using fallback position for player ${playerIndex}: (${x}, ${y})`);
          return { x, y };
        }
      }
    }

    // Ultimate fallback: find any passable non-ocean terrain (even if can't found city)
    console.error(`No valid starting positions found for player ${playerIndex}, using emergency fallback`);
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const terrainType = this.gameState.worldMap[y][x].terrain;
        if (terrainType !== TerrainType.OCEAN && TerrainManager.isPassable(terrainType)) {
          console.error(`Using emergency position for player ${playerIndex}: (${x}, ${y}) on ${terrainType}`);
          return { x, y };
        }
      }
    }

    // This should never happen unless the entire map is ocean
    console.error(`CRITICAL: No land found on map for player ${playerIndex}, using center position`);
    return { x: Math.floor(mapWidth / 2), y: Math.floor(mapHeight / 2) };
  }

  // Check if a position is valid for starting (passable terrain that allows city founding)
  private isValidStartingPosition(x: number, y: number, mapWidth: number, mapHeight: number): boolean {
    // Check bounds
    if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) {
      return false;
    }

    // Get terrain at this position
    const terrainType = this.gameState.worldMap[y][x].terrain;

    // Explicitly exclude ocean terrain (cannot spawn units on water)
    if (terrainType === TerrainType.OCEAN) {
      return false;
    }

    // Check if terrain is passable and allows city founding
    return TerrainManager.isPassable(terrainType) && TerrainManager.canFoundCity(terrainType);
  }

  // Game turn management
  public async endTurn(): Promise<void> {
    if (this.gameState.gamePhase !== GamePhase.PLAYING) return;

    // Clear current unit selection and stop blinking
    this.clearCurrentUnit();

    // Process the turn (restore movement points, handle cities, advance to next player)
    this.turnManager.processTurn(this.gameState);

    // Check for defeated players after turn processing
    this.checkForDefeatedPlayers();

    // Check if the new current player is AI and handle automatically
    await this.processCurrentPlayerTurn();

    this.emit('turnEnded', this.gameState);
  }

  // Process the current player's turn (human or AI)
  private async processCurrentPlayerTurn(): Promise<void> {
    while (this.isCurrentPlayerAI()) {
      // Execute AI turn
      const currentPlayer = this.getCurrentPlayer();
      if (currentPlayer) {
        this.emit('aiTurnStarted', { playerId: currentPlayer.id, playerName: currentPlayer.name });

        // Execute AI logic
        await AIPlayer.executeTurn(this.gameState, currentPlayer.id, this);

        // Process the turn end for AI
        this.turnManager.processTurn(this.gameState);

        // Check for defeated players after AI turn processing
        this.checkForDefeatedPlayers();

        this.emit('aiTurnEnded', { playerId: currentPlayer.id, playerName: currentPlayer.name });
      }
    }

    // Now it's a human player's turn - emit event and setup
    this.emit('humanTurnStarted', { playerId: this.gameState.currentPlayer });

    // Check if player needs to select research (after first turn)
    this.checkForResearchSelection();

    this.buildUnitQueue();
    if (this.unitQueue.length > 0) {
      this.selectCurrentUnit();
    }
  }

  // Check if the current player is AI
  private isCurrentPlayerAI(): boolean {
    const currentPlayer = this.getCurrentPlayer();
    return currentPlayer ? !currentPlayer.isHuman : false;
  }

  // Get the current player object
  private getCurrentPlayer(): Player | null {
    return this.gameState.players.find(p => p.id === this.gameState.currentPlayer) || null;
  }

  // Build queue of units that can move for current player
  private buildUnitQueue(): void {
    const currentPlayer = this.gameState.currentPlayer;

    // Get all units for current player that have movement points and are not fortified, sleeping, or building roads
    // Fortified, sleeping, and road-building units are excluded from the queue unless manually awakened
    this.unitQueue = this.gameState.units.filter(unit =>
      unit.playerId === currentPlayer &&
      unit.movementPoints > 0 &&
      !unit.fortified &&
      unit.fortifying !== true &&
      unit.sleeping !== true &&
      unit.buildingRoad !== true &&
      unit.buildingMine !== true
    );

    this.currentUnitIndex = 0;
    this.initialUnitQueueSize = this.unitQueue.length; // Track initial size

    console.log(`Built unit queue for player ${currentPlayer}:`, this.unitQueue.length, 'units');

    // If no units are available to move, emit endOfTurn event
    if (this.unitQueue.length === 0) {
      console.log('No units available to move - emitting endOfTurn event');
      this.emit('endOfTurn');
    }
  }

  // Select next unit in queue
  public selectNextUnit(): void {
    if (this.unitQueue.length === 0) {
      this.clearCurrentUnit();
      return;
    }

    const startIndex = this.currentUnitIndex;

    do {
      // Move to next unit
      this.currentUnitIndex++;
      if (this.currentUnitIndex >= this.unitQueue.length) {
        this.currentUnitIndex = 0;
      }

      const currentUnit = this.unitQueue[this.currentUnitIndex];

      // If we find a unit that can move (not fortified or building roads), select it
      if (currentUnit.movementPoints > 0 && !currentUnit.fortified && currentUnit.fortifying !== true && currentUnit.buildingRoad !== true && currentUnit.buildingMine !== true) {
        this.setCurrentUnit(currentUnit);
        return;
      }

      // If we've cycled through all units and they're all busy, 
      // just select the current one (player can activate manually)
      if (this.currentUnitIndex === startIndex) {
        this.setCurrentUnit(currentUnit);
        return;
      }
    } while (this.currentUnitIndex !== startIndex);
  }

  // Select current unit (used when unit is removed from queue)
  private selectCurrentUnit(): void {
    if (this.unitQueue.length === 0) {
      this.clearCurrentUnit();
      return;
    }

    // Ensure index is within bounds
    if (this.currentUnitIndex >= this.unitQueue.length) {
      this.currentUnitIndex = 0;
    }

    const currentUnit = this.unitQueue[this.currentUnitIndex];
    this.setCurrentUnit(currentUnit);
  }

  // Select previous unit in queue
  public selectPreviousUnit(): void {
    if (this.unitQueue.length === 0) {
      this.clearCurrentUnit();
      return;
    }

    this.currentUnitIndex--;
    if (this.currentUnitIndex < 0) {
      this.currentUnitIndex = this.unitQueue.length - 1;
    }

    const currentUnit = this.unitQueue[this.currentUnitIndex];
    this.setCurrentUnit(currentUnit);
  }

  // Set the current unit and emit events
  private setCurrentUnit(unit: Unit): void {
    // Only start blinking if unit is not fortified, fortifying, or building roads/mines
    if (!unit.fortified && unit.fortifying !== true && unit.buildingRoad !== true && unit.buildingMine !== true) {
      this.startUnitBlinking();
    }
    this.emit('unitSelected', {
      unit: unit,
      unitIndex: this.currentUnitIndex,
      totalUnits: this.unitQueue.length
    });
  }

  // Clear current unit selection
  private clearCurrentUnit(): void {
    this.stopUnitBlinking();
    this.emit('unitDeselected');

    // Check if this means end of turn (no more units to move)
    if (this.unitQueue.length === 0) {
      this.emit('endOfTurn');
    }
  }

  // Start blinking effect for current unit
  private startUnitBlinking(): void {
    this.stopUnitBlinking();
    this.blinkIntervalId = window.setInterval(() => {
      this.emit('unitBlink');
    }, 600);
  }

  // Stop blinking effect
  private stopUnitBlinking(): void {
    if (this.blinkIntervalId !== null) {
      clearInterval(this.blinkIntervalId);
      this.blinkIntervalId = null;
    }
  }

  // Get current unit
  public getCurrentUnit(): Unit | null {
    if (this.unitQueue.length === 0 || this.currentUnitIndex >= this.unitQueue.length) {
      return null;
    }
    return this.unitQueue[this.currentUnitIndex];
  }

  // Remove unit from queue when it can no longer move
  public removeUnitFromQueue(unitId: string): void {
    const unitIndex = this.unitQueue.findIndex(unit => unit.id === unitId);
    if (unitIndex === -1) return;

    this.unitQueue.splice(unitIndex, 1);

    // Adjust current index if necessary
    if (this.currentUnitIndex >= unitIndex) {
      this.currentUnitIndex = Math.max(0, this.currentUnitIndex - 1);
    }

    // If no units left in queue, check if we should auto-advance
    if (this.unitQueue.length === 0) {
      this.clearCurrentUnit();

      const player = this.getCurrentPlayer();
      if (player && player.isHuman) {
        // Only auto-advance if the turn started with units to move
        if (this.initialUnitQueueSize > 0) {
          console.log('All units exhausted movement - auto-advancing turn');
          this.autoAdvanceTriggered = true; // Set flag to prevent double end-turn
          this.emit('endOfTurn');
        } else {
          console.log('No units to move this turn - waiting for manual advancement');
          // Don't auto-advance; player must manually press spacebar/enter
        }
      }
    } else {
      // Select the unit that's now at the current position (or wrap to start)
      this.selectCurrentUnit();
    }
  }

  // Move a unit
  public moveUnit(unitId: string, newPosition: Position): boolean {
    const unit = this.gameState.units.find((u: Unit) => u.id === unitId);
    if (!unit || unit.movementPoints <= 0) {
      SoundEffects.playInvalidActionSound();
      return false;
    }

    // Store old position for visibility update
    const oldPosition = { ...unit.position };

    // Normalize position with horizontal wrapping
    const normalizedPosition = this.normalizePosition(newPosition);

    // Check if target tile is valid
    if (!this.isValidPosition(normalizedPosition)) {
      SoundEffects.playInvalidActionSound();
      return false;
    }

    // Check for enemy units at target position
    const enemyUnitsAtPosition = this.gameState.units.filter(u =>
      u.position.x === normalizedPosition.x &&
      u.position.y === normalizedPosition.y &&
      u.playerId !== unit.playerId
    );

    console.log('moveUnit: Moving unit', unit.type, 'from', unit.position, 'to', normalizedPosition);
    console.log('moveUnit: Found', enemyUnitsAtPosition.length, 'enemy units at target position');

    // If there are enemy units, initiate combat instead of moving
    if (enemyUnitsAtPosition.length > 0) {
      console.log('moveUnit: Initiating combat with enemy units');
      return this.initiateAutomaticCombat(unit, normalizedPosition, enemyUnitsAtPosition);
    }

    // Check terrain-based movement restrictions
    if (!this.canUnitMoveToTerrain(unit, normalizedPosition)) {
      SoundEffects.playInvalidActionSound();
      return false;
    }

    // Calculate actual movement cost including terrain
    const movementCost = this.calculateMovementCost(unit.position, normalizedPosition);

    // Classic Civ rule: A unit can always move into a terrain square even if the movement cost 
    // exceeds remaining movement points. In that case, it drains all remaining movement to 0.
    // However, unit must have at least some movement points to move
    if (unit.movementPoints <= 0) {
      SoundEffects.playInvalidActionSound();
      return false;
    }

    // Move unit
    unit.position = normalizedPosition;

    // Check for city capture - if there's an enemy city at this position with no defending units
    const cityAtPosition = this.gameState.cities.find(city =>
      city.position.x === normalizedPosition.x &&
      city.position.y === normalizedPosition.y
    );

    if (cityAtPosition && cityAtPosition.playerId !== unit.playerId) {
      // Check if there are any enemy units defending the city (after movement)
      const defendingUnits = this.gameState.units.filter(u =>
        u.position.x === normalizedPosition.x &&
        u.position.y === normalizedPosition.y &&
        u.playerId === cityAtPosition.playerId
      );

      if (defendingUnits.length === 0) {
        // City is undefended, capture it!
        console.log(`Capturing city ${cityAtPosition.name} from player ${cityAtPosition.playerId} to player ${unit.playerId}`);

        const oldOwner = cityAtPosition.playerId;
        cityAtPosition.playerId = unit.playerId;

        // Add captured city name to new owner's used names list
        const newOwnerPlayer = this.gameState.players.find(p => p.id === unit.playerId);
        if (newOwnerPlayer && !newOwnerPlayer.usedCityNames.includes(cityAtPosition.name)) {
          newOwnerPlayer.usedCityNames.push(cityAtPosition.name);
        }

        // Clear any production from the previous owner
        cityAtPosition.production = null;
        cityAtPosition.production_points = 0;

        // Play civilization fanfare if human player captured the city
        const capturingPlayer = this.gameState.players.find(p => p.id === unit.playerId);
        if (capturingPlayer?.isHuman) {
          SoundEffects.playCivilizationFanfare(capturingPlayer.civilizationType);
        }

        // Emit city capture event
        this.emit('cityCapture', {
          city: cityAtPosition,
          newOwner: unit.playerId,
          oldOwner: oldOwner,
          capturingUnit: unit
        });

        // Check for defeated players after city capture
        this.checkForDefeatedPlayers();

        console.log(`City ${cityAtPosition.name} successfully captured by ${unit.playerId}`);
      }
    }

    // Update visibility for the unit's movement
    VisibilitySystem.updateVisibilityForUnitMove(this.gameState, unit, normalizedPosition);

    // Break fortification and road building when unit moves
    if (unit.fortified || unit.fortifying) {
      unit.fortified = false;
      unit.fortifying = false;
      unit.fortificationTurns = 0;
    }

    if (unit.buildingRoad) {
      unit.buildingRoad = false;
      unit.roadBuildingTurns = 0;
      console.log('buildRoad: Road building cancelled due to unit movement');
    }

    if (unit.buildingMine) {
      unit.buildingMine = false;
      unit.mineBuildingTurns = 0;
      console.log('buildMine: Mine building cancelled due to unit movement');
    }

    // If movement cost exceeds remaining points, drain all remaining movement
    if (movementCost > unit.movementPoints) {
      unit.movementPoints = 0;
    } else {
      unit.movementPoints -= movementCost;
    }

    // If unit can no longer move, remove from queue
    if (unit.movementPoints <= 0) {
      this.removeUnitFromQueue(unitId);
    }

    this.emit('unitMoved', { unit, newPosition: normalizedPosition });
    return true;
  }

  // Calculate movement cost including terrain and roads
  private calculateMovementCost(fromPosition: Position, toPosition: Position): number {
    // Check if the move is to an adjacent tile (including diagonals)
    const mapWidth = this.gameState.worldMap[0]?.length || 80;

    // Calculate direct distance
    const directDx = Math.abs(fromPosition.x - toPosition.x);
    const wrappedDx = mapWidth - directDx;
    const dx = Math.min(directDx, wrappedDx);
    const dy = Math.abs(fromPosition.y - toPosition.y);

    // Check if adjacent (including diagonals) using Chebyshev distance
    const isAdjacent = Math.max(dx, dy) === 1;

    if (!isAdjacent) {
      // For non-adjacent moves, use Manhattan distance (this would need pathfinding for proper implementation)
      return dx + dy;
    }

    // Get tiles at both positions
    const fromTile = this.gameState.worldMap[fromPosition.y]?.[fromPosition.x];
    const toTile = this.gameState.worldMap[toPosition.y]?.[toPosition.x];
    if (!fromTile || !toTile) return 999; // Invalid tile

    // Check if both tiles have roads - if so, movement cost is 1/3 regardless of terrain
    const fromHasRoad = fromTile.improvements?.some(imp => imp.type === ImprovementType.ROAD);
    const toHasRoad = toTile.improvements?.some(imp => imp.type === ImprovementType.ROAD);

    if (fromHasRoad && toHasRoad) {
      return 1 / 3; // Road movement bonus
    }

    // Otherwise use normal terrain movement cost
    return TerrainManager.getMovementCost(toTile.terrain);
  }

  // Check if unit can move to a specific terrain type
  private canUnitMoveToTerrain(unit: Unit, position: Position): boolean {
    const tile = this.gameState.worldMap[position.y]?.[position.x];
    if (!tile) return false;

    // Check for other units at the target position
    const unitsAtPosition = this.gameState.units.filter(u =>
      u.position.x === position.x && u.position.y === position.y
    );

    // Allow stacking with friendly units
    const friendlyUnitsAtPosition = unitsAtPosition.filter(u => u.playerId === unit.playerId);
    // Enemy units will trigger combat, which is handled in moveUnit method

    // First, check if there's a city at the target position
    const cityAtPosition = this.gameState.cities.find(city =>
      city.position.x === position.x && city.position.y === position.y
    );

    // If there's a city and the unit belongs to the same player, allow movement
    if (cityAtPosition && cityAtPosition.playerId === unit.playerId) {
      return true;
    }

    // Get unit stats to determine category
    const unitStats = getUnitStats(unit.type);
    const targetTerrain = tile.terrain;

    // Naval units can move freely in ocean
    if (unitStats.category === UnitCategory.NAVAL) {
      return true;
    }

    // Air units can move over any terrain
    if (unitStats.category === UnitCategory.AIR) {
      return true;
    }

    // Check if target is ocean
    if (targetTerrain === TerrainType.OCEAN) {
      // Non-naval units cannot move to ocean unless there's a transport ship
      return this.hasAvailableTransport(position, unit);
    }

    // For other terrain types, use TerrainManager
    return TerrainManager.isPassable(targetTerrain);
  }

  // Check if there's an available transport ship at the given position
  private hasAvailableTransport(position: Position, unitToTransport: Unit): boolean {
    // Find naval units at the target position
    const navalUnitsAtPosition = this.gameState.units.filter(u =>
      u.position.x === position.x &&
      u.position.y === position.y &&
      u.playerId === unitToTransport.playerId && // Same player
      getUnitStats(u.type).category === UnitCategory.NAVAL &&
      getUnitStats(u.type).canCarryUnits && // Has transport capacity
      getUnitStats(u.type).canCarryUnits! > 0
    );

    // Check if any naval unit has available capacity
    for (const navalUnit of navalUnitsAtPosition) {
      const stats = getUnitStats(navalUnit.type);
      const maxCapacity = stats.canCarryUnits || 0;

      // Count currently carried units (we'd need to track this in the naval unit)
      // For now, assume naval units are available if they have transport capacity
      const currentlyCarried = 0; // TODO: Implement proper tracking of carried units

      if (currentlyCarried < maxCapacity) {
        return true;
      }
    }

    return false;
  }

  // Normalize position coordinates with horizontal wrapping
  private normalizePosition(position: Position): Position {
    const mapWidth = this.gameState.worldMap[0]?.length || 80;
    const mapHeight = this.gameState.worldMap.length || 50;

    let { x, y } = position;

    // Wrap horizontally
    x = ((x % mapWidth) + mapWidth) % mapWidth;

    // Clamp vertically (no wrapping)
    y = Math.max(0, Math.min(y, mapHeight - 1));

    return { x, y };
  }

  // Calculate distance considering horizontal wrapping
  private calculateWrappedDistance(pos1: Position, pos2: Position): number {
    const mapWidth = this.gameState.worldMap[0]?.length || 80;

    // Calculate direct distance
    const directDx = Math.abs(pos1.x - pos2.x);

    // Calculate wrapped distance
    const wrappedDx = mapWidth - directDx;

    // Use shorter distance
    const dx = Math.min(directDx, wrappedDx);
    const dy = Math.abs(pos1.y - pos2.y);

    return dx + dy;
  }

  // Check if a position is valid (considering wrapping)
  private isValidPosition(position: Position): boolean {
    const { y } = position;
    const mapHeight = this.gameState.worldMap.length || 50;

    // Y must be within bounds (no vertical wrapping)
    if (y < 0 || y >= mapHeight) return false;

    // X is always valid due to horizontal wrapping
    return true;
  }

  // Random word components for generating city names when civilization list is exhausted
  private readonly cityPrefixes = [
    'New', 'Old', 'Great', 'Little', 'Upper', 'Lower', 'North', 'South', 'East', 'West',
    'Fort', 'Port', 'Mount', 'Lake', 'River', 'Valley', 'Hill', 'Stone', 'Golden', 'Silver'
  ];

  private readonly citySuffixes = [
    'town', 'city', 'burg', 'holm', 'ford', 'haven', 'port', 'field', 'wood', 'hill',
    'vale', 'stead', 'bridge', 'marsh', 'grove', 'ridge', 'fall', 'glen', 'moor', 'wick'
  ];

  // Generate a random city name when civilization names are exhausted
  private generateRandomCityName(): string {
    const prefix = this.cityPrefixes[Math.floor(Math.random() * this.cityPrefixes.length)];
    const suffix = this.citySuffixes[Math.floor(Math.random() * this.citySuffixes.length)];
    return `${prefix}${suffix}`;
  }

  // Generate a default city name for a player based on their civilization
  public generateCityName(playerId: string): string {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) {
      console.warn('generateCityName: Player not found for ID:', playerId);
      return 'New City';
    }

    const civilization = getCivilization(player.civilizationType);
    console.log('generateCityName: Player civilization:', civilization.name, 'Available cities:', civilization.cities.length);
    console.log('generateCityName: Player used city names:', player.usedCityNames);

    // Get available city names (not yet used)
    const availableCityNames = civilization.cities.filter(cityName =>
      !player.usedCityNames.includes(cityName)
    );

    console.log('generateCityName: Available city names:', availableCityNames);

    // If we have available civilization-specific names, use the first one
    if (availableCityNames.length > 0) {
      const cityName = availableCityNames[0];
      console.log('generateCityName: Returning civilization city name:', cityName);
      // We'll mark it as used when the city is actually founded
      return cityName;
    }

    console.log('generateCityName: All civilization names exhausted, generating random name');

    // If all civilization names are used, generate a random name
    let randomName: string;
    let attempts = 0;
    const maxAttempts = 50; // Prevent infinite loops

    do {
      randomName = this.generateRandomCityName();
      attempts++;
    } while (player.usedCityNames.includes(randomName) && attempts < maxAttempts);

    // If we still have a duplicate after max attempts, add a number
    if (player.usedCityNames.includes(randomName)) {
      randomName = `${randomName} ${player.usedCityNames.length + 1}`;
    }

    console.log('generateCityName: Returning random city name:', randomName);
    return randomName;
  }

  // Found a city
  public foundCity(unitId: string, cityName?: string): boolean {
    const unit = this.gameState.units.find((u: Unit) => u.id === unitId);
    if (!unit || unit.type !== UnitType.SETTLERS) return false;

    // Check if position allows city founding (terrain validation)
    if (!this.isValidPosition(unit.position)) {
      console.log('foundCity: Cannot found city - invalid terrain');
      return false;
    }

    // Check minimum distance requirement (3 squares between cities)
    const minDistance = 3;
    for (const city of this.gameState.cities) {
      if (this.calculateWrappedDistance(unit.position, city.position) < minDistance) {
        console.log('foundCity: Cannot found city - too close to existing city');
        return false;
      }
    }

    console.log('foundCity: Founding city for player:', unit.playerId);

    // Generate city name if not provided
    const finalCityName = cityName || this.generateCityName(unit.playerId);
    console.log('foundCity: Final city name chosen:', finalCityName);

    // Mark the city name as used by this player
    const player = this.gameState.players.find(p => p.id === unit.playerId);
    if (player && !player.usedCityNames.includes(finalCityName)) {
      player.usedCityNames.push(finalCityName);
      console.log('foundCity: Marked city name as used. Player used names now:', player.usedCityNames);
    }

    // Create new city
    const city: City = {
      id: `city-${Date.now()}`,
      name: finalCityName,
      position: unit.position,
      population: 1,
      playerId: unit.playerId,
      buildings: [],
      wonders: [],
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

    this.gameState.cities.push(city);

    // Set initial production to the best defensive unit
    const bestDefensiveUnit = this.getBestDefensiveUnit(unit.playerId);
    if (bestDefensiveUnit) {
      city.production = {
        type: 'unit',
        item: bestDefensiveUnit.type as any,
        turnsRemaining: bestDefensiveUnit.turns
      };
    }

    // Remove the settler unit from game state
    this.gameState.units = this.gameState.units.filter((u: Unit) => u.id !== unitId);

    // Remove the settler unit from the queue system as well
    this.removeUnitFromQueue(unitId);

    // Play city founding sound effect only for human players
    const foundingPlayer = this.gameState.players.find(p => p.id === unit.playerId);
    if (foundingPlayer?.isHuman) {
      SoundEffects.playCityFoundingSound();
    }

    this.emit('cityFounded', city);
    return true;
  }

  // Rename a city
  public renameCity(cityId: string, newName: string): boolean {
    const city = this.gameState.cities.find(c => c.id === cityId);
    if (!city) return false;

    const oldName = city.name;
    city.name = newName;

    // Update the player's used city names
    const player = this.gameState.players.find(p => p.id === city.playerId);
    if (player) {
      // Remove old name and add new name
      const oldNameIndex = player.usedCityNames.indexOf(oldName);
      if (oldNameIndex !== -1) {
        player.usedCityNames.splice(oldNameIndex, 1);
      }
      if (!player.usedCityNames.includes(newName)) {
        player.usedCityNames.push(newName);
      }
    }

    this.emit('cityRenamed', { city, oldName, newName });
    return true;
  }

  // Change city production
  public changeCityProduction(cityId: string, production: string): boolean {
    const city = this.gameState.cities.find(c => c.id === cityId);
    if (!city) return false;

    // Get the current player to check technologies
    const player = this.gameState.players.find(p => p.id === city.playerId);
    if (!player) return false;

    // Validate the production choice
    const existingBuildings = city.buildings.map(b => b.type as any);
    const availableOptions = ProductionManager.getAvailableProduction(
      player.technologies,
      existingBuildings,
      2,
      city.production_points,
      city,
      this.gameState.worldMap
    );

    // Find the selected option
    const selectedOption = availableOptions.find(opt =>
      opt.name === production || opt.id === production.toLowerCase()
    );

    if (!selectedOption) {
      console.warn(`Production option '${production}' is not available for this city`);
      return false;
    }

    // In Civilization 1, shields are typically transferred when switching production
    // Only reset shields in specific cases (like switching from units to buildings)
    // For now, keep the shields to allow for the "shield transfer" mechanic
    // city.production_points = 0; // Comment out - keep accumulated shields

    // Set up production item with proper cost calculation
    const productionItem = {
      type: selectedOption.type,
      item: selectedOption.id,
      turnsRemaining: selectedOption.turns
    };

    city.production = productionItem as any;
    this.emit('cityProductionChanged', { city, production });
    return true;
  }

  // Get production time for an item
  private getProductionTime(item: string): number {
    const productionTimes: { [key: string]: number } = {
      'Settler': 4,
      'Warrior': 2,
      'Phalanx': 3,
      'Archer': 3,
      'Legion': 4,
      'Scout': 2,
      'Granary': 6,
      'Barracks': 4,
      'Library': 8,
      'Temple': 6,
      'Walls': 10,
    };
    return productionTimes[item] || 3;
  }

  // Attack another unit
  public attackUnit(attackerUnitId: string, defenderUnitId: string): CombatResult | null {
    const attacker = this.gameState.units.find(u => u.id === attackerUnitId);
    const defender = this.gameState.units.find(u => u.id === defenderUnitId);

    if (!attacker || !defender) return null;

    // Get all units at the defender's position (for stack combat)
    const allUnitsAtPosition = this.gameState.units.filter(u =>
      u.position.x === defender.position.x && u.position.y === defender.position.y
    );

    // Check if there's a city at the defender's position
    const cityAtPosition = this.gameState.cities.find(city =>
      city.position.x === defender.position.x && city.position.y === defender.position.y
    );

    // Check if defender is on a fortress tile
    const defenderTile = this.gameState.worldMap[defender.position.y]?.[defender.position.x];
    const defenderHasFortress = defenderTile?.improvements?.some(imp => imp.type === ImprovementType.FORTRESS) || false;

    const result = this.combatSystem.executeAttack(attacker, defender, allUnitsAtPosition, cityAtPosition, defenderHasFortress);

    if (result) {
      // Process combat results
      this.processCombatResult(result, defender.position);
    }

    return result;
  }

  // Fortify a unit
  public fortifyUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    const stats = getUnitStats(unit.type);
    if (!stats.canFortify) return false;

    // Get the terrain at the unit's position
    const tile = this.gameState.worldMap[unit.position.y]?.[unit.position.x];
    if (!tile) return false;

    // Determine fortification timing based on terrain and city presence
    const isInCity = this.isUnitInCity(unit.position);
    const terrainType = tile.terrain;
    const requiredTurns = isInCity ? 1 : this.getFortificationTurns(terrainType);

    // Initialize fortification state
    unit.fortificationTurns = unit.fortificationTurns || 0;

    if (requiredTurns === 1) {
      // Instant fortification (1 turn)
      unit.fortified = true;
      unit.fortifying = false;
      unit.fortificationTurns = 1;
    } else {
      // 2-turn fortification
      if (unit.fortificationTurns === 0) {
        // First turn - start fortifying
        unit.fortifying = true;
        unit.fortified = false;
        unit.fortificationTurns = 1;
      } else if (unit.fortificationTurns === 1 && unit.fortifying) {
        // Second turn - complete fortification
        unit.fortified = true;
        unit.fortifying = false;
        unit.fortificationTurns = 2;
      }
    }

    unit.movementPoints = 0; // End turn when fortifying

    // Remove the unit from the move queue since fortification ends the turn
    this.removeUnitFromQueue(unitId);

    this.emit('unitFortified', unit);
    return true;
  }

  // Wake up (unfortify) a unit
  public wakeUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    unit.fortified = false;
    unit.fortifying = false;
    unit.fortificationTurns = 0;

    this.emit('unitWoken', unit);
    return true;
  }

  // Wake a unit and add it back to the move queue
  public wakeAndActivateUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    // Can only activate units belonging to current player
    if (unit.playerId !== this.gameState.currentPlayer) return false;

    // Wake the unit
    this.wakeUnit(unitId);

    // Restore movement points if it doesn't have any
    if (unit.movementPoints <= 0) {
      const stats = getUnitStats(unit.type);
      unit.movementPoints = stats.movement;
    }

    // Add unit to the move queue if it's not already there
    if (!this.unitQueue.find(u => u.id === unitId)) {
      this.unitQueue.push(unit);
    }

    // Make this unit the current unit
    const unitIndex = this.unitQueue.findIndex(u => u.id === unitId);
    if (unitIndex >= 0) {
      this.currentUnitIndex = unitIndex;
      this.setCurrentUnit(unit);
    }

    this.emit('unitActivated', unit);
    return true;
  }

  // Put a unit to sleep
  public sleepUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    // Check if this unit type can sleep (air units cannot sleep)
    if (!canUnitSleep(unit.type)) return false;

    // Put unit to sleep
    unit.sleeping = true;
    unit.movementPoints = 0; // End turn when sleeping

    // Remove the unit from the move queue since sleeping ends the turn
    this.removeUnitFromQueue(unitId);

    this.emit('unitSlept', unit);
    return true;
  }

  // Wake up a sleeping unit
  public wakeUpUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    // Only wake units that are actually sleeping
    if (unit.sleeping !== true) return false;

    unit.sleeping = false;

    this.emit('unitWokeUp', unit);
    return true;
  }

  // Wake up a sleeping unit and add it back to the move queue
  public wakeUpAndActivateUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    // Can only activate units belonging to current player
    if (unit.playerId !== this.gameState.currentPlayer) return false;

    // Wake the unit
    this.wakeUpUnit(unitId);

    // Restore movement points
    const stats = getUnitStats(unit.type);
    unit.movementPoints = stats.movement;

    // Add unit to the move queue if it's not already there
    if (!this.unitQueue.find(u => u.id === unitId)) {
      this.unitQueue.push(unit);
    }

    // Make this unit the current unit
    const unitIndex = this.unitQueue.findIndex(u => u.id === unitId);
    if (unitIndex >= 0) {
      this.currentUnitIndex = unitIndex;
      this.setCurrentUnit(unit);
    }

    this.emit('unitActivated', unit);
    return true;
  }

  // Create a unit of specified type at specified position
  public createUnit(unitType: UnitType, position: Position, playerId: string): Unit | null {
    // Check if player has required technology
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return null;

    const stats = getUnitStats(unitType);
    if (stats.requiredTechnology) {
      const hasTech = player.technologies.includes(stats.requiredTechnology);
      if (!hasTech) return null;
    }

    const unit = createUnit(
      `unit-${Date.now()}-${Math.random()}`,
      unitType,
      position,
      playerId
    );

    this.gameState.units.push(unit);
    this.emit('unitCreated', unit);
    return unit;
  }

  // Get available unit types for a player based on their technology
  public getAvailableUnits(playerId: string): UnitType[] {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return [];

    // Define non-standard units that should only be available with Civ 2 enhancements
    const nonStandardUnits: UnitType[] = [
      UnitType.WARRIOR,
      UnitType.SCOUT,
      UnitType.ARCHER,
      UnitType.SPEARMAN
    ];

    const civ2EnhancementsEnabled = DebugSystem.getInstance().isCiv2EnhancementsEnabled();

    return Object.values(UnitType).filter(unitType => {
      const stats = getUnitStats(unitType);

      // Check technology requirements
      const hasTechRequirement = !stats.requiredTechnology || player.technologies.includes(stats.requiredTechnology);
      if (!hasTechRequirement) return false;

      // Filter out non-standard units if Civ 2 enhancements are disabled
      if (!civ2EnhancementsEnabled && nonStandardUnits.includes(unitType)) {
        return false;
      }

      return true;
    });
  }

  // Get unit information including stats
  public getUnitInfo(unitType: UnitType) {
    return getUnitStats(unitType);
  }

  // Get current game state
  public getGameState(): GameState {
    return { ...this.gameState };
  }

  // Pause/unpause game
  public togglePause(): void {
    this.gameState.gamePhase = this.gameState.gamePhase === GamePhase.PAUSED
      ? GamePhase.PLAYING
      : GamePhase.PAUSED;

    this.emit('gamePhaseChanged', this.gameState.gamePhase);
  }

  // Start a revolution to change government
  public startRevolution(playerId: string): boolean {
    const player = this.gameState.players.find((p: Player) => p.id === playerId);
    if (!player || this.gameState.gamePhase !== GamePhase.PLAYING) return false;

    // Check if already in anarchy
    if (player.government === GovernmentType.ANARCHY) return false;

    // Start anarchy period (2-5 turns based on Civilization mechanics)
    player.government = GovernmentType.ANARCHY;
    player.revolutionTurns = Math.floor(Math.random() * 4) + 2; // 2-5 turns

    this.emit('revolutionStarted', { playerId, turnsRemaining: player.revolutionTurns });
    return true;
  }

  // Change government after revolution
  public changeGovernment(playerId: string, newGovernment: GovernmentType): boolean {
    const player = this.gameState.players.find((p: Player) => p.id === playerId);
    if (!player || player.government !== GovernmentType.ANARCHY) return false;

    // Check if player has required technology
    const governmentData = GOVERNMENTS[newGovernment];
    if (governmentData.requiredTechnology) {
      const hasTech = player.technologies.includes(governmentData.requiredTechnology);
      if (!hasTech) return false;
    }

    // Change government
    player.government = newGovernment;
    player.revolutionTurns = undefined;

    this.emit('governmentChanged', { playerId, newGovernment });
    return true;
  }

  // Get available governments for a player
  public getAvailableGovernments(playerId: string): GovernmentType[] {
    const player = this.gameState.players.find((p: Player) => p.id === playerId);
    if (!player) return [];

    const available: GovernmentType[] = [GovernmentType.DESPOTISM]; // Always available

    // Check technology requirements for other governments
    Object.values(GOVERNMENTS).forEach((gov: any) => {
      if (gov.type === GovernmentType.DESPOTISM || gov.type === GovernmentType.ANARCHY) return;

      if (!gov.requiredTechnology ||
        player.technologies.includes(gov.requiredTechnology)) {
        available.push(gov.type);
      }
    });

    return available;
  }

  // Get current government effects for a player
  public getGovernmentEffects(playerId: string): GovernmentEffects | null {
    const player = this.gameState.players.find((p: Player) => p.id === playerId);
    if (!player) return null;

    return GOVERNMENTS[player.government as GovernmentType].effects;
  }

  // Get available technologies for research
  public getAvailableTechnologies(playerId: string): TechnologyType[] {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return [];

    return Object.values(TechnologyType).filter(techType => {
      // Don't show already known technologies
      if (player.technologies.includes(techType)) return false;

      // Check if prerequisites are met
      return canResearch(techType, player.technologies);
    });
  }

  // Check if current player needs to select research technology
  private checkForResearchSelection(): void {
    console.log('checkForResearchSelection: Checking if current player needs to select research technology');
    const currentPlayer = this.getCurrentPlayer();
    console.log('checkForResearchSelection: Current player:', currentPlayer);
    if (!currentPlayer || !currentPlayer.isHuman) {
      console.log('checkForResearchSelection: No current player or not a human player');
      return;
    }

    // Only prompt after the first turn to give players time to understand the game
    if (this.gameState.turn <= 1) {
      console.log('checkForResearchSelection: Not prompting for research selection on first turn');
      return;
    }

    // Check if player has no current research selected
    if (!currentPlayer.currentResearch) {
      // Check if there are any technologies available to research
      const availableTechs = this.getAvailableTechnologies(currentPlayer.id);
      console.log('checkForResearchSelection: Available technologies for research:', availableTechs);
      if (availableTechs.length > 0) {
        console.log('checkForResearchSelection: Player needs to select research - triggering modal');
        // Emit event to trigger the research selection modal
        this.emit('researchSelectionRequired', {
          playerId: currentPlayer.id,
          player: currentPlayer
        });
      } else {
        console.log('checkForResearchSelection: No technologies available for research');
      }
    } else {
      console.log('checkForResearchSelection: Player already has current research:', currentPlayer.currentResearch);
    }
  }

  // Research a technology
  public researchTechnology(playerId: string, technologyType: TechnologyType): boolean {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return false;

    // Check if already researched
    if (player.technologies.includes(technologyType)) return false;

    // Check if this is the current research and player has enough progress
    const cost = getResearchCost(technologyType);
    const progress = player.currentResearch === technologyType ? (player.currentResearchProgress || 0) : 0;

    if (progress < cost) return false;

    // Research the technology
    player.technologies.push(technologyType);
    player.currentResearch = undefined; // Clear current research
    player.currentResearchProgress = 0; // Reset progress

    this.emit('technologyResearched', { playerId, technologyType });
    return true;
  }

  // Set current research for a player (without immediately researching)
  public setCurrentResearch(playerId: string, technologyType: TechnologyType): boolean {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return false;

    // Check if already researched
    if (player.technologies.includes(technologyType)) return false;

    // Check if prerequisites are met
    if (!canResearch(technologyType, player.technologies)) return false;

    // Set as current research and reset progress
    player.currentResearch = technologyType;
    player.currentResearchProgress = 0; // Start fresh progress toward this technology
    return true;
  }

  // Get technology information
  public getTechnologyInfo(technologyType: TechnologyType) {
    return getTechnology(technologyType);
  }

  // Event system
  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  public off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  // Get the number of turns required to fully fortify on a terrain type
  private getFortificationTurns(terrainType: TerrainType): number {
    // 1 turn fortification: city, plains, desert, grassland
    // 2 turn fortification: forest, jungle, mountain, hills, rivers
    switch (terrainType) {
      case TerrainType.GRASSLAND:
      case TerrainType.DESERT:
        return 1;
      case TerrainType.FOREST:
      case TerrainType.JUNGLE:
      case TerrainType.MOUNTAINS:
      case TerrainType.HILLS:
      case TerrainType.RIVER:
        return 2;
      default:
        return 1; // Default to 1 turn for unknown terrain
    }
  }

  // Check if a unit is on a city tile (which provides 1-turn fortification)
  private isUnitInCity(unitPosition: Position): boolean {
    const tile = this.gameState.worldMap[unitPosition.y]?.[unitPosition.x];
    return tile?.city !== undefined;
  }

  // Get civilization information for a player
  public getPlayerCivilization(playerId: string): Civilization | null {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return null;
    return getCivilization(player.civilizationType);
  }

  // Get the adjective for a player's civilization (e.g., "Roman", "American")
  public getPlayerCivilizationAdjective(playerId: string): string {
    const civilization = this.getPlayerCivilization(playerId);
    return civilization ? civilization.adjective : 'Unknown';
  }

  // Get the leader name for a player's civilization
  public getPlayerLeader(playerId: string): string {
    const civilization = this.getPlayerCivilization(playerId);
    return civilization ? civilization.leader : 'Unknown Leader';
  }

  // Get the best defensive unit available to a player
  private getBestDefensiveUnit(playerId: string): { type: string; turns: number } | null {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return null;

    // Defensive units in order of preference (best to worst)
    const defensiveUnits = [
      UnitType.RIFLEMEN,    // Industrial era
      UnitType.MUSKETEERS,  // Gunpowder era  
      UnitType.PHALANX,     // Classical era
      UnitType.MILITIA      // Ancient era (starting unit)
    ];

    // Find the best unit the player can build
    for (const unitType of defensiveUnits) {
      if (ProductionManager.canProduce('unit', unitType, player.technologies, [])) {
        // Calculate production turns (simplified - using base production of 1)
        const cost = ProductionManager.getProductionCost('unit', unitType);
        const turns = Math.ceil(cost / 1); // Base production capacity

        return {
          type: unitType,
          turns: turns
        };
      }
    }

    return null;
  }

  // Terrain improvement methods
  public buildRoad(unitId: string): boolean {
    const unit = this.gameState.units.find((u: Unit) => u.id === unitId);
    if (!unit || unit.type !== UnitType.SETTLERS) {
      console.log('buildRoad: Only Settlers can build roads');
      return false;
    }

    if (unit.playerId !== this.gameState.currentPlayer) {
      console.log('buildRoad: Unit does not belong to current player');
      return false;
    }

    const tile = this.gameState.worldMap[unit.position.y]?.[unit.position.x];
    if (!tile) {
      console.log('buildRoad: Invalid tile position');
      return false;
    }

    // Check if roads can be built over rivers - requires Bridge Building technology
    if (tile.terrain === TerrainType.RIVER) {
      const player = this.gameState.players.find(p => p.id === unit.playerId);
      if (!player?.technologies.includes(TechnologyType.BRIDGE_BUILDING)) {
        console.log('buildRoad: Bridge Building technology required to build roads over rivers');
        return false;
      }
    }

    // Check if road already exists
    const hasRoad = tile.improvements?.some(imp => imp.type === ImprovementType.ROAD);
    if (hasRoad) {
      console.log('buildRoad: Road already exists on this tile');
      return false;
    }

    // Determine how many turns are required for this terrain
    const requiredTurns = this.getRoadBuildingTurns(tile.terrain);

    // Initialize road building state
    unit.roadBuildingTurns = unit.roadBuildingTurns || 0;

    if (requiredTurns === 1) {
      // Instant road building (1 turn)
      if (!tile.improvements) {
        tile.improvements = [];
      }

      tile.improvements.push({
        type: ImprovementType.ROAD,
        completedTurn: this.gameState.turn
      });

      // Clear building state
      unit.buildingRoad = false;
      unit.roadBuildingTurns = 0;
      unit.movementPoints = 0; // End turn when building

      console.log(`buildRoad: Road built instantly at (${unit.position.x}, ${unit.position.y})`);
      this.emit('terrainImproved', {
        position: unit.position,
        improvement: 'road',
        playerId: unit.playerId
      });

      // Remove unit from queue since turn ends
      this.removeUnitFromQueue(unitId);
    } else {
      // 2-turn road building
      if (unit.roadBuildingTurns === 0) {
        // First turn - start building road
        unit.buildingRoad = true;
        unit.roadBuildingTurns = 1;
        unit.movementPoints = 0; // End turn when starting road building

        console.log(`buildRoad: Started building road at (${unit.position.x}, ${unit.position.y}) - turn 1 of 2`);
        this.emit('roadBuildingStarted', {
          unit,
          position: unit.position,
          turnsRemaining: 1
        });

        // Remove unit from queue since turn ends
        this.removeUnitFromQueue(unitId);
      } else if (unit.roadBuildingTurns === 1 && unit.buildingRoad) {
        // Second turn - complete road
        if (!tile.improvements) {
          tile.improvements = [];
        }

        tile.improvements.push({
          type: ImprovementType.ROAD,
          completedTurn: this.gameState.turn
        });

        // Clear building state
        unit.buildingRoad = false;
        unit.roadBuildingTurns = 0;
        unit.movementPoints = 0; // End turn when completing

        console.log(`buildRoad: Road completed at (${unit.position.x}, ${unit.position.y})`);
        this.emit('terrainImproved', {
          position: unit.position,
          improvement: 'road',
          playerId: unit.playerId
        });

        // Remove unit from queue since turn ends
        this.removeUnitFromQueue(unitId);
      }
    }

    return true;
  }

  public buildIrrigation(unitId: string): boolean {
    const unit = this.gameState.units.find((u: Unit) => u.id === unitId);
    if (!unit || unit.type !== UnitType.SETTLERS) {
      console.log('buildIrrigation: Only Settlers can build irrigation');
      return false;
    }

    if (unit.playerId !== this.gameState.currentPlayer) {
      console.log('buildIrrigation: Unit does not belong to current player');
      return false;
    }

    const tile = this.gameState.worldMap[unit.position.y]?.[unit.position.x];
    if (!tile) {
      console.log('buildIrrigation: Invalid tile position');
      return false;
    }

    // Check if terrain can be irrigated
    const irrigatableTerrains = [
      TerrainType.DESERT,
      TerrainType.GRASSLAND,
      TerrainType.HILLS,
      TerrainType.PLAINS,
      TerrainType.RIVER
    ];

    if (!irrigatableTerrains.includes(tile.terrain)) {
      console.log('buildIrrigation: This terrain cannot be irrigated');
      return false;
    }

    // Check if irrigation already exists
    const hasIrrigation = tile.improvements?.some(imp => imp.type === ImprovementType.IRRIGATION);
    if (hasIrrigation) {
      console.log('buildIrrigation: Irrigation already exists on this tile');
      return false;
    }

    // Check water access requirement
    if (!this.hasWaterAccess(unit.position.x, unit.position.y)) {
      console.log('buildIrrigation: No water access - must be adjacent to river, ocean, or irrigated tile');
      return false;
    }

    // Add irrigation improvement
    if (!tile.improvements) {
      tile.improvements = [];
    }

    tile.improvements.push({
      type: ImprovementType.IRRIGATION,
      completedTurn: this.gameState.turn
    });

    console.log(`buildIrrigation: Irrigation built at (${unit.position.x}, ${unit.position.y})`);
    this.emit('terrainImproved', {
      position: unit.position,
      improvement: 'irrigation',
      playerId: unit.playerId
    });

    return true;
  }

  public buildMine(unitId: string): boolean {
    const unit = this.gameState.units.find((u: Unit) => u.id === unitId);
    if (!unit || unit.type !== UnitType.SETTLERS) {
      console.log('buildMine: Only Settlers can build mines');
      return false;
    }

    if (unit.playerId !== this.gameState.currentPlayer) {
      console.log('buildMine: Unit does not belong to current player');
      return false;
    }

    const tile = this.gameState.worldMap[unit.position.y]?.[unit.position.x];
    if (!tile) {
      console.log('buildMine: Invalid tile position');
      return false;
    }

    // Check if terrain can be mined (all land tiles except ocean can be mined)
    const unmineableTerrains = [TerrainType.OCEAN];
    if (unmineableTerrains.includes(tile.terrain)) {
      console.log('buildMine: This terrain cannot be mined');
      return false;
    }

    // Check if mine already exists
    const hasMine = tile.improvements?.some(imp => imp.type === ImprovementType.MINE);
    if (hasMine) {
      console.log('buildMine: Mine already exists on this tile');
      return false;
    }

    // Check if unit is already building a mine
    if (unit.buildingMine) {
      console.log('buildMine: Unit is already building a mine');
      return false;
    }

    // Start mine building process (takes 2 turns)
    unit.buildingMine = true;
    unit.mineBuildingTurns = 0;
    unit.movementPoints = 0; // End turn when starting mine building

    // Remove unit from queue since turn ends
    this.removeUnitFromQueue(unitId);

    console.log(`buildMine: Started building mine at (${unit.position.x}, ${unit.position.y})`);
    this.emit('mineBuildingStarted', {
      unit,
      position: unit.position,
      turnsRemaining: 2
    });

    return true;
  }

  public cancelMineBuilding(unitId: string): boolean {
    const unit = this.gameState.units.find((u: Unit) => u.id === unitId);
    if (!unit) {
      return false;
    }

    if (unit.buildingMine) {
      unit.buildingMine = false;
      unit.mineBuildingTurns = 0;
      console.log(`cancelMineBuilding: Cancelled mine building at (${unit.position.x}, ${unit.position.y})`);
      this.emit('mineBuildingCancelled', unit);
      return true;
    }

    return false;
  }

  public cancelMineBuildingAndActivateUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    // Can only activate units belonging to current player
    if (unit.playerId !== this.gameState.currentPlayer) return false;

    // Cancel mine building
    this.cancelMineBuilding(unitId);

    // Restore movement points if it doesn't have any
    if (unit.movementPoints <= 0) {
      const stats = getUnitStats(unit.type);
      unit.movementPoints = stats.movement;
    }

    // Add unit to the move queue if it's not already there
    if (!this.unitQueue.find(u => u.id === unitId)) {
      this.unitQueue.push(unit);
    }

    // Make this unit the current unit
    const unitIndex = this.unitQueue.findIndex(u => u.id === unitId);
    if (unitIndex >= 0) {
      this.currentUnitIndex = unitIndex;
      this.setCurrentUnit(unit);
    }

    this.emit('unitActivated', unit);
    return true;
  }

  // Helper method to check water access for irrigation
  private hasWaterAccess(x: number, y: number): boolean {
    const mapWidth = this.gameState.worldMap[0].length;
    const mapHeight = this.gameState.worldMap.length;

    // Check adjacent tiles (not diagonal)
    const directions = [
      { dx: 0, dy: -1 }, // North
      { dx: 1, dy: 0 },  // East
      { dx: 0, dy: 1 },  // South
      { dx: -1, dy: 0 }  // West
    ];

    for (const dir of directions) {
      let checkX = x + dir.dx;
      let checkY = y + dir.dy;

      // Handle horizontal wrapping
      if (checkX < 0) checkX = mapWidth - 1;
      if (checkX >= mapWidth) checkX = 0;

      // Skip if out of vertical bounds
      if (checkY < 0 || checkY >= mapHeight) continue;

      const adjacentTile = this.gameState.worldMap[checkY]?.[checkX];
      if (!adjacentTile) continue;

      // Water access sources:
      // 1. River or Ocean terrain
      if (adjacentTile.terrain === TerrainType.RIVER || adjacentTile.terrain === TerrainType.OCEAN) {
        return true;
      }

      // 2. Another irrigated tile
      const hasIrrigation = adjacentTile.improvements?.some(imp => imp.type === ImprovementType.IRRIGATION);
      if (hasIrrigation) {
        return true;
      }
    }

    return false;
  }

  // Get terrain yields with improvements
  public getTerrainYieldsWithImprovements(x: number, y: number): { food: number; production: number; trade: number } {
    const tile = this.gameState.worldMap[y]?.[x];
    if (!tile) {
      return { food: 0, production: 0, trade: 0 };
    }

    // Get base yields
    const baseYields = TerrainManager.getTerrainYields(tile.terrain);
    let yields = { ...baseYields };

    // Apply improvement bonuses
    if (tile.improvements) {
      for (const improvement of tile.improvements) {
        switch (improvement.type) {
          case ImprovementType.IRRIGATION:
            yields.food += 1;
            break;

          case ImprovementType.MINE:
            if (tile.terrain === TerrainType.DESERT) {
              yields.production += 1;
            } else if (tile.terrain === TerrainType.HILLS) {
              yields.production += 3;
            } else if (tile.terrain === TerrainType.MOUNTAINS) {
              yields.production += 1;
            }
            break;

          case ImprovementType.ROAD:
            // Roads increase trade for specific terrains
            if (tile.terrain === TerrainType.GRASSLAND ||
              tile.terrain === TerrainType.PLAINS ||
              tile.terrain === TerrainType.DESERT) {
              yields.trade += 1;
            }
            break;
        }
      }
    }

    return yields;
  }

  // Get the number of turns required to build a road on a terrain type
  private getRoadBuildingTurns(terrainType: TerrainType): number {
    // 1 turn: grassland, desert, plains
    // 2 turns: forest, jungle, hills, mountains, rivers
    switch (terrainType) {
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
        return 1; // Default to 1 turn for unknown terrain
    }
  }

  // Cancel road building for a unit
  public cancelRoadBuilding(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    if (unit.buildingRoad) {
      unit.buildingRoad = false;
      unit.roadBuildingTurns = 0;
      console.log('cancelRoadBuilding: Road building cancelled');
      this.emit('roadBuildingCancelled', unit);
    }

    return true;
  }

  // Cancel road building and activate the unit
  public cancelRoadBuildingAndActivateUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    // Can only activate units belonging to current player
    if (unit.playerId !== this.gameState.currentPlayer) return false;

    // Cancel road building
    this.cancelRoadBuilding(unitId);

    // Restore movement points if it doesn't have any
    if (unit.movementPoints <= 0) {
      const stats = getUnitStats(unit.type);
      unit.movementPoints = stats.movement;
    }

    // Add unit to the move queue if it's not already there
    if (!this.unitQueue.find(u => u.id === unitId)) {
      this.unitQueue.push(unit);
    }

    // Make this unit the current unit
    const unitIndex = this.unitQueue.findIndex(u => u.id === unitId);
    if (unitIndex >= 0) {
      this.currentUnitIndex = unitIndex;
      this.setCurrentUnit(unit);
    }

    this.emit('unitActivated', unit);
    return true;
  }

  public buildFortress(unitId: string): boolean {
    const unit = this.gameState.units.find((u: Unit) => u.id === unitId);
    if (!unit || unit.type !== UnitType.SETTLERS) {
      console.log('buildFortress: Only Settlers can build fortresses');
      return false;
    }

    if (unit.playerId !== this.gameState.currentPlayer) {
      console.log('buildFortress: Unit does not belong to current player');
      return false;
    }

    // Check if player has Construction technology
    const player = this.gameState.players.find(p => p.id === unit.playerId);
    if (!player?.technologies.includes(TechnologyType.CONSTRUCTION)) {
      console.log('buildFortress: Construction technology required to build fortress');
      return false;
    }

    const tile = this.gameState.worldMap[unit.position.y]?.[unit.position.x];
    if (!tile) {
      console.log('buildFortress: Invalid tile position');
      return false;
    }

    // Check if position is in a city square - fortresses cannot be built in cities
    const cityAtPosition = this.gameState.cities.find(city =>
      city.position.x === unit.position.x && city.position.y === unit.position.y
    );
    if (cityAtPosition) {
      console.log('buildFortress: Fortress cannot be built in a city square');
      return false;
    }

    // Check if fortress already exists
    const hasFortress = tile.improvements?.some(imp => imp.type === ImprovementType.FORTRESS);
    if (hasFortress) {
      console.log('buildFortress: Fortress already exists on this tile');
      return false;
    }

    // Check if terrain allows fortress building (cannot build on ocean)
    if (tile.terrain === TerrainType.OCEAN) {
      console.log('buildFortress: Fortress cannot be built on ocean');
      return false;
    }

    // Add fortress improvement
    if (!tile.improvements) {
      tile.improvements = [];
    }

    tile.improvements.push({
      type: ImprovementType.FORTRESS,
      completedTurn: this.gameState.turn
    });

    // End unit's turn
    unit.movementPoints = 0;
    this.removeUnitFromQueue(unitId);

    console.log(`buildFortress: Fortress built at (${unit.position.x}, ${unit.position.y})`);
    this.emit('terrainImproved', {
      position: unit.position,
      improvement: 'fortress',
      playerId: unit.playerId
    });

    return true;
  }

  // Initialize food storage for all existing cities (for backward compatibility)
  public initializeFoodStorageForExistingCities(): void {
    this.gameState.cities.forEach(city => {
      if (city.foodStorageCapacity === undefined) {
        CityGrowthSystem.initializeCityFoodStorage(city);
      }
    });
  }

  // Get visibility state for the current player
  public getVisibilityForCurrentPlayer(): VisibilityMap | null {
    if (!this.gameState.visibility) {
      return null;
    }
    return this.gameState.visibility.get(this.gameState.currentPlayer) || null;
  }

  // Check if a tile is visible to the current player
  public isTileVisibleToCurrentPlayer(position: Position): boolean {
    return VisibilitySystem.isTileVisible(this.gameState, this.gameState.currentPlayer, position);
  }

  // Check if a tile has been explored by the current player
  public isTileExploredByCurrentPlayer(position: Position): boolean {
    return VisibilitySystem.isTileExplored(this.gameState, this.gameState.currentPlayer, position);
  }

  /**
   * Check if auto-advance was recently triggered and reset the flag
   */
  public wasAutoAdvanceTriggered(): boolean {
    const wasTriggered = this.autoAdvanceTriggered;
    this.autoAdvanceTriggered = false; // Reset flag after checking
    return wasTriggered;
  }

  // Initiate automatic combat when unit moves into enemy-occupied tile
  private initiateAutomaticCombat(attacker: Unit, targetPosition: Position, enemyUnits: Unit[]): boolean {
    console.log('initiateAutomaticCombat called', { attacker: attacker.type, attackerId: attacker.id, enemyCount: enemyUnits.length });

    // Check if the attacker can attack
    const attackerStats = getUnitStats(attacker.type);
    if (!attackerStats.canAttack) {
      console.log('Unit cannot attack:', attacker.type, 'canAttack:', attackerStats.canAttack);
      SoundEffects.playInvalidActionSound();
      return false;
    }

    console.log('Unit can attack, proceeding with combat');

    // Get the strongest enemy unit to defend (highest defense value)
    const defender = enemyUnits.reduce((strongest, current) => {
      const currentStats = getUnitStats(current.type);
      const strongestStats = getUnitStats(strongest.type);
      return currentStats.defense > strongestStats.defense ? current : strongest;
    });



    // Get all units at the target position (for stack combat)
    const allUnitsAtPosition = this.gameState.units.filter(u =>
      u.position.x === targetPosition.x && u.position.y === targetPosition.y
    );

    // Check if there's a city at the target position
    const cityAtPosition = this.gameState.cities.find(city =>
      city.position.x === targetPosition.x && city.position.y === targetPosition.y
    );

    // Check if defender is on a fortress tile
    const defenderTile = this.gameState.worldMap[targetPosition.y]?.[targetPosition.x];
    const defenderHasFortress = defenderTile?.improvements?.some(imp => imp.type === ImprovementType.FORTRESS) || false;

    // Execute combat
    const result = this.combatSystem.executeAttack(attacker, defender, allUnitsAtPosition, cityAtPosition, defenderHasFortress);

    if (result) {
      // Handle combat results
      this.processCombatResult(result, targetPosition);

      // If attacker wins and can still move, check if we can move to the target position
      if (result.attackerWins && result.attackerSurvived) {
        // Check if there's a city at the target position
        const cityAtPosition = this.gameState.cities.find(city =>
          city.position.x === targetPosition.x &&
          city.position.y === targetPosition.y
        );

        if (cityAtPosition && cityAtPosition.playerId !== attacker.playerId) {
          // Check if there are any remaining enemy units defending the city (after combat)
          const defendingUnits = this.gameState.units.filter(u =>
            u.position.x === targetPosition.x &&
            u.position.y === targetPosition.y &&
            u.playerId === cityAtPosition.playerId
          );

          if (defendingUnits.length === 0) {
            // City is now undefended after combat, move in and capture it!
            attacker.position = targetPosition;
            console.log(`Capturing city ${cityAtPosition.name} from player ${cityAtPosition.playerId} to player ${attacker.playerId} after combat victory`);

            const oldOwner = cityAtPosition.playerId;
            cityAtPosition.playerId = attacker.playerId;

            // Add captured city name to new owner's used names list
            const newOwnerPlayer = this.gameState.players.find(p => p.id === attacker.playerId);
            if (newOwnerPlayer && !newOwnerPlayer.usedCityNames.includes(cityAtPosition.name)) {
              newOwnerPlayer.usedCityNames.push(cityAtPosition.name);
            }

            // Clear any production from the previous owner
            cityAtPosition.production = null;
            cityAtPosition.production_points = 0;

            // Play civilization fanfare if human player captured the city
            const capturingPlayer = this.gameState.players.find(p => p.id === attacker.playerId);
            if (capturingPlayer?.isHuman) {
              SoundEffects.playCivilizationFanfare(capturingPlayer.civilizationType);
            }

            // Emit city capture event
            this.emit('cityCapture', {
              city: cityAtPosition,
              newOwner: attacker.playerId,
              oldOwner: oldOwner,
              capturingUnit: attacker
            });

            // Check for defeated players after city capture
            this.checkForDefeatedPlayers();

            console.log(`City ${cityAtPosition.name} successfully captured by ${attacker.playerId} after combat`);
          } else {
            // City still has defending units, attacker doesn't move in
            console.log(`City ${cityAtPosition.name} still has ${defendingUnits.length} defending units, attacker cannot move in`);
          }
        } else {
          // No city at target position, or city belongs to attacker - normal movement after combat
          attacker.position = targetPosition;
        }

        // Only update visibility and break fortification if the unit actually moved
        if (attacker.position.x === targetPosition.x && attacker.position.y === targetPosition.y) {
          // Update visibility for the unit's movement
          VisibilitySystem.updateVisibilityForUnitMove(this.gameState, attacker, targetPosition);

          // Break fortification and road building when unit moves
          if (attacker.fortified || attacker.fortifying) {
            attacker.fortified = false;
            attacker.fortifying = false;
            attacker.fortificationTurns = 0;
          }

          if (attacker.buildingRoad) {
            attacker.buildingRoad = false;
            attacker.roadBuildingTurns = 0;
          }

          this.emit('unitMoved', { unit: attacker, newPosition: targetPosition });
        }
      }

      // Remove attacker from queue since combat always uses all movement points
      this.removeUnitFromQueue(attacker.id);

      return true;
    }

    return false;
  }

  // Process combat result and handle unit destruction, city damage, etc.
  private processCombatResult(result: CombatResult, combatPosition: Position): void {
    // Determine if human player was involved and play appropriate sound
    const attackerPlayer = this.gameState.players.find(p => p.id === result.attacker.playerId);
    const defenderPlayer = this.gameState.players.find(p => p.id === result.defender.playerId);

    const humanPlayerInvolved = (attackerPlayer?.isHuman || defenderPlayer?.isHuman);

    if (humanPlayerInvolved) {
      // Check if the human player's unit won or lost
      if (result.attackerWins) {
        // Attacker won
        if (attackerPlayer?.isHuman) {
          // Human player attacked and won
          SoundEffects.playPlayerVictorySound();
        } else if (defenderPlayer?.isHuman) {
          // Human player defended and lost
          SoundEffects.playPlayerDefeatSound();
        }
      } else {
        // Defender won
        if (defenderPlayer?.isHuman) {
          // Human player defended and won
          SoundEffects.playPlayerVictorySound();
        } else if (attackerPlayer?.isHuman) {
          // Human player attacked and lost
          SoundEffects.playPlayerDefeatSound();
        }
      }
    }

    // Remove destroyed units from the game
    for (const destroyedUnit of result.unitsDestroyed) {
      this.gameState.units = this.gameState.units.filter(u => u.id !== destroyedUnit.id);
      this.removeUnitFromQueue(destroyedUnit.id);
    }

    // Handle city population loss
    if (result.cityPopulationLost && result.cityPopulationLost > 0) {
      const city = this.gameState.cities.find(c =>
        c.position.x === combatPosition.x && c.position.y === combatPosition.y
      );
      if (city) {
        city.population = Math.max(0, city.population - result.cityPopulationLost);
        this.emit('cityPopulationLost', { city, populationLost: result.cityPopulationLost });
      }
    }

    this.emit('combatResolved', result);
  }

  /**
   * Check for defeated players and eliminate them from the game
   * A player is defeated if they have no cities and it's past the early game period
   */
  private checkForDefeatedPlayers(): void {
    const earlyGameTurns = 10; // Players are safe from elimination for first 10 turns

    if (this.gameState.turn <= earlyGameTurns) {
      return; // No eliminations during early game
    }

    const playersToEliminate: string[] = [];

    for (const player of this.gameState.players) {
      // Skip human players for now (they might have different defeat conditions)
      if (player.isHuman) {
        continue;
      }

      // Skip players who are already defeated
      if (player.defeated) {
        continue;
      }

      // Check if player has any cities
      const playerCities = this.gameState.cities.filter(city => city.playerId === player.id);

      if (playerCities.length === 0) {
        console.log(`Player ${player.name} (${player.id}) has been defeated - no cities remaining`);
        playersToEliminate.push(player.id);
      }
    }

    // Eliminate defeated players
    for (const playerId of playersToEliminate) {
      this.eliminatePlayer(playerId);
    }
  }

  /**
   * Eliminate a player from the game
   */
  private eliminatePlayer(playerId: string): void {
    console.log(`Eliminating player ${playerId} from the game`);

    // Remove all units belonging to this player
    const unitsToRemove = this.gameState.units.filter(unit => unit.playerId === playerId);
    console.log(`Removing ${unitsToRemove.length} units for eliminated player ${playerId}`);

    this.gameState.units = this.gameState.units.filter(unit => unit.playerId !== playerId);

    // Clean up unit queue - remove any units from eliminated player
    this.unitQueue = this.unitQueue.filter(unit => unit.playerId !== playerId);

    // If current unit belongs to eliminated player, advance to next unit
    const currentUnit = this.getCurrentUnit();
    if (currentUnit && currentUnit.playerId === playerId) {
      this.clearCurrentUnit();
      this.selectNextUnit();
    }

    // Mark player as eliminated (but keep in players array for historical record)
    const player = this.gameState.players.find(p => p.id === playerId);
    if (player) {
      // Mark player as defeated
      player.defeated = true;
      console.log(`Player ${player.name} has been marked as defeated`);

      // Only emit event if defeat hasn't been acknowledged yet
      if (!player.defeatAcknowledged) {
        // Emit player elimination event
        this.emit('playerEliminated', {
          playerId: playerId,
          playerName: player?.name || playerId,
          turn: this.gameState.turn
        });
      }
    }
  }

  /**
   * Mark a player's defeat as acknowledged
   */
  public acknowledgePlayerDefeat(playerId: string): void {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (player) {
      player.defeatAcknowledged = true;
      console.log(`Player ${player.name} defeat acknowledged`);
    }
  }

  /**
   * Handle building completion event from TurnManager
   */
  private handleBuildingCompletion(city: City, buildingType: string, isWonder: boolean): void {
    // Only show modal for human players
    const player = this.gameState.players.find(p => p.id === city.playerId);
    if (player && player.isHuman) {
      // Show the modal on next tick to ensure UI is ready
      setTimeout(() => {
        this.buildingCompletionModal.show(buildingType as any, city, isWonder);
      }, 100);
    }

    // Emit event for other systems
    this.emit('buildingCompleted', {
      city,
      buildingType,
      isWonder,
      playerId: city.playerId
    });
  }
}
