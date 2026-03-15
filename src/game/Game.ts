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
import { TerrainImprovementSystem } from './TerrainImprovementSystem';
import { GovernmentSystem } from './GovernmentSystem';
import { UnitStateSystem } from './UnitStateSystem';
import { CityFoundingSystem } from './CityMaker';
import { UnitMovementSystem } from './UnitMovementSystem';
import { CombatOrchestrator } from './CombatOrchestrator';
import { UnitQueueSystem } from './UnitQueueSystem';
import { BarbarianSystem, BARBARIAN_PLAYER_ID, createBarbarianPlayer } from './BarbarianSystem';

export class Game {
  private gameState: GameState;
  private mapGenerator: MapGenerator;
  private turnManager: TurnManager;
  private combatSystem: CombatSystem;
  private buildingCompletionModal: BuildingCompletionModal;
  public diplomacyManager: DiplomacyManager;
  public researchSystem: ResearchSystem;
  private terrainImprovementSystem: TerrainImprovementSystem;
  private governmentSystem: GovernmentSystem;
  private unitStateSystem: UnitStateSystem;
  private cityFoundingSystem: CityFoundingSystem;
  private unitMovementSystem: UnitMovementSystem;
  private combatOrchestrator: CombatOrchestrator;
  private unitQueueSystem: UnitQueueSystem;
  private eventListeners: Map<string, Function[]> = new Map();

