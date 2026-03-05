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
      SoundEffects.playInvalidActionSound();
      return false;
    }

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
      u.playerId !== unit.playerId,
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
}
