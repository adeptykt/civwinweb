/**
 * AINavalStrategy.ts
 *
 * Handles AI logic for naval units (Trireme, Sail, Frigate, Transport, etc.)
 * and the embarkation/disembarkation of land units onto transports.
 */

import { GameState, Unit, Position, UnitType, TerrainType, UnitCategory, VisibilityState } from '../../types/game';
import { getUnitStats } from '../UnitDefinitions';
import { GameInterface } from './AITypes';
import {
  getDistance,
  moveUnitTowards,
  exploreRandomly,
  isTileUnseen,
  isOceanTile,
  isCoastalPosition,
  isMilitaryUnit,
  getValidMoves,
} from './AIUtils';

// ─────────────────────────────────────────────────────────────────────────────
// Naval unit AI
// ─────────────────────────────────────────────────────────────────────────────

/** Main dispatch for all naval units. */
export function handleNavalAI(unit: Unit, gameState: GameState, game?: GameInterface): void {
  if (unit.type === UnitType.TRANSPORT) {
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
 * Returns true if a land unit should try to board a transport.
 * Conditions: unit is on a coastal tile, there is no unexplored land adjacent,
 * and a friendly transport is within range.
 */
export function shouldEmbark(unit: Unit, gameState: GameState): boolean {
  if (!isCoastalPosition(unit.position, gameState)) return false;
  // Don't embark if there's still plenty of unseen land nearby
  const unseenLandNearby = countUnseenLandTilesAround(unit.position, gameState, unit.playerId, 5);
  if (unseenLandNearby > 8) return false;
  const nearbyTransport = findNearbyTransport(unit, gameState);
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
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const other of gameState.units) {
    if (other.playerId === unit.playerId) continue;
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
    if (!isCoastalPosition(city.position, gameState)) continue;
    const d = getDistance(unit.position, city.position);
    const score = 100 - d;
    if (score > bestScore) { bestScore = score; best = city.position; }
  }
  return best;
}

/** Count how many land units are on the same tile as this transport. */
function countPassengers(transport: Unit, gameState: GameState): number {
  return gameState.units.filter(u =>
    u.id !== transport.id &&
    u.playerId === transport.playerId &&
    u.position.x === transport.position.x &&
    u.position.y === transport.position.y &&
    getUnitStats(u.type)?.category === UnitCategory.LAND
  ).length;
}

/**
 * Find the best land tile to head toward for disembarkation:
 * prefers coastal tiles that are unseen or have no nearby friendly cities.
 */
function findBestLandingSpot(transport: Unit, gameState: GameState): Position | null {
  const mapWidth  = gameState.worldMap[0]?.length || 80;
  const mapHeight = gameState.worldMap.length || 50;
  const playerId  = transport.playerId;

  let best: Position | null = null;
  let bestScore = -Infinity;

  // Sample candidate positions across the map
  for (let attempts = 0; attempts < 200; attempts++) {
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
    if (isTileUnseen(pos, playerId, gameState)) score += 30;
    const dist = getDistance(transport.position, pos);
    score -= dist * 0.5;

    if (score > bestScore) { bestScore = score; best = pos; }
  }
  return best;
}

/**
 * Find a nearby friendly land unit that would benefit from being transported
 * (military unit on a coastal tile that has explored most nearby land).
 */
function findUnitToBoard(transport: Unit, gameState: GameState): Unit | null {
  const searchRadius = 6;
  for (const u of gameState.units) {
    if (u.playerId !== transport.playerId) continue;
    const stats = getUnitStats(u.type);
    if (stats?.category !== UnitCategory.LAND) continue;
    if (!isMilitaryUnit(u.type)) continue;
    const d = getDistance(transport.position, u.position);
    if (d > searchRadius) continue;
    // Prefer units on coastal tiles with not much unseen land around them
    if (!isCoastalPosition(u.position, gameState)) continue;
    const unseenNearby = countUnseenLandTilesAround(u.position, gameState, u.playerId, 4);
    if (unseenNearby < 6) return u; // This unit has explored its local area — good candidate
  }
  return null;
}

/** Find a friendly transport within boarding range. */
function findNearbyTransport(unit: Unit, gameState: GameState): Unit | null {
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const u of gameState.units) {
    if (u.playerId !== unit.playerId) continue;
    const stats = getUnitStats(u.type);
    if (!stats?.canCarryUnits || stats.canCarryUnits <= 0) continue;
    const d = getDistance(unit.position, u.position);
    if (d <= 3 && d < bestDist) { bestDist = d; best = u; }
  }
  return best;
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
 * Criteria: has a coastal city, AND there are unexplored ocean areas near it.
 */
export function shouldBuildNavalUnits(playerId: string, gameState: GameState): boolean {
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
  return false;
}

/**
 * Returns true if this player already has enough naval units for its coastal cities.
 */
export function hasEnoughNavalUnits(playerId: string, gameState: GameState): boolean {
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