  /** Pending diplomacy contacts to show the human player (queue, shown one at a time) */
  private pendingDiplomacyContacts: DiplomacyContact[] = [];
  /** Set to true while waiting for the human to respond to a diplomacy dialog */
  private diplomacyInProgress: boolean = false;

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
      },
      (playerId) => {
        // Civil disorder has toppled the government — force into Anarchy.
        this.startRevolution(playerId, 'disorder');
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

    this.unitQueueSystem = new UnitQueueSystem(
      this.gameState,
      (event, data) => this.emit(event, data),
      () => this.endTurn(),
      () => this.getCurrentPlayer(),
    );
    this.researchSystem = new ResearchSystem(this.gameState, this.emit.bind(this));
    this.terrainImprovementSystem = new TerrainImprovementSystem(
      this.gameState,
      (event, data) => this.emit(event, data),
      (unitId) => this.removeUnitFromQueue(unitId)
    );
    this.governmentSystem = new GovernmentSystem(
      this.gameState,
      (event, data) => this.emit(event, data)
    );
    this.unitStateSystem = new UnitStateSystem(
      this.gameState,
      (event, data) => this.emit(event, data),
      (unitId) => this.removeUnitFromQueue(unitId),
      (unit) => this.unitQueueSystem.ensureUnitInQueueAndSelect(unit),
    );
    this.cityFoundingSystem = new CityFoundingSystem(
      this.gameState,
      (event, data) => this.emit(event, data),
      (unitId) => this.removeUnitFromQueue(unitId),
      (city, gs) => this.turnManager.calculateProductionOutput(city, gs),
    );
    this.unitMovementSystem = new UnitMovementSystem(
      this.gameState,
      (event, data) => this.emit(event, data),
      (unitId) => this.removeUnitFromQueue(unitId),
      (unit, position, enemies) => this.combatOrchestrator.initiateAutomaticCombat(unit, position, enemies),
      () => this.combatOrchestrator.checkForDefeatedPlayers(),
      (unitId) => this.buildRoad(unitId),
      (unitId) => this.buildIrrigation(unitId),
      (unitId) => this.buildMine(unitId),
      this.diplomacyManager,
    );
    this.combatOrchestrator = new CombatOrchestrator(
      this.gameState,
      (event, data) => this.emit(event, data),
      this.combatSystem,
      this.diplomacyManager,
      this.pendingDiplomacyContacts,
      (unit, position) => this.unitMovementSystem.canUnitMoveToTerrain(unit, position),
      (unitId, position) => this.moveUnit(unitId, position),
      (unitId) => this.removeUnitFromQueue(unitId),
      (playerId) => this.unitQueueSystem.filterQueueByPlayer(playerId),
      () => this.unitQueueSystem.getCurrentUnit(),
      () => this.unitQueueSystem.clearCurrentUnit(),
      () => this.unitQueueSystem.selectNextUnit(),
    );
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
    this.unitQueueSystem.buildUnitQueue();
    if (this.unitQueueSystem.getUnitQueueSize() > 0) {
      this.unitQueueSystem.selectCurrentUnit();
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

    const players: Player[] = playerNames.map((name, index) => {
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

    // Always append the barbarian faction as the last pseudo-player.
    players.push(createBarbarianPlayer());
    return players;
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
      // Barbarians start with no units; they spawn via BarbarianSystem.
      if (player.isBarbarian) return;

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
    this.unitQueueSystem.clearCurrentUnit();

    // Process the turn (restore movement points, handle cities, advance to next player)
    this.turnManager.processTurn(this.gameState);

    // Check for defeated players after turn processing
    this.combatOrchestrator.checkForDefeatedPlayers();

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
        // ── Barbarian turn: simple spawn + move logic, no diplomacy ──────────
        if (currentPlayer.isBarbarian) {
          this.emit('aiTurnStarted', { playerId: currentPlayer.id, playerName: 'Barbarians' });
          BarbarianSystem.processBarbarianTurn(this.gameState, this);
          this.turnManager.processTurn(this.gameState);
          this.combatOrchestrator.checkForDefeatedPlayers();
          this.emit('aiTurnEnded', { playerId: currentPlayer.id, playerName: 'Barbarians' });
          continue;
        }

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
        this.combatOrchestrator.checkForDefeatedPlayers();

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
    this.unitMovementSystem.processAutomatedSettlers();

    // Execute one turn of movement for all units with an active goto order
    this.unitMovementSystem.processGotoUnits();

    this.unitQueueSystem.buildUnitQueue();
    if (this.unitQueueSystem.getUnitQueueSize() > 0) {
      this.unitQueueSystem.selectCurrentUnit();
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

  // ── Goto & settler automation — delegated to UnitMovementSystem ──────────

  public setSettlerAutomate(unitId: string): boolean {
    return this.unitMovementSystem.setSettlerAutomate(unitId);
  }

  /**
   * Permanently delete (disband) a unit belonging to the current player.
   * The unit is removed from the game immediately.
   */
  public deleteUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit || unit.playerId !== this.gameState.currentPlayer) return false;

    // Remove from move queue first so the queue advances correctly
    this.removeUnitFromQueue(unitId);

    // Remove from game state
    this.gameState.units = this.gameState.units.filter(u => u.id !== unitId);

    this.emit('unitDeleted', { unit });
    return true;
  }

  // ── Difficulty ────────────────────────────────────────────────────────────

  /** Change the difficulty level mid-game. All systems read it dynamically. */
  public setDifficulty(level: DifficultyLevel): void {
    this.gameState.difficulty = level;
    this.emit('difficultyChanged', { difficulty: level });
  }

  /** Return the current difficulty level. */
  public getDifficulty(): DifficultyLevel {
    return this.gameState.difficulty ?? 'chieftain';
  }

  public setUnitGotoDestination(unitId: string, destination: Position): boolean {
    return this.unitMovementSystem.setUnitGotoDestination(unitId, destination);
  }

  public cancelUnitGoto(unitId: string): void {
    this.unitMovementSystem.cancelUnitGoto(unitId);
  }

  // ── Unit queue — delegated to UnitQueueSystem ────────────────────────────

  public selectNextUnit(): void {
    this.unitQueueSystem.selectNextUnit();
  }

  public selectPreviousUnit(): void {
    this.unitQueueSystem.selectPreviousUnit();
  }

  public getCurrentUnit(): Unit | null {
    return this.unitQueueSystem.getCurrentUnit();
  }

  /** Returns the number of units still waiting to move this turn. */
  public getUnitQueueSize(): number {
    return this.unitQueueSystem.getUnitQueueSize();
  }

  /** Returns the 1-based position of the current unit in the queue (0 when queue is empty). */
  public getUnitQueueIndex(): number {
    return this.unitQueueSystem.getUnitQueueIndex();
  }

  /** Returns a shallow copy of the current unit queue. */
  public getUnitQueue(): Unit[] {
    return this.unitQueueSystem.getUnitQueue();
  }

  /**
   * Move a queued unit to the front, making it the active unit.
   * Emits 'unitSelected' with centerIfNeeded=true so the camera only
   * pans when the unit is not already visible in the current viewport.
   */
  public promoteUnitToFront(unitId: string): void {
    this.unitQueueSystem.promoteUnitToFront(unitId);
  }

  /**
   * Wake a sleeping/fortified/automating unit (if needed) and place it at the
   * front of the active queue, making it the unit the player moves next.
   * Does nothing if the unit has no movement points remaining this turn.
   * Returns true if the unit was successfully activated.
   */
  public activateUnit(unitId: string): boolean {
    return this.unitQueueSystem.activateUnit(unitId);
  }

  // Remove unit from queue when it can no longer move
  public removeUnitFromQueue(unitId: string): void {
    this.unitQueueSystem.removeUnitFromQueue(unitId);
  }

  // Move a unit
  public moveUnit(unitId: string, newPosition: Position): boolean {
    return this.unitMovementSystem.moveUnit(unitId, newPosition);
  }

  // Generate a default city name for a player based on their civilization
  public generateCityName(playerId: string): string {
    return this.cityFoundingSystem.generateCityName(playerId);
  }

  // Found a city
  public foundCity(unitId: string, cityName?: string): boolean {
    return this.cityFoundingSystem.foundCity(unitId, cityName);
  }

  // Rename a city
  public renameCity(cityId: string, newName: string): boolean {
    return this.cityFoundingSystem.renameCity(cityId, newName);
  }

  // Change city production
  public getCityProductionOutput(cityId: string): number {
    return this.cityFoundingSystem.getCityProductionOutput(cityId);
  }

  public changeCityProduction(cityId: string, production: string): boolean {
    return this.cityFoundingSystem.changeCityProduction(cityId, production);
  }

  // Production queue management
  public addToProductionQueue(cityId: string, productionId: string): boolean {
    return this.cityFoundingSystem.addToProductionQueue(cityId, productionId);
  }

  public removeFromProductionQueue(cityId: string, index: number): boolean {
    return this.cityFoundingSystem.removeFromProductionQueue(cityId, index);
  }

  public moveProductionQueueItem(cityId: string, fromIndex: number, toIndex: number): boolean {
    return this.cityFoundingSystem.moveProductionQueueItem(cityId, fromIndex, toIndex);
  }

  public resetProductionQueue(cityId: string): boolean {
    return this.cityFoundingSystem.resetProductionQueue(cityId);
  }

  public toggleAutoFillQueue(cityId: string): boolean {
    return this.cityFoundingSystem.toggleAutoFillQueue(cityId);
  }



  // Attack another unit
  public attackUnit(attackerUnitId: string, defenderUnitId: string): CombatResult | null {
    return this.combatOrchestrator.attackUnit(attackerUnitId, defenderUnitId);
  }

  // Fortify a unit
  public fortifyUnit(unitId: string): boolean {
    return this.unitStateSystem.fortifyUnit(unitId);
  }

  // Wake up (unfortify) a unit
  public wakeUnit(unitId: string): boolean {
    return this.unitStateSystem.wakeUnit(unitId);
  }

  // Wake a unit and add it back to the move queue
  public wakeAndActivateUnit(unitId: string): boolean {
    return this.unitStateSystem.wakeAndActivateUnit(unitId);
  }

  // Put a unit to sleep
  public sleepUnit(unitId: string): boolean {
    return this.unitStateSystem.sleepUnit(unitId);
  }

  // Wake up a sleeping unit
  public wakeUpUnit(unitId: string): boolean {
    return this.unitStateSystem.wakeUpUnit(unitId);
  }

  // Wake up a sleeping unit and add it back to the move queue
  public wakeUpAndActivateUnit(unitId: string): boolean {
    return this.unitStateSystem.wakeUpAndActivateUnit(unitId);
  }

  // Create a unit of specified type at specified position
  public createUnit(unitType: UnitType, position: Position, playerId: string): Unit | null {
    return this.unitStateSystem.createUnit(unitType, position, playerId);
  }

  // Get available unit types for a player based on their technology
  public getAvailableUnits(playerId: string): UnitType[] {
    return this.unitStateSystem.getAvailableUnits(playerId);
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
  public startRevolution(playerId: string, cause?: string): boolean {
    return this.governmentSystem.startRevolution(playerId, cause);
  }

  // Change government after revolution
  public changeGovernment(playerId: string, newGovernment: GovernmentType): boolean {
    return this.governmentSystem.changeGovernment(playerId, newGovernment);
  }

  // Get available governments for a player
  public getAvailableGovernments(playerId: string): GovernmentType[] {
    return this.governmentSystem.getAvailableGovernments(playerId);
  }

  // Get current government effects for a player
  public getGovernmentEffects(playerId: string): GovernmentEffects | null {
    return this.governmentSystem.getGovernmentEffects(playerId);
  }

  // ── Tax system public API ─────────────────────────────────────────────────

  /**
   * Set the tax and luxury rates for a player.
   * Science rate is auto-calculated as 100 - taxRate - luxuryRate.
   * Both values are clamped to [0, 100] in steps of 10, and the sum cannot exceed 100.
   */
  public setTaxRates(playerId: string, taxRate: number, luxuryRate: number): boolean {
    return this.governmentSystem.setTaxRates(playerId, taxRate, luxuryRate);
  }

  /** Return the current tax rates for a player. */
  public getTaxRates(playerId: string): { taxRate: number; luxuryRate: number; scienceRate: number } | null {
    return this.governmentSystem.getTaxRates(playerId);
  }

  /** Return the full per-turn income / expense summary for a player. */
  public getPlayerTaxSummary(playerId: string) {
    return this.governmentSystem.getPlayerTaxSummary(playerId);
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
    // Barbarians don't engage in diplomacy.
    if (aiPlayer.isBarbarian) return;

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

  // Initialize food storage for all existing cities (for backward compatibility)
  public initializeFoodStorageForExistingCities(): void {
    return this.cityFoundingSystem.initializeFoodStorageForExistingCities();
  }
  public buildRoad(unitId: string): boolean {
    return this.terrainImprovementSystem.buildRoad(unitId);
  }

  public buildIrrigation(unitId: string): boolean {
    return this.terrainImprovementSystem.buildIrrigation(unitId);
  }

  public buildMine(unitId: string): boolean {
    return this.terrainImprovementSystem.buildMine(unitId);
  }

  public cancelMineBuilding(unitId: string): boolean {
    return this.terrainImprovementSystem.cancelMineBuilding(unitId);
  }

  public cancelMineBuildingAndActivateUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    // Can only activate units belonging to current player
    if (unit.playerId !== this.gameState.currentPlayer) return false;

    // Cancel mine building
    this.terrainImprovementSystem.cancelMineBuilding(unitId);

    // Restore movement points if it doesn't have any
    if (unit.movementPoints <= 0) {
      const stats = getUnitStats(unit.type);
      unit.movementPoints = stats.movement;
    }

    // Add unit to the move queue and make it active
    this.unitQueueSystem.ensureUnitInQueueAndSelect(unit);

    this.emit('unitActivated', unit);
    return true;
  }

  // Get terrain yields with improvements
  public getTerrainYieldsWithImprovements(x: number, y: number): { food: number; production: number; trade: number } {
    return this.terrainImprovementSystem.getTerrainYieldsWithImprovements(x, y);
  }

  // Cancel road building for a unit
  public cancelIrrigationBuilding(unitId: string): boolean {
    return this.terrainImprovementSystem.cancelIrrigationBuilding(unitId);
  }

  public cancelIrrigationBuildingAndActivateUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    if (unit.playerId !== this.gameState.currentPlayer) return false;

    this.terrainImprovementSystem.cancelIrrigationBuilding(unitId);

    if (unit.movementPoints <= 0) {
      const stats = getUnitStats(unit.type);
      unit.movementPoints = stats.movement;
    }

    this.unitQueueSystem.ensureUnitInQueueAndSelect(unit);
    this.emit('unitActivated', unit);
    return true;
  }

  public cancelRoadBuilding(unitId: string): boolean {
    return this.terrainImprovementSystem.cancelRoadBuilding(unitId);
  }

  // Cancel road building and activate the unit
  public cancelRoadBuildingAndActivateUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    // Can only activate units belonging to current player
    if (unit.playerId !== this.gameState.currentPlayer) return false;

    // Cancel road building
    this.terrainImprovementSystem.cancelRoadBuilding(unitId);

    // Restore movement points if it doesn't have any
    if (unit.movementPoints <= 0) {
      const stats = getUnitStats(unit.type);
      unit.movementPoints = stats.movement;
    }

    // Add unit to the move queue and make it active
    this.unitQueueSystem.ensureUnitInQueueAndSelect(unit);

    this.emit('unitActivated', unit);
    return true;
  }

  public buildFortress(unitId: string): boolean {
    return this.terrainImprovementSystem.buildFortress(unitId);
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
    return this.unitQueueSystem.wasAutoAdvanceTriggered();
  }

  /**
   * Called by the UI after the player confirms they want to declare war and attack.
   */
  public confirmDeclareWarAndAttack(unitId: string, targetPosition: Position, aiPlayerId: string): boolean {
    return this.combatOrchestrator.confirmDeclareWarAndAttack(unitId, targetPosition, aiPlayerId);
  }

  public acknowledgePlayerDefeat(playerId: string): void {
    this.combatOrchestrator.acknowledgePlayerDefeat(playerId);
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
