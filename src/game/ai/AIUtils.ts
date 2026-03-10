import { GameState, Unit, City, Position, UnitType, TerrainType, VisibilityState, UnitCategory } from '../../types/game';
import { getCivilization } from '../CivilizationDefinitions';
import { TerrainManager } from '../../terrain/index';
import { getUnitStats } from '../UnitDefinitions';
import type { AITraits, AggressionLevel, DevelopmentStyle, MilitarismLevel } from '../CivilizationDefinitions';
import type { GameInterface } from './AITypes';
import { findPath } from '../../utils/Pathfinder';

// ─── Trait helpers ───────────────────────────────────────────────────────────

export function getAITraits(gameState: GameState, playerId: string): AITraits {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) {
    return {
      aggression: 'normal' as AggressionLevel,
      development: 'normal' as DevelopmentStyle,
      militarism: 'normal' as MilitarismLevel,
    };
  }
  return getCivilization(player.civilizationType).aiTraits;
}

export function getAggressivenessScore(traits: AITraits): number {
  let score = 0;
  switch (traits.aggression) {
    case 'friendly':   score -= 2; break;
    case 'aggressive': score += 2; break;
  }
  switch (traits.development) {
    case 'perfectionist': score -= 1; break;
    case 'expansionist':  score += 1; break;
  }
  switch (traits.militarism) {
    case 'civilized':    score -= 1; break;
    case 'militaristic': score += 2; break;
  }
  return score;
}

// ─── Position / map utilities ────────────────────────────────────────────────

export function getDistance(pos1: Position, pos2: Position): number {
  const mapWidth = 80; // Standard world width with wrapping
  const directDx = Math.abs(pos1.x - pos2.x);
  const wrappedDx = mapWidth - directDx;
  const dx = Math.min(directDx, wrappedDx);
  const dy = Math.abs(pos1.y - pos2.y);
  return dx + dy;
}

export function getChebyshevDistance(pos1: Position, pos2: Position, mapWidth: number = 80): number {
  const directDx = Math.abs(pos1.x - pos2.x);
  const wrappedDx = mapWidth - directDx;
  const dx = Math.min(directDx, wrappedDx);
  const dy = Math.abs(pos1.y - pos2.y);
  return Math.max(dx, dy);
}

export function isAtPosition(pos1: Position, pos2: Position): boolean {
  return pos1.x === pos2.x && pos1.y === pos2.y;
}

export function isValidPosition(position: Position, gameState: GameState): boolean {
  const mapWidth  = gameState.worldMap[0]?.length || 80;
  const mapHeight = gameState.worldMap.length    || 50;
  let { x, y } = position;
  x = ((x % mapWidth) + mapWidth) % mapWidth;
  if (y < 0 || y >= mapHeight) return false;
  const tile = gameState.worldMap[y]?.[x];
  if (!tile) return false;
  if (tile.terrain === TerrainType.OCEAN) return false;
  return TerrainManager.isPassable(tile.terrain);
}

export function isValidNavalPosition(position: Position, gameState: GameState): boolean {
  const mapWidth  = gameState.worldMap[0]?.length || 80;
  const mapHeight = gameState.worldMap.length    || 50;
  let { x, y } = position;
  x = ((x % mapWidth) + mapWidth) % mapWidth;
  if (y < 0 || y >= mapHeight) return false;
  const tile = gameState.worldMap[y]?.[x];
  if (!tile) return false;
  
  if (tile.terrain === TerrainType.OCEAN) return true;
  
  // Naval units can only enter land if there is a coastal city there
  const city = gameState.cities.find(c => c.position.x === x && c.position.y === y);
  if (city) {
    return isCoastalPosition({x, y}, gameState);
  }
  return false;
}

export function getValidMoves(position: Position, gameState: GameState, naval = false): Position[] {
  const directions = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],          [1,  0],
    [-1,  1], [0,  1], [1,  1],
  ] as const;
  const mapWidth = gameState.worldMap[0]?.length || 80;
  return directions
    .map(([dx, dy]) => ({
      x: ((position.x + dx + mapWidth) % mapWidth),
      y: position.y + dy,
    }))
    .filter(pos => naval ? isValidNavalPosition(pos, gameState) : isValidPosition(pos, gameState));
}

/** Return whether a tile is ocean. */
export function isOceanTile(position: Position, gameState: GameState): boolean {
  const tile = gameState.worldMap[position.y]?.[position.x];
  return tile?.terrain === TerrainType.OCEAN;
}

/** Return whether this position is on land adjacent to ocean (coastal). */
export function isCoastalPosition(position: Position, gameState: GameState): boolean {
  const tile = gameState.worldMap[position.y]?.[position.x];
  if (!tile || tile.terrain === TerrainType.OCEAN) return false;
  const directions = [[-1,0],[1,0],[0,-1],[0,1]] as const;
  const mapWidth = gameState.worldMap[0]?.length || 80;
  for (const [dx, dy] of directions) {
    const nx = ((position.x + dx + mapWidth) % mapWidth);
    const ny = position.y + dy;
    const neighbour = gameState.worldMap[ny]?.[nx];
    if (neighbour?.terrain === TerrainType.OCEAN) return true;
  }
  return false;
}

