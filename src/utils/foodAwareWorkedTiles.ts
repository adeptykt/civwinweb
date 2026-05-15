import type { City, GameState, Tile } from '../types/game.js';

/** Four diagonal (±2,±2) squares lie outside the Civ1 city work diamond (21 tiles). */
export function isCityWorkRadiusExcludedCorner(dx: number, dy: number): boolean {
  return Math.abs(dx) === 2 && Math.abs(dy) === 2;
}

export type WorkedTileYields = { food: number; production: number; trade: number };

export type WorkedTileMeta = {
  dx: number;
  dy: number;
  yields: WorkedTileYields;
  totalYield: number;
  priority: number;
};

/**
 * Workable tiles in city radius: 5×5 minus centre and the four (±2,±2) corners
 * (21-tile diamond in Civ1 terms). Matches TurnManager.getAvailableTiles.
 */
export function collectCityRadiusTileMetas(
  city: City,
  gameState: GameState,
  getTileYields: (tile: Tile) => WorkedTileYields
): WorkedTileMeta[] {
  const mapWidth = gameState.worldMap[0]?.length ?? 80;
  const h = gameState.worldMap.length;
  const out: WorkedTileMeta[] = [];

  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      if (dx === 0 && dy === 0) continue;
      if (isCityWorkRadiusExcludedCorner(dx, dy)) continue;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      if (distance > 2) continue;

      const tileY = city.position.y + dy;
      if (tileY < 0 || tileY >= h) continue;

      const tileX = ((city.position.x + dx) % mapWidth + mapWidth) % mapWidth;
      const tile = gameState.worldMap[tileY]?.[tileX];
      if (!tile) continue;

      const yields = getTileYields(tile);
      const totalYield = yields.food + yields.production + yields.trade;
      const priority = yields.food * 2 + yields.production * 2 + yields.trade;
      out.push({ dx, dy, yields, totalYield, priority });
    }
  }

  return out;
}

const key = (dx: number, dy: number): string => `${dx},${dy}`;

/**
 * Pick up to `population` outer tiles: while food from workers + city center is below
 * `population * 2`, prefer higher food; otherwise prefer the usual shield/trade priority.
 * `locked` tiles are kept first (e.g. manual selection when the city grows).
 */
export function selectFoodAwareWorkedTileMetas(
  city: City,
  gameState: GameState,
  population: number,
  cityCenterFood: number,
  locked: Array<{ dx: number; dy: number }>,
  getTileYields: (tile: Tile) => WorkedTileYields
): WorkedTileMeta[] {
  const candidates = collectCityRadiusTileMetas(city, gameState, getTileYields);
  const maxTiles = Math.min(population, candidates.length);
  const pop = population;

  const selectedKeys = new Set<string>();
  const selected: WorkedTileMeta[] = [];

  const addMeta = (meta: WorkedTileMeta): void => {
    if (selected.length >= maxTiles) return;
    const k = key(meta.dx, meta.dy);
    if (selectedKeys.has(k)) return;
    selected.push(meta);
    selectedKeys.add(k);
  };

  for (const t of locked) {
    if (selected.length >= maxTiles) break;
    const meta = candidates.find(c => c.dx === t.dx && c.dy === t.dy);
    if (meta) {
      addMeta(meta);
    } else {
      const mapWidth = gameState.worldMap[0]?.length ?? 80;
      const h = gameState.worldMap.length;
      const tileY = city.position.y + t.dy;
      if (tileY < 0 || tileY >= h) continue;
      const tileX = ((city.position.x + t.dx) % mapWidth + mapWidth) % mapWidth;
      const tile = gameState.worldMap[tileY]?.[tileX];
      if (!tile) continue;
      const yields = getTileYields(tile);
      const totalYield = yields.food + yields.production + yields.trade;
      const priority = yields.food * 2 + yields.production * 2 + yields.trade;
      addMeta({ dx: t.dx, dy: t.dy, yields, totalYield, priority });
    }
  }

  while (selected.length < maxTiles) {
    const foodFromWorkers = selected.reduce((s, m) => s + m.yields.food, 0);
    const need = pop * 2 - cityCenterFood - foodFromWorkers;
    const pool = candidates.filter(c => !selectedKeys.has(key(c.dx, c.dy)));
    if (pool.length === 0) break;

    let bestIdx = 0;
    for (let i = 1; i < pool.length; i++) {
      const c = pool[i]!;
      const b = pool[bestIdx]!;
      if (need > 0) {
        if (c.yields.food > b.yields.food) bestIdx = i;
        else if (c.yields.food === b.yields.food && c.priority > b.priority) bestIdx = i;
      } else {
        if (c.priority > b.priority) bestIdx = i;
        else if (c.priority === b.priority && c.yields.food > b.yields.food) bestIdx = i;
      }
    }
    addMeta(pool[bestIdx]!);
  }

  return selected;
}
