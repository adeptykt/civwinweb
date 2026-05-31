import type { Tile } from '../types/game';
import { TerrainType, TerrainVariant } from '../types/game';
import { TerrainManager } from '../terrain/index';
import { placeVillagesOnMap } from './VillageSystem';

export class EarthMapGenerator {
  
  // Generate Earth-like map
  public generateEarthMap(width: number, height: number): Tile[][] {
    const map: Tile[][] = [];

    // Initialize empty map with ocean
    for (let y = 0; y < height; y++) {
      map[y] = [];
      for (let x = 0; x < width; x++) {
        map[y][x] = {
          position: { x, y },
          terrain: TerrainType.OCEAN,
          resources: [],
          improvements: []
        };
      }
    }

    // Generate Earth-like continents and terrain
    this.generateEarthTerrain(map, width, height);
    
    // Add terrain variants (shield grassland, shield river)
    this.addTerrainVariants(map, width, height);
    
    // Add resources
    this.addResources(map, width, height);

    // Place tribal villages (goody huts)
    placeVillagesOnMap(map, width, height);

    return map;
  }

  // Generate Earth-like terrain distribution
  private generateEarthTerrain(map: Tile[][], width: number, height: number): void {
    console.log('Generating Earth-like terrain...');
    
    // Create major continents with proper Earth positioning
    // Map coordinates: x=0 is leftmost (Americas), x=width-1 is rightmost (wraps to Asia)
    // y=0 is northernmost (Arctic), y=height-1 is southernmost (Antarctica)
    
    this.createNorthAmerica(map, width, height);
    this.createSouthAmerica(map, width, height);
    this.createEurope(map, width, height);
    this.createAfrica(map, width, height);
    this.createAsia(map, width, height);
    this.createAustralia(map, width, height);
    
    // Connect Africa to Asia through the Middle East (Sinai Peninsula)
    this.createAfricaAsiaConnection(map, width, height);
    
    // Create the Mediterranean Sea (between Europe and Africa)
    this.createMediterraneanSea(map, width, height);
    
    // Smooth coastlines for better appearance
    this.smoothCoastlines(map, width, height);
    
    // Add climate-based terrain after continents are placed
    this.addEarthClimateZones(map, width, height);
    
    // Add plains in appropriate locations
    this.addEarthPlains(map, width, height);
    
    // Add mountain ranges based on Earth's major ranges
    this.addEarthMountainRanges(map, width, height);
    
    // Add deserts in appropriate locations
    this.addEarthDeserts(map, width, height);
    
    // Add forests in temperate and tropical regions
    this.addEarthForests(map, width, height);
    
    // Add swamps in specific wetland regions
    this.addEarthSwamps(map, width, height);
    
    // Add rivers connecting mountain to ocean
    this.addEarthRivers(map, width, height);
  }

  // Create the connected Americas (western side of map)
  private createNorthAmerica(map: Tile[][], width: number, height: number): void {
    // Create the full Americas as one connected landmass
    this.createConnectedAmericas(map, width, height);
    
    // Greenland (separate)
    this.createLandmass(map, width * 0.35, height * 0.12, width * 0.1, height * 0.12, width, height, 0.7);
  }

  // Create South America (this is now part of the connected Americas)
  private createSouthAmerica(_map: Tile[][], _width: number, _height: number): void {
    // South America is now created as part of the connected Americas in createConnectedAmericas
    // This method is kept for consistency but doesn't need to do anything
  }

