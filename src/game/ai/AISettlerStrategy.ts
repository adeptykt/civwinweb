import { GameState, Unit, City, Position } from '../../types/game';
import { TechnologyType } from '../TechnologyDefinitions';
import { GameInterface } from './AITypes';
import { getAITraits, moveUnitTowards, exploreRandomly, isAtPosition, getDistance, isTileUnseen } from './AIUtils';
import { findBestCityLocation, isValidCityLocation, evaluateCityLocation } from './AICityPlacementStrategy';

/** AI logic for settler units -- find good city locations or build infrastructure. */
export function handleSettlerAI(unit: Unit, gameState: GameState, game: GameInterface): void {
  // If already building a road or mine, let TurnManager advance the progress.
  // Don't interfere — the unit will finish on its own.
  if (unit.buildingRoad || unit.buildingMine) return;

  const aiTraits = getAITraits(gameState, unit.playerId);
  const shouldPrioritizeInfrastructure = aiTraits.development === 'perfectionist';
  const shouldRushExpansion            = aiTraits.development === 'expansionist';

  const playerCities = gameState.cities.filter(c => c.playerId === unit.playerId);

  // First city: found immediately if the current tile is valid.
  // Classic Civ AI plants the first city right away rather than wandering for
  // a "perfect" spot — wandering risks never settling before the early-game
  // protection expires and the player is eliminated.
  if (playerCities.length === 0) {
    if (isValidCityLocation(unit.position, gameState)) {
      game.foundCity(unit.id);
    } else {
      // Current tile is blocked (e.g. ocean, too close to another city).
      // Look for the nearest valid tile within 1 step and move there.
      const firstCityLocation = findBestAdjacentCityLocation(unit.position, unit.playerId, gameState);
      if (firstCityLocation) {
        moveUnitTowards(unit, firstCityLocation, gameState, game);
      } else {
        exploreRandomly(unit, gameState, game);
      }
    }
    return;
  }

  const isEarlyGame        = gameState.turn <= 30;
  const expansionThreshold = shouldRushExpansion ? 40 : shouldPrioritizeInfrastructure ? 25 : 30;
  const isExpansionPhase   = gameState.turn <= expansionThreshold;

  // ── Pre-expansion high-value infrastructure pass ───────────────────────────
  // Only build improvements at the settler's CURRENT tile — never issue a
  // moveTo here.  Moving to an infrastructure target causes oscillation: the
  // "closest unimproved tile" changes each turn as the settler moves, so it
  // bounces between targets and never reaches the city-founding code below.
  if (!shouldRushExpansion) {
    const veryNearCity = findNearbyCity(unit.position, gameState, unit.playerId, 2);
    if (veryNearCity) {
      const highPrio = findHighPriorityInfraAction(unit, veryNearCity, gameState);
      if (highPrio) {
        if (highPrio.action === 'buildMine')       { buildMineAI(unit, gameState, game);       return; }
        if (highPrio.action === 'buildRoad')       { buildRoadAI(unit, gameState, game);       return; }
        if (highPrio.action === 'buildIrrigation') { buildIrrigationAI(unit, gameState, game); return; }
        // Do NOT handle 'moveTo' — fall through to city-founding logic instead.
      }
    }
  }

  // ── City founding ──────────────────────────────────────────────────────────
  // Threshold for founding at the current tile during a quick scan.
  let cityLocationThreshold = 0;
  if (aiTraits.development === 'perfectionist') cityLocationThreshold = 1;
  else if (aiTraits.development === 'expansionist') cityLocationThreshold = -1;

  // Always try to find a city location first -- don't let infrastructure
  // distract a settler that has somewhere useful to go.
  const bestLocation = findBestCityLocation(unit.position, unit.playerId, gameState, isExpansionPhase, aiTraits);
  if (bestLocation) {
    if (isAtPosition(unit.position, bestLocation)) {
      game.foundCity(unit.id);
    } else {
      moveUnitTowards(unit, bestLocation, gameState, game);
    }
    return;
  }

  // No nearby city location found. If the current tile is valid, found here
  // rather than wandering indefinitely — a city in a mediocre spot beats
  // a settler that never settles.
  if (isValidCityLocation(unit.position, gameState)) {
    const currentScore = evaluateCityLocation(unit.position, gameState);
    if (currentScore > cityLocationThreshold) {
      game.foundCity(unit.id);
      return;
    }
  }

  // ── Infrastructure fallback ────────────────────────────────────────────────
  // No good city location reachable in our immediate radius.
  // Evaluate if we should improve tiles near a city instead of blindly exploring.
  // We avoid Math.random() here because it evaluates every turn and causes
  // the settler to oscillate between infra targets and exploring.
  const nearbyCity = findNearbyCity(unit.position, gameState, unit.playerId, 5);
  let shouldDoInfra = false;

  if (nearbyCity) {
    if (shouldPrioritizeInfrastructure) {
      shouldDoInfra = true;
    } else if (!isExpansionPhase) {
      shouldDoInfra = true;
    } else {
      // During expansion phase for non-perfectionists, if we can't find a local city spot:
      // If our trait is balanced, dedicate ~50% of units to infra.
      // If expansionist, still dedicate ~25% of units to infra.
      // Using unit.id ensures consistent stateless behavior per unit.
      const charCode = unit.id.charCodeAt(unit.id.length - 1);
        if (aiTraits.development === 'normal') {
        shouldDoInfra = (charCode % 2 === 0);
      } else {
        shouldDoInfra = (charCode % 4 === 0);
      }
    }
  }

  if (shouldDoInfra && nearbyCity) {
    const action = findBestInfrastructureAction(unit, nearbyCity, gameState);
    if (action) {
      if (action.action === 'buildMine')       { buildMineAI(unit, gameState, game);       return; }
      if (action.action === 'buildRoad')       { buildRoadAI(unit, gameState, game);       return; }
      if (action.action === 'buildIrrigation') { buildIrrigationAI(unit, gameState, game); return; }
      if (action.action === 'moveTo' && action.target) {
        moveUnitTowards(unit, action.target, gameState, game);
        return;
      }
    }
  }

  // Explore to find new land
  exploreRandomly(unit, gameState, game);
}

