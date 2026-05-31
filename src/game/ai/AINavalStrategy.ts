/**
 * AINavalStrategy.ts
 *
 * Handles AI logic for naval units (Trireme, Sail, Frigate, Transport, etc.)
 * and the embarkation/disembarkation of land units onto transports.
 */

import { GameState, Unit, Position, UnitType, TerrainType, UnitCategory, VisibilityState, TechnologyType } from '../../types/game';
import { getUnitStats } from '../UnitDefinitions';
import { GameInterface } from './AITypes';
import { VisibilitySystem } from '../VisibilitySystem';
import {
  getDistance,
  moveUnitTowards,
  exploreRandomly,
  isTileUnseen,
  isOceanTile,
  isCoastalPosition,
  isMilitaryUnit,
  getValidMoves,
  getTileVisibility,
  getUnitAtKey,
} from './AIUtils';
import { isValidCityLocation, evaluateCityLocation } from './AICityPlacementStrategy';

// ─────────────────────────────────────────────────────────────────────────────
// Turn-scoped caches – automatically invalidated when the turn number changes.
// These prevent repeating expensive BFS / sampling work for each unit in one turn.
// ─────────────────────────────────────────────────────────────────────────────

const _islandLockedCache = new Map<string, boolean>();
let   _islandLockedTurn  = -1;

const _landingSpotCache = new Map<string, Position | null>();
let   _landingSpotTurn  = -1;

const _passengerCountCache = new Map<string, number>();
let   _passengerCountTurn  = -1;

// ─────────────────────────────────────────────────────────────────────────────
// Naval unit AI
// ─────────────────────────────────────────────────────────────────────────────

/** Main dispatch for all naval units. */
export function handleNavalAI(unit: Unit, gameState: GameState, game?: GameInterface): void {
  const stats = getUnitStats(unit.type);
  const isCarryCapable = (stats?.canCarryUnits ?? 0) > 0;
  // Any carry-capable ship with passengers aboard acts as a transport — route to
  // transport AI so it actively seeks a landing spot rather than patrolling.
  if (unit.type === UnitType.TRANSPORT || (isCarryCapable && countPassengers(unit, gameState) > 0)) {
    handleTransportAI(unit, gameState, game);
  } else {
    handleWarshipAI(unit, gameState, game);
  }
}

/** AI for combat naval units — patrol, attack enemy ships / bombard cities. */
function handleWarshipAI(unit: Unit, gameState: GameState, game?: GameInterface): void {
  // Prioritise attacking nearby enemy ships
  const nearestEnemyShip = findNearestEnemyNavalUnit(unit, gameState);
  if (nearestEnemyShip && getDistance(unit.position, nearestEnemyShip.position) <= 6) {
    moveUnitTowards(unit, nearestEnemyShip.position, gameState, game);
    return;
  }

  // Try to find an undefended enemy coastal city to bombard
  const coastalTarget = findEnemyCoastalCity(unit, gameState);
  if (coastalTarget) {
    moveUnitTowards(unit, coastalTarget, gameState, game);
    return;
  }

  // Otherwise explore ocean (prefer unseen ocean tiles)
  exploreOcean(unit, gameState, game);
}

/** AI for transport ships — pick up land units and ferry them to new continents. */
function handleTransportAI(unit: Unit, gameState: GameState, game?: GameInterface): void {
  // If we have passengers on board, head for an unexplored coast to disembark
  const cargoCount = countPassengers(unit, gameState);
  if (cargoCount > 0) {
    const landingSpot = findBestLandingSpot(unit, gameState);
    if (landingSpot) {
      moveUnitTowards(unit, landingSpot, gameState, game);
      return;
    }
    // No good landing spot found — explore ocean until we find one
    exploreOcean(unit, gameState, game);
    return;
  }

  // Find a nearby friendly land unit that wants to board
  const stats = getUnitStats(unit.type);
  const capacity = stats?.canCarryUnits ?? 0;
  if (capacity > 0) {
    const boarder = findUnitToBoard(unit, gameState);
    if (boarder) {
      moveUnitTowards(unit, boarder.position, gameState, game);
      return;
    }
  }

  // No one to carry — explore along the coast
  exploreOcean(unit, gameState, game);
}

