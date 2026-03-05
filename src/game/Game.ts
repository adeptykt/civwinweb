import { GamePhase, GameState, Player, Position, Unit, City, GovernmentType, GOVERNMENTS, GovernmentEffects, MapScenario, UnitType, TechnologyType, UnitCategory, TerrainType, ImprovementType, VisibilityMap, DifficultyLevel } from '../types/game';
import { MapGenerator } from './MapGenerator';
import { TurnManager } from './TurnManager';
import { createUnit } from './Units';
import { getUnitStats, canUnitSleep } from './UnitDefinitions';
import { CombatSystem, CombatResult } from './CombatSystem';
import { TerrainManager } from '../terrain/index';
import { CIVILIZATION_DEFINITIONS, CivilizationType, getAllCivilizations, getCivilization, Civilization } from './CivilizationDefinitions';
import { AIPlayer } from './AIPlayer';
import { SoundEffects } from '../utils/SoundEffects';
import { ProductionManager } from './ProductionManager';
import { CityGrowthSystem } from './CityGrowthSystem';
import { VisibilitySystem } from './VisibilitySystem';
import { DebugSystem } from '../utils/DebugSystem';
import { SettingsManager } from '../utils/SettingsManager';
import { BuildingCompletionModal } from '../renderer/BuildingCompletionModal';
import { findPath } from '../utils/Pathfinder';
import { TaxSystem } from './TaxSystem';
import { chooseGovernmentAfterAnarchy, shouldAIStartRevolution } from './ai/AIGovernmentStrategy';
import { findBestInfrastructureAction } from './ai/AISettlerStrategy';
import { isMilitaryUnit } from './ai/AIUtils';
import { DiplomacyManager, DiplomacyContact, DiplomacyOutcome, DiplomacyProposal, DiplomaticStatus } from './DiplomacyManager';
import { getDifficultyParams } from './DifficultyConfig';
import { ResearchSystem } from './ResearchSystem';

export class Game {
  private gameState: GameState;
  private mapGenerator: MapGenerator;
  private turnManager: TurnManager;
  private combatSystem: CombatSystem;
  private buildingCompletionModal: BuildingCompletionModal;
  public diplomacyManager: DiplomacyManager;
  public researchSystem: ResearchSystem;
  private eventListeners: Map<string, Function[]> = new Map();

  /** Pending diplomacy contacts to show the human player (queue, shown one at a time) */
  private pendingDiplomacyContacts: DiplomacyContact[] = [];
  /** Set to true while waiting for the human to respond to a diplomacy dialog */
  private diplomacyInProgress: boolean = false;

  // Unit queue system
  private unitQueue: Unit[] = [];
  private currentUnitIndex: number = 0;
  private initialUnitQueueSize: number = 0; // Track initial queue size to determine auto-advance behavior
  private autoAdvanceTriggered: boolean = false; // Track if auto-advance was just triggered
  private blinkIntervalId: number | null = null;

  // AI turn processing state
  private isProcessingAITurns: boolean = false;
  private aiDevTestPaused: boolean = false;

  constructor() {
    this.mapGenerator = new MapGenerator();
    this.diplomacyManager = new DiplomacyManager();
    this.buildingCompletionModal = new BuildingCompletionModal();
    this.turnManager = new TurnManager(
      (city, buildingType, isWonder) => {
        this.handleBuildingCompletion(city, buildingType, isWonder);
      },
      (position) => {
        this.emit('terrainImproved', { position, improvement: 'mine' });
      }
    );
    this.combatSystem = new CombatSystem();

    // Initialize game state
    this.gameState = {
      turn: 1,
      currentPlayer: '',
      currentPlayerIsHuman: true, // Default to true, will be updated when players are set
      players: [],
      worldMap: [],
      units: [],
      cities: [],
      gamePhase: GamePhase.SETUP,
      score: 0,
      difficulty: 'chieftain'
    };

    this.researchSystem = new ResearchSystem(this.gameState, this.emit.bind(this));
  }

  // Initialize a new game with scenario
  public initializeGame(playerNames: string[], scenario: MapScenario = 'earth', worldSize?: number, humanCivType?: string, difficulty: DifficultyLevel = 'chieftain'): void {
    // Clear terrain sprite cache to ensure fresh terrain generation
    TerrainManager.clearSpriteCache();
    
    // Create players
    this.gameState.players = this.createPlayers(playerNames, humanCivType);
    this.gameState.currentPlayer = this.gameState.players[0].id;
    this.gameState.currentPlayerIsHuman = this.gameState.players[0].isHuman;

    // Reset all per-game state so stale units/cities from a previous game
    // don't persist into the new map (their old coordinates can land on ocean
    // after a fresh map generation).
    this.gameState.units = [];
    this.gameState.cities = [];
    this.gameState.turn = 1;
    this.gameState.score = 0;
    this.gameState.difficulty = difficulty;
    this.unitQueue = [];
    this.currentUnitIndex = 0;

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
  private createPlayers(playerNames: string[], humanCivType?: string): Player[] {
    const allCivs = getAllCivilizations();
    console.log('createPlayers: Available civilizations:', allCivs.map(c => c.name));

    // Build the civ assignment list.
    // Human player (index 0) gets the chosen civ; AI players fill the rest.
    let humanCiv = humanCivType
      ? (allCivs.find(c => c.id === humanCivType) ?? allCivs[0])
      : allCivs[0];

    // Pool of civs for AI: everything except the human's chosen civ, shuffled
    const aiCivPool = allCivs
      .filter(c => c.id !== humanCiv.id)
      .sort(() => Math.random() - 0.5);

    return playerNames.map((name, index) => {
      const civilization = index === 0 ? humanCiv : (aiCivPool[(index - 1) % aiCivPool.length]);

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
        taxRate: 40,     // 40% of trade → gold
        luxuryRate: 10,  // 10% of trade → luxuries (50% left for science)
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

      this.gameState.units.push(settler);
    });
  }

  // Find a suitable starting position for a player — guaranteed never ocean.
  private findStartingPosition(mapWidth: number, mapHeight: number, playerIndex: number): Position {
    const minDistance = 14; // Preferred minimum Manhattan distance from other players
    const margin = 2;       // Tile margin from map edges

    // Collect the positions that have already been assigned to earlier players.
    const existingPositions: Position[] = [];
    for (let i = 0; i < playerIndex; i++) {
      const player = this.gameState.players[i];
      if (player) {
        const firstUnit = this.gameState.units.find(u => u.playerId === player.id);
        if (firstUnit) existingPositions.push(firstUnit.position);
      }
    }

    /** Manhattan distance with horizontal map wrapping. */
    const manhattanDist = (ax: number, ay: number, bx: number, by: number): number => {
      const dx = Math.abs(ax - bx);
      return Math.min(dx, mapWidth - dx) + Math.abs(ay - by);
    };

    const isFarEnough = (x: number, y: number): boolean =>
      existingPositions.every(p => manhattanDist(x, y, p.x, p.y) >= minDistance);

    // Pre-collect all valid land tiles into two tiers across the whole map.
    // Tier 1: preferred city-founding land (passable, canFoundCity, within margin).
    // Tier 2: any passable non-ocean tile (fallback, includes edge tiles).
    const tier1: Position[] = [];
    const tier2: Position[] = [];

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const terrainType = this.gameState.worldMap[y][x].terrain;
        if (terrainType === TerrainType.OCEAN) continue;
        if (!TerrainManager.isPassable(terrainType)) continue;

        tier2.push({ x, y });

        if (TerrainManager.canFoundCity(terrainType) &&
            x >= margin && x < mapWidth - margin &&
            y >= margin && y < mapHeight - margin) {
          tier1.push({ x, y });
        }
      }
    }

