import { City, Tile, TerrainType, Position } from '../types/game';

/**
 * Utility functions for checking water access for cities
 */
export class WaterAccess {
  /**
   * Check if a city has access to water (ocean, river, or adjacent to water)
   * @param city - The city to check
   * @param worldMap - The game world map
   * @returns true if the city has water access
   */
  public static hasWaterAccess(city: City, worldMap: Tile[][]): boolean {
    const cityPosition = city.position;
    
    // Check if city is directly on water
    if (this.isWaterTerrain(worldMap[cityPosition.y][cityPosition.x].terrain)) {
      return true;
    }
    
    // Check if city is directly on a river
    if (worldMap[cityPosition.y][cityPosition.x].terrain === TerrainType.RIVER) {
      return true;
    }
    
    // Check adjacent tiles for water or river
    return this.hasAdjacentWater(cityPosition, worldMap);
  }
  
  /**
   * Check if a position has adjacent water tiles
   * @param position - The position to check around
   * @param worldMap - The game world map
   * @returns true if there are adjacent water tiles
   */
  private static hasAdjacentWater(position: Position, worldMap: Tile[][]): boolean {
    const { x, y } = position;
    const mapHeight = worldMap.length;
    const mapWidth = worldMap[0].length;
    
    // Check all 8 adjacent tiles
    const directions = [
      { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
      { dx: -1, dy: 0 },                     { dx: 1, dy: 0 },
      { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 }
    ];
    
    for (const direction of directions) {
      const newX = (x + direction.dx + mapWidth) % mapWidth; // Handle horizontal wrapping
      const newY = y + direction.dy;
      
      // Check bounds (no vertical wrapping)
      if (newY >= 0 && newY < mapHeight) {
        const terrain = worldMap[newY][newX].terrain;
        
        if (this.isWaterTerrain(terrain) || terrain === TerrainType.RIVER) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Check if a terrain type is considered water
   * @param terrain - The terrain type to check
   * @returns true if the terrain is water
   */
  private static isWaterTerrain(terrain: TerrainType): boolean {
    return terrain === TerrainType.OCEAN;
  }
  
  /**
   * Check if a city can build naval units or water-dependent buildings
   * @param city - The city to check
   * @param worldMap - The game world map
   * @returns true if the city can build naval/water items
   */
  public static canBuildNavalItems(city: City, worldMap: Tile[][]): boolean {
    return this.hasWaterAccess(city, worldMap);
  }
  
  /**
   * Get a descriptive message about why a city can't build naval items
   * @param city - The city that can't build naval items
   * @returns A descriptive message
   */
  public static getWaterAccessMessage(city: City): string {
    return `${city.name} must be located on or adjacent to water (ocean or river) to build naval units and water-dependent buildings.`;
  }
}