/**
 * Scan the current tile plus all 8 immediate neighbours (radius 1).
 * Returns the highest-scoring valid city location, or null if none qualify.
 * Used only for the very first city so the settler never wanders far.
 */
function findBestAdjacentCityLocation(
  pos: Position,
  playerId: string,
  gameState: GameState,
): Position | null {
  const mapWidth  = gameState.worldMap[0]?.length || 80;
  const mapHeight = gameState.worldMap.length || 50;

  let best: Position | null = null;
  let bestScore = -Infinity;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const candidate: Position = {
        x: ((pos.x + dx + mapWidth) % mapWidth),
        y: pos.y + dy,
      };
      if (candidate.y < 0 || candidate.y >= mapHeight) continue;
      if (!isValidCityLocation(candidate, gameState)) continue;
      if (isTileUnseen(candidate, playerId, gameState)) continue;
      const score = evaluateCityLocation(candidate, gameState);
      if (score > bestScore) { bestScore = score; best = candidate; }
    }
  }

  return best;
}

/** Determine the best infrastructure action for a settler near a given city.
 * Priority order (roads/irrigation first — fast & growth-boosting; mines last — slow):
 *   1. Road between this city and the nearest other player city (inter-city network)
 *   2. Road on current tile
 *   3. Irrigation on current tile
 *   4. Road in city radius (radius 2)
 *   5. Irrigation in city radius
 *   6. Mine on current tile (hills/mountains/desert)
 *   7. Mine on a tile in city workzone (radius 2)
 */
