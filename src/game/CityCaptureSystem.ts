import type { City, GameState, Unit } from '../types/game';
import { BuildingType, UnitType } from '../types/game';
import { createUnit } from './Units';
import { SoundEffects } from '../utils/SoundEffects';

export interface CityCaptureOptions {
  onPlayerOwnsCity?: (playerId: string) => void;
  checkDefeated?: () => void;
}

export function cityHasWalls(city: City): boolean {
  return city.buildings?.some(b => b.type === BuildingType.CITY_WALLS) ?? false;
}

/**
 * Apply Civ I–style city capture: transfer ownership, clear production, optional partisans.
 */
export function applyCityCapture(
  gameState: GameState,
  city: City,
  newOwnerId: string,
  capturingUnit: Unit | undefined,
  options?: CityCaptureOptions,
): { oldOwnerId: string } {
  const oldOwnerId = city.playerId;
  city.playerId = newOwnerId;
  options?.onPlayerOwnsCity?.(newOwnerId);

  const newOwnerPlayer = gameState.players.find(p => p.id === newOwnerId);
  if (newOwnerPlayer && !newOwnerPlayer.usedCityNames.includes(city.name)) {
    newOwnerPlayer.usedCityNames.push(city.name);
  }

  city.production = null;
  city.production_points = 0;

  if (newOwnerPlayer?.isHuman) {
    SoundEffects.playCivilizationFanfare(newOwnerPlayer.civilizationType);
  }

  if (!cityHasWalls(city) && oldOwnerId !== newOwnerId) {
    spawnPartisansForFormerOwner(gameState, city, oldOwnerId);
  }

  void capturingUnit;
  options?.checkDefeated?.();

  return { oldOwnerId };
}

/** Former owner gets a militia near the captured city (no walls). */
function spawnPartisansForFormerOwner(
  gameState: GameState,
  city: City,
  formerOwnerId: string,
): void {
  const former = gameState.players.find(p => p.id === formerOwnerId);
  if (!former || (former as { isBarbarian?: boolean }).isBarbarian) return;

  const mapWidth = gameState.worldMap[0]?.length ?? 80;
  const mapHeight = gameState.worldMap.length;
  const offsets = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
  ];

  for (const { dx, dy } of offsets) {
    const x = ((city.position.x + dx) % mapWidth + mapWidth) % mapWidth;
    const y = city.position.y + dy;
    if (y < 0 || y >= mapHeight) continue;
    const tile = gameState.worldMap[y]?.[x];
    if (!tile || tile.terrain === 'ocean') continue;
    const occupied = gameState.units.some(
      u => u.position.x === x && u.position.y === y && !u.aboardUnitId,
    );
    if (occupied) continue;

    const partisan = createUnit(
      `partisan-${Date.now()}-${Math.random()}`,
      UnitType.MILITIA,
      { x, y },
      formerOwnerId,
    );
    gameState.units.push(partisan as Unit);
    break;
  }
}
