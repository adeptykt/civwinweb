import {
  GameState,
  Unit,
  Position,
  City,
  UnitType,
  UnitCategory,
  TerrainType,
  ImprovementType,
} from '../types/game';
import { getUnitStats } from './UnitDefinitions';
import { TerrainManager } from '../terrain/index';
import { SoundEffects } from '../utils/SoundEffects';
import { findPath } from '../utils/Pathfinder';
import { findBestInfrastructureAction } from './ai/AISettlerStrategy';
import { VisibilitySystem } from './VisibilitySystem';
import { getCivilization } from './CivilizationDefinitions';
import { DiplomacyManager } from './DiplomacyManager';
import {
  resolveVillageEncounter,
  applyVillageEncounterResult,
  type VillageEncounterResult,
} from './VillageSystem';

export class UnitMovementSystem {
  constructor(
    private readonly gameState: GameState,
    private readonly emit: (event: string, data?: any) => void,
    private readonly removeUnitFromQueue: (unitId: string) => void,
    private readonly initiateAutomaticCombat: (
      unit: Unit,
      position: Position,
      enemies: Unit[],
    ) => boolean,
    private readonly checkForDefeatedPlayers: () => void,
    private readonly buildRoad: (unitId: string) => void,
    private readonly buildIrrigation: (unitId: string) => void,
    private readonly buildMine: (unitId: string) => void,
    private readonly diplomacyManager: DiplomacyManager,
    private readonly onPlayerOwnsCity?: (playerId: string) => void,
  ) {}

  // ── Position utilities ────────────────────────────────────────────────────

  public normalizePosition(position: Position): Position {
    const mapWidth = this.gameState.worldMap[0]?.length || 80;
    const mapHeight = this.gameState.worldMap.length || 50;

    let { x, y } = position;

    // Wrap horizontally
    x = ((x % mapWidth) + mapWidth) % mapWidth;

    // Clamp vertically (no wrapping)
    y = Math.max(0, Math.min(y, mapHeight - 1));

    return { x, y };
  }

  public isValidPosition(position: Position): boolean {
    const { y } = position;
    const mapHeight = this.gameState.worldMap.length || 50;

    // Y must be within bounds (no vertical wrapping)
    if (y < 0 || y >= mapHeight) return false;

    // X is always valid due to horizontal wrapping
    return true;
  }

  // Calculate distance considering horizontal wrapping
  private calculateWrappedDistance(pos1: Position, pos2: Position): number {
    const mapWidth = this.gameState.worldMap[0]?.length || 80;

    const directDx = Math.abs(pos1.x - pos2.x);
    const wrappedDx = mapWidth - directDx;
    const dx = Math.min(directDx, wrappedDx);
    const dy = Math.abs(pos1.y - pos2.y);

    return dx + dy;
  }

  // ── Core movement ─────────────────────────────────────────────────────────

  public moveUnit(unitId: string, newPosition: Position): boolean {
    const unit = this.gameState.units.find((u: Unit) => u.id === unitId);
    if (!unit || unit.movementPoints <= 0) {
      // Only play the error sound if this is the human player's unit
      const movingPlayer = this.gameState.players.find(p => p.id === unit?.playerId);
      if (movingPlayer?.isHuman) SoundEffects.playInvalidActionSound();
      return false;
    }

    // Normalize position with horizontal wrapping
    const normalizedPosition = this.normalizePosition(newPosition);

    // Dev-only diagnostic: verify what tile we are actually moving into.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console -- movement/combat diagnosis
      console.log('[moveUnit]', {
        unitId,
        unitPlayerId: unit.playerId,
        from: { ...unit.position },
        requested: { ...newPosition },
        normalized: { ...normalizedPosition },
      });
    }

    // Check if target tile is valid
    if (!this.isValidPosition(normalizedPosition)) {
      const movingPlayer = this.gameState.players.find(p => p.id === unit.playerId);
      if (movingPlayer?.isHuman) SoundEffects.playInvalidActionSound();
      return false;
    }

    // Check for enemy units at target position
    const enemyUnitsAtPosition = this.gameState.units.filter(u =>
      u.position.x === normalizedPosition.x &&
      u.position.y === normalizedPosition.y &&
      u.playerId !== unit.playerId,
    );

    if (import.meta.env.DEV && enemyUnitsAtPosition.length > 0) {
      // eslint-disable-next-line no-console -- movement/combat diagnosis
      console.log('[moveUnit] enemyUnitsAtPosition', {
        target: { ...normalizedPosition },
        enemies: enemyUnitsAtPosition.map(e => ({
          id: e.id,
          type: e.type,
          playerId: e.playerId,
          pos: { ...e.position },
        })),
      });
    }

    // Reuse the isHuman flag for all remaining sound-guard checks in this function.
    const isHumanUnit = this.gameState.players.find(p => p.id === unit.playerId)?.isHuman ?? false;

