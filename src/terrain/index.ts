import { TerrainType, ResourceType, TerrainVariant } from '../types/game.js';
import { ConnectionPattern } from '../types/terrain.js';

// Import all terrain classes
import { TerrainBase } from './TerrainBase.js';
import { GrasslandTerrain } from './GrasslandTerrain.js';
import { PlainsTerrain } from './PlainsTerrain.js';
import { DesertTerrain } from './DesertTerrain.js';
import { ForestTerrain } from './ForestTerrain.js';
import { HillsTerrain } from './HillsTerrain.js';
import { MountainsTerrain } from './MountainsTerrain.js';
import { OceanTerrain } from './OceanTerrain.js';
import { RiverTerrain } from './RiverTerrain.js';
import { JungleTerrain } from './JungleTerrain.js';
import { SwampTerrain } from './SwampTerrain.js';
import { ArcticTerrain } from './ArcticTerrain.js';
import { TundraTerrain } from './TundraTerrain.js';

/**
 * Factory class for creating terrain instances.
 * Manages all terrain types and provides a unified interface.
 */
export class TerrainManager {
  private static terrainInstances: Map<TerrainType, TerrainBase> = new Map();
  private static spriteCache: Map<string, HTMLCanvasElement> = new Map();

  /**
   * Initialize all terrain instances
   */
  public static initialize(): void {
    this.terrainInstances.set(TerrainType.GRASSLAND, new GrasslandTerrain());
    this.terrainInstances.set(TerrainType.PLAINS, new PlainsTerrain());
    this.terrainInstances.set(TerrainType.DESERT, new DesertTerrain());
    this.terrainInstances.set(TerrainType.FOREST, new ForestTerrain());
    this.terrainInstances.set(TerrainType.HILLS, new HillsTerrain());
    this.terrainInstances.set(TerrainType.MOUNTAINS, new MountainsTerrain());
    this.terrainInstances.set(TerrainType.OCEAN, new OceanTerrain());
    this.terrainInstances.set(TerrainType.RIVER, new RiverTerrain());
    this.terrainInstances.set(TerrainType.JUNGLE, new JungleTerrain());
    this.terrainInstances.set(TerrainType.SWAMP, new SwampTerrain());
    this.terrainInstances.set(TerrainType.ARCTIC, new ArcticTerrain());
    this.terrainInstances.set(TerrainType.TUNDRA, new TundraTerrain());
  }

  /**
   * Get terrain instance by type
   */
  public static getTerrain(type: TerrainType): TerrainBase {
    if (this.terrainInstances.size === 0) {
      this.initialize();
    }

    const terrain = this.terrainInstances.get(type);
    if (!terrain) {
      throw new Error(`Unknown terrain type: ${type}`);
    }
    return terrain;
  }

  /**
   * Get all terrain types
   */
  public static getAllTerrainTypes(): TerrainType[] {
    return Array.from(Object.values(TerrainType));
  }

  /**
   * Get terrain sprite (with or without connections and variants)
   */
  public static getTerrainSprite(type: TerrainType, tileSize: number, connections?: ConnectionPattern, variant?: TerrainVariant): HTMLCanvasElement {
    const key = `${type}_${tileSize}_${connections || 0}_${variant || 'none'}`;

    if (this.spriteCache.has(key)) {
      return this.spriteCache.get(key)!;
    }

    // Generate sprite
    const terrain = this.getTerrain(type);
    let sprite: HTMLCanvasElement;

    // if (connections !== undefined && terrain.useConnections) {
    //   console.debug(`  Creating connected sprite for ${type} with variant ${variant || 'none'}`);
    //   sprite = terrain.createConnectedSprite(tileSize, connections);
    // } else {
      console.debug(`  Creating basic sprite for ${type} with variant ${variant || 'none'}`);
      sprite = terrain.createSprite(tileSize);
    // }

    // Add variant rendering on top of base terrain
    if (variant && variant !== TerrainVariant.NONE) {
      sprite = this.addVariantToSprite(sprite, variant, tileSize);
    }

    console.debug(`  Generated sprite: ${sprite.width}x${sprite.height}`);

    // Cache the sprite
    this.spriteCache.set(key, sprite);
    return sprite;
  }

  /**
   * Check if terrain type uses connection-based rendering
   */
  public static shouldUseConnections(type: TerrainType): boolean {
    return this.getTerrain(type).useConnections;
  }