// ─────────────────────────────────────────────────────────────────────────────
// Embarkation helpers (called from land-unit AI)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if a military unit should try to board a transport.
 * Conditions: unit is on a coastal tile, there is no unexplored land adjacent,
 * and a friendly transport is within range.
 */
export function shouldEmbark(unit: Unit, gameState: GameState): boolean {
  if (!isCoastalPosition(unit.position, gameState)) return false;
  // Don't embark if there's still plenty of unseen land nearby
  const unseenLandNearby = countUnseenLandTilesAround(unit.position, gameState, unit.playerId, 5);
  if (unseenLandNearby > 8) return false;
  const nearbyTransport = findNearbyTransport(unit, gameState, 5);
  return nearbyTransport !== null;
}

/**
 * Returns true if a settler should board a transport rather than wandering.
 * Triggers when the civ is island-locked (too few good land city spots remain)
 * and a carry-capable ship is nearby.
 */
export function shouldEmbarkSettler(unit: Unit, gameState: GameState): boolean {
  if (!isCoastalPosition(unit.position, gameState)) return false;
  if (!isIslandLocked(unit.playerId, gameState)) return false;
  const nearbyTransport = findNearbyTransport(unit, gameState, 6);
  return nearbyTransport !== null;
}

/**
 * Move a land unit toward a nearby transport so it can board.
 * Returns true if an action was taken.
 */
export function handleEmbarkation(unit: Unit, gameState: GameState, game?: GameInterface): boolean {
  const transport = findNearbyTransport(unit, gameState);
  if (!transport) return false;
  moveUnitTowards(unit, transport.position, gameState, game);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function findNearestEnemyNavalUnit(unit: Unit, gameState: GameState): Unit | null {
  // Iterate only the tiles currently in the player's line-of-sight.
  // Each key lookup into the position index is O(1), so the total cost
  // is O(visible_tiles) — independent of how many units exist in the game.
  const visibleKeys = VisibilitySystem.getVisibleKeys(unit.playerId);
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const key of visibleKeys) {
    const other = getUnitAtKey(key, gameState);
    if (!other || other.playerId === unit.playerId) continue;
    const stats = getUnitStats(other.type);
    if (stats?.category !== UnitCategory.NAVAL) continue;
    const d = getDistance(unit.position, other.position);
    if (d < bestDist) { bestDist = d; best = other; }
  }
  return best;
}

function findEnemyCoastalCity(unit: Unit, gameState: GameState): Position | null {
  let best: Position | null = null;
  let bestScore = -Infinity;
  for (const city of gameState.cities) {
    if (city.playerId === unit.playerId) continue;
    if (isTileUnseen(city.position, unit.playerId, gameState)) continue;
    if (!isCoastalPosition(city.position, gameState)) continue;
    const d = getDistance(unit.position, city.position);
    const score = 100 - d;
    if (score > bestScore) { bestScore = score; best = city.position; }
  }
  return best;
}

/** Count how many land units are on the same tile as this transport (cached per turn). */
function countPassengers(transport: Unit, gameState: GameState): number {
  if (_passengerCountTurn !== gameState.turn) {
    _passengerCountCache.clear();
    _passengerCountTurn = gameState.turn;
  }
  if (_passengerCountCache.has(transport.id)) return _passengerCountCache.get(transport.id)!;
  const count = gameState.units.filter(u =>
    u.id !== transport.id &&
    u.playerId === transport.playerId &&
    u.position.x === transport.position.x &&
    u.position.y === transport.position.y &&
    getUnitStats(u.type)?.category === UnitCategory.LAND
  ).length;
  _passengerCountCache.set(transport.id, count);
  return count;
}

/**
 * Find the best land tile to head toward for disembarkation.
 * - When carrying settlers: prefer coastal tiles adjacent to high-quality city spots.
 * - When carrying military only: prefer unseen coastal areas far from own cities.
 */
