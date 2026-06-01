import type { GameState, Position } from '../types/game';
import { TerrainType, UnitType } from '../types/game';
import { isUnitAboard } from './TransportSystem';

export function isWithinTilesOfLand(
  gameState: GameState,
  pos: Position,
  maxDist: number,
): boolean {
  const mapWidth = gameState.worldMap[0]?.length ?? 80;
  const mapHeight = gameState.worldMap.length;
  for (let dy = -maxDist; dy <= maxDist; dy++) {
    for (let dx = -maxDist; dx <= maxDist; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > maxDist) continue;
      const ny = pos.y + dy;
      const nx = ((pos.x + dx) % mapWidth + mapWidth) % mapWidth;
      if (ny < 0 || ny >= mapHeight) continue;
      const tile = gameState.worldMap[ny]?.[nx];
      if (tile && tile.terrain !== TerrainType.OCEAN) {
        return true;
      }
    }
  }
  return false;
}

/** Triremes far from shore may be lost at sea (Civ I). Returns removed unit ids. */
export function processTriremesLostAtSea(gameState: GameState): string[] {
  const removed: string[] = [];
  for (const unit of gameState.units) {
    if (unit.type !== UnitType.TRIREME || isUnitAboard(unit)) continue;
    const tile = gameState.worldMap[unit.position.y]?.[unit.position.x];
    if (tile?.terrain !== TerrainType.OCEAN) continue;
    if (isWithinTilesOfLand(gameState, unit.position, 2)) continue;
    if (Math.random() < 0.2) {
      removed.push(unit.id);
    }
  }
  if (removed.length > 0) {
    gameState.units = gameState.units.filter(u => !removed.includes(u.id));
  }
  return removed;
}
