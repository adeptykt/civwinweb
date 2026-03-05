import { GameState, Player, Position, TerrainType, Unit, UnitType } from '../types/game';
import { getUnitStats, canUnitSleep } from './UnitDefinitions';
import { createUnit as createUnitEntity } from './Units';
import { DebugSystem } from '../utils/DebugSystem';
import { ProductionManager } from './ProductionManager';

export class UnitStateSystem {
  private gameState: GameState;
  private emit: (event: string, data?: any) => void;
  private removeUnitFromQueue: (unitId: string) => void;
  /**
   * Called when wakeAndActivateUnit / wakeUpAndActivateUnit need to
   * add a unit to the move queue and make it the current unit.
   * Implemented in Game.ts using the queue state owned there (until
   * UnitQueueSystem is extracted).
   */
  private activateUnitInQueue: (unit: Unit) => void;

  constructor(
    gameState: GameState,
    emit: (event: string, data?: any) => void,
    removeUnitFromQueue: (unitId: string) => void,
    activateUnitInQueue: (unit: Unit) => void,
  ) {
    this.gameState = gameState;
    this.emit = emit;
    this.removeUnitFromQueue = removeUnitFromQueue;
    this.activateUnitInQueue = activateUnitInQueue;
  }

  // ── Fortification ─────────────────────────────────────────────────────────

  public fortifyUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    const stats = getUnitStats(unit.type);
    if (!stats.canFortify) return false;

    const tile = this.gameState.worldMap[unit.position.y]?.[unit.position.x];
    if (!tile) return false;

    const isInCity = this.isUnitInCity(unit.position);
    const requiredTurns = isInCity ? 1 : this.getFortificationTurns(tile.terrain);

    unit.fortificationTurns = unit.fortificationTurns || 0;

    if (requiredTurns === 1) {
      // Instant fortification
      unit.fortified = true;
      unit.fortifying = false;
      unit.fortificationTurns = 1;
    } else {
      // 2-turn fortification
      if (unit.fortificationTurns === 0) {
        unit.fortifying = true;
        unit.fortified = false;
        unit.fortificationTurns = 1;
      } else if (unit.fortificationTurns === 1 && unit.fortifying) {
        unit.fortified = true;
        unit.fortifying = false;
        unit.fortificationTurns = 2;
      }
    }

    unit.movementPoints = 0;
    this.removeUnitFromQueue(unitId);
    this.emit('unitFortified', unit);
    return true;
  }

  // ── Wake / unfortify ──────────────────────────────────────────────────────

  public wakeUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    unit.fortified = false;
    unit.fortifying = false;
    unit.fortificationTurns = 0;

    this.emit('unitWoken', unit);
    return true;
  }

  public wakeAndActivateUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    if (unit.playerId !== this.gameState.currentPlayer) return false;

    this.wakeUnit(unitId);

    if (unit.movementPoints <= 0) {
      const stats = getUnitStats(unit.type);
      unit.movementPoints = stats.movement;
    }

    this.activateUnitInQueue(unit);
    this.emit('unitActivated', unit);
    return true;
  }

  // ── Sleep ─────────────────────────────────────────────────────────────────

  public sleepUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    if (!canUnitSleep(unit.type)) return false;

    unit.sleeping = true;
    unit.movementPoints = 0;
    this.removeUnitFromQueue(unitId);
    this.emit('unitSlept', unit);
    return true;
  }

  public wakeUpUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    if (unit.sleeping !== true) return false;

    unit.sleeping = false;
    this.emit('unitWokeUp', unit);
    return true;
  }

  public wakeUpAndActivateUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    if (unit.playerId !== this.gameState.currentPlayer) return false;

    this.wakeUpUnit(unitId);

    const stats = getUnitStats(unit.type);
    unit.movementPoints = stats.movement;

    this.activateUnitInQueue(unit);
    this.emit('unitActivated', unit);
    return true;
  }

  // ── Unit creation / availability ──────────────────────────────────────────

  public createUnit(unitType: UnitType, position: Position, playerId: string): Unit | null {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return null;

    const stats = getUnitStats(unitType);
    if (stats.requiredTechnology) {
      if (!player.technologies.includes(stats.requiredTechnology)) return null;
    }

    const unit = createUnitEntity(
      `unit-${Date.now()}-${Math.random()}`,
      unitType,
      position,
      playerId
    );

    this.gameState.units.push(unit);
    this.emit('unitCreated', unit);
    return unit;
  }

  public getAvailableUnits(playerId: string): UnitType[] {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return [];

    const nonStandardUnits: UnitType[] = [
      UnitType.WARRIOR,
      UnitType.SCOUT,
      UnitType.ARCHER,
      UnitType.SPEARMAN,
    ];

    const civ2EnhancementsEnabled = DebugSystem.getInstance().isCiv2EnhancementsEnabled();

    return Object.values(UnitType).filter(unitType => {
      const stats = getUnitStats(unitType);

      if (stats.requiredTechnology && !player.technologies.includes(stats.requiredTechnology)) {
        return false;
      }

      if (stats.obsoletedBy && player.technologies.includes(stats.obsoletedBy)) {
        return false;
      }

      if (!civ2EnhancementsEnabled && nonStandardUnits.includes(unitType)) {
        return false;
      }

      return true;
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private getFortificationTurns(terrainType: TerrainType): number {
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
        return 1;
    }
  }

  private isUnitInCity(unitPosition: Position): boolean {
    const tile = this.gameState.worldMap[unitPosition.y]?.[unitPosition.x];
    return tile?.city !== undefined;
  }
}
