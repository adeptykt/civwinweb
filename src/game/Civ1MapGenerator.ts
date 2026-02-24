import type { Tile } from '../types/game';
import { TerrainType, TerrainVariant } from '../types/game';
import { TerrainManager } from '../terrain/index';
// Credit: mycophobia / https://forums.civfanatics.com/threads/civ-1-style.691991/
export class Civ1MapGenerator {
  // Default map size similar to Civ 1
  private static readonly DEFAULT_WIDTH = 80;
  private static readonly DEFAULT_HEIGHT = 50;
  
  // World size settings that control land mass amount
  public static readonly WorldSize = {
    TINY: 0,
    SMALL: 1,
    MEDIUM: 2,
    LARGE: 3,
    HUGE: 4,
    GIGANTIC: 5
  };
  
  // Land limits based on world size (number of land tiles)
  // Increased for better gameplay - aiming for 50-75% land coverage
  private static readonly LAND_LIMITS = {
    [Civ1MapGenerator.WorldSize.TINY]: 1600,    // ~40% land coverage
    [Civ1MapGenerator.WorldSize.SMALL]: 2000,   // ~50% land coverage
    [Civ1MapGenerator.WorldSize.MEDIUM]: 2400,  // ~60% land coverage
    [Civ1MapGenerator.WorldSize.LARGE]: 2800,   // ~70% land coverage
    [Civ1MapGenerator.WorldSize.HUGE]: 3200,    // ~80% land coverage
    [Civ1MapGenerator.WorldSize.GIGANTIC]: 3600 // ~90% land coverage
  };

  // Generate a Civ 1-style map
  public generateCiv1Map(width: number = Civ1MapGenerator.DEFAULT_WIDTH, 
                        height: number = Civ1MapGenerator.DEFAULT_HEIGHT, 
                        worldSize: number = Civ1MapGenerator.WorldSize.MEDIUM): Tile[][] {
    console.log(`Generating Civ 1-style map (${width}x${height}, world size: ${worldSize})...`);
    
    // Generate the height map using Civ 1 algorithm
    const heightMap = this.addChunks(width, height, worldSize);
    
    // Convert height map to terrain map
    const map = this.convertHeightMapToTerrain(heightMap, width, height);
    
    // Add terrain features
    this.addTerrainFeatures(map, width, height);
    
    // Add terrain variants (shield grassland, shield river)
    this.addTerrainVariants(map, width, height);
    
    // Add resources
    this.addResources(map, width, height);

    return map;
  }

  // Main chunk generation algorithm from the Python script
  private addChunks(width: number, height: number, landMass: number): number[][] {
    // Initialize height map with ocean (0)
    const worldMap: number[][] = [];
    for (let y = 0; y < height; y++) {
      worldMap[y] = new Array(width).fill(0);
    }

    // Get land limit based on world size
    const landLimit = Civ1MapGenerator.LAND_LIMITS[landMass] || Civ1MapGenerator.LAND_LIMITS[Civ1MapGenerator.WorldSize.MEDIUM];
    
    // First, generate large continents to ensure substantial landmasses
    this.generateLargeContinents(worldMap, width, height, landMass);
    
    // Then generate smaller chunks until we have enough land
    while (!this.sufficientMass(worldMap, width, height, landLimit)) {
      this.generateChunk(worldMap, width, height);
    }
    
    // Apply erosion to smooth the terrain
    this.doErosion(worldMap, width, height);
    
    // Correct diagonal X-shaped patterns for land
    this.correctXPatterns(worldMap, width, height, true);
    
    // Correct diagonal X-shaped patterns for sea
    this.correctXPatterns(worldMap, width, height, false);
    
    // Generate initial large continents for better land distribution
    this.generateLargeContinents(worldMap, width, height, landMass);
    
    return worldMap;
  }