    // If there are enemy units, initiate combat instead of moving.
    // But first: if the human player is attacking an AI they are NOT at war with,
    // pause and ask the player to confirm the war declaration before proceeding.
    if (enemyUnitsAtPosition.length > 0) {
      if (isHumanUnit) {
        // Collect the distinct AI owner(s) on that tile
        const aiOwnerIds = [...new Set(enemyUnitsAtPosition.map(u => u.playerId))];
        const aiPlayerId = aiOwnerIds.find(id => {
          const p = this.gameState.players.find(pp => pp.id === id);
          return p && !p.isHuman && !this.diplomacyManager.isAtWar(unit.playerId, id);
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
      if (isHumanUnit) SoundEffects.playInvalidActionSound();
      return false;
    }

    // Zone of Control: a unit cannot move directly from one enemy-ZoC tile
    // into another enemy-ZoC tile (unless the destination is a friendly city
    // or the move uses a railroad connection).
    if (this.isZoCBlocked(unit, unit.position, normalizedPosition)) {
      if (isHumanUnit) SoundEffects.playInvalidActionSound();
      return false;
    }

    // Calculate actual movement cost including terrain
    const movementCost = this.calculateMovementCost(unit.position, normalizedPosition);

    // Classic Civ rule: A unit can always move into a terrain square even if the movement cost
    // exceeds remaining movement points. In that case, it drains all remaining movement to 0.
    // However, unit must have at least some movement points to move
    if (unit.movementPoints <= 0) {
      if (isHumanUnit) SoundEffects.playInvalidActionSound();
      return false;
    }

    // Move unit
    unit.position = normalizedPosition;

    // Check for city capture - if there's an enemy city at this position with no defending units
    const cityAtPosition = this.gameState.cities.find(city =>
      city.position.x === normalizedPosition.x &&
      city.position.y === normalizedPosition.y,
    );

    if (cityAtPosition && cityAtPosition.playerId !== unit.playerId) {
      // Check if there are any enemy units defending the city (after movement)
      const defendingUnits = this.gameState.units.filter(u =>
        u.position.x === normalizedPosition.x &&
        u.position.y === normalizedPosition.y &&
        u.playerId === cityAtPosition.playerId,
      );

      if (defendingUnits.length === 0) {
        // City is undefended, capture it!
        console.log(`Capturing city ${cityAtPosition.name} from player ${cityAtPosition.playerId} to player ${unit.playerId}`);

        const oldOwner = cityAtPosition.playerId;
        cityAtPosition.playerId = unit.playerId;
        this.onPlayerOwnsCity?.(unit.playerId);

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
          capturingUnit: unit,
        });

        // Check for defeated players after city capture
        this.checkForDefeatedPlayers();

        console.log(`City ${cityAtPosition.name} successfully captured by ${unit.playerId}`);
      }
    }

    // Update visibility for the unit's movement
    VisibilitySystem.updateVisibilityForUnitMove(this.gameState, unit, normalizedPosition);

    // Check for tribal village (goody hut) on the destination tile
    const destTile = this.gameState.worldMap[normalizedPosition.y]?.[normalizedPosition.x];
    let villageHumanDialog: {
      unit: Unit;
      tile: NonNullable<typeof destTile>;
      result: VillageEncounterResult;
    } | null = null;
    if (destTile?.hasVillage) {
      const villageResult = resolveVillageEncounter(unit, destTile, this.gameState);
      if (villageResult.type !== 'nothing') {
        const showVillageUi = applyVillageEncounterResult(
          villageResult,
          unit,
          destTile,
          this.gameState,
          this.emit,
        );
        if (showVillageUi) {
          villageHumanDialog = { unit, tile: destTile, result: villageResult };
        }
      } else {
        // Air unit or similar – still remove the village silently
        destTile.hasVillage = false;
      }
    }

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

    if (unit.buildingIrrigation) {
      unit.buildingIrrigation = false;
      unit.irrigationBuildingTurns = 0;
    }

    // If movement cost exceeds remaining points, drain all remaining movement
    if (movementCost > unit.movementPoints) {
      unit.movementPoints = 0;
    } else {
      unit.movementPoints -= movementCost;
    }

    const movementExhausted = unit.movementPoints <= 0;

    if (villageHumanDialog) {
      this.emit('villageEncountered', {
        ...villageHumanDialog,
        deferQueueRemoval: movementExhausted,
      });
    }

    // If unit can no longer move, remove from queue (deferred when human must dismiss village dialog first)
    if (movementExhausted && !villageHumanDialog) {
      this.removeUnitFromQueue(unitId);
    }

    this.emit('unitMoved', { unit, newPosition: normalizedPosition });
    return true;
  }

