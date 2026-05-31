import { GameState, Position, Player, TerrainType } from '../../types/game';
import { TerrainManager } from '../../terrain/index';
import { getCivilization } from '../CivilizationDefinitions';
import type { AITraits } from '../CivilizationDefinitions';
import { CITY_PREFIXES, CITY_SUFFIXES } from '../../constants/city-names';
import { getDistance, getChebyshevDistance, getValidMoves, isTileUnseen } from './AIUtils';

/**
 * Find the best position in the area for founding a new city.
 * Returns null if no location above the quality threshold is found.
 */
export function findBestCityLocation(
  currentPos: Position,
  playerId: string,
  gameState: GameState,
  isEarlyGame = false,
  aiTraits?: AITraits,
): Position | null {
  const mapWidth    = gameState.worldMap[0]?.length || 80;
  const searchRadius = isEarlyGame ? 6 : 8;
  let baseThreshold = isEarlyGame ? 0.5 : 1.5;
  if (aiTraits) {
    if (aiTraits.development === 'perfectionist') baseThreshold += 1;
    else if (aiTraits.development === 'expansionist') baseThreshold -= 0.5;
  }

  const valid: Array<{ position: Position; score: number }> = [];
  for (let dx = -searchRadius; dx <= searchRadius; dx++) {
    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      // Normalise x so edge-of-map settlers see the full wrapped search area,
      // and the returned position has a canonical x that isAtPosition can match.
      const pos = {
        x: ((currentPos.x + dx) % mapWidth + mapWidth) % mapWidth,
        y: currentPos.y + dy,
      };
      if (isValidCityLocation(pos, gameState) && !isTileUnseen(pos, playerId, gameState)) {
        let score = evaluateCityLocation(pos, gameState);
        // Slightly penalise tiles further away so the settler prioritises closer
        // identical tiles. As it walks toward the target, the distance penalty
        // decreases, which effectively causes the target's score to increase and
        // prevents the settler from continuously changing its mind (oscillating).
        score -= getDistance(currentPos, pos) * 0.05;
        if (score > baseThreshold) valid.push({ position: pos, score });
      }
    }
  }

  if (valid.length === 0) return null;
  valid.sort((a, b) => b.score - a.score);

  // Always pick the highest scored deterministic location to prevent wandering.
  return valid[0].position;
}

/** Returns true if the given position is a legal city-founding spot. */
export function isValidCityLocation(position: Position, gameState: GameState): boolean {
  const mapWidth  = gameState.worldMap[0]?.length || 80;
  const mapHeight = gameState.worldMap.length    || 50;
  let { x, y } = position;
  x = ((x % mapWidth) + mapWidth) % mapWidth;
  if (y < 0 || y >= mapHeight) return false;
  const tile = gameState.worldMap[y]?.[x];
  if (!tile) return false;
  if (!TerrainManager.canFoundCity(tile.terrain)) return false;
  // Enforce minimum separation between cities
  return gameState.cities.every(c => getChebyshevDistance(position, c.position, mapWidth) >= 3);
}

/** Score a potential city location (higher = better). */
export function evaluateCityLocation(position: Position, gameState: GameState): number {
  const mapWidth = gameState.worldMap[0]?.length || 80;
  const tile = gameState.worldMap[position.y]?.[position.x];
  if (!tile) return 0;

  let score = 2; // Base for any valid land
  switch (tile.terrain) {
    case TerrainType.RIVER:     score += 5; break;
    case TerrainType.GRASSLAND:
    case TerrainType.PLAINS:    score += 3; break;
    case TerrainType.HILLS:     score += 2; break;
    default:                    score += 1; break;
  }
  if (isNearTerrain(position, TerrainType.OCEAN, gameState)) score += 2;
  if (isNearTerrain(position, TerrainType.RIVER, gameState)) score += 1;

  // Prefer building further away from existing cities (at least 3 away, usually more)
  let minCityDist = 999;
  for (const c of gameState.cities) {
    const dist = getChebyshevDistance(position, c.position, mapWidth);
    if (dist < minCityDist) minCityDist = dist;
  }

  if (minCityDist === 3) {
    score -= 3; // Penalize being right on the edge of the minimum distance
  } else if (minCityDist === 4) {
    score -= 1; // Slight penalty for some overlap
  } else if (minCityDist >= 5 && minCityDist <= 7) {
    score += 2; // Bonus for ideal separation without being completely isolated
  }

  return score;
}

/** Returns true if any neighbour of the position has the given terrain type. */
export function isNearTerrain(
  position: Position,
  terrainType: TerrainType,
  gameState: GameState,
): boolean {
  return getValidMoves(position, gameState).some(n => {
    const tile = gameState.worldMap[n.y]?.[n.x];
    return tile?.terrain === terrainType;
  });
}

/** Pick a city name for a player from their civilization list, falling back to random generation. */
export function generateCityNameForPlayer(player: Player): string {
  const civilization = getCivilization(player.civilizationType);
  const available = civilization.cities.filter(n => !player.usedCityNames.includes(n));
  if (available.length > 0) return available[0];

  let name = '';
  let attempts = 0;
  do {
    const prefix = CITY_PREFIXES[Math.floor(Math.random() * CITY_PREFIXES.length)];
    const suffix = CITY_SUFFIXES[Math.floor(Math.random() * CITY_SUFFIXES.length)];
    name = `${prefix} ${suffix}`;
    attempts++;
  } while (player.usedCityNames.includes(name) && attempts < 50);

  if (player.usedCityNames.includes(name)) {
    name = `${name} ${player.usedCityNames.length + 1}`;
  }
  return name;
}