  // Generate a single chunk of land using random walk
  private generateChunk(worldMap: number[][], width: number, height: number): void {
    // Generate random starting position (with more generous margins)
    const startX = this.randomInt(60) + 10;
    const startY = this.randomInt(30) + 10;
    let pathLength = this.randomInt(120) + 80; // Much longer paths for bigger landmasses
    
    // Out of bounds limits (less restrictive to allow bigger continents)
    const oobX = [2, 77];
    const oobY = [2, 47];
    
    // Track the path
    const stencil: Array<[number, number]> = [];
    let currentX = startX;
    let currentY = startY;
    
    // Create random walk path with larger landmasses
    while (pathLength > 0) {
      // Add current position and create a thicker landmass (3x3 pattern)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          stencil.push([currentX + dx, currentY + dy]);
        }
      }
      
      // Choose random direction: up, down, left, right
      const direction = this.randomInt(4);
      const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      const [dx, dy] = directions[direction];
      
      currentX += dx;
      currentY += dy;
      pathLength--;
      
      // Stop if we go out of bounds
      if (currentX > oobX[1] || currentY > oobY[1] || currentX < oobX[0] || currentY < oobY[0]) {
        pathLength = 0;
      }
    }
    
    // Apply the stencil to the world map (remove duplicates)
    const uniquePoints = new Set(stencil.map(([x, y]) => `${x},${y}`));
    for (const pointStr of uniquePoints) {
      const [x, y] = pointStr.split(',').map(Number);
      if (x >= 0 && x < width && y >= 0 && y < height) {
        worldMap[y][x] += 1;
      }
    }
  }

  // Check if we have enough land mass
  private sufficientMass(worldMap: number[][], width: number, height: number, landLimit: number): boolean {
    let landTiles = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (worldMap[y][x] > 0) {
          landTiles++;
        }
      }
    }
    return landTiles >= landLimit;
  }

  // Apply erosion to reduce height of random tiles
  private doErosion(worldMap: number[][], width: number, height: number): void {
    // Reduced erosion iterations to preserve more landmass
    let iterations = 800; // Reduced from 1600
    while (iterations > 0) {
      const randX = this.randomInt(width);
      const randY = this.randomInt(height);
      // Only erode tiles that are higher than 2 to preserve basic landmass
      if (worldMap[randY][randX] > 2) {
        worldMap[randY][randX] = Math.max(1, worldMap[randY][randX] - 1);
      }
      iterations--;
    }
  }

  // Correct X-shaped diagonal patterns (both land and sea)
  private correctXPatterns(worldMap: number[][], width: number, height: number, isLand: boolean): void {
    let needsCorrection = true;
    
    while (needsCorrection) {
      needsCorrection = false;
      
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (isLand) {
            // Correct land X patterns
            if (this.correctXLand(worldMap, x, y)) {
              needsCorrection = true;
              break;
            }
          } else {
            // Correct sea X patterns
            if (this.correctXSea(worldMap, x, y)) {
              needsCorrection = true;
              break;
            }
          }
        }
        if (needsCorrection) break;
      }
    }
  }

  // Correct X-shaped land patterns
  private correctXLand(worldMap: number[][], x: number, y: number): boolean {
    if (worldMap[y][x] > 0) {
      if (worldMap[y + 1][x] === 0 && worldMap[y][x + 1] === 0 && worldMap[y + 1][x + 1] > 0) {
        worldMap[y + 1][x] = worldMap[y][x];
        worldMap[y][x + 1] = worldMap[y][x];
        return true;
      }
    }
    return false;
  }

  // Correct X-shaped sea patterns
  private correctXSea(worldMap: number[][], x: number, y: number): boolean {
    if (worldMap[y][x] === 0) {
      if (worldMap[y + 1][x] > 0 && worldMap[y][x + 1] > 0 && worldMap[y + 1][x + 1] === 0) {
        worldMap[y + 1][x + 1] = 3;
        return true;
      }
    }
    return false;
  }

  // Convert height map to terrain tiles
  private convertHeightMapToTerrain(heightMap: number[][], width: number, height: number): Tile[][] {
    const map: Tile[][] = [];

    for (let y = 0; y < height; y++) {
      map[y] = [];
      for (let x = 0; x < width; x++) {
        let terrain: TerrainType;
        
        // Convert height values to terrain types
        if (heightMap[y][x] === 0) {
          terrain = TerrainType.OCEAN;
        } else if (heightMap[y][x] === 1) {
          terrain = TerrainType.GRASSLAND;
        } else if (heightMap[y][x] >= 2) {
          terrain = TerrainType.HILLS;
        } else {
          terrain = TerrainType.OCEAN;
        }

        map[y][x] = {
          position: { x, y },
          terrain,
          resources: [],
          improvements: []
        };
      }
    }

    return map;
  }

  // Add terrain features like forests, deserts, etc.
  private addTerrainFeatures(map: Tile[][], width: number, height: number): void {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = map[y][x];
        
        // Only modify land tiles
        if (tile.terrain === TerrainType.OCEAN) continue;
        
        // Apply terrain variations based on latitude and randomness
        const latitude = y / height; // 0 = north, 1 = south
        
        // Arctic regions (far north and south)
        if (latitude < 0.1 || latitude > 0.9) {
          if (Math.random() < 0.3) {
            tile.terrain = TerrainType.ARCTIC;
          } else if (Math.random() < 0.5) {
            tile.terrain = TerrainType.TUNDRA;
          }
        }
        // Desert regions (around 25-35% latitude)
        else if ((latitude > 0.25 && latitude < 0.35) || (latitude > 0.65 && latitude < 0.75)) {
          if (Math.random() < 0.28) { // 28% desert as per original
            tile.terrain = TerrainType.DESERT;
          } else if (Math.random() < 0.22) { // 22% plains as per original
            tile.terrain = TerrainType.PLAINS;
          }
        }
        // Temperate regions
        else if ((latitude > 0.15 && latitude < 0.25) || (latitude > 0.75 && latitude < 0.85)) {
          if (Math.random() < 0.4) {
            tile.terrain = TerrainType.FOREST;
          } else if (Math.random() < 0.3) {
            tile.terrain = TerrainType.PLAINS;
          }
        }
        // Tropical regions
        else if (latitude > 0.35 && latitude < 0.65) {
          if (Math.random() < 0.4) { // 40% jungle as per original
            tile.terrain = TerrainType.JUNGLE;
          } else if (Math.random() < 0.1) {
            tile.terrain = TerrainType.SWAMP;
          }
        }
      }
    }

    // Add some rivers connecting different regions
    this.addRandomRivers(map, width, height);
  }

  // Add random rivers to the map
  private addRandomRivers(map: Tile[][], width: number, height: number): void {
    const riverCount = Math.floor((width * height) / 800); // About 1 river per 800 tiles
    
    for (let i = 0; i < riverCount; i++) {
      const startX = this.randomInt(width);
      const startY = this.randomInt(height);
      const length = this.randomInt(20) + 10;
      
      this.traceRiver(map, startX, startY, length, width, height);
    }
  }

  // Trace a river from a starting point
  private traceRiver(map: Tile[][], startX: number, startY: number, length: number, width: number, height: number): void {
    let currentX = startX;
    let currentY = startY;
    
    for (let i = 0; i < length; i++) {
      if (currentX >= 0 && currentX < width && currentY >= 0 && currentY < height) {
        const tile = map[currentY][currentX];
        if (tile.terrain !== TerrainType.OCEAN && tile.terrain !== TerrainType.MOUNTAINS) {
          tile.terrain = TerrainType.RIVER;
        }
      }
      
      // Random walk for river
      const direction = this.randomInt(4);
      const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      const [dx, dy] = directions[direction];
      
      currentX += dx;
      currentY += dy;
      
      // Stop if we hit the edge
      if (currentX < 0 || currentX >= width || currentY < 0 || currentY >= height) {
        break;
      }
    }
  }

  // Add terrain variants like shield grassland and shield river
  private addTerrainVariants(map: Tile[][], width: number, height: number): void {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = map[y][x];
        
        // Add shield variants to grassland and river tiles
        if (tile.terrain === TerrainType.GRASSLAND) {
          // Create a more natural, less predictable pattern for shield grassland
          // Use multiple factors to create pseudo-randomness with some clustering
          const seed1 = (x * 17 + y * 23) % 100;
          const seed2 = (x * 31 + y * 41) % 100;
          const seed3 = (x * 7 + y * 13) % 100;
          
          // Combine multiple noise sources for more natural distribution
          const noiseValue = (seed1 + seed2 * 0.7 + seed3 * 0.3) % 100;
          
          // About 15% of grassland should be shield grassland, but with clustering
          // Add some clustering bias based on nearby coordinates
          const clusterBias = ((x / 3) + (y / 3)) % 7;
          const finalValue = (noiseValue + clusterBias * 5) % 100;
          
          const isShieldGrassland = finalValue < 15;
          if (isShieldGrassland) {
            tile.terrainVariant = TerrainVariant.SHIELD;
          }
        } else if (tile.terrain === TerrainType.RIVER) {
          // River shield variants should be rarer and more random
          const riverSeed = (x * 43 + y * 67) % 100;
          const isShieldRiver = riverSeed < 25; // 25% chance for shield river
          if (isShieldRiver) {
            tile.terrainVariant = TerrainVariant.SHIELD;
          }
        }
      }
    }
  }

  // Add resources to the map
  private addResources(map: Tile[][], width: number, height: number): void {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = map[y][x];

        // Get terrain instance and check for resources
        const terrain = TerrainManager.getTerrain(tile.terrain);
        
        // Check each possible resource for this terrain
        for (const resource of terrain.possibleResources) {
          const probability = terrain.getResourceProbability(resource);
          if (Math.random() < probability) {
            tile.resources = tile.resources || [];
            tile.resources.push(resource);
            break; // Only add one resource per tile
          }
        }
      }
    }
  }

  // Simple random number generator (replacement for CyGame().getSorenRandNum)
  private randomInt(max: number): number {
    return Math.floor(Math.random() * max);
  }

  // Generate initial large continents for better land distribution
  private generateLargeContinents(worldMap: number[][], width: number, height: number, landMass: number): void {
    // Number of large continents based on world size
    const continentCount = Math.max(2, Math.floor(landMass / 2) + 1);
    
    for (let i = 0; i < continentCount; i++) {
      // Create large continent with substantial size
      const centerX = this.randomInt(width - 20) + 10;
      const centerY = this.randomInt(height - 20) + 10;
      const continentSize = 80 + this.randomInt(60); // 80-140 tiles per continent
      
      this.generateLargeContinent(worldMap, centerX, centerY, continentSize, width, height);
    }
  }

  // Generate a single large continent
  private generateLargeContinent(worldMap: number[][], centerX: number, centerY: number, size: number, width: number, height: number): void {
    let currentX = centerX;
    let currentY = centerY;
    let tilesPlaced = 0;
    
    while (tilesPlaced < size) {
      // Create a cluster of land around current position
      const clusterSize = 3 + this.randomInt(4); // 3-6 tile clusters
      
      for (let dy = -clusterSize; dy <= clusterSize; dy++) {
        for (let dx = -clusterSize; dx <= clusterSize; dx++) {
          const x = currentX + dx;
          const y = currentY + dy;
          
          if (x >= 0 && x < width && y >= 0 && y < height) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= clusterSize && Math.random() < 0.7) {
              worldMap[y][x] += 1;
              tilesPlaced++;
            }
          }
        }
      }
      
      // Move to next position with some randomness but bias toward expanding the continent
      const direction = this.randomInt(8);
      const directions = [
        [-1, -1], [0, -1], [1, -1],
        [-1,  0],          [1,  0],
        [-1,  1], [0,  1], [1,  1]
      ];
      const [dx, dy] = directions[direction];
      
      currentX = Math.max(5, Math.min(width - 5, currentX + dx * (2 + this.randomInt(3))));
      currentY = Math.max(5, Math.min(height - 5, currentY + dy * (2 + this.randomInt(3))));
    }
  }
}