  // Calculate movement cost including terrain and roads
  private calculateMovementCost(fromPosition: Position, toPosition: Position): number {
    const mapWidth = this.gameState.worldMap[0]?.length || 80;

    const directDx = Math.abs(fromPosition.x - toPosition.x);
    const wrappedDx = mapWidth - directDx;
    const dx = Math.min(directDx, wrappedDx);
    const dy = Math.abs(fromPosition.y - toPosition.y);

    // Check if adjacent (including diagonals) using Chebyshev distance
    const isAdjacent = Math.max(dx, dy) === 1;

    if (!isAdjacent) {
      // For non-adjacent moves, use Manhattan distance
      return dx + dy;
    }

    // Get tiles at both positions
    const fromTile = this.gameState.worldMap[fromPosition.y]?.[fromPosition.x];
    const toTile = this.gameState.worldMap[toPosition.y]?.[toPosition.x];
    if (!fromTile || !toTile) return 999; // Invalid tile

    // Cities implicitly count as having both a road and a railroad
    const fromHasCity = this.gameState.cities.some(
      city => city.position.x === fromPosition.x && city.position.y === fromPosition.y,
    );
    const toHasCity = this.gameState.cities.some(
      city => city.position.x === toPosition.x && city.position.y === toPosition.y,
    );

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

  // Check if unit can move to a specific terrain type (public — combat system uses this)
  public canUnitMoveToTerrain(unit: Unit, position: Position): boolean {
    const tile = this.gameState.worldMap[position.y]?.[position.x];
    if (!tile) return false;

    // First, check if there's a city at the target position
    const cityAtPosition = this.gameState.cities.find(
      city => city.position.x === position.x && city.position.y === position.y,
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
        const isCoastal = this.isCoastal(position);
        if (isCoastal) {
          return true;
        }
      }
      return false;
    }

    // If there's a city and the unit belongs to the same player, allow movement
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
    const navalUnitsAtPosition = this.gameState.units.filter(u =>
      u.position.x === position.x &&
      u.position.y === position.y &&
      u.playerId === unitToTransport.playerId &&
      getUnitStats(u.type).category === UnitCategory.NAVAL &&
      getUnitStats(u.type).canCarryUnits &&
      getUnitStats(u.type).canCarryUnits! > 0,
    );

    for (const navalUnit of navalUnitsAtPosition) {
      const stats = getUnitStats(navalUnit.type);
      const maxCapacity = stats.canCarryUnits || 0;

      // Count currently carried units
      const currentlyCarried = 0; // TODO: Implement proper tracking of carried units

      if (currentlyCarried < maxCapacity) {
        return true;
      }
    }

    return false;
  }

  // ── Goto (multi-turn movement) ────────────────────────────────────────────

