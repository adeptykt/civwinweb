import type { Tile, MapScenario } from '../types/game';
import { TerrainType, TerrainVariant } from '../types/game';
import { TerrainManager } from '../terrain/index';
import { EarthMapGenerator } from './EarthMapGenerator';
import { Civ1MapGenerator } from './Civ1MapGenerator';

export class MapGenerator {
  private earthMapGenerator: EarthMapGenerator;
  private civ1MapGenerator: Civ1MapGenerator;

  constructor() {
    this.earthMapGenerator = new EarthMapGenerator();
    this.civ1MapGenerator = new Civ1MapGenerator();
  }
  
  // Generate a map based on scenario
  public generateMap(width: number, height: number, scenario: MapScenario = 'random'): Tile[][] {
    console.log(`Generating ${scenario} map of size ${width}x${height}`);
    
    switch (scenario) {
      case 'earth':
        return this.earthMapGenerator.generateEarthMap(width, height);
      case 'civ1':
        return this.civ1MapGenerator.generateCiv1Map(width, height);
      case 'random':
      default:
        return this.generateRandomMap(width, height);
    }
  }

  // Generate a map based on scenario with optional world size for Civ1
  public generateMapWithWorldSize(width: number, height: number, scenario: MapScenario = 'random', worldSize?: number): Tile[][] {
    console.log(`Generating ${scenario} map of size ${width}x${height}${worldSize !== undefined ? ` (world size: ${worldSize})` : ''}`);
    
    switch (scenario) {
      case 'earth':
        return this.earthMapGenerator.generateEarthMap(width, height);
      case 'civ1':
        return this.civ1MapGenerator.generateCiv1Map(width, height, worldSize);
      case 'random':
      default:
        return this.generateRandomMap(width, height);
    }
  }

  // Generate a random world map (original implementation)
  private generateRandomMap(width: number, height: number): Tile[][] {
    const map: Tile[][] = [];

    // Initialize empty map
    for (let y = 0; y < height; y++) {
      map[y] = [];
      for (let x = 0; x < width; x++) {
        map[y][x] = {
          position: { x, y },
          terrain: TerrainType.GRASSLAND,
          resources: [],
          improvements: []
        };
      }
    }

    // Generate terrain using simple noise
    this.generateTerrain(map, width, height);
    
    // Add terrain variants (shield grassland, shield river)
    this.addTerrainVariants(map, width, height);
    
    // Add resources
    this.addResources(map, width, height);

    return map;
  }

