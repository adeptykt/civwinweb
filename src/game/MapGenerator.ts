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

  // Generate terrain using noise-based algorithm for more realistic distribution
  private generateTerrain(map: Tile[][], width: number, height: number): void {
    // First, set base grassland
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        map[y][x].terrain = TerrainType.GRASSLAND;
      }
    }

    // Generate terrain using noise-based approach for more realistic distribution
    this.generateTerrainWithNoise(map, width, height);
    this.generateOceanBorders(map, width, height);
    this.generateArcticBorders(map, width, height);
    this.addRivers(map, width, height);
    this.smoothCoastlines(map, width, height);
    
    // Add final terrain mixing pass for more natural variation
    this.addTerrainMixing(map, width, height);
  }

  // Generate terrain using noise-based approach for more realistic distribution
  private generateTerrainWithNoise(map: Tile[][], width: number, height: number): void {
    // Use much higher frequency noise for smaller terrain patches
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Create multiple noise layers with higher frequencies for smaller features
        const elevation = this.noise(x * 0.3, y * 0.3) + 
                         this.noise(x * 0.6, y * 0.6) * 0.5 + 
                         this.noise(x * 1.2, y * 1.2) * 0.25;
        
        const temperature = this.noise(x * 0.25 + 1000, y * 0.25 + 1000) +
                           this.noise(x * 0.5 + 1000, y * 0.5 + 1000) * 0.3;
        
        const humidity = this.noise(x * 0.35 + 2000, y * 0.35 + 2000) +
                        this.noise(x * 0.7 + 2000, y * 0.7 + 2000) * 0.4;

        // Add some fine-grained randomness for more variation
        const randomFactor = (Math.random() - 0.5) * 0.3;
        const finalElevation = elevation + randomFactor;
        const finalTemperature = temperature + randomFactor * 0.5;
        const finalHumidity = humidity + randomFactor * 0.5;

        // Determine terrain based on elevation, temperature, and humidity
        const terrain = this.getTerrainFromNoise(finalElevation, finalTemperature, finalHumidity);
        
        // Only place terrain on non-ocean tiles (ocean borders are handled separately)
        if (map[y][x].terrain !== TerrainType.OCEAN) {
          map[y][x].terrain = terrain;
        }
      }
    }
    
    // Add some scattered special features for variety
    this.addScatteredFeatures(map, width, height);
  }

  // Simple noise function (pseudo-Perlin noise)
  private noise(x: number, y: number): number {
    // More complex noise implementation with better randomness
    const seed1 = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    const seed2 = Math.sin(x * 93.9898 + y * 47.233) * 19768.5453;
    const seed3 = Math.sin(x * 67.9898 + y * 32.233) * 31768.5453;
    
    const noise1 = (seed1 - Math.floor(seed1)) * 2 - 1;
    const noise2 = (seed2 - Math.floor(seed2)) * 2 - 1;
    const noise3 = (seed3 - Math.floor(seed3)) * 2 - 1;
    
    // Combine multiple noise sources for better distribution
    return (noise1 + noise2 * 0.5 + noise3 * 0.25) / 1.75;
  }

  // Determine terrain type based on noise values
  private getTerrainFromNoise(elevation: number, temperature: number, humidity: number): TerrainType {
    // Normalize values to roughly -1 to 1 range
    const e = Math.max(-1, Math.min(1, elevation));
    const t = Math.max(-1, Math.min(1, temperature));
    const h = Math.max(-1, Math.min(1, humidity));

    // Mountains (very high elevation)
    if (e > 0.8) {
      return TerrainType.MOUNTAINS;
    }
    
    // Hills (high elevation)
    if (e > 0.5) {
      return TerrainType.HILLS;
    }
    
    // Desert (hot and dry)
    if (t > 0.3 && h < -0.3) {
      return TerrainType.DESERT;
    }
    
    // Jungle (hot and very humid)
    if (t > 0.4 && h > 0.6) {
      return TerrainType.JUNGLE;
    }
    
    // Swamp (low elevation and humid)
    if (e < -0.3 && h > 0.4) {
      return TerrainType.SWAMP;
    }
    
    // Forest (moderate conditions with some humidity)
    if (t > -0.1 && t < 0.5 && h > 0.2 && h < 0.7) {
      return TerrainType.FOREST;
    }
    
    // Plains (drier conditions)
    if (h < 0.1 && t > -0.2) {
      return TerrainType.PLAINS;
    }
    
    // Default to grassland for everything else
    return TerrainType.GRASSLAND;
  }

  // Add scattered special features for variety
  private addScatteredFeatures(map: Tile[][], width: number, height: number): void {
    // Add much smaller, more frequent terrain variations
    const featureCount = Math.floor((width * height) / 50); // More frequent small features
    
    for (let i = 0; i < featureCount; i++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      
      // Only modify grassland and plains for subtle variation
      if (map[y][x].terrain === TerrainType.GRASSLAND || map[y][x].terrain === TerrainType.PLAINS) {
        const rand = Math.random();
        if (rand < 0.4) {
          map[y][x].terrain = TerrainType.FOREST;
        } else if (rand < 0.6) {
          map[y][x].terrain = TerrainType.HILLS;
        } else if (rand < 0.8) {
          // Swap between grassland and plains
          map[y][x].terrain = map[y][x].terrain === TerrainType.GRASSLAND ? 
                              TerrainType.PLAINS : TerrainType.GRASSLAND;
        }
        // Very small chance for special terrain
        else if (rand < 0.9) {
          map[y][x].terrain = TerrainType.SWAMP;
        }
      }
      // Also add some variation to existing forest
      else if (map[y][x].terrain === TerrainType.FOREST && Math.random() < 0.3) {
        map[y][x].terrain = Math.random() < 0.5 ? TerrainType.GRASSLAND : TerrainType.HILLS;
      }
    }
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

  // Add rivers to the map
  private addRivers(map: Tile[][], width: number, height: number): void {
    const numRivers = Math.floor((width * height) / 800); // Fewer rivers for more realism
    
    for (let i = 0; i < numRivers; i++) {
      // Find a starting point near mountains or hills
      const startPoint = this.findRiverStartPoint(map, width, height);
      if (startPoint) {
        this.traceRiver(map, startPoint.x, startPoint.y, width, height);
      }
    }
  }

  // Find a good starting point for a river (near mountains or hills)
  private findRiverStartPoint(map: Tile[][], width: number, height: number): {x: number, y: number} | null {
    // Try to find a high elevation starting point
    for (let attempts = 0; attempts < 50; attempts++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      
      const terrain = map[y][x].terrain;
      if (terrain === TerrainType.MOUNTAINS || terrain === TerrainType.HILLS) {
        return { x, y };
      }
    }
    
    // Fallback to any non-ocean point
    for (let attempts = 0; attempts < 20; attempts++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      
      if (map[y][x].terrain !== TerrainType.OCEAN) {
        return { x, y };
      }
    }
    
    return null;
  }

  // Trace a river from a starting point, flowing towards lower elevation
  private traceRiver(map: Tile[][], startX: number, startY: number, width: number, height: number): void {
    let x = startX;
    let y = startY;
    const riverLength = Math.floor(Math.random() * 15) + 8; // Longer rivers
    let direction = Math.floor(Math.random() * 4); // Starting direction

    for (let i = 0; i < riverLength; i++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        // Don't override ocean or mountains, but can flow through other terrain
        if (map[y][x].terrain !== TerrainType.OCEAN && map[y][x].terrain !== TerrainType.MOUNTAINS) {
          map[y][x].terrain = TerrainType.RIVER;
        }
        
        // Stop if we reach ocean
        if (map[y][x].terrain === TerrainType.OCEAN) {
          break;
        }
      } else {
        break; // Out of bounds
      }

      // Find the best direction to flow (towards lower elevation or ocean)
      const bestDirection = this.findBestRiverDirection(map, x, y, width, height, direction);
      direction = bestDirection;
      
      // Move in the chosen direction
      switch (direction) {
        case 0: y--; break; // North
        case 1: x++; break; // East
        case 2: y++; break; // South
        case 3: x--; break; // West
      }
    }
  }

  // Find the best direction for a river to flow
  private findBestRiverDirection(map: Tile[][], x: number, y: number, width: number, height: number, currentDirection: number): number {
    const directions = [
      { dx: 0, dy: -1, dir: 0 }, // North
      { dx: 1, dy: 0, dir: 1 },  // East
      { dx: 0, dy: 1, dir: 2 },  // South
      { dx: -1, dy: 0, dir: 3 }  // West
    ];

    let bestDirection = currentDirection;
    let bestScore = -1000;

    for (const {dx, dy, dir} of directions) {
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        let score = 0;
        const terrain = map[ny][nx].terrain;
        
        // Prefer flowing towards ocean
        if (terrain === TerrainType.OCEAN) {
          score += 100;
        }
        // Prefer lower elevation terrain
        else if (terrain === TerrainType.RIVER) {
          score += 20; // Rivers can join
        }
        else if (terrain === TerrainType.SWAMP) {
          score += 15;
        }
        else if (terrain === TerrainType.GRASSLAND || terrain === TerrainType.PLAINS) {
          score += 10;
        }
        else if (terrain === TerrainType.FOREST || terrain === TerrainType.JUNGLE) {
          score += 5;
        }
        else if (terrain === TerrainType.DESERT) {
          score += 2;
        }
        else if (terrain === TerrainType.HILLS) {
          score -= 5;
        }
        else if (terrain === TerrainType.MOUNTAINS) {
          score -= 20;
        }
        
        // Prefer continuing in the same general direction (momentum)
        if (dir === currentDirection) {
          score += 8;
        }
        // Slightly prefer not going backwards
        else if (Math.abs(dir - currentDirection) === 2) {
          score -= 5;
        }
        
        // Add some randomness
        score += Math.random() * 10 - 5;
        
        if (score > bestScore) {
          bestScore = score;
          bestDirection = dir;
        }
      }
    }

    return bestDirection;
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
        
        // Add shield variants to grassland and river tiles using higher frequency noise
        if (tile.terrain === TerrainType.GRASSLAND) {
          // Use higher frequency noise for more scattered distribution
          const noiseValue = this.noise(x * 0.8 + 5000, y * 0.8 + 5000);
          const probability = (noiseValue + 1) / 2; // Normalize to 0-1
          
          // About 12% of grassland should be shield grassland
          if (probability < 0.12) {
            tile.terrainVariant = TerrainVariant.SHIELD;
          }
        } else if (tile.terrain === TerrainType.RIVER) {
          // River shield variants with even higher frequency
          const noiseValue = this.noise(x * 1.2 + 6000, y * 1.2 + 6000);
          const probability = (noiseValue + 1) / 2; // Normalize to 0-1
          
          // About 20% of rivers should be shield rivers
          if (probability < 0.20) {
            tile.terrainVariant = TerrainVariant.SHIELD;
          }
        }
      }
    }
  }

  // Add final terrain mixing to break up large regions
  private addTerrainMixing(map: Tile[][], width: number, height: number): void {
    // Go through the map and add variety to break up monotonous regions
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const currentTerrain = map[y][x].terrain;
        
        // Skip ocean, mountains, and rivers - they should stay as is
        if (currentTerrain === TerrainType.OCEAN || 
            currentTerrain === TerrainType.MOUNTAINS || 
            currentTerrain === TerrainType.RIVER ||
            currentTerrain === TerrainType.ARCTIC) {
          continue;
        }
        
        // Check if this tile is surrounded by the same terrain type
        let sameCount = 0;
        const neighbors = [
          map[y-1][x], map[y+1][x], map[y][x-1], map[y][x+1],
          map[y-1][x-1], map[y-1][x+1], map[y+1][x-1], map[y+1][x+1]
        ];
        
        for (const neighbor of neighbors) {
          if (neighbor.terrain === currentTerrain) {
            sameCount++;
          }
        }
        
        // If more than 6 neighbors are the same terrain, add some variation
        if (sameCount >= 6 && Math.random() < 0.25) {
          // Convert to a related terrain type
          switch (currentTerrain) {
            case TerrainType.GRASSLAND:
              map[y][x].terrain = Math.random() < 0.5 ? TerrainType.PLAINS : TerrainType.FOREST;
              break;
            case TerrainType.PLAINS:
              map[y][x].terrain = Math.random() < 0.6 ? TerrainType.GRASSLAND : TerrainType.HILLS;
              break;
            case TerrainType.FOREST:
              map[y][x].terrain = Math.random() < 0.7 ? TerrainType.GRASSLAND : TerrainType.HILLS;
              break;
            case TerrainType.HILLS:
              map[y][x].terrain = Math.random() < 0.4 ? TerrainType.GRASSLAND : 
                                 (Math.random() < 0.7 ? TerrainType.FOREST : TerrainType.PLAINS);
              break;
            case TerrainType.DESERT:
              if (Math.random() < 0.3) {
                map[y][x].terrain = Math.random() < 0.5 ? TerrainType.PLAINS : TerrainType.HILLS;
              }
              break;
            case TerrainType.JUNGLE:
              if (Math.random() < 0.4) {
                map[y][x].terrain = Math.random() < 0.6 ? TerrainType.FOREST : TerrainType.SWAMP;
              }
              break;
            case TerrainType.SWAMP:
              if (Math.random() < 0.3) {
                map[y][x].terrain = Math.random() < 0.7 ? TerrainType.GRASSLAND : TerrainType.FOREST;
              }
              break;
          }
        }
      }
    }
  }
}