/** Return whether a city is coastal (has ocean within 1 tile). */
export function isCityCoastal(city: City, gameState: GameState): boolean {
  return isCoastalPosition(city.position, gameState);
}

/** Return the current visibility state for a tile, defaulting to UNSEEN. */
export function getTileVisibility(position: Position, playerId: string, gameState: GameState): VisibilityState {
  const visMap = gameState.visibility?.get(playerId);
  if (!visMap) return VisibilityState.UNSEEN;
  return visMap.tiles[position.y]?.[position.x] ?? VisibilityState.UNSEEN;
}

/** Check if a tile has never been seen by this player. */
export function isTileUnseen(position: Position, playerId: string, gameState: GameState): boolean {
  return getTileVisibility(position, playerId, gameState) === VisibilityState.UNSEEN;
}

// ─── Unit classification ─────────────────────────────────────────────────────

export function isMilitaryUnit(unitType: UnitType): boolean {
  const militaryTypes: UnitType[] = [
    UnitType.MILITIA,   UnitType.WARRIOR,   UnitType.PHALANX,  UnitType.LEGION,
    UnitType.KNIGHTS,   UnitType.MUSKETEERS, UnitType.RIFLEMEN, UnitType.ARTILLERY,
    UnitType.ARMOR,     UnitType.MECH_INF,  UnitType.CAVALRY,  UnitType.CHARIOT,
    UnitType.CATAPULT,  UnitType.CANNON,
  ];
  return militaryTypes.includes(unitType);
}

// ─── Shared turn-scoped unit position index ──────────────────────────────────
// Maps "x,y" → Unit for every unit in the game.  Rebuilt once on first access
// each turn, then shared across all AI modules that import getUnitAtKey.

const _sharedUnitPosIndex = new Map<string, Unit>();
let   _sharedUnitPosIndexTurn = -1;

/**
 * Return the unit at tile key "x,y" (if any), using a turn-scoped cache.
 * O(N units) to build once per turn; O(1) per lookup thereafter.
 */
export function getUnitAtKey(key: string, gameState: GameState): Unit | undefined {
  if (_sharedUnitPosIndexTurn !== gameState.turn) {
    _sharedUnitPosIndex.clear();
    for (const u of gameState.units) {
      _sharedUnitPosIndex.set(`${u.position.x},${u.position.y}`, u);
    }
    _sharedUnitPosIndexTurn = gameState.turn;
  }
  return _sharedUnitPosIndex.get(key);
}

// ─── Shared city lookup ───────────────────────────────────────────────────────

export function findNearestCityAny(position: Position, gameState: GameState): City | null {
  let nearest: City | null = null;
  let minDist = Infinity;
  for (const city of gameState.cities) {
    const d = getDistance(position, city.position);
    if (d < minDist) { minDist = d; nearest = city; }
  }
  return nearest;
}

// ─── Shared unit movement ────────────────────────────────────────────────────

export function moveUnitTowards(
  unit: Unit,
  target: Position,
  gameState: GameState,
  game?: GameInterface,
): void {
  if (unit.movementPoints <= 0) return;
  const unitStats = getUnitStats(unit.type);
  const naval = unitStats?.category === UnitCategory.NAVAL;

  // ── A* first step ─────────────────────────────────────────────────────────
  // Use the terrain-aware pathfinder so land units navigate around oceans and
  // naval units navigate around land, rather than the greedy approach that
  // gets stuck in local minima (e.g. a peninsula blocking the crow-flies route).
  const path = findPath(unit, target, gameState);
  if (path !== null) {
    if (path.length === 0) return; // Already at destination
    if (executeMove(unit, path[0], game)) return;
    // First A* step was blocked (e.g. enemy just moved there); fall through to greedy.
  }

  // ── Greedy fallback ────────────────────────────────────────────────────────
  // Used when A* returns null (destination unreachable / iteration cap hit) or
  // the computed first step was blocked by a unit this turn.
  const possibleMoves = getValidMoves(unit.position, gameState, naval);
  if (possibleMoves.length === 0) return;

  const triedMoves = new Set<string>();

  // Small randomness so units don't deadlock on identical-distance moves
  const randomnessChance = unit.type === UnitType.SETTLERS ? 0.15 : 0.05;
  if (Math.random() < randomnessChance) {
    const sortedRandomMoves = [...possibleMoves].sort(() => Math.random() - 0.5);
    for (const randomMove of sortedRandomMoves) {
      if (executeMove(unit, randomMove, game)) return;
      triedMoves.add(`${randomMove.x},${randomMove.y}`);
    }
  }

  const goodMoves: Array<{ move: Position; distance: number }> = [];
  for (const move of possibleMoves) {
    if (triedMoves.has(`${move.x},${move.y}`)) continue;
    const d = getDistance(move, target);
    goodMoves.push({ move, distance: d });
  }

  goodMoves.sort((a, b) => {
    if (a.distance === b.distance) return Math.random() - 0.5;
    return a.distance - b.distance;
  });

  for (const candidate of goodMoves) {
    if (executeMove(unit, candidate.move, game)) {
      return;
    }
  }

  const remainingMoves = possibleMoves.filter(m => !triedMoves.has(`${m.x},${m.y}`));
  remainingMoves.sort(() => Math.random() - 0.5);
  for (const fallbackMove of remainingMoves) {
    if (executeMove(unit, fallbackMove, game)) {
      return;
    }
  }
}

