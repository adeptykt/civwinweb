import type { City, GameState, Player, Unit } from '../types/game';
import { BuildingType } from '../types/game';
import type { Position } from '../types/game';
import { SoundEffects } from '../utils/SoundEffects';

function wrappedCityDistance(a: Position, b: Position, mapWidth: number): number {
  const dx = Math.abs(a.x - b.x);
  const wrappedDx = Math.min(dx, mapWidth - dx);
  const dy = Math.abs(a.y - b.y);
  return wrappedDx + dy;
}
import type { CityCaptureOptions } from './CityCaptureSystem';

export interface CityJoinOptions extends CityCaptureOptions {
  /** Keep shields/production queue (diplomatic revolt). Default false for military surrender. */
  keepProduction?: boolean;
}

/** True if this city is the owner's capital (Palace). Capitals cannot revolt (Civ I). */
export function isOwnerCapitalCity(city: City, gameState: GameState): boolean {
  if (city.buildings?.some(b => b.type === BuildingType.PALACE)) return true;
  const capital = findOwnerCapital(city.playerId, gameState.cities);
  return capital?.id === city.id;
}

export function isCityInCivilDisorder(city: City): boolean {
  if ((city.disorderTurns ?? 0) >= 1) return true;
  const unhappy = city.unhappyCitizens ?? 0;
  const content = city.contentCitizens ?? 0;
  return unhappy > content && unhappy > 0;
}

function findOwnerCapital(ownerId: string, cities: City[]): City | null {
  const playerCities = cities.filter(c => c.playerId === ownerId);
  return (
    playerCities.find(c => c.buildings?.some(b => b.type === BuildingType.PALACE)) ??
    playerCities[0] ??
    null
  );
}

export function distanceFromOwnerCapital(city: City, gameState: GameState): number {
  const capital = findOwnerCapital(city.playerId, gameState.cities);
  if (!capital || capital.id === city.id) return 0;
  const mapWidth = gameState.worldMap[0]?.length ?? 80;
  return wrappedCityDistance(city.position, capital.position, mapWidth);
}

/** Civ I–style gold cost to incite revolt (city joins buyer). */
export function computeInciteRevoltCost(gameState: GameState, city: City): number {
  const base = 40 + city.population * 18;
  const dist = distanceFromOwnerCapital(city, gameState);
  const distFactor = 1 + dist / 12;
  let cost = Math.floor(base * distFactor);
  if (isCityInCivilDisorder(city)) {
    cost = Math.floor(cost * 0.55);
  }
  return Math.max(25, cost);
}

export function canDiplomatInciteRevolt(
  gameState: GameState,
  city: City,
  actorPlayerId: string,
): { ok: true } | { ok: false; reason: string } {
  if (city.playerId === actorPlayerId) return { ok: false, reason: 'own_city' };
  const owner = gameState.players.find(p => p.id === city.playerId);
  if ((owner as Player & { isBarbarian?: boolean })?.isBarbarian) {
    return { ok: false, reason: 'barbarian' };
  }
  if (isOwnerCapitalCity(city, gameState)) {
    return { ok: false, reason: 'capital' };
  }
  if (city.population < 1) return { ok: false, reason: 'invalid' };
  return { ok: true };
}

/**
 * Weak undefended cities may join without a full assault (no partisans).
 * Requires no walls and population 2 or less.
 */
export function canMilitaryPeacefulJoin(city: City, defendingUnitCount: number): boolean {
  if (defendingUnitCount > 0) return false;
  const hasWalls = city.buildings?.some(b => b.type === BuildingType.CITY_WALLS) ?? false;
  if (hasWalls) return false;
  return city.population <= 2;
}

/**
 * Transfer city to a new owner without combat partisans (revolt / peaceful join).
 */
export function applyCityJoin(
  gameState: GameState,
  city: City,
  newOwnerId: string,
  options?: CityJoinOptions,
): { oldOwnerId: string } {
  const oldOwnerId = city.playerId;
  city.playerId = newOwnerId;
  options?.onPlayerOwnsCity?.(newOwnerId);

  const newOwnerPlayer = gameState.players.find(p => p.id === newOwnerId);
  if (newOwnerPlayer && !newOwnerPlayer.usedCityNames.includes(city.name)) {
    newOwnerPlayer.usedCityNames.push(city.name);
  }

  if (!options?.keepProduction) {
    city.production = null;
    city.production_points = 0;
  }

  city.disorderTurns = 0;

  if (newOwnerPlayer?.isHuman) {
    SoundEffects.playCivilizationFanfare(newOwnerPlayer.civilizationType);
  }

  options?.checkDefeated?.();

  return { oldOwnerId };
}
