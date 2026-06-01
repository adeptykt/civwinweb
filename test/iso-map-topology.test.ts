import { describe, it, expect, beforeEach } from 'vitest';
import { TerrainType } from '../src/types/game';
import type { Tile } from '../src/types/game';
import {
  diamondDistance,
  isCoastlineTileIso,
  getIsoEdgeCoastMask,
  getIsoKeyboardMoveDelta,
  shouldUseIsoMapTopology,
  smoothCoastlinesIso,
} from '../src/game/map/IsoMapTopology';
import { SettingsManager } from '../src/utils/SettingsManager';

function makeMap(width: number, height: number, fill: TerrainType): Tile[][] {
  const map: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    map[y] = [];
    for (let x = 0; x < width; x++) {
      map[y][x] = {
        position: { x, y },
        terrain: fill,
        resources: [],
        improvements: [],
      };
    }
  }
  return map;
}

describe('IsoMapTopology', () => {
  beforeEach(() => {
    SettingsManager.getInstance().setSetting('renderMode', 'ortho');
  });

  it('diamondDistance is Manhattan metric', () => {
    expect(diamondDistance(3, 4)).toBe(7);
    expect(diamondDistance(-2, 1)).toBe(3);
  });

  it('shouldUseIsoMapTopology follows renderMode setting', () => {
    expect(shouldUseIsoMapTopology()).toBe(false);
    SettingsManager.getInstance().setSetting('renderMode', 'iso');
    expect(shouldUseIsoMapTopology()).toBe(true);
  });

  it('isCoastlineTileIso uses even-r edge neighbors', () => {
    const map = makeMap(5, 5, TerrainType.GRASSLAND);
    // For y=2 (even row), non-edge diagonal (3,1) should NOT count.
    map[1][3].terrain = TerrainType.OCEAN;
    expect(isCoastlineTileIso(map, 2, 2, 5, 5)).toBe(false);
    // Ocean at (1,1) shares an upper-left edge in even-r.
    map[1][1].terrain = TerrainType.OCEAN;
    expect(isCoastlineTileIso(map, 2, 2, 5, 5)).toBe(true);
  });

  it('coastline and coast mask honor horizontal wrap seam', () => {
    const map = makeMap(5, 5, TerrainType.GRASSLAND);
    // Tile (0,2) is on an even row; its upper-left edge neighbor is (-1,1) => wraps to (4,1).
    map[1][4].terrain = TerrainType.OCEAN;

    expect(isCoastlineTileIso(map, 0, 2, 5, 5)).toBe(true);
    // Upper-left edge bit should be set for seam neighbor contact.
    expect(getIsoEdgeCoastMask(map, 0, 2, 5, 5) & 1).toBe(1);
  });

  it('keyboard SE on even row is lower-right neighbor (0,1), not doubled down', () => {
    expect(getIsoKeyboardMoveDelta('se', 56)).toEqual({ dx: 0, dy: 1 });
    expect(getIsoKeyboardMoveDelta('se', 57)).toEqual({ dx: 1, dy: 1 });
  });

  it('keyboard NW on odd row is upper-left (0,-1)', () => {
    expect(getIsoKeyboardMoveDelta('nw', 57)).toEqual({ dx: 0, dy: -1 });
  });

  it('keyboard N/S use two rows along visual vertical axis', () => {
    expect(getIsoKeyboardMoveDelta('n', 57)).toEqual({ dx: 0, dy: -2 });
    expect(getIsoKeyboardMoveDelta('s', 57)).toEqual({ dx: 0, dy: 2 });
  });

  it('matches expected coast edges from sample even-r layout', () => {
    const map = makeMap(4, 4, TerrainType.OCEAN);
    // Row 1 is land: (0,1), (1,1)
    map[1][0].terrain = TerrainType.GRASSLAND;
    map[1][1].terrain = TerrainType.GRASSLAND;
    // (1,2) is land, (0,2) is ocean
    map[2][1].terrain = TerrainType.GRASSLAND;

    // (0,0) water: coast on right-bottom only (bit 4).
    expect(getIsoEdgeCoastMask(map, 0, 0, 4, 4)).toBe(4);
    // (1,0) water: coast on left-bottom and right-bottom (bits 8 + 4).
    expect(getIsoEdgeCoastMask(map, 1, 0, 4, 4)).toBe(12);
    // (0,2) water: coast on right-top only (bit 2).
    expect(getIsoEdgeCoastMask(map, 0, 2, 4, 4)).toBe(2);
  });

  it('getIsoEdgeCoastMask marks edges touching opposite terrain', () => {
    const map = makeMap(3, 3, TerrainType.GRASSLAND);
    map[1][1].terrain = TerrainType.OCEAN;
    const mask = getIsoEdgeCoastMask(map, 1, 1, 3, 3);
    expect(mask).toBeGreaterThan(0);
  });

  it('smoothCoastlinesIso erodes land with 3+ ocean edge neighbors', () => {
    const map = makeMap(5, 5, TerrainType.OCEAN);
    map[2][2].terrain = TerrainType.GRASSLAND;
    map[2][1].terrain = TerrainType.OCEAN;
    map[2][3].terrain = TerrainType.OCEAN;
    map[1][2].terrain = TerrainType.OCEAN;
    smoothCoastlinesIso(map, 5, 5);
    expect(map[2][2].terrain).toBe(TerrainType.OCEAN);
  });
});
