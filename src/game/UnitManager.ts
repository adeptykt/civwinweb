/**
 * Manages unit-related operations including movement, combat, and actions
 */
import { Unit, Position, UnitType, GameState, Player } from '../types/game';
import { createUnit } from './Units';
import { getUnitStats } from './UnitDefinitions';

export class UnitManager {
  private units: Map<string, Unit> = new Map();
  private unitQueue: Unit[] = [];
  private currentUnitIndex: number = 0;

  /**
   * Create a new unit
   */
  createUnit(type: UnitType, position: Position, playerId: string): Unit {
    const unit = createUnit(`unit-${Date.now()}-${Math.random()}`, type, position, playerId);
    this.units.set(unit.id, unit);
    return unit;
  }

  /**
   * Get unit by ID
   */
  getUnit(unitId: string): Unit | undefined {
    return this.units.get(unitId);
  }

  /**
   * Get all units
   */
  getAllUnits(): Unit[] {
    return Array.from(this.units.values());
  }

  /**
   * Get units for a specific player
   */
  getPlayerUnits(playerId: string): Unit[] {
    return Array.from(this.units.values()).filter(unit => unit.playerId === playerId);
  }

  /**
   * Get units at a specific position
   */
  getUnitsAtPosition(position: Position): Unit[] {
    return Array.from(this.units.values()).filter(unit => 
      unit.position.x === position.x && unit.position.y === position.y
    );
  }

  /**
   * Remove a unit
   */
  removeUnit(unitId: string): void {
    const unit = this.units.get(unitId);
    if (unit) {
      // Remove from queue if present
      const queueIndex = this.unitQueue.findIndex(u => u.id === unitId);
      if (queueIndex !== -1) {
        this.unitQueue.splice(queueIndex, 1);
        if (this.currentUnitIndex > queueIndex) {
          this.currentUnitIndex--;
        }
      }
      
      this.units.delete(unitId);
    }
  }

  /**
   * Move a unit to a new position
   */
  moveUnit(unitId: string, newPosition: Position): boolean {
    const unit = this.units.get(unitId);
    if (!unit || unit.movementPoints <= 0) {
      return false;
    }

    // Update position and movement points
    unit.position = newPosition;
    unit.movementPoints = Math.max(0, unit.movementPoints - 1);
    
    return true;
  }

  /**
   * Check if a unit can move to a position
   */
  canUnitMoveTo(unit: Unit, position: Position, worldMap: any[][]): boolean {
    const stats = getUnitStats(unit.type);
    
    // Check map boundaries
    const mapHeight = worldMap.length;
    const mapWidth = worldMap[0]?.length || 0;
    
    if (position.y < 0 || position.y >= mapHeight) {
      return false;
    }
    
    // Handle horizontal wrapping
    const wrappedX = ((position.x % mapWidth) + mapWidth) % mapWidth;
    const terrain = worldMap[position.y]?.[wrappedX]?.terrain;
    
    // Check if unit can move on this terrain type
    if (terrain === 'ocean' && !stats.canMoveOnWater) {
      return false;
    }
    
    if (terrain === 'mountains' && !stats.canMoveOnMountains) {
      return false;
    }
    
    return true;
  }

  /**
   * Reset movement points for all units of a player
   */
  resetMovementPoints(playerId: string): void {
    this.getPlayerUnits(playerId).forEach(unit => {
      const stats = getUnitStats(unit.type);
      unit.movementPoints = stats.movement;
    });
  }

  /**
   * Queue management for unit turns
   */
  initializeUnitQueue(playerId: string): void {
    this.unitQueue = this.getPlayerUnits(playerId).filter(unit => 
      unit.movementPoints > 0 && !unit.fortified && unit.sleeping !== true
    );
    this.currentUnitIndex = 0;
  }

  /**
   * Get the current unit in queue
   */
  getCurrentQueuedUnit(): Unit | undefined {
    return this.unitQueue[this.currentUnitIndex];
  }

  /**
   * Move to next unit in queue
   */
  nextUnitInQueue(): Unit | undefined {
    this.currentUnitIndex++;
    if (this.currentUnitIndex >= this.unitQueue.length) {
      this.currentUnitIndex = 0;
      return undefined; // No more units
    }
    return this.unitQueue[this.currentUnitIndex];
  }

  /**
   * Remove current unit from queue
   */
  removeCurrentFromQueue(): void {
    if (this.currentUnitIndex < this.unitQueue.length) {
      this.unitQueue.splice(this.currentUnitIndex, 1);
      if (this.currentUnitIndex >= this.unitQueue.length) {
        this.currentUnitIndex = 0;
      }
    }
  }

  /**
   * Check if there are more units in queue
   */
  hasUnitsInQueue(): boolean {
    return this.unitQueue.length > 0;
  }
}