    // Fisher-Yates shuffle so we sample randomly rather than always picking top-left land.
    const shuffle = (arr: Position[]): Position[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    // 1. Try preferred positions: city-founding land, far from other players.
    for (const pos of shuffle(tier1)) {
      if (isFarEnough(pos.x, pos.y)) return pos;
    }

    // 2. Relax: any city-founding land (distance no longer enforced).
    if (tier1.length > 0) {
      console.warn(`Player ${playerIndex}: no well-separated city-founding tile; relaxing distance.`);
      return tier1[Math.floor(Math.random() * tier1.length)];
    }

    // 3. Relax further: any passable non-ocean tile with distance enforcement.
    for (const pos of shuffle(tier2)) {
      if (isFarEnough(pos.x, pos.y)) return pos;
    }

    // 4. Last resort: any passable non-ocean tile (absolutely no ocean, no distance).
    if (tier2.length > 0) {
      console.warn(`Player ${playerIndex}: using any passable non-ocean tile.`);
      return tier2[Math.floor(Math.random() * tier2.length)];
    }

    // Should be unreachable on any normal map — entire map would have to be ocean.
    console.error(`CRITICAL: No land tiles found on map for player ${playerIndex}.`);
    // Scan entire map one more time — never return ocean intentionally.
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        if (this.gameState.worldMap[y][x].terrain !== TerrainType.OCEAN) {
          return { x, y };
        }
      }
    }
    // Absolute last resort — map is all ocean; center is the best we can do.
    return { x: Math.floor(mapWidth / 2), y: Math.floor(mapHeight / 2) };
  }

  // Game turn management
  public async endTurn(): Promise<void> {
    if (this.gameState.gamePhase !== GamePhase.PLAYING) return;

    // Set AI processing state to true when ending turn
    this.isProcessingAITurns = true;

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

  // Check if AI turns are currently being processed
  public getIsProcessingAITurns(): boolean {
    return this.isProcessingAITurns;
  }

  // Pause the AI Dev Test autopilot (does not disable the mode)
  public pauseAiDevTest(): void {
    this.aiDevTestPaused = true;
  }

  // Resume the AI Dev Test autopilot and kick off the next turn immediately
  public resumeAiDevTest(): void {
    if (!this.aiDevTestPaused) return;
    this.aiDevTestPaused = false;
    setTimeout(() => this.endTurn(), 250);
  }

  public isAiDevTestPaused(): boolean {
    return this.aiDevTestPaused;
  }

  // Process the current player's turn (human or AI)
  private async processCurrentPlayerTurn(): Promise<void> {
    while (this.isCurrentPlayerAI()) {
      // Execute AI turn
      const currentPlayer = this.getCurrentPlayer();
      if (currentPlayer) {
        this.emit('aiTurnStarted', { playerId: currentPlayer.id, playerName: currentPlayer.name });

        // If anarchy just ended for this AI, auto-choose a government BEFORE the turn
        if (currentPlayer.government === GovernmentType.ANARCHY && currentPlayer.revolutionTurns === 0) {
          const newGov = chooseGovernmentAfterAnarchy(this.gameState, currentPlayer.id);
          this.changeGovernment(currentPlayer.id, newGov);
        } else if (shouldAIStartRevolution(this.gameState, currentPlayer.id)) {
          // AI decides to start a revolution this turn
          this.startRevolution(currentPlayer.id);
        }

        // AI may initiate diplomacy with the human player during their turn
        const humanPlayer = this.gameState.players.find(p => p.isHuman && !p.defeated);
        if (humanPlayer && !DebugSystem.getInstance().isAiDevTestEnabled()) {
          this.checkAIDiplomacyContact(currentPlayer, humanPlayer);
        }

        // Execute AI logic
        await AIPlayer.executeTurn(this.gameState, currentPlayer.id, this);

        // Process the turn end for AI
        this.turnManager.processTurn(this.gameState);

        // Check for defeated players after AI turn processing
        this.checkForDefeatedPlayers();

        this.emit('aiTurnEnded', { playerId: currentPlayer.id, playerName: currentPlayer.name });
      }
    }

    // Now it's a human player's turn - clear AI processing state and emit event
    this.isProcessingAITurns = false;
    this.emit('humanTurnStarted', { playerId: this.gameState.currentPlayer });

    // AI Dev Test mode: treat the human player as another AI player and auto-advance turns
    const debugSystem = DebugSystem.getInstance();
    if (debugSystem.isAiDevTestEnabled()) {
      const currentPlayer = this.getCurrentPlayer();
      if (currentPlayer) {
        // In AI dev test, auto-pick a government if needed
        if (currentPlayer.government === GovernmentType.ANARCHY && currentPlayer.revolutionTurns === 0) {
          const newGov = chooseGovernmentAfterAnarchy(this.gameState, currentPlayer.id);
          this.changeGovernment(currentPlayer.id, newGov);
        }
        this.emit('aiTurnStarted', { playerId: currentPlayer.id, playerName: `[AI Test] ${currentPlayer.name}` });
        await AIPlayer.executeTurn(this.gameState, currentPlayer.id, this);
        this.emit('aiTurnEnded', { playerId: currentPlayer.id, playerName: currentPlayer.name });
      }
      // Schedule automatic end of turn to keep the game running on autopilot
      if (!this.aiDevTestPaused) {
        setTimeout(() => this.endTurn(), 250);
      }
      return;
    }

    // Check if the human player's anarchy has ended - prompt government selection
    const humanPlayer = this.getCurrentPlayer();
    if (humanPlayer && humanPlayer.government === GovernmentType.ANARCHY && humanPlayer.revolutionTurns === 0) {
      this.emit('governmentSelectionRequired', {
        playerId: humanPlayer.id,
        player: humanPlayer,
        mandatory: true,
      });
    }

    // Normal human turn: check for research, process goto units, build unit queue
    // Dispatch any pending AI diplomacy contacts
    this.dispatchPendingDiplomacyContact();

    // Check if player needs to select research (after first turn)
    this.checkForResearchSelection();

    // Process automated settlers (A-key automation) before goto so any
    // movement targets they set are picked up by processGotoUnits immediately.
    this.processAutomatedSettlers();

    // Execute one turn of movement for all units with an active goto order
    this.processGotoUnits();

    this.buildUnitQueue();
    if (this.unitQueue.length > 0) {
      this.selectCurrentUnit();
    }
  }

  // Check if the current player is AI
  private isCurrentPlayerAI(): boolean {
    return !this.gameState.currentPlayerIsHuman;
  }

  // Get the current player object
  private getCurrentPlayer(): Player | null {
    return this.gameState.players.find(p => p.id === this.gameState.currentPlayer) || null;
  }

  // Build queue of units that can move for current player
  private buildUnitQueue(): void {
    const currentPlayer = this.gameState.currentPlayer;

    // Get all units for current player that have movement points and are not fortified, sleeping,
    // building roads, or in the middle of a goto order (those move automatically).
    this.unitQueue = this.gameState.units.filter(unit =>
      unit.playerId === currentPlayer &&
      unit.movementPoints > 0 &&
      !unit.fortified &&
      unit.fortifying !== true &&
      unit.sleeping !== true &&
      unit.buildingRoad !== true &&
      unit.buildingMine !== true &&
      !unit.gotoDestination &&
      !unit.automating
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

  // ── Goto (multi-turn movement) ────────────────────────────────────────────

  /**
   * Execute one turn of automatic movement for every human unit that has an
   * active goto destination.  Call this at the START of the human turn,
   * before buildUnitQueue(), so the units' moves are processed before the
   * player is asked for manual orders.
   */
  private processGotoUnits(): void {
    const currentPlayer = this.gameState.currentPlayer;
    const gotoUnits = this.gameState.units.filter(
      u => u.playerId === currentPlayer && u.gotoDestination,
    );
    for (const unit of gotoUnits) {
      this.processGotoForUnit(unit);
    }
  }

  /**
   * Execute one turn of automatic movement for a single unit with an active
   * goto destination.  Uses as many movement points as the unit has this turn.
   */
  private processGotoForUnit(unit: Unit): void {
    const dest = unit.gotoDestination;
    if (!dest) return;

    // Already standing on the destination
    if (unit.position.x === dest.x && unit.position.y === dest.y) {
      delete unit.gotoDestination;
      return;
    }

    const path = findPath(unit, dest, this.gameState);

    if (!path || path.length === 0) {
      // No path available – cancel the order and let the player take manual control
      delete unit.gotoDestination;
      this.emit('gotoBlocked', { unit, destination: dest });
      return;
    }

    // Walk as many steps as movement points allow this turn
    for (const step of path) {
      if (unit.movementPoints <= 0) break;

      const success = this.moveUnit(unit.id, step);
      if (!success) {
        // Path suddenly blocked (e.g. enemy appeared) – cancel order
        delete unit.gotoDestination;
        break;
      }

      if (unit.position.x === dest.x && unit.position.y === dest.y) {
        delete unit.gotoDestination;
        break;
      }
    }
  }

  // ── Settler automation (A-key) ───────────────────────────────────────────

  /**
   * Toggle automated infrastructure mode for a settler unit.
   * Returns true if automation was enabled, false if it was cancelled or errored.
   */
  public setSettlerAutomate(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit || unit.type !== UnitType.SETTLERS) return false;
    if (unit.playerId !== this.gameState.currentPlayer) return false;

    if (unit.automating) {
      unit.automating = false;
      this.emit('settlerAutomationCancelled', { unit });
      return false;
    }

    unit.automating = true;
    // Cancel any conflicting orders
    if (unit.gotoDestination) {
      delete unit.gotoDestination;
    }
    // Remove from the manual queue — the settler now acts automatically
    this.removeUnitFromQueue(unitId);
    this.emit('settlerAutomationStarted', { unit });
    return true;
  }

  /**
   * Each turn, decide and execute one action per automating settler for the
   * current player.  Build actions (road / irrigation / mine) are issued
   * directly; movement-to-target is assigned as a goto destination so that
   * processGotoUnits() handles the step-by-step pathfinding.
   */
  private processAutomatedSettlers(): void {
    const currentPlayer = this.gameState.currentPlayer;
    const settlers = this.gameState.units.filter(
      u =>
        u.playerId === currentPlayer &&
        u.type === UnitType.SETTLERS &&
        u.automating &&
        !u.buildingRoad &&
        !u.buildingMine &&
        !u.gotoDestination,
    );

    for (const unit of settlers) {
      const nearestCity = this.findNearestPlayerCity(unit.position, currentPlayer);
      if (!nearestCity) continue;

      const action = findBestInfrastructureAction(unit, nearestCity, this.gameState);
      if (!action) continue;

      if (action.action === 'buildRoad') {
        this.buildRoad(unit.id);
      } else if (action.action === 'buildIrrigation') {
        this.buildIrrigation(unit.id);
      } else if (action.action === 'buildMine') {
        this.buildMine(unit.id);
      } else if (action.action === 'moveTo' && action.target) {
        // Never set a city tile as the final destination — there is nothing to
        // improve there.  The pathfinder may still route *through* a city as
        // an intermediate step, which is fine.
        const targetIsCity = this.gameState.cities.some(
          c => c.position.x === action.target!.x && c.position.y === action.target!.y,
        );
        if (!targetIsCity) {
          // Let processGotoUnits() drive movement so roads/terrain costs are respected
          unit.gotoDestination = action.target;
        }
      }
    }
  }

  /** Find the nearest city owned by playerId, using Manhattan distance with horizontal wrapping. */
  private findNearestPlayerCity(position: Position, playerId: string): City | null {
    const mapWidth = this.gameState.worldMap[0]?.length || 80;
    let nearest: City | null = null;
    let nearestDist = Infinity;
    for (const city of this.gameState.cities.filter(c => c.playerId === playerId)) {
      const dx = Math.abs(city.position.x - position.x);
      const dy = Math.abs(city.position.y - position.y);
      const dist = Math.min(dx, mapWidth - dx) + dy;
      if (dist < nearestDist) { nearestDist = dist; nearest = city; }
    }
    return nearest;
  }

  /**
   * Assign a multi-turn goto destination to a unit.
   * Returns false if the unit doesn't exist, doesn't belong to the current
   * player, or if A* cannot find any path to the destination.
   */
  public setUnitGotoDestination(unitId: string, destination: Position): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;
    if (unit.playerId !== this.gameState.currentPlayer) return false;

    const normalizedDest = this.normalizePosition(destination);

    // Reject immediately if no path exists
    const path = findPath(unit, normalizedDest, this.gameState);
    if (!path) return false;

    // Destination equals current position – nothing to do
    if (path.length === 0) return false;

    unit.gotoDestination = normalizedDest;
    this.emit('gotoSet', { unit, destination: normalizedDest });

    // Remove from the manual move queue immediately — the unit now moves automatically.
    // This also advances to the next unit (or ends the turn if queue empties).
    this.removeUnitFromQueue(unitId);

    // Execute the first step(s) of the goto this turn using remaining movement points.
    this.processGotoForUnit(unit);

    return true;
  }

  /**
   * Cancel an active goto order.  The unit will appear in the normal move
   * queue on the next turn (or immediately if it still has movement points).
   */
  public cancelUnitGoto(unitId: string): void {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (unit?.gotoDestination) {
      delete unit.gotoDestination;
      this.emit('gotoCancelled', { unit });
    }
  }

  // ── Unit queue ────────────────────────────────────────────────────────────

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

  /** Returns the number of units still waiting to move this turn. */
  public getUnitQueueSize(): number {
    return this.unitQueue.length;
  }

  /** Returns the 1-based position of the current unit in the queue (0 when queue is empty). */
  public getUnitQueueIndex(): number {
    return this.unitQueue.length > 0 ? this.currentUnitIndex + 1 : 0;
  }

  /** Returns a shallow copy of the current unit queue. */
  public getUnitQueue(): Unit[] {
    return [...this.unitQueue];
  }

  /**
   * Move a queued unit to the front, making it the active unit.
   * Emits 'unitSelected' with centerIfNeeded=true so the camera only
   * pans when the unit is not already visible in the current viewport.
   */
  public promoteUnitToFront(unitId: string): void {
    const idx = this.unitQueue.findIndex(u => u.id === unitId);
    if (idx === -1 || idx === this.currentUnitIndex) return;

    const [unit] = this.unitQueue.splice(idx, 1);
    this.unitQueue.unshift(unit);
    this.currentUnitIndex = 0;

    this.stopUnitBlinking();
    if (!unit.fortified && unit.fortifying !== true && unit.buildingRoad !== true && unit.buildingMine !== true) {
      this.startUnitBlinking();
    }

    this.emit('unitSelected', {
      unit,
      unitIndex: 0,
      totalUnits: this.unitQueue.length,
      centerIfNeeded: true,
    });
  }

  /**
   * Wake a sleeping/fortified/automating unit (if needed) and place it at the
   * front of the active queue, making it the unit the player moves next.
   * Does nothing if the unit has no movement points remaining this turn.
   * Returns true if the unit was successfully activated.
   */
  public activateUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    // Can't activate a unit that has already spent all its moves
    if (unit.movementPoints <= 0) return false;

    // Clear any "idle" states so the unit is free to accept orders
    unit.sleeping = false;
    unit.fortified = false;
    unit.fortifying = false;
    unit.fortificationTurns = 0;
    unit.buildingRoad = false;
    unit.buildingMine = false;
    unit.automating = false;
    delete unit.gotoDestination;

    // Insert / move to front of queue
    const idx = this.unitQueue.findIndex(u => u.id === unitId);
    if (idx === -1) {
      // Was not in the queue (e.g. was fortified) — add it now
      this.unitQueue.unshift(unit);
    } else if (idx !== 0) {
      // Already in the queue but not first — promote it
      this.unitQueue.splice(idx, 1);
      this.unitQueue.unshift(unit);
    }
    this.currentUnitIndex = 0;

    this.stopUnitBlinking();
    this.startUnitBlinking();

    this.emit('unitSelected', {
      unit,
      unitIndex: 0,
      totalUnits: this.unitQueue.length,
      centerIfNeeded: true,
    });

    return true;
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
          // If requireEndOfTurn is on, show the end-of-turn prompt instead of auto-advancing
          const requireEndOfTurn = SettingsManager.getInstance().getSetting('requireEndOfTurn');
          if (requireEndOfTurn) {
            console.log('All units moved - waiting for manual End Turn (requireEndOfTurn is on)');
            this.emit('endOfTurn');
          } else {
            console.log('All units exhausted movement - auto-advancing turn');
            this.autoAdvanceTriggered = true; // Set flag to prevent double end-turn
            this.endTurn();
          }
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

    // If there are enemy units, initiate combat instead of moving.
    // But first: if the human player is attacking an AI they are NOT at war with,
    // pause and ask the player to confirm the war declaration before proceeding.
    if (enemyUnitsAtPosition.length > 0) {
      const movingPlayer = this.gameState.players.find(p => p.id === unit.playerId);
      if (movingPlayer?.isHuman) {
        // Collect the distinct AI owner(s) on that tile
        const aiOwnerIds = [...new Set(enemyUnitsAtPosition.map(u => u.playerId))];
        const aiPlayerId = aiOwnerIds.find(id => {
          const p = this.gameState.players.find(pp => pp.id === id);
          return p && !p.isHuman && !this.diplomacyManager.isAtWar(movingPlayer.id, id);
        });
        if (aiPlayerId) {
          const aiPlayer = this.gameState.players.find(p => p.id === aiPlayerId);
          const civ = aiPlayer ? getCivilization(aiPlayer.civilizationType) : null;
          const civName = civ?.name ?? aiPlayer?.name ?? 'Unknown';
          this.emit('declareWarRequired', {
            unitId,
            targetPosition: normalizedPosition,
            aiPlayerId,
            aiCivName: civName,
          });
          return false; // suspend — no movement points consumed
        }
      }
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
    }

    if (unit.buildingMine) {
      unit.buildingMine = false;
      unit.mineBuildingTurns = 0;
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

    // Check if both tiles have roads or railroads
    // Cities implicitly count as having both a road and a railroad
    const fromHasCity = this.gameState.cities.some(city => city.position.x === fromPosition.x && city.position.y === fromPosition.y);
    const toHasCity = this.gameState.cities.some(city => city.position.x === toPosition.x && city.position.y === toPosition.y);

    const fromHasRoad = fromHasCity || fromTile.improvements?.some(imp => imp.type === ImprovementType.ROAD);
    const toHasRoad = toHasCity || toTile.improvements?.some(imp => imp.type === ImprovementType.ROAD);
    const fromHasRailroad = fromHasCity || fromTile.improvements?.some(imp => imp.type === ImprovementType.RAILROAD);
    const toHasRailroad = toHasCity || toTile.improvements?.some(imp => imp.type === ImprovementType.RAILROAD);

    // Railroad logic: if both tiles have railroad, movement is completely free!
    if (fromHasRailroad && toHasRailroad) {
      return 0;
    }

    // Road logic: if both tiles have road/railroad, movement cost is 1/3 regardless of terrain
    if ((fromHasRoad || fromHasRailroad) && (toHasRoad || toHasRailroad)) {
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

    // Get unit stats to determine category
    const unitStats = getUnitStats(unit.type);
    const targetTerrain = tile.terrain;

    // Air units can move over any terrain
    if (unitStats.category === UnitCategory.AIR) {
      return true;
    }

    // Naval units can move freely in ocean, or into coastal cities
    if (unitStats.category === UnitCategory.NAVAL) {
      if (targetTerrain === TerrainType.OCEAN) {
        return true;
      }

      if (cityAtPosition) {
        // Can enter if the city is coastal, regardless of who owns it
        // (Enemy cities will trigger combat, but the terrain itself is technically legal to enter if won)
        const isCoastal = this.isCoastal(position);
        if (isCoastal) {
          return true;
        }
      }
      return false;
    }

    // If there's a city and the unit belongs to the same player, allow movement for land/air units
    if (cityAtPosition && cityAtPosition.playerId === unit.playerId) {
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

  // Check if a specific position is adjacent to at least one ocean tile
  private isCoastal(pos: Position): boolean {
    const mapWidth = this.gameState.worldMap[0]?.length || 80;
    const mapHeight = this.gameState.worldMap.length;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const ny = pos.y + dy;
        const nx = ((pos.x + dx) % mapWidth + mapWidth) % mapWidth;
        if (ny >= 0 && ny < mapHeight) {
          const tile = this.gameState.worldMap[ny][nx];
          if (tile && tile.terrain === TerrainType.OCEAN) {
            return true;
          }
        }
      }
    }
    return false;
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
      culture: 0,
      discoveredByPlayers: [unit.playerId],
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
  public getCityProductionOutput(cityId: string): number {
    const city = this.gameState.cities.find(c => c.id === cityId);
    if (!city) return 0;
    return this.turnManager.calculateProductionOutput(city, this.gameState);
  }

  public changeCityProduction(cityId: string, production: string): boolean {
    const city = this.gameState.cities.find(c => c.id === cityId);
    if (!city) return false;

    // Get the current player to check technologies
    const player = this.gameState.players.find(p => p.id === city.playerId);
    if (!player) return false;

    // Validate the production choice
    const existingBuildings = city.buildings.map(b => b.type as any);
    // Use actual city production output so the initial turns estimate is accurate
    const actualCityProduction = Math.max(1, this.turnManager.calculateProductionOutput(city, this.gameState));
    const availableOptions = ProductionManager.getAvailableProduction(
      player.technologies,
      existingBuildings,
      actualCityProduction,
      city.production_points,
      city,
      this.gameState.worldMap,
      this.gameState  // pass gameState so already-built wonders are excluded
    );

    // Find the selected option — match by ID first (most reliable), then by display name
    const selectedOption = availableOptions.find(opt =>
      opt.id === production || opt.name === production || opt.id === production.toLowerCase()
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

      // Check if obsolete
      if (stats.obsoletedBy && player.technologies.includes(stats.obsoletedBy)) {
        return false;
      }

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

  public getDiplomacyManager(): DiplomacyManager {
    return this.diplomacyManager;
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

  // ── Tax system public API ─────────────────────────────────────────────────

  /**
   * Set the tax and luxury rates for a player.
   * Science rate is auto-calculated as 100 - taxRate - luxuryRate.
   * Both values are clamped to [0, 100] in steps of 10, and the sum cannot exceed 100.
   */
  public setTaxRates(playerId: string, taxRate: number, luxuryRate: number): boolean {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return false;

    // Snap to nearest 10 and clamp
    taxRate = Math.max(0, Math.min(100, Math.round(taxRate / 10) * 10));
    luxuryRate = Math.max(0, Math.min(100 - taxRate, Math.round(luxuryRate / 10) * 10));

    player.taxRate = taxRate;
    player.luxuryRate = luxuryRate;
    return true;
  }

  /** Return the current tax rates for a player. */
  public getTaxRates(playerId: string): { taxRate: number; luxuryRate: number; scienceRate: number } | null {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return null;
    return TaxSystem.getEffectiveTaxRates(player);
  }

  /** Return the full per-turn income / expense summary for a player. */
  public getPlayerTaxSummary(playerId: string) {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return null;
    return TaxSystem.calculatePlayerTaxSummary(player, this.gameState);
  }

  // Get available technologies for research
  public getAvailableTechnologies(playerId: string): TechnologyType[] {
    return this.researchSystem.getAvailableTechnologies(playerId);
  }

  // Check if current player needs to select research technology
  // ── Diplomacy ──────────────────────────────────────────────────────────────

  /**
   * Check if an AI player should initiate a diplomacy contact with the human
   * and, if so, queue it for display when the human turn starts.
   */
  private checkAIDiplomacyContact(aiPlayer: Player, humanPlayer: Player): void {
    const aiTechs = (aiPlayer.technologies ?? []) as import('./TechnologyDefinitions').TechnologyType[];
    const humanTechs = (humanPlayer.technologies ?? []) as import('./TechnologyDefinitions').TechnologyType[];
    const aiUnitList = this.gameState.units.filter(u => u.playerId === aiPlayer.id);
    const humanUnitList = this.gameState.units.filter(u => u.playerId === humanPlayer.id);
    const aiCities = this.gameState.cities.filter(c => c.playerId === aiPlayer.id).length;
    const humanCities = this.gameState.cities.filter(c => c.playerId === humanPlayer.id).length;
    const aiScore = aiCities * 3 + aiUnitList.length + (aiPlayer.gold ?? 0) / 50;
    const humanScore = humanCities * 3 + humanUnitList.length + (humanPlayer.gold ?? 0) / 50;
    const isAIStronger = aiScore > humanScore * 1.1;

    // Civ1: AI contacts the player only when their units are adjacent (chebyshev dist ≤ 1)
    const mapWidth = this.gameState.worldMap[0]?.length ?? 80;
    const adjacencyCheck = (humanUnit: (typeof humanUnitList)[0]) =>
      aiUnitList.some(aiUnit => {
        const dx = Math.abs(aiUnit.position.x - humanUnit.position.x);
        const wrappedDx = Math.min(dx, mapWidth - dx);
        const dy = Math.abs(aiUnit.position.y - humanUnit.position.y);
        return wrappedDx <= 1 && dy <= 1;
      });

    const hasAdjacentUnits = humanUnitList.some(adjacencyCheck);
    // Distinguish military (warriors, cavalry, artillery, etc.) from harmless units (settlers, workers, diplomats)
    const hasAdjacentMilitaryUnits = humanUnitList.filter(u => isMilitaryUnit(u.type)).some(adjacencyCheck);

    const contact = this.diplomacyManager.buildAIContact(
      aiPlayer,
      humanPlayer,
      isAIStronger,
      this.gameState.turn,
      humanTechs,
      aiTechs,
      hasAdjacentUnits,
      hasAdjacentMilitaryUnits,
    );

    if (contact) {
      this.pendingDiplomacyContacts.push(contact);
    }
  }

  /**
   * If there are pending diplomacy contacts, emit the first one to
   * let the renderer show the dialog.
   */
  private dispatchPendingDiplomacyContact(): void {
    if (this.pendingDiplomacyContacts.length === 0) return;
    const contact = this.pendingDiplomacyContacts.shift()!;
    this.emit('diplomacyContactRequired', { contact });
  }

  /**
   * Apply the outcome of a diplomacy dialog to game state (called by main.ts
   * after the human player responds).
   */
  public applyDiplomacyOutcome(contact: DiplomacyContact, outcome: DiplomacyOutcome): void {
    this.diplomacyManager.applyOutcome(contact, outcome);

    if (outcome.war) {
      this.diplomacyManager.updateStatus(contact.initiatorId, contact.receiverId, DiplomaticStatus.WAR);
      this.emit('diplomaticWarDeclared', {
        initiatorId: contact.initiatorId,
        receiverId: contact.receiverId,
      });
    } else if (outcome.peace) {
      this.diplomacyManager.updateStatus(contact.initiatorId, contact.receiverId, DiplomaticStatus.PEACE);
      this.emit('diplomaticPeaceSigned', {
        initiatorId: contact.initiatorId,
        receiverId: contact.receiverId,
      });
    }

    // Apply tech transfers
    if (outcome.techGiven || outcome.techReceived) {
      const humanPlayer = this.gameState.players.find(p => p.isHuman);
      const aiPlayerId = contact.initiatorId === humanPlayer?.id
        ? contact.receiverId
        : contact.initiatorId;
      const aiPlayer = this.gameState.players.find(p => p.id === aiPlayerId);

      if (humanPlayer && outcome.techGiven && !aiPlayer?.technologies?.includes(outcome.techGiven)) {
        aiPlayer?.technologies?.push(outcome.techGiven);
        humanPlayer.technologies = humanPlayer.technologies?.filter(t => t !== outcome.techGiven) ?? [];
      }
      if (humanPlayer && outcome.techReceived && !humanPlayer.technologies?.includes(outcome.techReceived)) {
        humanPlayer.technologies = [...(humanPlayer.technologies ?? []), outcome.techReceived];
      }
    }

    // Apply gold payment
    if (outcome.goldPaid) {
      const humanPlayer = this.gameState.players.find(p => p.isHuman);
      const aiPlayer = this.gameState.players.find(
        p => p.id === (contact.initiatorId === humanPlayer?.id ? contact.receiverId : contact.initiatorId)
      );
      if (humanPlayer) humanPlayer.gold = Math.max(0, (humanPlayer.gold ?? 0) - outcome.goldPaid);
      if (aiPlayer) aiPlayer.gold = (aiPlayer.gold ?? 0) + outcome.goldPaid;
    }

    // Third-party war declaration
    if (outcome.targetDeclaredWar) {
      const humanPlayer = this.gameState.players.find(p => p.isHuman);
      if (humanPlayer) {
        this.diplomacyManager.updateStatus(humanPlayer.id, outcome.targetDeclaredWar, DiplomaticStatus.WAR);
      }
    }

    this.diplomacyInProgress = false;
    this.emit('diplomacyResolved', { contact, outcome });

    // If more contacts are pending, dispatch the next one shortly
    if (this.pendingDiplomacyContacts.length > 0) {
      setTimeout(() => this.dispatchPendingDiplomacyContact(), 500);
    }
  }

  /**
   * Initiate diplomacy between the human player and an AI player.
   * Call this when the human sends a diplomat to an AI city, or from the
   * Intelligence Advisor. Works regardless of whose turn it currently is.
   */
  public initiatePlayerDiplomacy(targetPlayerId: string): void {
    const humanPlayer = this.gameState.players.find(p => p.isHuman && !p.defeated);
    if (!humanPlayer) return;

    const aiPlayer = this.gameState.players.find(p => p.id === targetPlayerId && !p.isHuman);
    if (!aiPlayer) return;

    const contact: DiplomacyContact = {
      initiatorId: humanPlayer.id,
      receiverId: aiPlayer.id,
      proposal: DiplomacyProposal.PLAYER_GREET,
      turn: this.gameState.turn,
    };

    this.emit('diplomacyContactRequired', { contact });
  }

  private checkForResearchSelection(): void {
    this.researchSystem.checkForResearchSelection();
  }

  // Research a technology
  public researchTechnology(playerId: string, technologyType: TechnologyType): boolean {
    return this.researchSystem.researchTechnology(playerId, technologyType);
  }

  // Set current research for a player (without immediately researching)
  public setCurrentResearch(playerId: string, technologyType: TechnologyType): boolean {
    return this.researchSystem.setCurrentResearch(playerId, technologyType);
  }

  // Get technology information
  public getTechnologyInfo(technologyType: TechnologyType) {
    return this.researchSystem.getTechnologyInfo(technologyType);
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
    if (!tile || tile.terrain === TerrainType.OCEAN) {
      console.log('buildRoad: Invalid tile position or oceanic terrain');
      return false;
    }

    const player = this.gameState.players.find(p => p.id === unit.playerId);
    const anyTileImprovement = SettingsManager.getInstance().getSetting('anyTileImprovement');

    // Check if roads can be built over rivers - requires Bridge Building technology
    if (tile.terrain === TerrainType.RIVER) {
      if (!anyTileImprovement && !player?.technologies.includes(TechnologyType.BRIDGE_BUILDING)) {
        console.log('buildRoad: Bridge Building technology required to build roads over rivers');
        return false;
      }
    }

    // Check if road/railroad already exists
    const hasRoad = tile.improvements?.some(imp => imp.type === ImprovementType.ROAD);
    const hasRailroad = tile.improvements?.some(imp => imp.type === ImprovementType.RAILROAD);
    
    if (hasRailroad) {
      console.log('buildRoad: Railroad already exists on this tile');
      return false;
    }
    
    if (hasRoad) {
      if (!anyTileImprovement && !player?.technologies.includes(TechnologyType.RAILROAD)) {
        console.log('buildRoad: Railroad technology required to upgrade road');
        return false;
      }
    }

    // Determine how many turns are required for this terrain
    const requiredTurns = this.getRoadBuildingTurns(tile.terrain);

    if (unit.buildingRoad) {
      console.log('buildRoad: Unit is already building a road');
      return false;
    }

    // Initialize road building state
    unit.buildingRoad = true;
    unit.roadBuildingTurns = 0;
    unit.movementPoints = 0; // End turn when building

    // Cancel any active goto order so the settler doesn't move next turn
    if (unit.gotoDestination) {
      delete unit.gotoDestination;
      this.emit('gotoCancelled', { unit });
    }

    // Remove unit from queue since turn ends
    this.removeUnitFromQueue(unitId);

    console.log(`buildRoad: Started building road at (${unit.position.x}, ${unit.position.y}) - ${requiredTurns} turns`);
    this.emit('roadBuildingStarted', {
      unit,
      position: unit.position,
      turnsRemaining: requiredTurns
    });

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

    const anyTileImprovement = SettingsManager.getInstance().getSetting('anyTileImprovement');

    if (!anyTileImprovement && !irrigatableTerrains.includes(tile.terrain)) {
      console.log('buildIrrigation: This terrain cannot be irrigated');
      return false;
    }

    // Check if irrigation already exists
    const hasIrrigation = tile.improvements?.some(imp => imp.type === ImprovementType.IRRIGATION);
    if (hasIrrigation) {
      console.log('buildIrrigation: Irrigation already exists on this tile');
      return false;
    }

    // Mine and irrigation are mutually exclusive — remove any mine first
    if (tile.improvements?.some(imp => imp.type === ImprovementType.MINE)) {
      tile.improvements = tile.improvements!.filter(imp => imp.type !== ImprovementType.MINE);
      console.log('buildIrrigation: Removed existing mine to place irrigation');
    }

    // Check water access requirement
    if (!anyTileImprovement && !this.hasWaterAccess(unit.position.x, unit.position.y)) {
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
    const anyTileImprovementForMine = SettingsManager.getInstance().getSetting('anyTileImprovement');
    if (!anyTileImprovementForMine && unmineableTerrains.includes(tile.terrain)) {
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

    // Start mine building process
    unit.buildingMine = true;
    unit.mineBuildingTurns = 0;
    unit.movementPoints = 0; // End turn when starting mine building

    // Cancel any active goto order so the settler doesn't move next turn
    // (processGotoUnits would call moveUnit which resets buildingMine)
    if (unit.gotoDestination) {
      delete unit.gotoDestination;
      this.emit('gotoCancelled', { unit });
    }

    // Remove unit from queue since turn ends
    this.removeUnitFromQueue(unitId);

    const requiredTurns = this.getMineBuildingTurnsForTile(tile);
    console.log(`buildMine: Started building mine at (${unit.position.x}, ${unit.position.y}) - ${requiredTurns} turns`);
    this.emit('mineBuildingStarted', {
      unit,
      position: unit.position,
      turnsRemaining: requiredTurns
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

  // Get the number of turns required to build a mine on a given tile (terrain-dependent)
  private getMineBuildingTurnsForTile(tile: { terrain: TerrainType } | null | undefined): number {
    if (!tile) return 3;
    switch (tile.terrain) {
      case TerrainType.GRASSLAND:
      case TerrainType.PLAINS:
      case TerrainType.RIVER:
        return 3;
      case TerrainType.DESERT:
      case TerrainType.HILLS:
      case TerrainType.FOREST:
        return 4;
      case TerrainType.MOUNTAINS:
      case TerrainType.JUNGLE:
        return 5;
      default:
        return 3;
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

  /**
   * Called by the UI after the player confirms they want to declare war and attack.
   * Declares war on the target AI player, then re-invokes moveUnit so combat proceeds normally.
   */
  public confirmDeclareWarAndAttack(unitId: string, targetPosition: Position, aiPlayerId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;
    const humanPlayer = this.gameState.players.find(p => p.id === unit.playerId);
    if (!humanPlayer) return false;

    this.diplomacyManager.updateStatus(humanPlayer.id, aiPlayerId, DiplomaticStatus.WAR);
    this.emit('diplomaticWarDeclared', { initiatorId: humanPlayer.id, receiverId: aiPlayerId });

    // Now that war is declared, moveUnit will pass through to initiateAutomaticCombat
    return this.moveUnit(unitId, targetPosition);
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

    // If an AI unit is attacking a human unit and war has not yet been declared,
    // queue a war declaration dialog (shown at the start of the human's next turn)
    // and set the diplomatic status to WAR now so combat can proceed.
    const attackerPlayer = this.gameState.players.find(p => p.id === attacker.playerId);
    const humanDefender = enemyUnits.find(u => {
      const defPlayer = this.gameState.players.find(p => p.id === u.playerId);
      return defPlayer?.isHuman;
    });
    if (attackerPlayer && !attackerPlayer.isHuman && humanDefender) {
      const humanPlayer = this.gameState.players.find(p => p.id === humanDefender.playerId)!;
      const alreadyAtWar = this.diplomacyManager.isAtWar(attackerPlayer.id, humanPlayer.id);
      if (!alreadyAtWar) {
        // Declare war immediately so combat is valid
        this.diplomacyManager.updateStatus(attackerPlayer.id, humanPlayer.id, DiplomaticStatus.WAR);
        this.emit('diplomaticWarDeclared', { initiatorId: attackerPlayer.id, receiverId: humanPlayer.id });
        // Queue the notification dialog for the human's next turn
        this.pendingDiplomacyContacts.push({
          initiatorId: attackerPlayer.id,
          receiverId: humanPlayer.id,
          proposal: DiplomacyProposal.DECLARE_WAR,
          turn: this.gameState.turn,
        });
      }
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
            // Check if terrain permits moving in (e.g. naval units can only move into coastal cities)
            if (this.canUnitMoveToTerrain(attacker, targetPosition)) {
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
              console.log(`City ${cityAtPosition.name} is undefended, but attacker cannot move into this terrain to capture it`);
            }
          } else {
            // City still has defending units, attacker doesn't move in
            console.log(`City ${cityAtPosition.name} still has ${defendingUnits.length} defending units, attacker cannot move in`);
          }
        } else {
          // No city at target position, or city belongs to attacker - normal movement after combat
          // Only move if the unit is allowed to occupy this terrain type (e.g. naval units don't move onto land)
          if (this.canUnitMoveToTerrain(attacker, targetPosition)) {
            attacker.position = targetPosition;
          }
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
      const destroyedUnitSnapshot: Unit = {
        ...destroyedUnit,
        position: { ...destroyedUnit.position }
      };

      this.emit('unitDefeated', {
        unit: destroyedUnitSnapshot
      });

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
    const earlyGameTurns = 20; // Players are safe from elimination for first 20 turns

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
    const player = this.gameState.players.find(p => p.id === city.playerId);

    // Always show the modal for wonders (regardless of who built it), but only
    // for regular buildings if the human player built them.
    const humanPlayer = this.gameState.players.find(p => p.isHuman);
    const shouldShow = isWonder
      ? humanPlayer !== undefined
      : (player && player.isHuman);

    if (shouldShow) {
      // Determine if a foreign civ built this wonder
      let foreignCivName: string | null = null;
      if (isWonder && player && !player.isHuman) {
        const civ = getCivilization(player.civilizationType);
        foreignCivName = civ.peoples;
      }

      // Show the modal on next tick to ensure UI is ready
      setTimeout(() => {
        this.buildingCompletionModal.show(buildingType as any, city, isWonder, foreignCivName);
        // AI Dev Test: auto-dismiss after a brief flash
        if (DebugSystem.getInstance().isAiDevTestEnabled()) {
          setTimeout(() => this.buildingCompletionModal.hide(), 1200);
        }
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