  /**
   * Execute one turn of automatic movement for every human unit that has an
   * active goto destination.  Call this at the START of the human turn,
   * before buildUnitQueue(), so the units' moves are processed before the
   * player is asked for manual orders.
   */
  public processGotoUnits(): void {
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

    const zocEdgeBlocker = UnitMovementSystem.isZoCExempt(unit)
      ? undefined
      : (from: Position, to: Position) => this.isZoCBlocked(unit, from, to);
    const path = findPath(unit, dest, this.gameState, zocEdgeBlocker);

    if (!path || path.length === 0) {
      // No path available – cancel the order and let the player take manual control
      delete unit.gotoDestination;
      this.emit('gotoBlocked', { unit, destination: dest });
      return;
    }

    // Walk as many steps as movement points allow this turn
    for (const step of path) {
      if (unit.movementPoints <= 0) break;

      // For human players: if the next step is occupied by enemy units we are
      // not yet at war with, cancel the goto and park the unit rather than
      // auto-prompting a war declaration.  The player can then decide manually
      // whether to attack (which WILL show the war dialog).
      const movingPlayer = this.gameState.players.find(p => p.id === unit.playerId);
      if (movingPlayer?.isHuman) {
        const nonWarEnemyOnStep = this.gameState.units.some(u =>
          u.position.x === step.x &&
          u.position.y === step.y &&
          u.playerId !== unit.playerId &&
          !this.diplomacyManager.isAtWar(unit.playerId, u.playerId)
        );
        if (nonWarEnemyOnStep) {
          // Cancel goto silently — unit stays put adjacent to the enemy so the
          // player can issue explicit orders next.
          delete unit.gotoDestination;
          this.emit('gotoBlocked', { unit, destination: dest });
          break;
        }
      }

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
    const zocEdgeBlocker = UnitMovementSystem.isZoCExempt(unit)
      ? undefined
      : (from: Position, to: Position) => this.isZoCBlocked(unit, from, to);
    const path = findPath(unit, normalizedDest, this.gameState, zocEdgeBlocker);
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
  public processAutomatedSettlers(): void {
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
      if (!nearestCity) {
        // No city to work near — exit automation and return to manual queue.
        unit.automating = false;
        this.emit('settlerAutomationCancelled', { unit });
        continue;
      }

      const action = findBestInfrastructureAction(unit, nearestCity, this.gameState);
      if (!action) {
        // Nothing left to improve in the area — exit automation and return
        // the settler to the regular unit queue so the player can reassign it.
        unit.automating = false;
        this.emit('settlerAutomationCancelled', { unit });
        continue;
      }

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

  // ── Zone of Control ────────────────────────────────────────────────────────

  /**
   * Returns `true` if this unit exerts a Zone of Control over its 8 adjacent
   * tiles.  Only land-category military units exert ZoC.  Diplomats and
   * Caravans are SPECIAL-category but never exert ZoC.
   */
  private static unitExertsZoC(unit: Unit): boolean {
    if (unit.type === UnitType.DIPLOMAT || unit.type === UnitType.CARAVAN) return false;
    const stats = getUnitStats(unit.type);
    return stats.category === UnitCategory.LAND;
  }

  /**
   * Returns `true` if the unit is completely immune to enemy Zone of Control.
   * Diplomats, Caravans, Naval units, and Air units ignore ZoC entirely.
   * Land units (including Settlers) are affected.
   */
  public static isZoCExempt(unit: Unit): boolean {
    if (unit.type === UnitType.DIPLOMAT || unit.type === UnitType.CARAVAN) return true;
    const stats = getUnitStats(unit.type);
    return stats.category === UnitCategory.NAVAL || stats.category === UnitCategory.AIR;
  }

  /**
   * Returns `true` if `position` is within the Zone of Control of any enemy
   * unit (i.e. adjacent — Chebyshev distance 1 — to an enemy tile that holds
   * at least one ZoC-exerting unit).
   *
   * Stack rule: a tile contributes at most one ZoC source regardless of how
   * many units are stacked there.
   */
  public isInEnemyZoC(position: Position, playerId: string): boolean {
    const mapWidth = this.gameState.worldMap[0]?.length || 80;

    // Build the set of tiles occupied by at least one ZoC-exerting enemy unit.
    const enemyZoCTiles = new Set<string>();
    for (const u of this.gameState.units) {
      if (u.playerId === playerId) continue;
      if (!UnitMovementSystem.unitExertsZoC(u)) continue;
      enemyZoCTiles.add(`${u.position.x},${u.position.y}`);
    }

    if (enemyZoCTiles.size === 0) return false;

    // `position` is in ZoC if any adjacent tile (including diagonals) is in
    // the enemy ZoC-tile set.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = ((position.x + dx) % mapWidth + mapWidth) % mapWidth;
        const ny = position.y + dy;
        if (enemyZoCTiles.has(`${nx},${ny}`)) return true;
      }
    }

    return false;
  }

  /**
   * Returns `true` if moving `unit` from `from` → `to` is blocked by an
   * enemy Zone of Control.
   *
   * A move is ZoC-blocked when ALL of the following hold:
   *  1. The unit is not ZoC-exempt (Diplomat / Caravan / Naval / Air).
   *  2. The `from` tile is inside enemy ZoC.
   *  3. The `to` tile is also inside enemy ZoC.
   *  4. The `to` tile is not a friendly city (cities neutralise ZoC).
   *  5. The move is not along a railroad (railroad bypasses ZoC).
   */
  public isZoCBlocked(unit: Unit, from: Position, to: Position): boolean {
    if (UnitMovementSystem.isZoCExempt(unit)) return false;

    // Railroad bypass: both tiles connected by railroad → ZoC does not apply.
    const fromTile = this.gameState.worldMap[from.y]?.[from.x];
    const toTile   = this.gameState.worldMap[to.y]?.[to.x];
    const hasCityAt = (p: Position) =>
      this.gameState.cities.some(c => c.position.x === p.x && c.position.y === p.y);

    const fromHasRail =
      hasCityAt(from) ||
      (fromTile?.improvements?.some(i => i.type === ImprovementType.RAILROAD) ?? false);
    const toHasRail =
      hasCityAt(to) ||
      (toTile?.improvements?.some(i => i.type === ImprovementType.RAILROAD) ?? false);

    if (fromHasRail && toHasRail) return false;

    // Friendly city at destination neutralises ZoC.
    const friendlyCityAtDest = this.gameState.cities.some(
      c => c.position.x === to.x && c.position.y === to.y && c.playerId === unit.playerId,
    );
    if (friendlyCityAtDest) return false;

    // If `from` is not in enemy ZoC the unit moves freely.
    if (!this.isInEnemyZoC(from, unit.playerId)) return false;

    // `from` is in ZoC; blocked only if `to` is also in ZoC.
    return this.isInEnemyZoC(to, unit.playerId);
  }
}