  // Create the full connected Americas from Alaska to southern South America
  private createConnectedAmericas(map: Tile[][], width: number, height: number): void {
    // Alaska and northern Canada (wide at top)
    this.createLandmass(map, width * 0.08, height * 0.15, width * 0.16, height * 0.12, width, height, 0.8);
    
    // Main North America (very large, wide continent - dominates northern Americas)
    this.createLandmass(map, width * 0.15, height * 0.28, width * 0.32, height * 0.4, width, height, 0.85);
    
    // Mexico (much smaller, narrow transition)
    this.createLandmass(map, width * 0.18, height * 0.48, width * 0.06, height * 0.06, width, height, 0.9);
    
    // Central America (very narrow isthmus - geographically accurate, extended south)
    this.createLandmass(map, width * 0.19, height * 0.54, width * 0.04, height * 0.1, width, height, 0.95);
    
    // Northern South America (moderate size, wider than Central America, extended north)
    this.createLandmass(map, width * 0.20, height * 0.60, width * 0.12, height * 0.12, width, height, 0.85);
    
    // Main South America (slimmer and longer, almost touching bottom)
    this.createLandmass(map, width * 0.22, height * 0.80, width * 0.14, height * 0.32, width, height, 0.85);
    
    // Create connecting strips to ensure no gaps between major landmasses
    this.createConnectingStrip(map, width * 0.17, height * 0.43, width * 0.18, height * 0.48, width, height); // North America to Mexico
    this.createConnectingStrip(map, width * 0.18, height * 0.51, width * 0.19, height * 0.54, width, height); // Mexico to Central America
    this.createConnectingStrip(map, width * 0.19, height * 0.58, width * 0.20, height * 0.60, width, height); // Central America to South America
    
    // Additional robust connection for Central America - South America isthmus
    this.createRobustConnection(map, width * 0.19, height * 0.56, width * 0.20, height * 0.62, width, height);
  }

