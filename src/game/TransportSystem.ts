import type { GameState, Position, Unit } from '../types/game';
import { UnitCategory, UnitType } from '../types/game';
import { getUnitStats } from './UnitDefinitions';

export function isUnitAboard(unit: Unit): boolean {
  return !!unit.aboardUnitId;
}

export function getCargoUnits(gameState: GameState, transportId: string): Unit[] {
  return gameState.units.filter(u => u.aboardUnitId === transportId);
}

export function countCargo(gameState: GameState, transportId: string): number {
  return getCargoUnits(gameState, transportId).length;
}

export function getTransportCapacity(transport: Unit): number {
  const stats = getUnitStats(transport.type);
  return stats.canCarryUnits ?? 0;
}

export function canEmbark(gameState: GameState, transport: Unit, passenger: Unit): boolean {
  if (transport.playerId !== passenger.playerId) return false;
  const cap = getTransportCapacity(transport);
  if (cap <= 0) return false;
  if (isUnitAboard(passenger)) return false;
  const pStats = getUnitStats(passenger.type);
  if (pStats.category === UnitCategory.NAVAL || pStats.category === UnitCategory.AIR) return false;
  if (passenger.type === UnitType.DIPLOMAT || passenger.type === UnitType.CARAVAN) return false;
  if (
    transport.position.x !== passenger.position.x ||
    transport.position.y !== passenger.position.y
  ) {
    return false;
  }
  return countCargo(gameState, transport.id) < cap;
}

export function embarkUnit(gameState: GameState, transport: Unit, passenger: Unit): boolean {
  if (!canEmbark(gameState, transport, passenger)) return false;
  passenger.aboardUnitId = transport.id;
  return true;
}

export function disembarkUnit(
  gameState: GameState,
  passenger: Unit,
  target: Position,
): boolean {
  if (!passenger.aboardUnitId) return false;
  const transport = gameState.units.find(u => u.id === passenger.aboardUnitId);
  if (!transport) {
    passenger.aboardUnitId = undefined;
    return false;
  }
  passenger.aboardUnitId = undefined;
  passenger.position = { ...target };
  return true;
}

/** Units shown on the map (excludes cargo). */
export function getMapVisibleUnits(gameState: GameState): Unit[] {
  return gameState.units.filter(u => !isUnitAboard(u));
}

export function findTransportsAt(gameState: GameState, position: Position, playerId: string): Unit[] {
  return gameState.units.filter(u => {
    if (u.playerId !== playerId) return false;
    if (u.position.x !== position.x || u.position.y !== position.y) return false;
    return getTransportCapacity(u) > 0;
  });
}