export function findBestInfrastructureAction(
  unit: Unit,
  city: City,
  gameState: GameState,
): { action: string; target?: Position } | null {
  const mapWidth  = gameState.worldMap[0]?.length || 80;
  const mapHeight = gameState.worldMap.length || 50;
  const playerCities = gameState.cities.filter(c => c.playerId === unit.playerId);

  const currentTile = gameState.worldMap[unit.position.y]?.[unit.position.x];
  if (!currentTile) return null;

  // 1 ── Road between cities ─────────────────────────────────────────────────
  // Inter-city roads are the highest payoff: they connect the network, speed
  // unit movement and increase trade for Republic/Democracy.
  if (playerCities.length >= 2) {
    const roadTarget = findInterCityRoadTarget(unit, city, playerCities, gameState);
    if (roadTarget) {
      if (isAtPosition(unit.position, roadTarget)) return { action: 'buildRoad' };
      return { action: 'moveTo', target: roadTarget };
    }
  }

  // 2 ── Road on current tile ────────────────────────────────────────────────
  if (!hasRoad(currentTile) && canBuildRoad(currentTile, unit.playerId, gameState)) {
    return { action: 'buildRoad' };
  }

  // 3 ── Irrigation on current tile ──────────────────────────────────────────
  if (!hasIrrigation(currentTile) && canBuildIrrigation(currentTile, unit.position, gameState)) {
    return { action: 'buildIrrigation' };
  }

  // 4 ── Road in city radius (radius 2) ─────────────────────────────────────
  const radius = 2;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const target: Position = {
        x: ((city.position.x + dx) + mapWidth) % mapWidth,
        y: city.position.y + dy,
      };
      if (target.y < 0 || target.y >= mapHeight) continue;
      const tile = gameState.worldMap[target.y]?.[target.x];
      if (!tile) continue;
      if (!hasRoad(tile) && canBuildRoad(tile, unit.playerId, gameState)) return { action: 'moveTo', target };
    }
  }

  // 5 ── Irrigation in city radius ───────────────────────────────────────────
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const target: Position = {
        x: ((city.position.x + dx) + mapWidth) % mapWidth,
        y: city.position.y + dy,
      };
      if (target.y < 0 || target.y >= mapHeight) continue;
      const tile = gameState.worldMap[target.y]?.[target.x];
      if (!tile) continue;
      if (!hasIrrigation(tile) && canBuildIrrigation(tile, target, gameState)) {
        return { action: 'moveTo', target };
      }
    }
  }

  // 6 ── Mine at current tile ─────────────────────────────────────────────────
  if (canBuildMine(currentTile) && !hasMine(currentTile)) {
    return { action: 'buildMine' };
  }

  // 7 ── Mine in city workzone (radius 2) ────────────────────────────────────
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const target: Position = {
        x: ((city.position.x + dx) + mapWidth) % mapWidth,
        y: city.position.y + dy,
      };
      if (target.y < 0 || target.y >= mapHeight) continue;
      const tile = gameState.worldMap[target.y]?.[target.x];
      if (!tile || !canBuildMine(tile) || hasMine(tile)) continue;
      return { action: 'moveTo', target };
    }
  }

  return null;
}

/**
 * Check HIGH-VALUE improvements near a city during the expansion phase.
 * Priority: roads first (1 turn, huge payoff) → irrigation (growth) → mines (production).
 * Used in the pre-expansion pass so settlers improve tiles between city-founding missions.
 */
