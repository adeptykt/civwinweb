import { Unit, UnitType, Position, UnitCategory } from '../types/game';
import { getUnitStats } from './UnitDefinitions';

export abstract class BaseUnit implements Unit {
  id: string;
  type: UnitType;
  position: Position;
  movementPoints: number;
  maxMovementPoints: number;
  health: number;
  maxHealth: number;
  playerId: string;
  experience: number;
  isVeteran: boolean;
  fortified: boolean;
  fortifying?: boolean;
  fortificationTurns?: number;

  constructor(
    id: string,
    type: UnitType,
    position: Position,
    playerId: string
  ) {
    this.id = id;
    this.type = type;
    this.position = position;
    this.playerId = playerId;
    this.experience = 0;
    this.isVeteran = false;
    this.fortified = false;
    this.fortifying = false;
    this.fortificationTurns = 0;
    this.health = 100;
    this.maxHealth = 100;

    const stats = getUnitStats(type);
    this.maxMovementPoints = stats.movement;
    this.movementPoints = stats.movement;
  }

  // Abstract methods that must be implemented by subclasses
  abstract canMoveTo(position: Position): boolean;
  abstract getAttackStrength(): number;
  abstract getDefenseStrength(): number;

  // Common unit methods
  move(newPosition: Position): boolean {
    if (!this.canMoveTo(newPosition) || this.movementPoints <= 0) {
      return false;
    }

    this.position = newPosition;
    this.movementPoints--;
    return true;
  }

  fortify(): void {
    if (getUnitStats(this.type).canFortify) {
      this.fortified = true;
      this.fortifying = false;
      this.fortificationTurns = 1; // Default to 1 turn for basic fortify
      this.movementPoints = 0; // End turn when fortifying
    }
  }

  unfortify(): void {
    this.fortified = false;
    this.fortifying = false;
    this.fortificationTurns = 0;
  }

  restoreMovementPoints(): void {
    this.movementPoints = this.maxMovementPoints;
  }

  takeDamage(damage: number): void {
    this.health = Math.max(0, this.health - damage);
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  gainExperience(amount: number): void {
    this.experience += amount;
    // Become veteran after enough experience
    if (this.experience >= 100 && !this.isVeteran) {
      this.isVeteran = true;
    }
  }

  isAlive(): boolean {
    return this.health > 0;
  }

  getStats() {
    return getUnitStats(this.type);
  }
}

// Land unit class
export class LandUnit extends BaseUnit {
  canMoveTo(_position: Position): boolean {
    // Land units can move to land tiles (implementation depends on terrain system)
    // For now, just check if movement points are available
    return this.movementPoints > 0;
  }

  getAttackStrength(): number {
    const baseAttack = getUnitStats(this.type).attack;
    const veteranBonus = this.isVeteran ? Math.floor(baseAttack * 0.5) : 0;
    return baseAttack + veteranBonus;
  }

  getDefenseStrength(): number {
    const baseDefense = getUnitStats(this.type).defense;
    const veteranBonus = this.isVeteran ? Math.floor(baseDefense * 0.5) : 0;
    const fortificationBonus = this.fortified ? Math.floor(baseDefense * 0.5) : 0;
    return baseDefense + veteranBonus + fortificationBonus;
  }
}

// Naval unit class
export class NavalUnit extends BaseUnit {
  carriedUnits: Unit[] = [];

  canMoveTo(_position: Position): boolean {
    // Naval units can move to ocean/water tiles
    return this.movementPoints > 0;
  }

  getAttackStrength(): number {
    const baseAttack = getUnitStats(this.type).attack;
    const veteranBonus = this.isVeteran ? Math.floor(baseAttack * 0.5) : 0;
    return baseAttack + veteranBonus;
  }

  getDefenseStrength(): number {
    const baseDefense = getUnitStats(this.type).defense;
    const veteranBonus = this.isVeteran ? Math.floor(baseDefense * 0.5) : 0;
    return baseDefense + veteranBonus;
  }

  canCarryUnit(unit: Unit): boolean {
    const stats = getUnitStats(this.type);
    const maxCapacity = stats.canCarryUnits || 0;
    return this.carriedUnits.length < maxCapacity && 
           getUnitStats(unit.type).category === UnitCategory.LAND;
  }

  loadUnit(unit: Unit): boolean {
    if (this.canCarryUnit(unit)) {
      this.carriedUnits.push(unit);
      return true;
    }
    return false;
  }

  unloadUnit(unitId: string): Unit | null {
    const index = this.carriedUnits.findIndex(u => u.id === unitId);
    if (index >= 0) {
      return this.carriedUnits.splice(index, 1)[0];
    }
    return null;
  }
}

// Air unit class
export class AirUnit extends BaseUnit {
  basePosition: Position | null = null; // Must return to base
  turnsInAir: number = 0;

  canMoveTo(_position: Position): boolean {
    // Air units have special movement rules
    return this.movementPoints > 0;
  }

  getAttackStrength(): number {
    const baseAttack = getUnitStats(this.type).attack;
    const veteranBonus = this.isVeteran ? Math.floor(baseAttack * 0.5) : 0;
    return baseAttack + veteranBonus;
  }

  getDefenseStrength(): number {
    const baseDefense = getUnitStats(this.type).defense;
    const veteranBonus = this.isVeteran ? Math.floor(baseDefense * 0.5) : 0;
    return baseDefense + veteranBonus;
  }

  setBase(basePosition: Position): void {
    this.basePosition = basePosition;
  }

  mustReturnToBase(): boolean {
    // Bombers can stay airborne for 1 turn, fighters must return each turn
    const maxTurnsInAir = this.type === UnitType.BOMBER ? 1 : 0;
    return this.turnsInAir >= maxTurnsInAir;
  }

  incrementAirTime(): void {
    this.turnsInAir++;
  }

  returnToBase(): void {
    this.turnsInAir = 0;
    if (this.basePosition) {
      this.position = this.basePosition;
    }
  }
}

// Special unit class for non-combat units
export class SpecialUnit extends BaseUnit {
  canMoveTo(_position: Position): boolean {
    return this.movementPoints > 0;
  }

  getAttackStrength(): number {
    return getUnitStats(this.type).attack;
  }

  getDefenseStrength(): number {
    const baseDefense = getUnitStats(this.type).defense;
    const veteranBonus = this.isVeteran ? Math.floor(baseDefense * 0.5) : 0;
    return baseDefense + veteranBonus;
  }

  // Special abilities for different unit types
  canFoundCity(): boolean {
    return this.type === UnitType.SETTLERS;
  }

  canEstablishEmbassy(): boolean {
    return this.type === UnitType.DIPLOMAT;
  }

  canEstablishTradeRoute(): boolean {
    return this.type === UnitType.CARAVAN;
  }
}

// Factory function to create the appropriate unit class
export function createUnit(
  id: string,
  type: UnitType,
  position: Position,
  playerId: string
): BaseUnit {
  const stats = getUnitStats(type);
  
  switch (stats.category) {
    case UnitCategory.LAND:
      return new LandUnit(id, type, position, playerId);
    case UnitCategory.NAVAL:
      return new NavalUnit(id, type, position, playerId);
    case UnitCategory.AIR:
      return new AirUnit(id, type, position, playerId);
    case UnitCategory.SPECIAL:
      return new SpecialUnit(id, type, position, playerId);
    default:
      return new LandUnit(id, type, position, playerId);
  }
}
