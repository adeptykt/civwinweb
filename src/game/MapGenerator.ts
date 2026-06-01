import type { Tile, MapScenario } from '../types/game';
import { TerrainType, TerrainVariant } from '../types/game';
import { TerrainManager } from '../terrain/index';
import { EarthMapGenerator } from './EarthMapGenerator';
import { Civ1MapGenerator } from './Civ1MapGenerator';
import { placeVillagesOnMap } from './VillageSystem';
import {
  diamondDistance,
  isCoastlineTileIso,
  shouldUseIsoMapTopology,
  smoothCoastlinesIso,
} from './map/IsoMapTopology';

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

    // Place tribal villages (goody huts)
    placeVillagesOnMap(map, width, height);

    return map;
  }

  // Generate terrain using noise-based algorithm for more realistic distribution
  private generateTerrain(map: Tile[][], width: number, height: number): void {
    // Generate the archipelago structure first (islands in ocean)
    this.generateArchipelago(map, width, height);
    
    // Add terrain variety to the islands
    this.generateTerrainWithNoise(map, width, height);
    
    // Add arctic borders at top/bottom
    this.generateArcticBorders(map, width, height);

    // Add tundra transition zone just inside the arctic borders
    this.generateTundraTransition(map, width, height);
    
    // Add rivers to islands
    this.addRivers(map, width, height);
    
    // Smooth coastlines for more natural look
    this.smoothCoastlines(map, width, height);

    // Civ I–style latitude bands (dense jungle in tropics)
    this.applyLatitudeBiomes(map, width, height);
    
    // Add final terrain mixing pass for more natural variation
    this.addTerrainMixing(map, width, height);

    // Remove 1–3 tile specks only (keep real small islands)
    this.removeTinyLandmasses(map, width, height, 4);
  }

  /** Land tiles (not ocean / arctic ice cap). */
  private isLandTerrain(terrain: TerrainType): boolean {
    return terrain !== TerrainType.OCEAN && terrain !== TerrainType.ARCTIC;
  }

  /**
   * Flood-fill land components smaller than minTiles and convert them to ocean.
   * Fixes single-tile islands from noisy island edges and micro-island placement.
   */
  private removeTinyLandmasses(map: Tile[][], width: number, height: number, minTiles = 6): void {
    const visited = new Set<string>();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x},${y}`;
        if (visited.has(key) || !this.isLandTerrain(map[y][x].terrain)) {
          continue;
        }

        const component: Array<{ x: number; y: number }> = [];
        const queue: Array<{ x: number; y: number }> = [{ x, y }];
        visited.add(key);

        while (queue.length > 0) {
          const { x: cx, y: cy } = queue.shift()!;
          component.push({ x: cx, y: cy });

          for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const nk = `${nx},${ny}`;
            if (visited.has(nk) || !this.isLandTerrain(map[ny][nx].terrain)) continue;
            visited.add(nk);
            queue.push({ x: nx, y: ny });
          }
        }

        if (component.length < minTiles) {
          for (const { x: cx, y: cy } of component) {
            const tile = map[cy][cx];
            tile.terrain = TerrainType.OCEAN;
            tile.resources = [];
            tile.improvements = [];
            delete tile.terrainVariant;
          }
        }
      }
    }
  }

  /**
   * Civ I–style biome placement by latitude (matches Civ1MapGenerator tropical/desert bands).
   * Random maps previously relied on strict noise and produced almost no jungle.
   */
  private applyLatitudeBiomes(map: Tile[][], width: number, height: number): void {
    const maxY = Math.max(1, height - 1);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = map[y][x];
        const terrain = tile.terrain;

        if (
          terrain === TerrainType.OCEAN ||
          terrain === TerrainType.RIVER ||
          terrain === TerrainType.MOUNTAINS
        ) {
          continue;
        }

        const latitude = y / maxY;
        const distFromPole = Math.min(y, height - 1 - y);

        // Polar rows — same idea as Civ1 (skip tropical overrides near ice)
        if (distFromPole <= 2) {
          if (distFromPole === 0) {
            const r = Math.random();
            if (r < 0.25) tile.terrain = TerrainType.ARCTIC;
            else if (r < 0.45) tile.terrain = TerrainType.TUNDRA;
          } else if (distFromPole === 1) {
            const r = Math.random();
            if (r < 0.1) tile.terrain = TerrainType.ARCTIC;
            else if (r < 0.25) tile.terrain = TerrainType.TUNDRA;
          } else if (Math.random() < 0.08) {
            tile.terrain = TerrainType.TUNDRA;
          }
          continue;
        }

        // Desert belts
        if ((latitude > 0.25 && latitude < 0.35) || (latitude > 0.65 && latitude < 0.75)) {
          const r = Math.random();
          if (r < 0.28) tile.terrain = TerrainType.DESERT;
          else if (r < 0.5) tile.terrain = TerrainType.PLAINS;
          continue;
        }

        // Temperate belts
        if ((latitude > 0.15 && latitude < 0.25) || (latitude > 0.75 && latitude < 0.85)) {
          const r = Math.random();
          if (r < 0.4) tile.terrain = TerrainType.FOREST;
          else if (r < 0.7) tile.terrain = TerrainType.PLAINS;
          continue;
        }

        // Tropical belt — slightly below Civ I paper values (~40%); hills/desert kept as-is
        if (latitude > 0.35 && latitude < 0.65) {
          if (
            terrain === TerrainType.GRASSLAND ||
            terrain === TerrainType.PLAINS ||
            terrain === TerrainType.FOREST
          ) {
            const r = Math.random();
            if (r < 0.24) {
              tile.terrain = TerrainType.JUNGLE;
            } else if (r < 0.32) {
              tile.terrain = TerrainType.SWAMP;
            }
          }
        }
      }
    }
  }

  // Generate terrain using noise-based approach for more realistic distribution
  private generateTerrainWithNoise(map: Tile[][], width: number, height: number): void {
    // Use much higher frequency noise for smaller terrain patches
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Only apply terrain variation to land tiles (skip ocean)
        if (map[y][x].terrain === TerrainType.OCEAN) {
          continue;
        }

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
        
        // Apply the new terrain to this land tile
        map[y][x].terrain = terrain;
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
    
    // Jungle from noise (most tropical jungle comes from applyLatitudeBiomes)
    if (t > 0.35 && h > 0.45) {
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

  /** True if (satX,satY) is farther from every other continent than center is. */
  private growsAwayFromOthers(
    satX: number,
    satY: number,
    center: { x: number; y: number },
    others: Array<{ x: number; y: number }>
  ): boolean {
    for (const o of others) {
      const dSat = Math.hypot(satX - o.x, satY - o.y);
      const dCenter = Math.hypot(center.x - o.x, center.y - o.y);
      if (dSat <= dCenter + 1) return false;
    }
    return true;
  }

  /** Angle (radians) pointing away from the nearest other continent center. */
  private getOutwardAngle(
    x: number,
    y: number,
    others: Array<{ x: number; y: number }>
  ): number {
    if (others.length === 0) return Math.random() * Math.PI * 2;

    let nearest = others[0];
    let minDist = Number.POSITIVE_INFINITY;
    for (const o of others) {
      const d = Math.hypot(x - o.x, y - o.y);
      if (d < minDist) {
        minDist = d;
        nearest = o;
      }
    }
    return Math.atan2(y - nearest.y, x - nearest.x);
  }

  /** Chebyshev distance from (x,y) to the nearest land tile, or -1 if none in range. */
  private nearestLandDistance(
    map: Tile[][],
    x: number,
    y: number,
    width: number,
    height: number,
    searchRadius = 24
  ): number {
    let nearest = -1;
    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const cx = x + dx;
        const cy = y + dy;
        if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
        if (!this.isLandTerrain(map[cy][cx].terrain)) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (nearest < 0 || d < nearest) nearest = d;
      }
    }
    return nearest;
  }

  /**
   * Place medium islands in open ocean (separate landmasses, not merged with continents).
   */
  private placeSeparateOceanIslands(
    map: Tile[][],
    width: number,
    height: number,
    continentCenters: Array<{ x: number; y: number; size: number }>,
    targetCount: number
  ): number {
    const placed: Array<{ x: number; y: number }> = [];
    let placedCount = 0;

    for (let n = 0; n < targetCount; n++) {
      let attempts = 0;
      while (attempts < 60) {
        attempts++;
        const x = Math.floor(Math.random() * (width - 18)) + 9;
        const y = Math.floor(Math.random() * (height - 14)) + 7;
        if (map[y][x].terrain !== TerrainType.OCEAN) continue;

        const nearestLand = this.nearestLandDistance(map, x, y, width, height);
        if (nearestLand < 7 || nearestLand > 26) continue;

        let tooCloseToContinent = false;
        for (const c of continentCenters) {
          if (Math.hypot(x - c.x, y - c.y) < c.size + 16) {
            tooCloseToContinent = true;
            break;
          }
        }
        if (tooCloseToContinent) continue;

        let tooCloseToIslet = false;
        for (const p of placed) {
          if (Math.hypot(x - p.x, y - p.y) < 14) {
            tooCloseToIslet = true;
            break;
          }
        }
        if (tooCloseToIslet) continue;

        const islandSize = Math.floor(Math.random() * 3) + 6;
        this.generateIsland(map, x, y, islandSize, width, height);
        placed.push({ x, y });
        placedCount++;
        break;
      }
    }

    return placedCount;
  }

  private countLandTiles(map: Tile[][], width: number, height: number): number {
    let count = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.isLandTerrain(map[y][x].terrain)) count++;
      }
    }
    return count;
  }

  /**
   * Civ I–style random land: a few substantial continents separated by ocean (~40% land).
   */
  private generateArchipelago(map: Tile[][], width: number, height: number): void {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        map[y][x].terrain = TerrainType.OCEAN;
      }
    }

    const mapArea = width * height;
    const targetLand = Math.floor(mapArea * 0.44);
    // Two major continents (left/right) + separate islets — fits 80×50 without merging
    const numContinents = 2;
    const continentCenters: Array<{ x: number; y: number; size: number }> = [];

    const anchors = [
      { xr: 0.2, yr: 0.48 },
      { xr: 0.8, yr: 0.5 },
    ];

    for (let i = 0; i < numContinents; i++) {
      const anchor = anchors[i];
      const size = Math.floor(Math.random() * 3) + 11; // 11–13
      const x = Math.min(
        width - 14,
        Math.max(12, Math.floor(width * anchor.xr) + Math.floor(Math.random() * 11) - 5)
      );
      const y = Math.min(
        height - 10,
        Math.max(8, Math.floor(height * anchor.yr) + Math.floor(Math.random() * 9) - 4)
      );
      continentCenters.push({ x, y, size });
    }

    for (const center of continentCenters) {
      const others = continentCenters.filter((c) => c !== center);
      this.generateIsland(map, center.x, center.y, center.size, width, height);

      const outward = this.getOutwardAngle(center.x, center.y, others);
      const numSatellites = Math.floor(Math.random() * 2) + 2;

      for (let i = 0; i < numSatellites; i++) {
        const satSize = Math.floor(Math.random() * 2) + 6;
        const angle = outward + (Math.random() - 0.5) * Math.PI * 0.45;
        const distance = center.size * 0.32 + satSize + 2 + Math.random() * 3;

        const satX = Math.round(center.x + Math.cos(angle) * distance);
        const satY = Math.round(center.y + Math.sin(angle) * distance);

        if (
          satX >= 3 &&
          satX < width - 3 &&
          satY >= 3 &&
          satY < height - 3 &&
          this.growsAwayFromOthers(satX, satY, center, others)
        ) {
          this.generateIsland(map, satX, satY, satSize, width, height);
        }
      }
    }

    // Separate ocean islands (old center-slot logic never placed any on 80×50)
    const desiredIslands = 3 + Math.floor(Math.random() * 3); // 3–5
    let oceanIslands = this.placeSeparateOceanIslands(
      map,
      width,
      height,
      continentCenters,
      desiredIslands
    );

    // Fallback slots along top/bottom center (away from continent midline)
    const fallbackSlots = [
      { xr: 0.38, yr: 0.18 },
      { xr: 0.62, yr: 0.2 },
      { xr: 0.42, yr: 0.82 },
      { xr: 0.58, yr: 0.78 },
    ];
    for (const slot of fallbackSlots) {
      if (oceanIslands >= desiredIslands) break;
      const x = Math.floor(width * slot.xr);
      const y = Math.floor(height * slot.yr);
      if (map[y][x].terrain !== TerrainType.OCEAN) continue;
      if (this.nearestLandDistance(map, x, y, width, height) < 5) continue;
      this.generateIsland(map, x, y, 7, width, height);
      oceanIslands++;
    }

    let growAttempts = 0;
    while (this.countLandTiles(map, width, height) < targetLand && growAttempts < 100) {
      growAttempts++;
      if (continentCenters.length === 0) break;

      const center = continentCenters[Math.floor(Math.random() * continentCenters.length)];
      const others = continentCenters.filter((c) => c !== center);

      // Thickens existing continent without bridging the other side of the map
      if (Math.random() < 0.4) {
        const puffX = center.x + Math.floor(Math.random() * 7) - 3;
        const puffY = center.y + Math.floor(Math.random() * 7) - 3;
        if (puffX >= 2 && puffX < width - 2 && puffY >= 2 && puffY < height - 2) {
          this.generateIsland(map, puffX, puffY, Math.floor(Math.random() * 2) + 5, width, height);
        }
        continue;
      }

      const satSize = Math.floor(Math.random() * 3) + 7;
      const outward = this.getOutwardAngle(center.x, center.y, others);
      const angle = outward + (Math.random() - 0.5) * Math.PI * 0.4;
      const distance = center.size * 0.34 + satSize + 2 + Math.random() * 4;
      const satX = Math.round(center.x + Math.cos(angle) * distance);
      const satY = Math.round(center.y + Math.sin(angle) * distance);

      if (
        satX >= 2 &&
        satX < width - 2 &&
        satY >= 2 &&
        satY < height - 2 &&
        this.growsAwayFromOthers(satX, satY, center, others)
      ) {
        this.generateIsland(map, satX, satY, satSize, width, height);
      }
    }
  }

  // Generate a single island with organic shape
  private generateIsland(map: Tile[][], centerX: number, centerY: number, baseRadius: number, width: number, height: number): void {
    const iso = shouldUseIsoMapTopology();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = iso
          ? diamondDistance(dx, dy)
          : Math.sqrt(dx * dx + dy * dy);
        
        // Create organic island shape using multiple noise layers
        const shapeNoise1 = this.noise(x * 0.1, y * 0.1) * 3;
        const shapeNoise2 = this.noise(x * 0.2 + 1000, y * 0.2 + 1000) * 2;
        const shapeNoise3 = this.noise(x * 0.4 + 2000, y * 0.4 + 2000) * 1;
        
        const organicRadius = baseRadius + shapeNoise1 + shapeNoise2 + shapeNoise3;
        
        // Create land with more conservative soft edges
        if (distance < organicRadius) {
          // Stronger chance for land closer to center
          const landProbability = Math.max(0, 1 - (distance / organicRadius));
          const fadeDistance = organicRadius * 0.28;

          if (distance < organicRadius - fadeDistance) {
            map[y][x].terrain = TerrainType.GRASSLAND;
          } else if (Math.random() < landProbability * 0.72) {
            map[y][x].terrain = TerrainType.GRASSLAND;
          }
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

  // Generate tundra tiles as a transition band between arctic and temperate terrain.
  private generateTundraTransition(map: Tile[][], width: number, height: number): void {
    const tundraRows = 2; // Tundra only in the 2 rows immediately inside the arctic edge

    for (let x = 0; x < width; x++) {
      // Scan downward from top to find where arctic ends, then add tundra below it
      let topArcticEdge = 0;
      for (let y = 0; y < height; y++) {
        if (map[y][x].terrain === TerrainType.ARCTIC || map[y][x].terrain === TerrainType.OCEAN) {
          topArcticEdge = y;
        } else {
          break;
        }
      }
      for (let dy = 1; dy <= tundraRows; dy++) {
        const ty = topArcticEdge + dy;
        if (ty >= height) break;
        const t = map[ty][x].terrain;
        if (t !== TerrainType.OCEAN && t !== TerrainType.ARCTIC) {
          // Low probability — arctic/tundra can appear but other terrain is still common
          const prob = 0.30 - dy * 0.10;
          if (Math.random() < prob) {
            map[ty][x].terrain = TerrainType.TUNDRA;
          }
        }
      }

      // Scan upward from bottom
      let bottomArcticEdge = height - 1;
      for (let y = height - 1; y >= 0; y--) {
        if (map[y][x].terrain === TerrainType.ARCTIC || map[y][x].terrain === TerrainType.OCEAN) {
          bottomArcticEdge = y;
        } else {
          break;
        }
      }
      for (let dy = 1; dy <= tundraRows; dy++) {
        const ty = bottomArcticEdge - dy;
        if (ty < 0) break;
        const t = map[ty][x].terrain;
        if (t !== TerrainType.OCEAN && t !== TerrainType.ARCTIC) {
          const prob = 0.30 - dy * 0.10;
          if (Math.random() < prob) {
            map[ty][x].terrain = TerrainType.TUNDRA;
          }
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
    if (shouldUseIsoMapTopology()) {
      smoothCoastlinesIso(map, width, height);
      return;
    }

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
          
          // Erode stray coastal land only — filling ocean→land bridges separate islands
          if (
            currentTile.terrain !== TerrainType.OCEAN &&
            currentTile.terrain !== TerrainType.MOUNTAINS &&
            oceanCount >= 6
          ) {
            map[y][x].terrain = TerrainType.OCEAN;
          }
        }
      }
    }
  }

  // Check if a tile is part of a coastline (land-ocean boundary)
  private isCoastlineTile(map: Tile[][], x: number, y: number, width: number, height: number): boolean {
    if (shouldUseIsoMapTopology()) {
      return isCoastlineTileIso(map, x, y, width, height);
    }

    const currentTerrain = map[y][x].terrain;

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
              if (Math.random() < 0.14) {
                map[y][x].terrain = Math.random() < 0.55 ? TerrainType.FOREST : TerrainType.GRASSLAND;
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
