import type { City, GameState, Tile } from '../types/game';
import { BuildingType, TerrainType } from '../types/game';

const OCEAN_LIKE = new Set<string>([TerrainType.OCEAN, TerrainType.ARCTIC]);

function isPollutableLand(tile: Tile): boolean {
  if (tile.polluted) return false;
  return !OCEAN_LIKE.has(tile.terrain);
}

function cityPollutionLoad(city: City): number {
  let load = city.population;
  const buildings = city.buildings ?? [];
  if (buildings.some(b => b.type === BuildingType.FACTORY)) load += 2;
  if (buildings.some(b => b.type === BuildingType.MANUFACTURING_PLANT)) load += 2;

  if (buildings.some(b => b.type === BuildingType.MASS_TRANSIT)) {
    load = Math.max(0, load - city.population);
  }
  if (buildings.some(b => b.type === BuildingType.RECYCLING_CENTER)) {
    load = Math.ceil(load / 3);
  }
  if (buildings.some(b => b.type === BuildingType.SEWER_SYSTEM)) {
    load = Math.max(0, load - 1);
  }
  return load;
}

function adjacentOffsets(): Array<{ dx: number; dy: number }> {
  return [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
  ];
}

/** Polluted tiles in cities and worked radius of the player (Civ I scoring). */
export function countPlayerPollutionTiles(gameState: GameState, playerId: string): number {
  const mapWidth = gameState.worldMap[0]?.length ?? 80;
  const mapHeight = gameState.worldMap.length;
  const seen = new Set<string>();
  let count = 0;

  const playerCities = gameState.cities.filter(c => c.playerId === playerId);
  for (const city of playerCities) {
    const check = (x: number, y: number) => {
      const key = `${x},${y}`;
      if (seen.has(key)) return;
      seen.add(key);
      const tile = gameState.worldMap[y]?.[x];
      if (tile?.polluted) count++;
    };

    check(city.position.x, city.position.y);
    for (const { dx, dy } of city.workedTiles ?? []) {
      const tileY = city.position.y + dy;
      const tileX = ((city.position.x + dx) % mapWidth + mapWidth) % mapWidth;
      if (tileY >= 0 && tileY < mapHeight) check(tileX, tileY);
    }
  }
  return count;
}

/**
 * End-of-turn pollution for all cities (called once per full game turn).
 */
export function processGlobalPollution(gameState: GameState): void {
  const mapWidth = gameState.worldMap[0]?.length ?? 80;
  const mapHeight = gameState.worldMap.length;

  for (const city of gameState.cities) {
    const load = cityPollutionLoad(city);
    if (load <= 0) continue;

    // Rough Civ I curve: more industrial cities pollute more often
    const chance = Math.min(0.85, 0.08 + load * 0.04);
    if (Math.random() > chance) continue;

    const candidates: Tile[] = [];
    const cx = city.position.x;
    const cy = city.position.y;
    const centre = gameState.worldMap[cy]?.[cx];
    if (centre && isPollutableLand(centre)) candidates.push(centre);

    for (const { dx, dy } of adjacentOffsets()) {
      const tileY = cy + dy;
      const tileX = ((cx + dx) % mapWidth + mapWidth) % mapWidth;
      if (tileY < 0 || tileY >= mapHeight) continue;
      const tile = gameState.worldMap[tileY]?.[tileX];
      if (tile && isPollutableLand(tile)) candidates.push(tile);
    }

    if (candidates.length === 0) continue;
    const tile = candidates[Math.floor(Math.random() * candidates.length)];
    tile.polluted = true;
  }
}