function findBestLandingSpot(transport: Unit, gameState: GameState): Position | null {
  if (_landingSpotTurn !== gameState.turn) {
    _landingSpotCache.clear();
    _landingSpotTurn = gameState.turn;
  }
  if (_landingSpotCache.has(transport.id)) return _landingSpotCache.get(transport.id)!;

  const mapWidth  = gameState.worldMap[0]?.length || 80;
  const mapHeight = gameState.worldMap.length || 50;
  const playerId  = transport.playerId;
  const carryingSettler = hasSettlerPassenger(transport, gameState);

  let best: Position | null = null;
  let bestScore = -Infinity;

  // Sample candidate positions across the map (80 samples is sufficient for path-finding)
  for (let attempts = 0; attempts < 80; attempts++) {
    const x = Math.floor(Math.random() * mapWidth);
    const y = Math.floor(Math.random() * mapHeight);
    const tile = gameState.worldMap[y]?.[x];
    if (!tile || tile.terrain === TerrainType.OCEAN) continue;
    const pos = { x, y };
    if (!isCoastalPosition(pos, gameState)) continue;

    // Check that it's not too close to our own cities
    const nearestOwn = gameState.cities.filter(c => c.playerId === playerId)
      .reduce((min, c) => Math.min(min, getDistance(pos, c.position)), Infinity);
    if (nearestOwn < 5) continue;

    let score = 0;
    if (carryingSettler) {
      // Score by city-founding potential of this tile and its immediate neighbours
      let bestCityScore = isValidCityLocation(pos, gameState)
        ? evaluateCityLocation(pos, gameState)
        : 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = ((pos.x + dx + mapWidth) % mapWidth);
          const ny = pos.y + dy;
          if (ny < 0 || ny >= mapHeight) continue;
          if (isValidCityLocation({ x: nx, y: ny }, gameState)) {
            const s = evaluateCityLocation({ x: nx, y: ny }, gameState);
            if (s > bestCityScore) bestCityScore = s;
          }
        }
      }
      score += bestCityScore * 3; // City quality is the primary driver
    } else {
      if (isTileUnseen(pos, playerId, gameState)) score += 30;
    }
    score -= getDistance(transport.position, pos) * 0.5;

    if (score > bestScore) { bestScore = score; best = pos; }
  }
  _landingSpotCache.set(transport.id, best);
  return best;
}

/**
 * Find a nearby friendly land unit that wants to board.
 * Priority 1 — settlers when the civ is island-locked (primary mission: overseas expansion).
 * Priority 2 — military units that have already explored their local area.
 */
function findUnitToBoard(transport: Unit, gameState: GameState): Unit | null {
  const searchRadius = 7;
  const civIslandLocked = isIslandLocked(transport.playerId, gameState);

  // Priority 1: settlers ready to expand overseas
  if (civIslandLocked) {
    for (const u of gameState.units) {
      if (u.playerId !== transport.playerId) continue;
      if (u.type !== UnitType.SETTLERS) continue;
      const d = getDistance(transport.position, u.position);
      if (d > searchRadius) continue;
      if (!isCoastalPosition(u.position, gameState)) continue;
      return u;
    }
  }

  // Priority 2: military units that have explored most nearby land
  for (const u of gameState.units) {
    if (u.playerId !== transport.playerId) continue;
    const stats = getUnitStats(u.type);
    if (stats?.category !== UnitCategory.LAND) continue;
    if (!isMilitaryUnit(u.type)) continue;
    const d = getDistance(transport.position, u.position);
    if (d > searchRadius) continue;
    if (!isCoastalPosition(u.position, gameState)) continue;
    const unseenNearby = countUnseenLandTilesAround(u.position, gameState, u.playerId, 4);
    if (unseenNearby < 6) return u;
  }
  return null;
}

/** Find a friendly carry-capable ship within boarding range (default radius 3). */
function findNearbyTransport(unit: Unit, gameState: GameState, radius = 3): Unit | null {
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const u of gameState.units) {
    if (u.playerId !== unit.playerId) continue;
    const stats = getUnitStats(u.type);
    if (!stats?.canCarryUnits || stats.canCarryUnits <= 0) continue;
    const d = getDistance(unit.position, u.position);
    if (d <= radius && d < bestDist) { bestDist = d; best = u; }
  }
  return best;
}