function findHighPriorityInfraAction(
  unit: Unit,
  nearestCity: City,
  gameState: GameState,
): { action: string; target?: Position } | null {
  const mapWidth  = gameState.worldMap[0]?.length || 80;
  const mapHeight = gameState.worldMap.length || 50;

  const currentTile = gameState.worldMap[unit.position.y]?.[unit.position.x];

  // 1 ── Road at current position (cheapest, 1-2 turns) ─────────────────────
  if (currentTile && canBuildRoad(currentTile, unit.playerId, gameState) && !hasRoad(currentTile)) {
    return { action: 'buildRoad' };
  }

  // 2 ── Irrigation at current position ─────────────────────────────────────
  if (currentTile && canBuildIrrigation(currentTile, unit.position, gameState) && !hasIrrigation(currentTile)) {
    return { action: 'buildIrrigation' };
  }

  // 3 ── Road in city workzone — find the closest unroaded roadable tile ─────
  let bestRoadTarget: Position | null = null;
  let bestRoadDist = Infinity;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const target: Position = {
        x: ((nearestCity.position.x + dx) + mapWidth) % mapWidth,
        y: nearestCity.position.y + dy,
      };
      if (target.y < 0 || target.y >= mapHeight) continue;
      const tile = gameState.worldMap[target.y]?.[target.x];
      if (!tile || !canBuildRoad(tile, unit.playerId, gameState) || hasRoad(tile)) continue;
      const dist = getDistance(unit.position, target);
      if (dist < bestRoadDist) { bestRoadDist = dist; bestRoadTarget = target; }
    }
  }
  if (bestRoadTarget) return { action: 'moveTo', target: bestRoadTarget };

  // 4 ── Irrigation in city workzone ────────────────────────────────────────
  let bestIrrigTarget: Position | null = null;
  let bestIrrigDist = Infinity;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const target: Position = {
        x: ((nearestCity.position.x + dx) + mapWidth) % mapWidth,
        y: nearestCity.position.y + dy,
      };
      if (target.y < 0 || target.y >= mapHeight) continue;
      const tile = gameState.worldMap[target.y]?.[target.x];
      if (!tile || !canBuildIrrigation(tile, target, gameState) || hasIrrigation(tile)) continue;
      const dist = getDistance(unit.position, target);
      if (dist < bestIrrigDist) { bestIrrigDist = dist; bestIrrigTarget = target; }
    }
  }
  if (bestIrrigTarget) return { action: 'moveTo', target: bestIrrigTarget };

  // 5 ── Mine at current position ────────────────────────────────────────────
  if (currentTile && canBuildMine(currentTile) && !hasMine(currentTile)) {
    return { action: 'buildMine' };
  }

  // 6 ── Mine in city workzone — pick the closest one to the settler ─────────
  let bestMineTarget: Position | null = null;
  let bestMineDist = Infinity;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const target: Position = {
        x: ((nearestCity.position.x + dx) + mapWidth) % mapWidth,
        y: nearestCity.position.y + dy,
      };
      if (target.y < 0 || target.y >= mapHeight) continue;
      const tile = gameState.worldMap[target.y]?.[target.x];
      if (!tile || !canBuildMine(tile) || hasMine(tile)) continue;
      const dist = getDistance(unit.position, target);
      if (dist < bestMineDist) { bestMineDist = dist; bestMineTarget = target; }
    }
  }

  if (bestMineTarget) return { action: 'moveTo', target: bestMineTarget };
  return null;
}

/**
 * Find the nearest unroaded tile on the approximate path between homeCity
 * and the closest other player city.  Returns null when all inter-city paths
 * already have roads or there is only one city.
 */
function findInterCityRoadTarget(
  unit: Unit,
  homeCity: City,
  playerCities: City[],
  gameState: GameState,
): Position | null {
  const mapWidth = gameState.worldMap[0]?.length || 80;

  // Find the nearest other city (by distance from homeCity)
  let closestOther: City | null = null;
  let closestDist = Infinity;
  for (const city of playerCities) {
    if (city.id === homeCity.id) continue;
    const dist = getDistance(homeCity.position, city.position);
    if (dist < closestDist) { closestDist = dist; closestOther = city; }
  }
  if (!closestOther) return null;

  // Walk a simplified path and find the nearest unroaded tile to the settler
  const path = getSimplePath(homeCity.position, closestOther.position, mapWidth, gameState);

  let best: Position | null = null;
  let bestDist = Infinity;
  for (const pos of path) {
    if (pos.y < 0 || pos.y >= gameState.worldMap.length) continue;
    const tile = gameState.worldMap[pos.y]?.[pos.x];
    if (!tile || !canBuildRoad(tile, unit.playerId, gameState) || hasRoad(tile)) continue;
    const dist = getDistance(unit.position, pos);
    if (dist < bestDist) { bestDist = dist; best = pos; }
  }

  return best;
}

