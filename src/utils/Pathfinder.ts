import { Position, GameState, Unit, TerrainType, ImprovementType, UnitCategory } from '../types/game.js';
import { getUnitStats } from '../game/UnitDefinitions.js';

/** @internal A single node in the A* open/closed sets. */
interface AStarNode {
  position: Position;
  g: number;          // cost from start
  h: number;          // heuristic to goal
  f: number;          // g + h
  parent: AStarNode | null;
}

/**
 * Base terrain movement costs for ground units (movement points per tile).
 * Civ 1 reference costs:
 *   Plains / Grassland / Desert / Arctic / Tundra / River : 1
 *   Hills / Forest / Jungle / Swamp                       : 2
 *   Mountains                                             : 3
 *   Ocean (naval only)                                    : 1
 */
const TERRAIN_COST: Partial<Record<string, number>> = {
  [TerrainType.GRASSLAND]:  1,
  [TerrainType.PLAINS]:     1,
  [TerrainType.DESERT]:     1,
  [TerrainType.TUNDRA]:     1,
  [TerrainType.ARCTIC]:     1,
  [TerrainType.RIVER]:      1,
  [TerrainType.HILLS]:      2,
  [TerrainType.FOREST]:     2,
  [TerrainType.JUNGLE]:     2,
  [TerrainType.SWAMP]:      2,
  [TerrainType.MOUNTAINS]:  3,
  [TerrainType.OCEAN]:      1,   // only reached by naval / air units
};

/**
 * Find a path from `unit.position` to `destination` using A*.
 *
 * @returns An ordered list of positions to walk through (excluding the start
 *          tile, including the destination), or `null` if no path exists.
 */
export function findPath(
  unit: Unit,
  destination: Position,
  gameState: GameState,
): Position[] | null {
  const mapHeight = gameState.worldMap.length;
  const mapWidth  = gameState.worldMap[0]?.length || 80;

  const stats    = getUnitStats(unit.type);
  const isNaval  = stats.category === UnitCategory.NAVAL;
  const isAir    = stats.category === UnitCategory.AIR;

  const start: Position = { ...unit.position };

  // Normalise destination (horizontal wrap + vertical clamp)
  const dest: Position = {
    x: ((destination.x % mapWidth) + mapWidth) % mapWidth,
    y: Math.max(0, Math.min(destination.y, mapHeight - 1)),
  };

  if (start.x === dest.x && start.y === dest.y) return [];

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Manhattan distance with horizontal wrapping (admissible heuristic). */
  const heuristic = (a: Position, b: Position): number => {
    const dx = Math.abs(a.x - b.x);
    return Math.min(dx, mapWidth - dx) + Math.abs(a.y - b.y);
  };

  /** True if this unit type can enter the given tile. */
  const canEnter = (pos: Position): boolean => {
    const tile = gameState.worldMap[pos.y]?.[pos.x];
    if (!tile) return false;

    // Air units pass over everything
    if (isAir) return true;

    // Naval units travel only on ocean
    if (isNaval) return tile.terrain === TerrainType.OCEAN;

    // Land units cannot cross ocean (transport boarding not modelled here)
    if (tile.terrain === TerrainType.OCEAN) return false;

    // All other passable terrain is fine
    return true;
  };

  /** Movement cost to enter a tile (roads halve cost, simplified to 1). */
const moveCost = (fromPos: Position, toPos: Position): number => {
      const fromTile = gameState.worldMap[fromPos.y]?.[fromPos.x];
      const toTile = gameState.worldMap[toPos.y]?.[toPos.x];
      if (!toTile) return 999;

      const fromHasRailroad = fromTile?.improvements?.some(imp => imp.type === ImprovementType.RAILROAD);
      const toHasRailroad = toTile.improvements?.some(imp => imp.type === ImprovementType.RAILROAD);
      
      if (fromHasRailroad && toHasRailroad) return 0; // Railroad to railroad is free

      const fromHasRoad = fromHasRailroad || fromTile?.improvements?.some(imp => imp.type === ImprovementType.ROAD);
      const toHasRoad = toHasRailroad || toTile.improvements?.some(imp => imp.type === ImprovementType.ROAD);

      if (fromHasRoad && toHasRoad) return 1; // Road makes terrain effectively cost 1

      return TERRAIN_COST[toTile.terrain] ?? 1;
  };

  /** All 8 neighbours with horizontal wrapping. */
  const neighbours = (pos: Position): Position[] => {
    const result: Position[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const ny = pos.y + dy;
        if (ny < 0 || ny >= mapHeight) continue;
        const nx = ((pos.x + dx + mapWidth) % mapWidth);
        result.push({ x: nx, y: ny });
      }
    }
    return result;
  };

  const key = (p: Position) => `${p.x},${p.y}`;

  // ── A* search ────────────────────────────────────────────────────────────

  const openMap    = new Map<string, AStarNode>();
  const closedSet  = new Set<string>();

  const startNode: AStarNode = {
    position: start,
    g: 0,
    h: heuristic(start, dest),
    f: heuristic(start, dest),
    parent: null,
  };
  openMap.set(key(start), startNode);

  const MAX_NODES = 2000; // Safety cap for large maps
  let iterations = 0;

  while (openMap.size > 0 && iterations < MAX_NODES) {
    iterations++;

    // Pick node with lowest f-score from open set
    let current: AStarNode | null = null;
    for (const node of openMap.values()) {
      if (!current || node.f < current.f) current = node;
    }
    if (!current) break;

    const currentKey = key(current.position);
    openMap.delete(currentKey);
    closedSet.add(currentKey);

    // Goal reached – reconstruct path
    if (current.position.x === dest.x && current.position.y === dest.y) {
      const path: Position[] = [];
      let node: AStarNode | null = current;
      while (node && node.parent !== null) {
        path.unshift({ ...node.position });
        node = node.parent;
      }
      return path;
    }

    for (const nb of neighbours(current.position)) {
      const nbKey = key(nb);
      if (closedSet.has(nbKey)) continue;
      if (!canEnter(nb)) continue;

      const gCost = current.g + moveCost(current.position, nb);

      const existing = openMap.get(nbKey);
      if (!existing || gCost < existing.g) {
        const h = heuristic(nb, dest);
        openMap.set(nbKey, {
          position: nb,
          g: gCost,
          h,
          f: gCost + h,
          parent: current,
        });
      }
    }
  }

  return null; // No path found within iteration limit
}