/** Returns true if the transport has a settler unit as a passenger. */
function hasSettlerPassenger(transport: Unit, gameState: GameState): boolean {
  return gameState.units.some(u =>
    u.id !== transport.id &&
    u.playerId === transport.playerId &&
    u.position.x === transport.position.x &&
    u.position.y === transport.position.y &&
    u.type === UnitType.SETTLERS
  );
}

/**
 * Returns true if a player is island-locked — their landmass has fewer than 3
 * valid city-founding spots reachable overland from existing cities.
 * Uses a BFS over land tiles to detect small islands and peninsulas.
 */
export function isIslandLocked(playerId: string, gameState: GameState): boolean {
  if (_islandLockedTurn !== gameState.turn) {
    _islandLockedCache.clear();
    _islandLockedTurn = gameState.turn;
  }
  if (_islandLockedCache.has(playerId)) return _islandLockedCache.get(playerId)!;

  const playerCities = gameState.cities.filter(c => c.playerId === playerId);
  if (playerCities.length === 0) {
    _islandLockedCache.set(playerId, false);
    return false;
  }

  const mapWidth  = gameState.worldMap[0]?.length || 80;
  const mapHeight = gameState.worldMap.length || 50;
  const MAX_DEPTH = 12;

  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number; depth: number }> = [];

  for (const city of playerCities) {
    const key = `${city.position.x},${city.position.y}`;
    if (!visited.has(key)) {
      visited.add(key);
      queue.push({ x: city.position.x, y: city.position.y, depth: 0 });
    }
  }

  let goodSpotsFound = 0;
  let idx = 0;
  while (idx < queue.length) {
    const { x, y, depth } = queue[idx++];
    if (depth >= MAX_DEPTH) continue;
    for (const [ddx, ddy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = ((x + ddx + mapWidth) % mapWidth);
      const ny = y + ddy;
      if (ny < 0 || ny >= mapHeight) continue;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const tile = gameState.worldMap[ny]?.[nx];
      if (!tile || tile.terrain === TerrainType.OCEAN) continue; // don't cross ocean
      queue.push({ x: nx, y: ny, depth: depth + 1 });
      if (isValidCityLocation({ x: nx, y: ny }, gameState)) {
        goodSpotsFound++;
        if (goodSpotsFound >= 3) return false; // Enough land options — not locked
      }
    }
  }
  const result = goodSpotsFound < 3;
  _islandLockedCache.set(playerId, result);
  return result;
}

/**
 * Returns true if this player needs to build a transport to expand overseas.
 * Criteria: island-locked, has at least one coastal city, and has no carry-capable ship yet.
 */
export function needsTransportForExpansion(playerId: string, gameState: GameState): boolean {
  if (!isIslandLocked(playerId, gameState)) return false;
  const playerUnits = gameState.units.filter(u => u.playerId === playerId);
  const hasTransport = playerUnits.some(u => (getUnitStats(u.type)?.canCarryUnits ?? 0) > 0);
  if (hasTransport) return false;
  return gameState.cities.some(c => c.playerId === playerId && isCoastalPosition(c.position, gameState));
}

/** Count unseen passable (non-ocean) tiles around a position within radius. */
function countUnseenLandTilesAround(
  pos: Position,
  gameState: GameState,
  playerId: string,
  radius: number,
): number {
  const mapWidth  = gameState.worldMap[0]?.length || 80;
  const mapHeight = gameState.worldMap.length || 50;
  let count = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = ((pos.x + dx + mapWidth) % mapWidth);
      const ny = pos.y + dy;
      if (ny < 0 || ny >= mapHeight) continue;
      const tile = gameState.worldMap[ny]?.[nx];
      if (!tile || tile.terrain === TerrainType.OCEAN) continue;
      if (isTileUnseen({ x: nx, y: ny }, playerId, gameState)) count++;
    }
  }
  return count;
}

