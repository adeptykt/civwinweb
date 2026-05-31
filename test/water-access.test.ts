import { describe, it, expect, beforeEach } from 'vitest';
import { WaterAccess } from '../src/utils/WaterAccess';
import { City, Tile, TerrainType, Position } from '../src/types/game';

describe('WaterAccess', () => {
  let worldMap: Tile[][];
  let testCity: City;

  beforeEach(() => {
    // Create a 5x5 test map with grassland as default
    worldMap = [];
    for (let y = 0; y < 5; y++) {
      worldMap[y] = [];
      for (let x = 0; x < 5; x++) {
        worldMap[y][x] = {
          terrain: TerrainType.GRASSLAND,
          resource: null,
          improvements: [],
          units: [],
          position: { x, y },
          explored: [],
          visible: []
        };
      }
    }

    // Create a test city at center (2, 2)
    testCity = {
      id: 'test-city',
      name: 'Test City',
      position: { x: 2, y: 2 },
      playerId: 'player1',
      population: 1,
      food: 0,
      shields: 0,
      culture: 0,
      buildings: [],
      productionQueue: [],
      currentProduction: null,
      foundedTurn: 0
    };
  });

  describe('hasWaterAccess', () => {
    it('should return true when city is directly on ocean', () => {
      worldMap[2][2].terrain = TerrainType.OCEAN;
      
      expect(WaterAccess.hasWaterAccess(testCity, worldMap)).toBe(true);
    });

    it('should return true when city is directly on river', () => {
      worldMap[2][2].terrain = TerrainType.RIVER;
      
      expect(WaterAccess.hasWaterAccess(testCity, worldMap)).toBe(true);
    });

    it('should return true when city has adjacent ocean to the north', () => {
      worldMap[1][2].terrain = TerrainType.OCEAN;
      
      expect(WaterAccess.hasWaterAccess(testCity, worldMap)).toBe(true);
    });

    it('should return true when city has adjacent ocean to the south', () => {
      worldMap[3][2].terrain = TerrainType.OCEAN;
      
      expect(WaterAccess.hasWaterAccess(testCity, worldMap)).toBe(true);
    });

    it('should return true when city has adjacent ocean to the east', () => {
      worldMap[2][3].terrain = TerrainType.OCEAN;
      
      expect(WaterAccess.hasWaterAccess(testCity, worldMap)).toBe(true);
    });

    it('should return true when city has adjacent ocean to the west', () => {
      worldMap[2][1].terrain = TerrainType.OCEAN;
      
      expect(WaterAccess.hasWaterAccess(testCity, worldMap)).toBe(true);
    });

    it('should return true when city has adjacent ocean to the northeast', () => {
      worldMap[1][3].terrain = TerrainType.OCEAN;
      
      expect(WaterAccess.hasWaterAccess(testCity, worldMap)).toBe(true);
    });

    it('should return true when city has adjacent ocean to the northwest', () => {
      worldMap[1][1].terrain = TerrainType.OCEAN;
      
      expect(WaterAccess.hasWaterAccess(testCity, worldMap)).toBe(true);
    });

    it('should return true when city has adjacent ocean to the southeast', () => {
      worldMap[3][3].terrain = TerrainType.OCEAN;
      
      expect(WaterAccess.hasWaterAccess(testCity, worldMap)).toBe(true);
    });

    it('should return true when city has adjacent ocean to the southwest', () => {
      worldMap[3][1].terrain = TerrainType.OCEAN;
      
      expect(WaterAccess.hasWaterAccess(testCity, worldMap)).toBe(true);
    });

    it('should return true when city has adjacent river', () => {
      worldMap[1][2].terrain = TerrainType.RIVER;
      
      expect(WaterAccess.hasWaterAccess(testCity, worldMap)).toBe(true);
    });

    it('should return false when city has no water access', () => {
      // All tiles are grassland by default
      expect(WaterAccess.hasWaterAccess(testCity, worldMap)).toBe(false);
    });

    it('should return false when surrounded by non-water terrain types', () => {
      // Set all adjacent tiles to various non-water terrain
      worldMap[1][1].terrain = TerrainType.DESERT;
      worldMap[1][2].terrain = TerrainType.FOREST;
      worldMap[1][3].terrain = TerrainType.HILLS;
      worldMap[2][1].terrain = TerrainType.MOUNTAINS;
      worldMap[2][3].terrain = TerrainType.JUNGLE;
      worldMap[3][1].terrain = TerrainType.SWAMP;
      worldMap[3][2].terrain = TerrainType.ARCTIC;
      worldMap[3][3].terrain = TerrainType.TUNDRA;
      
      expect(WaterAccess.hasWaterAccess(testCity, worldMap)).toBe(false);
    });

    it('should handle city at top edge of map', () => {
      const edgeCity = { ...testCity, position: { x: 2, y: 0 } };
      
      // No water access
      expect(WaterAccess.hasWaterAccess(edgeCity, worldMap)).toBe(false);
      
      // Add ocean below
      worldMap[1][2].terrain = TerrainType.OCEAN;
      expect(WaterAccess.hasWaterAccess(edgeCity, worldMap)).toBe(true);
    });

    it('should handle city at bottom edge of map', () => {
      const edgeCity = { ...testCity, position: { x: 2, y: 4 } };
      
      // No water access
      expect(WaterAccess.hasWaterAccess(edgeCity, worldMap)).toBe(false);
      
      // Add ocean above
      worldMap[3][2].terrain = TerrainType.OCEAN;
      expect(WaterAccess.hasWaterAccess(edgeCity, worldMap)).toBe(true);
    });

    it('should handle horizontal wrapping at left edge', () => {
      const edgeCity = { ...testCity, position: { x: 0, y: 2 } };
      
      // Add ocean at right edge (should wrap around)
      worldMap[2][4].terrain = TerrainType.OCEAN;
      expect(WaterAccess.hasWaterAccess(edgeCity, worldMap)).toBe(true);
    });

    it('should handle horizontal wrapping at right edge', () => {
      const edgeCity = { ...testCity, position: { x: 4, y: 2 } };
      
      // Add ocean at left edge (should wrap around)
      worldMap[2][0].terrain = TerrainType.OCEAN;
      expect(WaterAccess.hasWaterAccess(edgeCity, worldMap)).toBe(true);
    });

    it('should not wrap vertically at top edge', () => {
      const topCity = { ...testCity, position: { x: 2, y: 0 } };
      
      // Add ocean at bottom (should NOT wrap)
      worldMap[4][2].terrain = TerrainType.OCEAN;
      expect(WaterAccess.hasWaterAccess(topCity, worldMap)).toBe(false);
    });

    it('should not wrap vertically at bottom edge', () => {
      const bottomCity = { ...testCity, position: { x: 2, y: 4 } };
      
      // Add ocean at top (should NOT wrap)
      worldMap[0][2].terrain = TerrainType.OCEAN;
      expect(WaterAccess.hasWaterAccess(bottomCity, worldMap)).toBe(false);
    });

    it('should handle city in corner (top-left)', () => {
      const cornerCity = { ...testCity, position: { x: 0, y: 0 } };
      
      // Add ocean to southeast
      worldMap[1][1].terrain = TerrainType.OCEAN;
      expect(WaterAccess.hasWaterAccess(cornerCity, worldMap)).toBe(true);
    });

    it('should handle city in corner (top-right)', () => {
      const cornerCity = { ...testCity, position: { x: 4, y: 0 } };
      
      // Add ocean to southwest
      worldMap[1][3].terrain = TerrainType.OCEAN;
      expect(WaterAccess.hasWaterAccess(cornerCity, worldMap)).toBe(true);
    });

    it('should handle city in corner (bottom-left)', () => {
      const cornerCity = { ...testCity, position: { x: 0, y: 4 } };
      
      // Add ocean to northeast
      worldMap[3][1].terrain = TerrainType.OCEAN;
      expect(WaterAccess.hasWaterAccess(cornerCity, worldMap)).toBe(true);
    });

    it('should handle city in corner (bottom-right)', () => {
      const cornerCity = { ...testCity, position: { x: 4, y: 4 } };
      
      // Add ocean to northwest
      worldMap[3][3].terrain = TerrainType.OCEAN;
      expect(WaterAccess.hasWaterAccess(cornerCity, worldMap)).toBe(true);
    });
  });

  describe('canBuildNavalItems', () => {
    it('should return true when city has water access', () => {
      worldMap[2][3].terrain = TerrainType.OCEAN;
      
      expect(WaterAccess.canBuildNavalItems(testCity, worldMap)).toBe(true);
    });

    it('should return false when city has no water access', () => {
      expect(WaterAccess.canBuildNavalItems(testCity, worldMap)).toBe(false);
    });

    it('should return true when city is on river', () => {
      worldMap[2][2].terrain = TerrainType.RIVER;
      
      expect(WaterAccess.canBuildNavalItems(testCity, worldMap)).toBe(true);
    });

    it('should return true when city is on ocean', () => {
      worldMap[2][2].terrain = TerrainType.OCEAN;
      
      expect(WaterAccess.canBuildNavalItems(testCity, worldMap)).toBe(true);
    });
  });

  describe('getWaterAccessMessage', () => {
    it('should return descriptive message with city name', () => {
      const message = WaterAccess.getWaterAccessMessage(testCity);
      
      expect(message).toContain('Test City');
      expect(message).toContain('water');
      expect(message).toContain('ocean or river');
    });

    it('should return appropriate message for different city names', () => {
      const differentCity = { ...testCity, name: 'Rome' };
      const message = WaterAccess.getWaterAccessMessage(differentCity);
      
      expect(message).toContain('Rome');
      expect(message).toContain('naval units');
    });

    it('should mention both ocean and river in message', () => {
      const message = WaterAccess.getWaterAccessMessage(testCity);
      
      expect(message).toMatch(/ocean.*river|river.*ocean/i);
    });
  });
});