/**
 * Build a rough step-by-step path (alternating x/y moves) between two positions,
 * respecting horizontal map wrapping.
 */
function getSimplePath(
  from: Position,
  to: Position,
  mapWidth: number,
  gameState: GameState,
): Position[] {
  const path: Position[] = [];
  const mapHeight = gameState.worldMap.length || 50;
  let x = from.x;
  let y = from.y;

  const maxSteps = Math.min(mapWidth + mapHeight, 60);
  for (let step = 0; step < maxSteps && (x !== to.x || y !== to.y); step++) {
    const directDx  = to.x - x;
    const wrappedDx = directDx > 0 ? directDx - mapWidth : directDx + mapWidth;
    const bestDx    = Math.abs(directDx) <= Math.abs(wrappedDx) ? directDx : wrappedDx;
    const dy        = to.y - y;

    // Prefer moving along the axis with the larger remaining distance
    if (bestDx !== 0 && (dy === 0 || Math.abs(bestDx) >= Math.abs(dy))) {
      x = ((x + Math.sign(bestDx)) + mapWidth) % mapWidth;
    } else if (dy !== 0) {
      y = Math.max(0, Math.min(mapHeight - 1, y + Math.sign(dy)));
    }

    path.push({ x, y });
  }

  return path;
}

/** Returns true if a road can be built on the tile. */
export function canBuildRoad(tile: any, playerId?: string, gameState?: GameState): boolean {
  const roadable = ['grassland', 'plains', 'desert', 'hills', 'forest', 'jungle'];
  let isRoadable = roadable.includes(tile.terrain);

  if (tile.terrain === 'river' && playerId && gameState) {
    const player = gameState.players.find(p => p.id === playerId);
    if (player && player.technologies.includes(TechnologyType.BRIDGE_BUILDING)) {
      isRoadable = true;
    }
  }

  return isRoadable;
}

/** Returns true if a mine should be built on the tile (high production value). */
export function canBuildMine(tile: any): boolean {
  return tile.terrain === 'hills' || tile.terrain === 'mountains' || tile.terrain === 'desert';
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
    if (y < 0 || y >= gameState.worldMap.length || x < 0 || x >= (gameState.worldMap[0]?.length || 0)) continue;
    const tile = gameState.worldMap[y]?.[x];
    if (!tile) continue;
    if (tile.terrain === 'river' || tile.terrain === 'ocean') return true;
    if (tile.improvements?.some((i: any) => i.type === 'irrigation')) return true;
  }
  return false;
}

function hasMine(tile: any): boolean {
  return tile.improvements?.some((i: any) => i.type === 'mine') ?? false;
}

function hasRoad(tile: any): boolean {
  // A railroad is a superset of a road — treat both as "roaded" so settlers
  // don't re-target tiles that already have a railroad built on them.
  return tile.improvements?.some((i: any) => i.type === 'road' || i.type === 'railroad') ?? false;
}

function hasIrrigation(tile: any): boolean {
  return tile.improvements?.some((i: any) => i.type === 'irrigation') ?? false;
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

/** Instruct the settler to build a mine at its current position. */
export function buildMineAI(unit: Unit, _gameState: GameState, game?: GameInterface): void {
  if (game) {
    const ok = game.buildMine(unit.id);
    console.log(ok
      ? `AI settler ${unit.id} started mine at (${unit.position.x}, ${unit.position.y})`
      : `AI settler ${unit.id} failed to build mine at (${unit.position.x}, ${unit.position.y})`);
  } else {
    unit.movementPoints = 0;
    console.log(`AI settler ${unit.id} building mine at (${unit.position.x}, ${unit.position.y})`);
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
