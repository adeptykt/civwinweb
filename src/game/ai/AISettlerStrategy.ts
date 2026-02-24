import { GameState, Unit, City, Position, UnitType } from '../../types/game';
import { GameInterface } from './AITypes';
import { getAITraits, moveUnitTowards, exploreRandomly, isAtPosition } from './AIUtils';
import { findBestCityLocation, isValidCityLocation, evaluateCityLocation } from './AICityPlacementStrategy';

/** AI logic for settler units — find good city locations or build infrastructure. */
export function handleSettlerAI(unit: Unit, gameState: GameState, game: GameInterface): void {
  const aiTraits = getAITraits(gameState, unit.playerId);
  const shouldPrioritizeInfrastructure = aiTraits.development === 'perfectionist';
  const shouldRushExpansion            = aiTraits.development === 'expansionist';

  const nearbyCity = findNearbyCity(unit.position, gameState, unit.playerId, 3);
  if (nearbyCity && (shouldPrioritizeInfrastructure || Math.random() < 0.5)) {
    const action = findBestInfrastructureAction(unit, nearbyCity, gameState);
    if (action) {
      if (action.action === 'buildRoad') {
        console.log(`AI settler ${unit.id} building road at`, unit.position);
        buildRoadAI(unit, gameState, game);
        return;
      }
      if (action.action === 'buildIrrigation') {
        console.log(`AI settler ${unit.id} building irrigation at`, unit.position);
        buildIrrigationAI(unit, gameState, game);
        return;
      }
      if (action.action === 'moveTo' && action.target) {
        console.log(`AI settler ${unit.id} moving to build infrastructure at`, action.target);
        moveUnitTowards(unit, action.target, gameState, game);
        return;
      }
    }
  }

  const isEarlyGame        = gameState.turn <= 10;
  const expansionThreshold = shouldRushExpansion ? 15 : 10;
  const isExpansionPhase   = gameState.turn <= expansionThreshold;

  let cityLocationThreshold = 1;
  if (aiTraits.development === 'perfectionist') cityLocationThreshold = 3;
  else if (aiTraits.development === 'expansionist') cityLocationThreshold = 0.5;

  if ((isEarlyGame || shouldRushExpansion) && isValidCityLocation(unit.position, gameState)) {
    const currentScore = evaluateCityLocation(unit.position, gameState);
    if (currentScore > cityLocationThreshold) {
      game.foundCity(unit.id);
      return;
    }
  }

  const bestLocation = findBestCityLocation(unit.position, gameState, isExpansionPhase, aiTraits);
  if (bestLocation) {
    if (isAtPosition(unit.position, bestLocation)) {
      game.foundCity(unit.id);
    } else {
      moveUnitTowards(unit, bestLocation, gameState, game);
    }
  } else {
    if (isEarlyGame && isValidCityLocation(unit.position, gameState)) {
      game.foundCity(unit.id);
    } else {
      exploreRandomly(unit, gameState, game);
    }
  }
}

/** Find a nearby city belonging to the specified player within maxDistance tiles. */
export function findNearbyCity(
  position: Position,
  gameState: GameState,
  playerId: string,
  maxDistance: number,
): City | null {
  const mapWidth = gameState.worldMap[0]?.length || 80;
  for (const city of gameState.cities.filter(c => c.playerId === playerId)) {
    const directDx  = Math.abs(position.x - city.position.x);
    const wrappedDx = mapWidth - directDx;
    const dx        = Math.min(directDx, wrappedDx);
    const dy        = Math.abs(position.y - city.position.y);
    if (dx + dy <= maxDistance) return city;
  }
  return null;
}

/** Determine the best infrastructure action for a settler near a given city. */
export function findBestInfrastructureAction(
  unit: Unit,
  city: City,
  gameState: GameState,
): { action: string; target?: Position } | null {
  const currentTile = gameState.worldMap[unit.position.y]?.[unit.position.x];
  if (!currentTile) return null;

  if (!currentTile.improvements?.some(i => i.type === 'road') && canBuildRoad(currentTile)) {
    return { action: 'buildRoad' };
  }
  if (!currentTile.improvements?.some(i => i.type === 'irrigation') &&
    canBuildIrrigation(currentTile, unit.position, gameState)) {
    return { action: 'buildIrrigation' };
  }

  const radius = 2;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const target = { x: city.position.x + dx, y: city.position.y + dy };
      if (target.y < 0 || target.y >= gameState.worldMap.length ||
        target.x < 0 || target.x >= gameState.worldMap[0].length) continue;
      const tile = gameState.worldMap[target.y][target.x];
      if (!tile.improvements?.some(i => i.type === 'road') && canBuildRoad(tile)) {
        return { action: 'moveTo', target };
      }
    }
  }
  return null;
}

/** Returns true if a road can be built on the tile. */
export function canBuildRoad(tile: any): boolean {
  const roadable = ['grassland', 'plains', 'desert', 'hills', 'forest', 'jungle'];
  return roadable.includes(tile.terrain);
}

/** Returns true if irrigation can be built on the tile (requires water access). */
export function canBuildIrrigation(tile: any, position: Position, gameState: GameState): boolean {
  const irrigatable = ['desert', 'grassland', 'hills', 'plains'];
  return irrigatable.includes(tile.terrain) && hasWaterAccess(position, gameState);
}

/** Returns true if the position has adjacent water (river, ocean, or irrigated tile). */
export function hasWaterAccess(position: Position, gameState: GameState): boolean {
  for (const { dx, dy } of [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }]) {
    const x = position.x + dx;
    const y = position.y + dy;
    if (y < 0 || y >= gameState.worldMap.length || x < 0 || x >= gameState.worldMap[0].length) continue;
    const tile = gameState.worldMap[y][x];
    if (tile.terrain === 'river' || tile.terrain === 'ocean') return true;
    if (tile.improvements?.some((i: any) => i.type === 'irrigation')) return true;
  }
  return false;
}

/** Instruct the settler to build a road at its current position. */
export function buildRoadAI(unit: Unit, _gameState: GameState, game?: GameInterface): void {
  if (game) {
    const ok = game.buildRoad(unit.id);
    console.log(ok
      ? `AI settler ${unit.id} built road at (${unit.position.x}, ${unit.position.y})`
      : `AI settler ${unit.id} failed to build road at (${unit.position.x}, ${unit.position.y})`);
  } else {
    unit.movementPoints = 0;
    console.log(`AI settler ${unit.id} building road at (${unit.position.x}, ${unit.position.y})`);
  }
}

/** Instruct the settler to build irrigation at its current position. */
export function buildIrrigationAI(unit: Unit, _gameState: GameState, game?: GameInterface): void {
  if (game) {
    const ok = game.buildIrrigation(unit.id);
    console.log(ok
      ? `AI settler ${unit.id} built irrigation at (${unit.position.x}, ${unit.position.y})`
      : `AI settler ${unit.id} failed to build irrigation at (${unit.position.x}, ${unit.position.y})`);
  } else {
    unit.movementPoints = 0;
    console.log(`AI settler ${unit.id} building irrigation at (${unit.position.x}, ${unit.position.y})`);
  }
}