/**
 * Frontier-based exploration.
 * Prefers tiles that are UNSEEN, then EXPLORED-but-fog, then anything.
 * Avoids tiles already occupied by many friendly units.
 */
export function exploreRandomly(
  unit: Unit,
  gameState: GameState,
  game?: GameInterface,
): void {
  if (unit.movementPoints <= 0) return;
  const unitStats = getUnitStats(unit.type);
  const naval = unitStats?.category === UnitCategory.NAVAL;
  const possibleMoves = getValidMoves(unit.position, gameState, naval);
  if (possibleMoves.length === 0) return;

  const playerId = unit.playerId;
  const mapWidth = gameState.worldMap[0]?.length || 80;

  // Score each candidate move
  const scored = possibleMoves.map(move => {
    let weight = 1.0;

    // Strong preference for unseen tiles
    const vis = getTileVisibility(move, playerId, gameState);
    if (vis === VisibilityState.UNSEEN)    weight *= 10;
    else if (vis === VisibilityState.EXPLORED) weight *= 3;

    if (!naval) {
      // Terrain preference for settlers
      if (unit.type === UnitType.SETTLERS) {
        const nearest = findNearestCityAny(move, gameState);
        if (nearest) {
          const d = getDistance(move, nearest.position);
          if (d < 3) weight *= 0.2;
          else if (d < 5) weight *= 0.6;
        }
        const tile = gameState.worldMap[move.y]?.[move.x];
        if (tile) {
          switch (tile.terrain) {
            case TerrainType.GRASSLAND:
            case TerrainType.RIVER:   weight *= 1.5; break;
            case TerrainType.PLAINS:
            case TerrainType.HILLS:   weight *= 1.2; break;
            case TerrainType.DESERT:
            case TerrainType.SWAMP:   weight *= 0.4; break;
          }
        }
      }

      // Discourage clustering — penalise tiles with many friendly units already
      const friendlyAtMove = gameState.units.filter(
        u => u.playerId === playerId && u.position.x === move.x && u.position.y === move.y
      ).length;
      if (friendlyAtMove >= 2) weight *= 0.3;
      else if (friendlyAtMove === 1) weight *= 0.7;
      
      // Discourage staying near friendly cities when exploring
      let minDistToFriendlyCity = Infinity;
      for (const city of gameState.cities) {
        if (city.playerId === playerId) {
          const d = getDistance(move, city.position);
          if (d < minDistToFriendlyCity) minDistToFriendlyCity = d;
        }
      }
      
      if (minDistToFriendlyCity === 0) weight *= 0.05;      // Deeply penalise just sitting in the city
      else if (minDistToFriendlyCity < 3) weight *= 0.3;    // Move away from the city!
      else if (minDistToFriendlyCity < 6) weight *= 0.7;    // Keep moving outward
      else if (minDistToFriendlyCity > 10) weight *= 1.5;   // Reward deep exploration
      
      // Look one step further: boost moves that open up more unseen neighbours
      const mapHeight = gameState.worldMap.length || 50;
      let unseenNeighbours = 0;
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]] as const) {
        const nx = ((move.x + dx + mapWidth) % mapWidth);
        const ny = move.y + dy;
        if (ny >= 0 && ny < mapHeight) {
          if (isTileUnseen({ x: nx, y: ny }, playerId, gameState)) unseenNeighbours++;
        }
      }
      weight *= (1 + unseenNeighbours * 0.5);
    }

    return { move, weight };
  });

  // Sort by weight descending, but add a slight random modifier to tie-break
  scored.sort((a, b) => b.weight * (0.8 + Math.random() * 0.4) - a.weight * (0.8 + Math.random() * 0.4));

  for (const s of scored) {
    if (executeMove(unit, s.move, game)) {
      return;
    }
  }
}

// ─── Internal helper ─────────────────────────────────────────────────────────

function executeMove(unit: Unit, pos: Position, game?: GameInterface): boolean {
  if (game) {
    return game.moveUnit(unit.id, pos);
  } else {
    unit.position = pos;
    unit.movementPoints = Math.max(0, unit.movementPoints - 1);
    return true;
  }
}
