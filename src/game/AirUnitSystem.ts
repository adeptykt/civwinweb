import type { GameState, Unit } from '../types/game';
import { UnitCategory } from '../types/game';
import { getUnitStats } from './UnitDefinitions';
import { findTransportsAt } from './TransportSystem';

export function ensureAirFuel(unit: Unit): void {
  if (getUnitStats(unit.type).category !== UnitCategory.AIR) return;
  if (unit.airFuelRemaining === undefined) {
    unit.airFuelRemaining = unit.maxMovementPoints;
  }
}

export function isAtAirBase(gameState: GameState, unit: Unit): boolean {
  const city = gameState.cities.find(
    c =>
      c.playerId === unit.playerId &&
      c.position.x === unit.position.x &&
      c.position.y === unit.position.y,
  );
  if (city) return true;
  const carriers = findTransportsAt(gameState, unit.position, unit.playerId);
  return carriers.some(c => getUnitStats(c.type).specialAbilities?.includes('air_base'));
}

export function refuelAirUnit(unit: Unit, gameState: GameState): void {
  if (getUnitStats(unit.type).category !== UnitCategory.AIR) return;
  if (isAtAirBase(gameState, unit)) {
    unit.airFuelRemaining = unit.maxMovementPoints;
  }
}

export function canAirUnitMove(unit: Unit): boolean {
  if (getUnitStats(unit.type).category !== UnitCategory.AIR) return true;
  ensureAirFuel(unit);
  return (unit.airFuelRemaining ?? 0) > 0 && unit.movementPoints > 0;
}

export function spendAirFuel(unit: Unit, tilesMoved: number): void {
  if (getUnitStats(unit.type).category !== UnitCategory.AIR) return;
  ensureAirFuel(unit);
  unit.airFuelRemaining = Math.max(0, (unit.airFuelRemaining ?? 0) - tilesMoved);
}

export function refuelAllAirUnitsForPlayer(gameState: GameState, playerId: string): void {
  for (const unit of gameState.units.filter(u => u.playerId === playerId)) {
    if (getUnitStats(unit.type).category === UnitCategory.AIR) {
      refuelAirUnit(unit, gameState);
    }
  }
}
