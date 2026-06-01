import type { City, GameState, Position, Unit } from '../types/game';
import { UnitType, TerrainType, BuildingType } from '../types/game';
import { applyCityCapture, cityHasWalls } from './CityCaptureSystem';
import type { CityCaptureOptions } from './CityCaptureSystem';

const OCEAN_LIKE = new Set<string>([TerrainType.OCEAN, TerrainType.ARCTIC]);

function polluteAround(gameState: GameState, center: Position, radius: number): void {
  const mapWidth = gameState.worldMap[0]?.length ?? 80;
  const mapHeight = gameState.worldMap.length;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const y = center.y + dy;
      const x = ((center.x + dx) % mapWidth + mapWidth) % mapWidth;
      if (y < 0 || y >= mapHeight) continue;
      const tile = gameState.worldMap[y]?.[x];
      if (tile && !OCEAN_LIKE.has(tile.terrain)) {
        tile.polluted = true;
      }
    }
  }
}

/**
 * Nuclear unit attack: destroy city or reduce population, pollute, remove warhead.
 */
export function executeNuclearStrike(
  gameState: GameState,
  attacker: Unit,
  target: Position,
  options?: CityCaptureOptions,
): { cityDestroyed: boolean; captured: boolean; oldOwnerId?: string } {
  if (attacker.type !== UnitType.NUCLEAR) {
    return { cityDestroyed: false, captured: false };
  }

  const city = gameState.cities.find(
    c => c.position.x === target.x && c.position.y === target.y,
  );

  polluteAround(gameState, target, 2);

  let cityDestroyed = false;
  let captured = false;
  let oldOwnerId: string | undefined;

  if (city && city.playerId !== attacker.playerId) {
    const sdi = city.buildings?.some(b => b.type === BuildingType.SDI_DEFENSE);
    if (!sdi) {
      if (cityHasWalls(city) && city.population > 1) {
        city.population = Math.max(1, city.population - 2);
      } else {
        oldOwnerId = applyCityCapture(gameState, city, attacker.playerId, attacker, options).oldOwnerId;
        captured = true;
      }
    }
  }

  const victims = gameState.units.filter(
    u =>
      u.position.x === target.x &&
      u.position.y === target.y &&
      u.id !== attacker.id &&
      !u.aboardUnitId,
  );
  for (const v of victims) {
    gameState.units = gameState.units.filter(u => u.id !== v.id);
  }

  gameState.units = gameState.units.filter(u => u.id !== attacker.id);
  cityDestroyed = !gameState.cities.some(
    c => c.position.x === target.x && c.position.y === target.y && c.population > 0,
  );

  return { cityDestroyed: !!city && !captured, captured, oldOwnerId };
}