  // Create a connecting strip between two points to ensure landmasses are connected
  private createConnectingStrip(map: Tile[][], x1: number, y1: number, x2: number, y2: number, width: number, height: number): void {
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const x = Math.floor(x1 + (x2 - x1) * progress);
      const y = Math.floor(y1 + (y2 - y1) * progress);
      
      // Create a small landmass at each step to ensure connection
      if (x >= 0 && x < width && y >= 0 && y < height) {
        this.createLandmass(map, x, y, width * 0.04, height * 0.03, width, height, 0.95);
      }
    }
  }

  // Create a more robust connection between two regions with multiple parallel strips
  private createRobustConnection(map: Tile[][], x1: number, y1: number, x2: number, y2: number, width: number, height: number): void {
    // Create multiple parallel connecting strips for better reliability
    for (let offset = -2; offset <= 2; offset++) {
      const steps = 30;
      for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        const x = Math.floor(x1 + (x2 - x1) * progress) + offset;
        const y = Math.floor(y1 + (y2 - y1) * progress);
        
        // Create landmass at each step
        if (x >= 0 && x < width && y >= 0 && y < height) {
          this.createLandmass(map, x, y, width * 0.06, height * 0.04, width, height, 0.98);
        }
      }
    }
  }

  // Create connection between Africa and Asia through the Middle East/Sinai Peninsula
  private createAfricaAsiaConnection(map: Tile[][], width: number, height: number): void {
    // Sinai Peninsula connection (narrow land bridge between Africa and Middle East)
    this.createLandmass(map, width * 0.58, height * 0.435, width * 0.03, height * 0.05, width, height, 0.95);
    
    // Additional narrow connection to ensure it's solid
    this.createConnectingStrip(map, width * 0.57, height * 0.44, width * 0.62, height * 0.42, width, height);
  }

  // Create the Mediterranean Sea between Europe and Africa
  private createMediterraneanSea(map: Tile[][], width: number, height: number): void {
    // Mediterranean Sea extends from Gibraltar to the Levant
    const startX = Math.floor(width * 0.42); // Western edge (near Gibraltar)
    const endX = Math.floor(width * 0.62);   // Eastern edge (near Middle East)
    const startY = Math.floor(height * 0.36); // Southern Europe
    const endY = Math.floor(height * 0.44);   // Northern Africa
    
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          // Create Mediterranean as ocean, but leave small gaps for Italian peninsula and islands
          const distanceFromCenter = Math.sqrt(
            Math.pow((x - (startX + endX) / 2) / (endX - startX), 2) +
            Math.pow((y - (startY + endY) / 2) / (endY - startY), 2)
          );
          
          // Leave some land for Italian peninsula and Greek islands
          const isItalianPeninsula = (x > width * 0.50 && x < width * 0.52 && y > height * 0.36 && y < height * 0.42);
          const isGreekIslands = (x > width * 0.54 && x < width * 0.57 && y > height * 0.37 && y < height * 0.40);
          
          if (!isItalianPeninsula && !isGreekIslands && distanceFromCenter < 0.6) {
            map[y][x].terrain = TerrainType.OCEAN;
          }
        }
      }
    }
    
    // Add some Mediterranean islands
    this.createLandmass(map, width * 0.48, height * 0.40, width * 0.02, height * 0.02, width, height, 0.9); // Corsica/Sardinia
    this.createLandmass(map, width * 0.51, height * 0.41, width * 0.015, height * 0.015, width, height, 0.9); // Sicily
    this.createLandmass(map, width * 0.56, height * 0.385, width * 0.01, height * 0.01, width, height, 0.9); // Crete
  }

  // Create Europe
  private createEurope(map: Tile[][], width: number, height: number): void {
    // Create the connected Eurasian landmass
    this.createConnectedEurasia(map, width, height);
    
    // British Isles as separate islands
    // Great Britain (UK) - larger island to the east
    this.createLandmass(map, width * 0.44, height * 0.22, width * 0.04, height * 0.08, width, height, 0.85);
    
    // Ireland - smaller island to the west
    this.createLandmass(map, width * 0.39, height * 0.23, width * 0.025, height * 0.06, width, height, 0.8);
    
    // Iceland (separate Nordic island)
    this.createLandmass(map, width * 0.36, height * 0.15, width * 0.025, height * 0.04, width, height, 0.8);
  }

  // Create Africa
  private createAfrica(map: Tile[][], width: number, height: number): void {
    // Main African landmass (moved south to make room for Mediterranean Sea)
    this.createLandmass(map, width * 0.52, height * 0.62, width * 0.2, height * 0.42, width, height, 0.85);
    
    // Madagascar (larger)
    this.createLandmass(map, width * 0.64, height * 0.72, width * 0.04, height * 0.08, width, height, 0.9);
  }

  // Create Asia
  private createAsia(_map: Tile[][], _width: number, _height: number): void {
    // Asia is now created as part of connected Eurasia in createConnectedEurasia
    // This method is kept for consistency but doesn't need to do anything
  }

  // Create the massive connected Eurasian landmass
  private createConnectedEurasia(map: Tile[][], width: number, height: number): void {
    // Main European region
    this.createLandmass(map, width * 0.48, height * 0.25, width * 0.18, height * 0.2, width, height, 0.85);
    
    // Scandinavia
    this.createLandmass(map, width * 0.52, height * 0.15, width * 0.1, height * 0.15, width, height, 0.8);
    
    // Western Asia / Middle East (connecting Europe to Asia and Africa)
    this.createLandmass(map, width * 0.62, height * 0.35, width * 0.15, height * 0.15, width, height, 0.85);
    
    // Arabian Peninsula (important geographical feature)
    this.createLandmass(map, width * 0.6, height * 0.45, width * 0.08, height * 0.08, width, height, 0.85);
    
    // Main Asian landmass (massive eastern continent)
    this.createLandmass(map, width * 0.75, height * 0.32, width * 0.35, height * 0.35, width, height, 0.8);
    
    // Siberia (northern extension)
    this.createLandmass(map, width * 0.78, height * 0.18, width * 0.3, height * 0.15, width, height, 0.7);
    
    // India (southern peninsula)
    this.createLandmass(map, width * 0.68, height * 0.48, width * 0.12, height * 0.15, width, height, 0.85);
    
    // Southeast Asia and Indonesia
    this.createLandmass(map, width * 0.8, height * 0.58, width * 0.12, height * 0.12, width, height, 0.7);
    
    // Japan (separate island)
    this.createLandmass(map, width * 0.88, height * 0.38, width * 0.05, height * 0.1, width, height, 0.8);
    
    // Create robust connections within Eurasia
    this.createRobustConnection(map, width * 0.57, height * 0.25, width * 0.62, height * 0.35, width, height); // Europe to Middle East
    this.createRobustConnection(map, width * 0.69, height * 0.35, width * 0.75, height * 0.32, width, height); // Middle East to Asia
    this.createRobustConnection(map, width * 0.52, height * 0.25, width * 0.78, height * 0.25, width, height); // Northern Eurasia connection
  }

  // Create Australia and Oceania
  private createAustralia(map: Tile[][], width: number, height: number): void {
    // Australia (much larger)
    this.createLandmass(map, width * 0.85, height * 0.78, width * 0.18, height * 0.12, width, height, 0.85);
    
    // New Zealand (larger)
    this.createLandmass(map, width * 0.98, height * 0.85, width * 0.04, height * 0.08, width, height, 0.8);
    
    // Papua New Guinea (new addition)
    this.createLandmass(map, width * 0.82, height * 0.68, width * 0.06, height * 0.05, width, height, 0.8);
  }

  // Create a landmass with irregular coastlines
  private createLandmass(map: Tile[][], centerX: number, centerY: number, sizeX: number, sizeY: number, width: number, height: number, density: number): void {
    const startX = Math.max(0, Math.floor(centerX - sizeX / 2));
    const endX = Math.min(width - 1, Math.floor(centerX + sizeX / 2));
    const startY = Math.max(0, Math.floor(centerY - sizeY / 2));
    const endY = Math.min(height - 1, Math.floor(centerY + sizeY / 2));

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        // Calculate distance from center (elliptical)
        const distanceX = (x - centerX) / (sizeX / 2);
        const distanceY = (y - centerY) / (sizeY / 2);
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
        
        // Create smooth coastlines with gentle variation
        const coastNoise1 = Math.sin(x * 0.05) * Math.cos(y * 0.03) * 0.15;
        const coastNoise2 = Math.sin(x * 0.1) * Math.cos(y * 0.08) * 0.08;
        const coastNoise3 = Math.sin(x * 0.15) * Math.cos(y * 0.12) * 0.04;
        const totalNoise = coastNoise1 + coastNoise2 + coastNoise3;
        
        // Make landmasses more solid - only add noise at the edges
        const baseThreshold = 1.0;
        const noisyThreshold = baseThreshold + totalNoise;
        
        if (distance < noisyThreshold) {
          // Create solid landmasses with only edge variation
          if (distance < 0.7) {
            // Core area - always land
            map[y][x].terrain = TerrainType.GRASSLAND;
          } else {
            // Edge area - use smooth transition for coastline
            const edgeProbability = density * (1 - (distance - 0.7) / (noisyThreshold - 0.7));
            if (edgeProbability > 0.5) { // Higher threshold for smoother coastlines
              map[y][x].terrain = TerrainType.GRASSLAND;
            }
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

  // Add climate zones based on latitude and geography
  private addEarthClimateZones(map: Tile[][], width: number, height: number): void {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (map[y][x].terrain === TerrainType.OCEAN) continue;

        // Polar zones: arctic/tundra can appear in the top and bottom 2 rows
        // but other terrain types (grassland, forest) are still possible
        const distFromPole = Math.min(y, height - 1 - y);
        if (distFromPole === 0) {
          const r = Math.random();
          if (r < 0.25) { map[y][x].terrain = TerrainType.ARCTIC; continue; }
          if (r < 0.45) { map[y][x].terrain = TerrainType.TUNDRA; continue; }
        } else if (distFromPole === 1) {
          const r = Math.random();
          if (r < 0.10) { map[y][x].terrain = TerrainType.ARCTIC; continue; }
          if (r < 0.25) { map[y][x].terrain = TerrainType.TUNDRA; continue; }
        } else if (distFromPole === 2) {
          if (Math.random() < 0.08) { map[y][x].terrain = TerrainType.TUNDRA; continue; }
        }

        // Non-polar climate variations (grassland tiles only)
        if (map[y][x].terrain === TerrainType.GRASSLAND) {
          const latitude = y / height; // 0 = north, 1 = south
          // Tropical zone (equatorial belt)
          if (latitude > 0.4 && latitude < 0.6) {
            if (Math.random() < 0.4) {
              map[y][x].terrain = TerrainType.JUNGLE;
            }
          }
          // Temperate zones
          else if ((latitude > 0.15 && latitude < 0.4) || (latitude > 0.6 && latitude < 0.85)) {
            if (Math.random() < 0.5) {
              map[y][x].terrain = TerrainType.FOREST;
            }
          }
        }
      }
    }
  }

  // Add major mountain ranges
  private addEarthMountainRanges(map: Tile[][], width: number, height: number): void {
    // Rocky Mountains (western North America) - larger
    this.createEarthMountainRange(map, width * 0.12, height * 0.3, width * 0.04, height * 0.25, width, height);
    
    // Appalachian Mountains (eastern North America) - larger
    this.createEarthMountainRange(map, width * 0.2, height * 0.32, width * 0.03, height * 0.2, width, height);
    
    // Andes Mountains (western South America) - longer to match extended South America
    this.createEarthMountainRange(map, width * 0.19, height * 0.75, width * 0.03, height * 0.35, width, height);
    
    // Alps (central Europe) - larger
    this.createEarthMountainRange(map, width * 0.48, height * 0.28, width * 0.08, height * 0.04, width, height);
    
    // Urals (Europe-Asia border) - larger
    this.createEarthMountainRange(map, width * 0.6, height * 0.25, width * 0.03, height * 0.2, width, height);
    
    // Himalayas (southern Asia) - much larger
    this.createEarthMountainRange(map, width * 0.7, height * 0.42, width * 0.15, height * 0.05, width, height);
    
    // Atlas Mountains (North Africa) - larger
    this.createEarthMountainRange(map, width * 0.48, height * 0.42, width * 0.1, height * 0.04, width, height);
    
    // Ethiopian Highlands (East Africa) - larger
    this.createEarthMountainRange(map, width * 0.58, height * 0.52, width * 0.06, height * 0.08, width, height);
    
    // Great Dividing Range (eastern Australia) - larger
    this.createEarthMountainRange(map, width * 0.88, height * 0.78, width * 0.03, height * 0.08, width, height);
    
    // Cascade Range (western North America)
    this.createEarthMountainRange(map, width * 0.08, height * 0.25, width * 0.02, height * 0.15, width, height);
    
    // Sierra Madre (Mexico)
    this.createEarthMountainRange(map, width * 0.15, height * 0.45, width * 0.03, height * 0.1, width, height);
    
    // Caucasus Mountains (between Europe and Asia)
    this.createEarthMountainRange(map, width * 0.6, height * 0.32, width * 0.04, height * 0.03, width, height);
    
    // Zagros Mountains (Iran/Middle East)
    this.createEarthMountainRange(map, width * 0.64, height * 0.38, width * 0.04, height * 0.06, width, height);
  }

  // Create a mountain range
  private createEarthMountainRange(map: Tile[][], centerX: number, centerY: number, sizeX: number, sizeY: number, width: number, height: number): void {
    const startX = Math.max(0, Math.floor(centerX - sizeX / 2));
    const endX = Math.min(width - 1, Math.floor(centerX + sizeX / 2));
    const startY = Math.max(0, Math.floor(centerY - sizeY / 2));
    const endY = Math.min(height - 1, Math.floor(centerY + sizeY / 2));

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (map[y][x].terrain !== TerrainType.OCEAN) {
          const distanceFromCenter = Math.sqrt(
            Math.pow((x - centerX) / sizeX, 2) + Math.pow((y - centerY) / sizeY, 2)
          );
          
          if (distanceFromCenter < 0.5) {
            if (distanceFromCenter < 0.3) {
              map[y][x].terrain = TerrainType.MOUNTAINS;
            } else if (Math.random() < 0.6) {
              map[y][x].terrain = TerrainType.HILLS;
            }
          }
        }
      }
    }
  }

  // Add Earth's major deserts
  private addEarthDeserts(map: Tile[][], width: number, height: number): void {
    // Sahara Desert (North Africa)
    this.createEarthDesertRegion(map, width * 0.52, height * 0.42, width * 0.12, height * 0.08, width, height);
    
    // Arabian Desert (Middle East)
    this.createEarthDesertRegion(map, width * 0.58, height * 0.42, width * 0.06, height * 0.06, width, height);
    
    // Gobi Desert (Mongolia/China)
    this.createEarthDesertRegion(map, width * 0.75, height * 0.32, width * 0.08, height * 0.04, width, height);
    
    // Mojave/Sonoran Desert (southwestern USA/northwestern Mexico)
    this.createEarthDesertRegion(map, width * 0.12, height * 0.38, width * 0.04, height * 0.06, width, height);
    
    // Atacama Desert (western South America) - adjusted for longer South America
    this.createEarthDesertRegion(map, width * 0.19, height * 0.78, width * 0.02, height * 0.08, width, height);
    
    // Australian Outback (central Australia)
    this.createEarthDesertRegion(map, width * 0.82, height * 0.75, width * 0.08, height * 0.06, width, height);
    
    // Kalahari Desert (southern Africa)
    this.createEarthDesertRegion(map, width * 0.54, height * 0.7, width * 0.06, height * 0.05, width, height);
    
    // Thar Desert (India/Pakistan)
    this.createEarthDesertRegion(map, width * 0.66, height * 0.45, width * 0.04, height * 0.04, width, height);
  }

  // Create a desert region
  private createEarthDesertRegion(map: Tile[][], centerX: number, centerY: number, sizeX: number, sizeY: number, width: number, height: number): void {
    const startX = Math.max(0, Math.floor(centerX - sizeX / 2));
    const endX = Math.min(width - 1, Math.floor(centerX + sizeX / 2));
    const startY = Math.max(0, Math.floor(centerY - sizeY / 2));
    const endY = Math.min(height - 1, Math.floor(centerY + sizeY / 2));

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (map[y][x].terrain === TerrainType.GRASSLAND) {
          const distanceFromCenter = Math.sqrt(
            Math.pow((x - centerX) / sizeX, 2) + Math.pow((y - centerY) / sizeY, 2)
          );
          
          if (distanceFromCenter < 0.5 && Math.random() < 0.8) {
            map[y][x].terrain = TerrainType.DESERT;
          }
        }
      }
    }
  }

  // Add Earth's major plains
  private addEarthPlains(map: Tile[][], width: number, height: number): void {
    // Great Plains (central North America)
    this.createEarthPlainsRegion(map, width * 0.15, height * 0.35, width * 0.08, height * 0.15, width, height);
    
    // Argentine Pampas (eastern South America)
    this.createEarthPlainsRegion(map, width * 0.23, height * 0.8, width * 0.06, height * 0.08, width, height);
    
    // European Plain (eastern Europe)
    this.createEarthPlainsRegion(map, width * 0.52, height * 0.28, width * 0.08, height * 0.08, width, height);
    
    // West Siberian Plain (northern Asia)
    this.createEarthPlainsRegion(map, width * 0.68, height * 0.25, width * 0.1, height * 0.1, width, height);
    
    // Indo-Gangetic Plain (northern India)
    this.createEarthPlainsRegion(map, width * 0.68, height * 0.45, width * 0.06, height * 0.06, width, height);
    
    // Mongolian-Manchurian grassland
    this.createEarthPlainsRegion(map, width * 0.78, height * 0.32, width * 0.08, height * 0.06, width, height);
  }

  // Create a plains region
  private createEarthPlainsRegion(map: Tile[][], centerX: number, centerY: number, sizeX: number, sizeY: number, width: number, height: number): void {
    const startX = Math.max(0, Math.floor(centerX - sizeX / 2));
    const endX = Math.min(width - 1, Math.floor(centerX + sizeX / 2));
    const startY = Math.max(0, Math.floor(centerY - sizeY / 2));
    const endY = Math.min(height - 1, Math.floor(centerY + sizeY / 2));

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (map[y][x].terrain === TerrainType.GRASSLAND) {
          const distanceFromCenter = Math.sqrt(
            Math.pow((x - centerX) / sizeX, 2) + Math.pow((y - centerY) / sizeY, 2)
          );
          
          if (distanceFromCenter < 0.5 && Math.random() < 0.7) { // 70% probability for plains
            map[y][x].terrain = TerrainType.PLAINS;
          }
        }
      }
    }
  }

  // Add forests in appropriate climate zones
  private addEarthForests(map: Tile[][], width: number, height: number): void {
    // Amazon Rainforest (northern South America)
    this.createEarthForestRegion(map, width * 0.23, height * 0.58, width * 0.08, height * 0.12, TerrainType.JUNGLE, width, height);
    
    // Congo Rainforest (central Africa)
    this.createEarthForestRegion(map, width * 0.54, height * 0.58, width * 0.06, height * 0.08, TerrainType.JUNGLE, width, height);
    
    // Southeast Asian Rainforest (Indonesia/Malaysia)
    this.createEarthForestRegion(map, width * 0.78, height * 0.58, width * 0.06, height * 0.06, TerrainType.JUNGLE, width, height);
    
    // Boreal Forest (northern North America)
    this.createEarthForestRegion(map, width * 0.15, height * 0.18, width * 0.15, height * 0.06, TerrainType.FOREST, width, height);
    
    // Taiga (northern Eurasia)
    this.createEarthForestRegion(map, width * 0.75, height * 0.18, width * 0.2, height * 0.06, TerrainType.FOREST, width, height);
    
    // European Forests
    this.createEarthForestRegion(map, width * 0.48, height * 0.25, width * 0.08, height * 0.08, TerrainType.FOREST, width, height);
    
    // Eastern North American Forests
    this.createEarthForestRegion(map, width * 0.18, height * 0.32, width * 0.06, height * 0.12, TerrainType.FOREST, width, height);
  }

  // Create a forest region
  private createEarthForestRegion(map: Tile[][], centerX: number, centerY: number, sizeX: number, sizeY: number, forestType: TerrainType, width: number, height: number): void {
    const startX = Math.max(0, Math.floor(centerX - sizeX / 2));
    const endX = Math.min(width - 1, Math.floor(centerX + sizeX / 2));
    const startY = Math.max(0, Math.floor(centerY - sizeY / 2));
    const endY = Math.min(height - 1, Math.floor(centerY + sizeY / 2));

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (map[y][x].terrain === TerrainType.GRASSLAND) {
          const distanceFromCenter = Math.sqrt(
            Math.pow((x - centerX) / sizeX, 2) + Math.pow((y - centerY) / sizeY, 2)
          );
          
          if (distanceFromCenter < 0.5 && Math.random() < 0.7) {
            map[y][x].terrain = forestType;
          }
        }
      }
    }
  }

  // Add swamps in Earth's major wetland regions
  private addEarthSwamps(map: Tile[][], width: number, height: number): void {
    // Florida Everglades (southeastern North America)
    this.createEarthSwampRegion(map, width * 0.2, height * 0.42, width * 0.02, height * 0.04, width, height);
    
    // Mississippi Delta (southern North America)
    this.createEarthSwampRegion(map, width * 0.17, height * 0.45, width * 0.015, height * 0.02, width, height);
    
    // Amazon Basin wetlands (northern South America)
    this.createEarthSwampRegion(map, width * 0.25, height * 0.55, width * 0.03, height * 0.03, width, height);
    
    // Pantanal (central South America)
    this.createEarthSwampRegion(map, width * 0.24, height * 0.68, width * 0.02, height * 0.03, width, height);
    
    // Okavango Delta (southern Africa)
    this.createEarthSwampRegion(map, width * 0.54, height * 0.7, width * 0.015, height * 0.015, width, height);
    
    // Mesopotamian Marshes (Middle East)
    this.createEarthSwampRegion(map, width * 0.6, height * 0.4, width * 0.015, height * 0.02, width, height);
    
    // Sundarbans (South Asia)
    this.createEarthSwampRegion(map, width * 0.72, height * 0.48, width * 0.015, height * 0.015, width, height);
  }

  // Create a swamp region
  private createEarthSwampRegion(map: Tile[][], centerX: number, centerY: number, sizeX: number, sizeY: number, width: number, height: number): void {
    const startX = Math.max(0, Math.floor(centerX - sizeX / 2));
    const endX = Math.min(width - 1, Math.floor(centerX + sizeX / 2));
    const startY = Math.max(0, Math.floor(centerY - sizeY / 2));
    const endY = Math.min(height - 1, Math.floor(centerY + sizeY / 2));

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (map[y][x].terrain === TerrainType.GRASSLAND || map[y][x].terrain === TerrainType.JUNGLE) {
          const distanceFromCenter = Math.sqrt(
            Math.pow((x - centerX) / sizeX, 2) + Math.pow((y - centerY) / sizeY, 2)
          );
          
          if (distanceFromCenter < 0.5 && Math.random() < 0.6) {
            map[y][x].terrain = TerrainType.SWAMP;
          }
        }
      }
    }
  }

  // Add major rivers
  private addEarthRivers(map: Tile[][], width: number, height: number): void {
    // Amazon River (South America)
    this.traceEarthRiver(map, width * 0.27, height * 0.58, width * 0.19, height * 0.58, width, height);
    
    // Mississippi River (North America)
    this.traceEarthRiver(map, width * 0.15, height * 0.32, width * 0.17, height * 0.45, width, height);
    
    // Nile River (Africa)
    this.traceEarthRiver(map, width * 0.54, height * 0.35, width * 0.56, height * 0.65, width, height);
    
    // Congo River (Africa)
    this.traceEarthRiver(map, width * 0.52, height * 0.58, width * 0.58, height * 0.58, width, height);
    
    // Yangtze River (China)
    this.traceEarthRiver(map, width * 0.72, height * 0.38, width * 0.82, height * 0.38, width, height);
    
    // Ganges River (India)
    this.traceEarthRiver(map, width * 0.68, height * 0.45, width * 0.72, height * 0.48, width, height);
    
    // Volga River (Russia)
    this.traceEarthRiver(map, width * 0.58, height * 0.22, width * 0.62, height * 0.35, width, height);
    
    // Danube River (Europe)
    this.traceEarthRiver(map, width * 0.48, height * 0.28, width * 0.54, height * 0.32, width, height);
  }

  // Trace a river between two points
  private traceEarthRiver(map: Tile[][], startX: number, startY: number, endX: number, endY: number, width: number, height: number): void {
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const x = Math.floor(startX + (endX - startX) * progress);
      const y = Math.floor(startY + (endY - startY) * progress);
      
      if (x >= 0 && x < width && y >= 0 && y < height) {
        if (map[y][x].terrain !== TerrainType.OCEAN && map[y][x].terrain !== TerrainType.MOUNTAINS) {
          map[y][x].terrain = TerrainType.RIVER;
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