/** Explore ocean tiles, preferring unseen ones. */
function exploreOcean(unit: Unit, gameState: GameState, game?: GameInterface): void {
  exploreRandomly(unit, gameState, game); // exploreRandomly already handles naval flag via unit stats
}

// ─────────────────────────────────────────────────────────────────────────────
// Production helpers (used by AIProductionStrategy)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if this player should be building naval units right now.
 * Criteria:
 *  - Has a coastal city with unseen ocean tiles nearby (exploration), OR
 *  - Is island-locked with no carry-capable ship yet (transport for expansion).
 */
export function shouldBuildNavalUnits(playerId: string, gameState: GameState): boolean {
  const player = gameState.players.find(p => p.id === playerId);
  // Require at least Map Making to build any naval unit — no point assigning one
  // if the player can't actually produce it, which causes an infinite warn/clear loop.
  if (!player || !player.technologies.includes(TechnologyType.MAPMAKING as any)) {
    return false;
  }
  const playerCities = gameState.cities.filter(c => c.playerId === playerId);
  for (const city of playerCities) {
    if (!isCoastalPosition(city.position, gameState)) continue;
    // Check if there are unseen tiles in the nearby ocean
    const mapWidth  = gameState.worldMap[0]?.length || 80;
    const mapHeight = gameState.worldMap.length || 50;
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const nx = ((city.position.x + dx + mapWidth) % mapWidth);
        const ny = city.position.y + dy;
        if (ny < 0 || ny >= mapHeight) continue;
        const tile = gameState.worldMap[ny]?.[nx];
        if (tile?.terrain === TerrainType.OCEAN && isTileUnseen({ x: nx, y: ny }, playerId, gameState)) {
          return true;
        }
      }
    }
  }
  // Also build when island-locked and no transport exists yet
  return needsTransportForExpansion(playerId, gameState);
}

/**
 * Returns true if this player already has enough naval units for its coastal cities.
 * Always returns false when the civ needs a transport to expand overseas.
 */
export function hasEnoughNavalUnits(playerId: string, gameState: GameState): boolean {
  // Always want a transport when island-locked and none exists yet
  if (needsTransportForExpansion(playerId, gameState)) return false;
  const playerUnits  = gameState.units.filter(u => u.playerId === playerId);
  const navalCount   = playerUnits.filter(u => getUnitStats(u.type)?.category === UnitCategory.NAVAL).length;
  const coastalCities = gameState.cities.filter(c =>
    c.playerId === playerId && isCoastalPosition(c.position, gameState)
  ).length;
  // One naval unit per coastal city is plenty at first
  return navalCount >= coastalCities;
}

/** Best naval unit to build given available technologies. */
export function getBestNavalUnit(
  playerId: string,
  gameState: GameState,
  purpose: 'transport' | 'combat' | 'exploration',
): UnitType {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return UnitType.TRIREME;

  const techs = player.technologies as string[];

  if (purpose === 'transport') {
    // Prefer dedicated transports, fall back to carry-capable ships
    if (techs.includes('industrialization')) return UnitType.TRANSPORT;
    if (techs.includes('magnetism'))         return UnitType.FRIGATE;
    if (techs.includes('navigation'))        return (UnitType as any).SAIL ?? UnitType.TRIREME;
    return UnitType.TRIREME;
  }

  if (purpose === 'combat') {
    if (techs.includes('mass_production'))   return UnitType.SUBMARINE;
    if (techs.includes('steel'))             return UnitType.BATTLESHIP;
    if (techs.includes('combustion'))        return (UnitType as any).CRUISER ?? UnitType.FRIGATE;
    if (techs.includes('steam_engine'))      return (UnitType as any).IRONCLAD ?? UnitType.FRIGATE;
    if (techs.includes('magnetism'))         return UnitType.FRIGATE;
    if (techs.includes('navigation'))        return (UnitType as any).SAIL ?? UnitType.TRIREME;
    return UnitType.TRIREME;
  }

  // exploration
  if (techs.includes('navigation'))  return (UnitType as any).SAIL ?? UnitType.TRIREME;
  return UnitType.TRIREME;
}