  // Generate terrain using clustered algorithm for connected regions
  private generateTerrain(map: Tile[][], width: number, height: number): void {
    // First, set base grassland
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        map[y][x].terrain = TerrainType.GRASSLAND;
      }
    }

    this.generateOceanBorders(map, width, height);
    this.generateArcticBorders(map, width, height);
    this.generateMountainRanges(map, width, height);
    this.generateHillRegions(map, width, height);
    this.generateForestRegions(map, width, height);
    this.generateDesertRegions(map, width, height);
    this.generateJunglePatches(map, width, height);
    this.generateSwampPatches(map, width, height);
    this.addRivers(map, width, height);
    this.smoothCoastlines(map, width, height);
  }

  private generateOceanBorders(map: Tile[][], width: number, height: number): void {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const distanceFromCenter = Math.sqrt(
          Math.pow(x - width / 2, 2) + Math.pow(y - height / 2, 2)
        );
        const maxDistance = Math.sqrt(Math.pow(width / 2, 2) + Math.pow(height / 2, 2));
        const oceanFactor = distanceFromCenter / maxDistance;

        // Smooth ocean borders with gentle variation
        const smoothNoise = Math.sin(x * 0.1) * Math.cos(y * 0.08) * 0.05;
        const adjustedFactor = oceanFactor + smoothNoise;

        // Ocean at edges with smooth transition
        if (adjustedFactor > 0.85) {
          map[y][x].terrain = TerrainType.OCEAN;
        } else if (adjustedFactor > 0.75 && Math.random() < 0.3) {
          map[y][x].terrain = TerrainType.OCEAN;
        }
      }
    }
  }

  // Generate arctic or ocean tiles at top and bottom borders
  private generateArcticBorders(map: Tile[][], width: number, height: number): void {
    // Top border - extend 1-2 tiles down randomly
    const topBorderHeight = Math.floor(Math.random() * 2) + 1; // 1 or 2 tiles
    
    for (let y = 0; y < Math.min(topBorderHeight, height); y++) {
      for (let x = 0; x < width; x++) {
        // Apply arctic/ocean to ALL tiles in the border zone, not just land
        // Higher probability for first row, lower for second row
        const arcticProbability = y === 0 ? 0.8 : 0.4;
        
        // Add some noise for natural borders
        const noise = Math.sin(x * 0.15) * Math.cos(y * 0.2) * 0.1;
        const finalProbability = arcticProbability + noise;
        
        if (Math.random() < finalProbability) {
          map[y][x].terrain = Math.random() < 0.7 ? TerrainType.ARCTIC : TerrainType.OCEAN;
        }
      }
    }
    
    // Bottom border - extend 1-2 tiles up randomly
    const bottomBorderHeight = Math.floor(Math.random() * 2) + 1; // 1 or 2 tiles
    
    for (let y = Math.max(height - bottomBorderHeight, 0); y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Apply arctic/ocean to ALL tiles in the border zone, not just land
        // Higher probability for last row, lower for second-to-last row
        const distanceFromBottom = height - 1 - y;
        const arcticProbability = distanceFromBottom === 0 ? 0.8 : 0.4;
        
        // Add some noise for natural borders
        const noise = Math.sin(x * 0.15) * Math.cos(y * 0.2) * 0.1;
        const finalProbability = arcticProbability + noise;
        
        if (Math.random() < finalProbability) {
          map[y][x].terrain = Math.random() < 0.7 ? TerrainType.ARCTIC : TerrainType.OCEAN;
        }
      }
    }
  }

  // Generate connected mountain ranges
  private generateMountainRanges(map: Tile[][], width: number, height: number): void {
    const numRanges = Math.floor((width * height) / 800) + 2;
    
    for (let i = 0; i < numRanges; i++) {
      // Pick a random starting point away from ocean
      let startX, startY;
      let attempts = 0;
      do {
        startX = Math.floor(Math.random() * (width - 10)) + 5;
        startY = Math.floor(Math.random() * (height - 10)) + 5;
        attempts++;
      } while (map[startY][startX].terrain === TerrainType.OCEAN && attempts < 20);
      
      if (attempts < 20) {
        this.createMountainRange(map, startX, startY, width, height);
      }
    }
  }

  // Create a single mountain range
  private createMountainRange(map: Tile[][], startX: number, startY: number, width: number, height: number): void {
    const rangeLength = Math.floor(Math.random() * 8) + 4;
    let x = startX;
    let y = startY;
    let direction = Math.floor(Math.random() * 4); // 0=N, 1=E, 2=S, 3=W
    
    for (let i = 0; i < rangeLength; i++) {
      // Place mountain cluster at current position
      this.placeMountainCluster(map, x, y, width, height);
      
      // Move in the current direction with slight variations
      const directionChange = Math.random();
      if (directionChange < 0.1) {
        direction = (direction + 1) % 4; // Turn right
      } else if (directionChange < 0.2) {
        direction = (direction + 3) % 4; // Turn left
      }
      
      // Move in current direction
      switch (direction) {
        case 0: y--; break; // North
        case 1: x++; break; // East
        case 2: y++; break; // South
        case 3: x--; break; // West
      }
      
      // Stay within bounds
      x = Math.max(1, Math.min(width - 2, x));
      y = Math.max(1, Math.min(height - 2, y));
    }
  }

  // Place a cluster of mountains
  private placeMountainCluster(map: Tile[][], centerX: number, centerY: number, width: number, height: number): void {
    const clusterSize = Math.floor(Math.random() * 3) + 2;
    
    for (let dy = -clusterSize; dy <= clusterSize; dy++) {
      for (let dx = -clusterSize; dx <= clusterSize; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (x >= 0 && x < width && y >= 0 && y < height && distance <= clusterSize) {
          if (map[y][x].terrain !== TerrainType.OCEAN) {
            const probability = 1 - (distance / clusterSize);
            if (Math.random() < probability * 0.8) {
              map[y][x].terrain = TerrainType.MOUNTAINS;
            }
          }
        }
      }
    }
  }

  // Generate connected hill regions
  private generateHillRegions(map: Tile[][], width: number, height: number): void {
    const numRegions = Math.floor((width * height) / 600) + 1;
    
    for (let i = 0; i < numRegions; i++) {
      let startX, startY;
      let attempts = 0;
      do {
        startX = Math.floor(Math.random() * (width - 6)) + 3;
        startY = Math.floor(Math.random() * (height - 6)) + 3;
        attempts++;
      } while ((map[startY][startX].terrain === TerrainType.OCEAN || 
                map[startY][startX].terrain === TerrainType.MOUNTAINS) && attempts < 20);
      
      if (attempts < 20) {
        this.createHillRegion(map, startX, startY, width, height);
      }
    }
  }

  // Create a connected hill region
  private createHillRegion(map: Tile[][], centerX: number, centerY: number, width: number, height: number): void {
    const regionSize = Math.floor(Math.random() * 4) + 3;
    
    for (let dy = -regionSize; dy <= regionSize; dy++) {
      for (let dx = -regionSize; dx <= regionSize; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (x >= 0 && x < width && y >= 0 && y < height && distance <= regionSize) {
          if (map[y][x].terrain === TerrainType.GRASSLAND) {
            const probability = 1 - (distance / regionSize);
            if (Math.random() < probability * 0.6) {
              map[y][x].terrain = TerrainType.HILLS;
            }
          }
        }
      }
    }
  }

  // Generate connected forest regions
  private generateForestRegions(map: Tile[][], width: number, height: number): void {
    const numForests = Math.floor((width * height) / 400) + 2;
    
    for (let i = 0; i < numForests; i++) {
      let startX, startY;
      let attempts = 0;
      do {
        startX = Math.floor(Math.random() * (width - 8)) + 4;
        startY = Math.floor(Math.random() * (height - 8)) + 4;
        attempts++;
      } while ((map[startY][startX].terrain !== TerrainType.GRASSLAND && 
                map[startY][startX].terrain !== TerrainType.HILLS) && attempts < 20);
      
      if (attempts < 20) {
        this.createForestRegion(map, startX, startY, width, height);
      }
    }
  }

  // Create a connected forest region
  private createForestRegion(map: Tile[][], centerX: number, centerY: number, width: number, height: number): void {
    const forestSize = Math.floor(Math.random() * 5) + 4;
    
    for (let dy = -forestSize; dy <= forestSize; dy++) {
      for (let dx = -forestSize; dx <= forestSize; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (x >= 0 && x < width && y >= 0 && y < height && distance <= forestSize) {
          if (map[y][x].terrain === TerrainType.GRASSLAND || map[y][x].terrain === TerrainType.HILLS) {
            const probability = 1 - (distance / forestSize);
            if (Math.random() < probability * 0.7) {
              map[y][x].terrain = TerrainType.FOREST;
            }
          }
        }
      }
    }
  }

  // Generate desert regions
  private generateDesertRegions(map: Tile[][], width: number, height: number): void {
    const numDeserts = Math.floor((width * height) / 1000) + 1;
    
    for (let i = 0; i < numDeserts; i++) {
      let startX, startY;
      let attempts = 0;
      do {
        startX = Math.floor(Math.random() * (width - 6)) + 3;
        startY = Math.floor(Math.random() * (height - 6)) + 3;
        attempts++;
      } while (map[startY][startX].terrain !== TerrainType.GRASSLAND && attempts < 20);
      
      if (attempts < 20) {
        this.createDesertRegion(map, startX, startY, width, height);
      }
    }
  }

  // Create a connected desert region
  private createDesertRegion(map: Tile[][], centerX: number, centerY: number, width: number, height: number): void {
    const desertSize = Math.floor(Math.random() * 4) + 3;
    
    for (let dy = -desertSize; dy <= desertSize; dy++) {
      for (let dx = -desertSize; dx <= desertSize; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (x >= 0 && x < width && y >= 0 && y < height && distance <= desertSize) {
          if (map[y][x].terrain === TerrainType.GRASSLAND) {
            const probability = 1 - (distance / desertSize);
            if (Math.random() < probability * 0.8) {
              map[y][x].terrain = TerrainType.DESERT;
            }
          }
        }
      }
    }
  }

  // Generate jungle patches
  private generateJunglePatches(map: Tile[][], width: number, height: number): void {
    const numJungles = Math.floor((width * height) / 1200);
    
    for (let i = 0; i < numJungles; i++) {
      let startX, startY;
      let attempts = 0;
      do {
        startX = Math.floor(Math.random() * (width - 4)) + 2;
        startY = Math.floor(Math.random() * (height - 4)) + 2;
        attempts++;
      } while (map[startY][startX].terrain !== TerrainType.GRASSLAND && attempts < 20);
      
      if (attempts < 20) {
        this.createJunglePatch(map, startX, startY, width, height);
      }
    }
  }

  // Create a small jungle patch
  private createJunglePatch(map: Tile[][], centerX: number, centerY: number, width: number, height: number): void {
    const jungleSize = Math.floor(Math.random() * 2) + 2;
    
    for (let dy = -jungleSize; dy <= jungleSize; dy++) {
      for (let dx = -jungleSize; dx <= jungleSize; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (x >= 0 && x < width && y >= 0 && y < height && distance <= jungleSize) {
          if (map[y][x].terrain === TerrainType.GRASSLAND) {
            const probability = 1 - (distance / jungleSize);
            if (Math.random() < probability * 0.6) {
              map[y][x].terrain = TerrainType.JUNGLE;
            }
          }
        }
      }
    }
  }

  // Generate swamp patches
  private generateSwampPatches(map: Tile[][], width: number, height: number): void {
    const numSwamps = Math.floor((width * height) / 1500); // Fewer swamps than jungles
    
    for (let i = 0; i < numSwamps; i++) {
      let startX, startY;
      let attempts = 0;
      do {
        startX = Math.floor(Math.random() * (width - 4)) + 2;
        startY = Math.floor(Math.random() * (height - 4)) + 2;
        attempts++;
      } while (map[startY][startX].terrain !== TerrainType.GRASSLAND && attempts < 20);
      
      if (attempts < 20) {
        this.createSwampPatch(map, startX, startY, width, height);
      }
    }
  }

  // Create a small swamp patch
  private createSwampPatch(map: Tile[][], centerX: number, centerY: number, width: number, height: number): void {
    const swampSize = Math.floor(Math.random() * 2) + 1; // Smaller than jungle patches
    
    for (let dy = -swampSize; dy <= swampSize; dy++) {
      for (let dx = -swampSize; dx <= swampSize; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (x >= 0 && x < width && y >= 0 && y < height && distance <= swampSize) {
          if (map[y][x].terrain === TerrainType.GRASSLAND) {
            const probability = 1 - (distance / swampSize);
            if (Math.random() < probability * 0.5) {
              map[y][x].terrain = TerrainType.SWAMP;
            }
          }
        }
      }
    }
  }

  // Add rivers to the map
  private addRivers(map: Tile[][], width: number, height: number): void {
    const numRivers = Math.floor((width * height) / 500);
    
    for (let i = 0; i < numRivers; i++) {
      const startX = Math.floor(Math.random() * width);
      const startY = Math.floor(Math.random() * height);
      
      this.traceRiver(map, startX, startY, width, height);
    }
  }

  // Trace a river from a starting point
  private traceRiver(map: Tile[][], startX: number, startY: number, width: number, height: number): void {
    let x = startX;
    let y = startY;
    const riverLength = Math.floor(Math.random() * 10) + 5;

    for (let i = 0; i < riverLength; i++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        // Don't override ocean or mountains
        if (map[y][x].terrain !== TerrainType.OCEAN && map[y][x].terrain !== TerrainType.MOUNTAINS) {
          map[y][x].terrain = TerrainType.RIVER;
        }
      }

      // Move in a somewhat random direction
      const direction = Math.floor(Math.random() * 4);
      switch (direction) {
        case 0: x++; break; // East
        case 1: x--; break; // West
        case 2: y++; break; // South
        case 3: y--; break; // North
      }
    }
  }

  // Add resources to the map
  private addResources(map: Tile[][], width: number, height: number): void {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = map[y][x];

        // Only add resources to land tiles
        if (tile.terrain === TerrainType.OCEAN) continue;

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

  // Smooth coastlines to reduce noise and create more natural-looking shores
  private smoothCoastlines(map: Tile[][], width: number, height: number): void {
    // Create a copy of the map to avoid modifying while reading
    const originalMap = map.map(row => row.map(tile => ({ ...tile })));
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const currentTile = originalMap[y][x];
        
        // Only process coastline tiles (land adjacent to ocean or vice versa)
        if (this.isCoastlineTile(originalMap, x, y, width, height)) {
          // Count neighboring terrain types
          let landCount = 0;
          let oceanCount = 0;
          
          // Check 8-connected neighbors
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              
              const nx = x + dx;
              const ny = y + dy;
              
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                if (originalMap[ny][nx].terrain === TerrainType.OCEAN) {
                  oceanCount++;
                } else if (originalMap[ny][nx].terrain !== TerrainType.MOUNTAINS) {
                  landCount++;
                }
              }
            }
          }
          
          // Smooth based on majority of neighbors
          if (currentTile.terrain === TerrainType.OCEAN && landCount >= 6) {
            // Convert isolated ocean to land
            map[y][x].terrain = TerrainType.GRASSLAND;
          } else if (currentTile.terrain !== TerrainType.OCEAN && 
                     currentTile.terrain !== TerrainType.MOUNTAINS && 
                     oceanCount >= 6) {
            // Convert isolated land to ocean
            map[y][x].terrain = TerrainType.OCEAN;
          }
        }
      }
    }
  }

  // Check if a tile is part of a coastline (land-ocean boundary)
  private isCoastlineTile(map: Tile[][], x: number, y: number, width: number, height: number): boolean {
    const currentTerrain = map[y][x].terrain;
    
    // Check adjacent tiles for different terrain types
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const neighborTerrain = map[ny][nx].terrain;
          
          // If current is ocean and neighbor is land, or vice versa, it's coastline
          if ((currentTerrain === TerrainType.OCEAN && neighborTerrain !== TerrainType.OCEAN) ||
              (currentTerrain !== TerrainType.OCEAN && neighborTerrain === TerrainType.OCEAN)) {
            return true;
          }
        }
      }
    }
    
    return false;
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
}