  /**
   * Get terrain color for fallback rendering
   */
  public static getTerrainColor(type: TerrainType): string {
    return this.getTerrain(type).color;
  }

  /**
   * Check if units can move through this terrain
   */
  public static isPassable(type: TerrainType): boolean {
    return this.getTerrain(type).passable;
  }

  /**
   * Get movement cost for terrain
   */
  public static getMovementCost(type: TerrainType): number {
    return this.getTerrain(type).movementCost;
  }

  /**
   * Check if cities can be founded on this terrain
   */
  public static canFoundCity(type: TerrainType): boolean {
    return this.getTerrain(type).canFoundCity;
  }

  /**
   * Get terrain yields (food, production, trade)
   */
  public static getTerrainYields(type: TerrainType): { food: number; production: number; trade: number } {
    const terrain = this.getTerrain(type);
    return {
      food: terrain.foodYield,
      production: terrain.productionYield,
      trade: terrain.tradeYield
    };
  }

  /**
   * Get resource color for rendering (classic Civ 1 style)
   */
  public static getResourceColor(resource: ResourceType): string {
    switch (resource) {
      case ResourceType.WHEAT: return '#fef3c7'; // Light wheat color
      case ResourceType.GOLD: return '#fbbf24'; // Bright gold
      case ResourceType.IRON: return '#6b7280'; // Metallic gray
      case ResourceType.HORSES: return '#92400e'; // Brown
      case ResourceType.FISH: return '#bfdbfe'; // Light blue
      default: return '#ffffff';
    }
  }

  /**
   * Clear sprite cache (useful when tile size changes)
   */
  public static clearSpriteCache(): void {
    this.spriteCache.clear();
  }

  /**
   * Add variant rendering to an existing terrain sprite
   */
  private static addVariantToSprite(baseSprite: HTMLCanvasElement, variant: TerrainVariant, tileSize: number): HTMLCanvasElement {
    // Create a new canvas to combine the base sprite with variant rendering
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // Draw the base terrain sprite first
    ctx.drawImage(baseSprite, 0, 0);

    // Add variant-specific rendering on top
    switch (variant) {
      case TerrainVariant.SHIELD:
        this.renderShieldVariant(ctx, tileSize);
        break;
    }

    return canvas;
  }

  /**
   * Render a shield variant indicator on a terrain tile
   */
  private static renderShieldVariant(ctx: CanvasRenderingContext2D, tileSize: number): void {
    const centerX = tileSize / 2;
    const centerY = tileSize / 2;
    const shieldSize = Math.max(8, tileSize / 6); // Scale shield size with tile size

    // Draw a small shield in the center
    ctx.fillStyle = '#2D5016'; // Dark green shield
    ctx.strokeStyle = '#1A3009'; // Darker green border
    ctx.lineWidth = 1;

    // Shield shape (pointed bottom, rounded top)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - shieldSize / 2); // Top center
    ctx.quadraticCurveTo(centerX + shieldSize / 2, centerY - shieldSize / 2, centerX + shieldSize / 2, centerY); // Top right curve
    ctx.lineTo(centerX + shieldSize / 3, centerY + shieldSize / 3); // Right side
    ctx.lineTo(centerX, centerY + shieldSize / 2); // Bottom point
    ctx.lineTo(centerX - shieldSize / 3, centerY + shieldSize / 3); // Left side
    ctx.lineTo(centerX - shieldSize / 2, centerY); // Left top
    ctx.quadraticCurveTo(centerX - shieldSize / 2, centerY - shieldSize / 2, centerX, centerY - shieldSize / 2); // Top left curve
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    // Add a small highlight on the shield
    ctx.fillStyle = '#4A7C23'; // Lighter green highlight
    ctx.beginPath();
    ctx.ellipse(centerX - shieldSize / 6, centerY - shieldSize / 6, shieldSize / 8, shieldSize / 12, 0, 0, 2 * Math.PI);
    ctx.fill();
  }
}

// Export all terrain classes for direct use if needed
export {
  TerrainBase,
  GrasslandTerrain,
  DesertTerrain,
  ForestTerrain,
  HillsTerrain,
  MountainsTerrain,
  OceanTerrain,
  RiverTerrain,
  JungleTerrain
};

// Initialize the terrain manager
TerrainManager.initialize();
