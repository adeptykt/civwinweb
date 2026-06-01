import type { Tile } from '../../types/game';
import { TerrainType } from '../../types/game';
import { SettingsManager } from '../../utils/SettingsManager';

/**
 * Isometric diamond topology for even-r stagger.
 *
 * Bit order matches renderer edge drawing:
 * 1 = upper-left, 2 = upper-right, 4 = lower-right, 8 = lower-left.
 */
const ISO_EDGE_BITS = [1, 2, 4, 8] as const;

export type IsoEdgeMask = number;

export function shouldUseIsoMapTopology(): boolean {
  return SettingsManager.getInstance().getSetting('renderMode') === 'iso';
}

export function isOceanTerrain(terrain: TerrainType): boolean {
  return terrain === TerrainType.OCEAN;
}

export function isLandTerrain(terrain: TerrainType): boolean {
  return terrain !== TerrainType.OCEAN;
}

/** Manhattan distance — natural “radius” for diamond-shaped landmasses on iso view. */
export function diamondDistance(dx: number, dy: number): number {
  return Math.abs(dx) + Math.abs(dy);
}

export type IsoKeyboardDirection = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';

function getIsoEdgeNeighborOffsets(y: number): ReadonlyArray<{ dx: number; dy: number; bit: number }> {
  // In even-r, odd rows are shifted right by half a tile.
  // Edge-sharing neighbors therefore depend on row parity.
  if ((y & 1) === 0) {
    return [
      { dx: -1, dy: -1, bit: 1 }, // upper-left
      { dx: 0, dy: -1, bit: 2 },  // upper-right
      { dx: 0, dy: 1, bit: 4 },   // lower-right
      { dx: -1, dy: 1, bit: 8 },  // lower-left
    ] as const;
  }
  return [
    { dx: 0, dy: -1, bit: 1 },   // upper-left
    { dx: 1, dy: -1, bit: 2 },   // upper-right
    { dx: 1, dy: 1, bit: 4 },    // lower-right
    { dx: 0, dy: 1, bit: 8 },    // lower-left
  ] as const;
}

/**
 * Keyboard step on the iso grid (even-r).
 * Diagonals = one edge neighbor; cardinals = two tiles along screen axes.
 */
export function getIsoKeyboardMoveDelta(
  direction: IsoKeyboardDirection,
  tileY: number
): { dx: number; dy: number } {
  switch (direction) {
    case 'n':
      return { dx: 0, dy: -2 };
    case 's':
      return { dx: 0, dy: 2 };
    case 'w':
      return { dx: -2, dy: 0 };
    case 'e':
      return { dx: 2, dy: 0 };
    default: {
      const bitByDir: Record<'nw' | 'ne' | 'se' | 'sw', number> = {
        nw: 1,
        ne: 2,
        se: 4,
        sw: 8,
      };
      const bit = bitByDir[direction];
      const off = getIsoEdgeNeighborOffsets(tileY).find((o) => o.bit === bit);
      return off ? { dx: off.dx, dy: off.dy } : { dx: 0, dy: 0 };
    }
  }
}

export function forEachEdgeNeighbor(
  x: number,
  y: number,
  width: number,
  height: number,
  fn: (nx: number, ny: number) => void,
  wrapX = false
): void {
  for (const { dx, dy } of getIsoEdgeNeighborOffsets(y)) {
    let nx = x + dx;
    const ny = y + dy;
    if (wrapX) {
      nx = ((nx % width) + width) % width;
    }
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      fn(nx, ny);
    }
  }
}

export function countEdgeNeighborsWhere(
  map: Tile[][],
  x: number,
  y: number,
  width: number,
  height: number,
  predicate: (terrain: TerrainType) => boolean,
  wrapX = false
): number {
  let count = 0;
  forEachEdgeNeighbor(x, y, width, height, (nx, ny) => {
    if (predicate(map[ny][nx].terrain)) {
      count++;
    }
  }, wrapX);
  return count;
}

/** True when land meets ocean across a shared diamond edge (not diagonal-only). */
export function isCoastlineTileIso(
  map: Tile[][],
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const current = map[y][x].terrain;
  const ocean = isOceanTerrain(current);
  let coast = false;
  // World wraps horizontally, so seam neighbors at x=0/x=width-1 are adjacent.
  forEachEdgeNeighbor(x, y, width, height, (nx, ny) => {
    const neighbor = map[ny][nx].terrain;
    if (ocean ? isLandTerrain(neighbor) : isOceanTerrain(neighbor)) {
      coast = true;
    }
  }, true);
  return coast;
}

/**
 * Remove 1-tile-thick cardinal spikes and close cardinal straits (iso-aware smoothing).
 */
export function smoothCoastlinesIso(map: Tile[][], width: number, height: number): void {
  const snapshot = map.map((row) => row.map((tile) => ({ ...tile })));

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (!isCoastlineTileIso(snapshot, x, y, width, height)) {
        continue;
      }

      const tile = snapshot[y][x];
      const oceanNeighbors = countEdgeNeighborsWhere(
        snapshot,
        x,
        y,
        width,
        height,
        isOceanTerrain,
        true
      );
      const landNeighbors = ISO_EDGE_BITS.length - oceanNeighbors;

      if (isOceanTerrain(tile.terrain) && landNeighbors >= 3) {
        map[y][x].terrain = TerrainType.GRASSLAND;
      } else if (
        isLandTerrain(tile.terrain) &&
        tile.terrain !== TerrainType.MOUNTAINS &&
        oceanNeighbors >= 3
      ) {
        map[y][x].terrain = TerrainType.OCEAN;
      }
    }
  }
}

/** Bitmask of diamond edges bordering opposite terrain (for coast drawing). */
export function getIsoEdgeCoastMask(
  map: Tile[][],
  x: number,
  y: number,
  width: number,
  height: number
): IsoEdgeMask {
  const current = map[y][x].terrain;
  const wantOpposite = isOceanTerrain(current) ? isLandTerrain : isOceanTerrain;
  let mask = 0;
  for (const { dx, dy, bit } of getIsoEdgeNeighborOffsets(y)) {
    const nx = ((x + dx) % width + width) % width;
    const ny = y + dy;
    if (ny >= 0 && ny < height && wantOpposite(map[ny][nx].terrain)) {
      mask |= bit;
    }
  }
  return mask;
}
