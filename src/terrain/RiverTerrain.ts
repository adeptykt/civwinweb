import { TerrainType, ResourceType } from '../types/game.js';
import { TerrainBase } from './TerrainBase.js';
import { ConnectionPattern, ConnectionMask } from '../types/terrain.js';

/**
 * River terrain - flowing water that provides fish and fresh water.
 * Creates connected waterways across the map.
 */
export class RiverTerrain extends TerrainBase {
  private static riverImage: HTMLImageElement | null = null;
  private static imageLoaded = false;

  constructor() {
    super(TerrainType.RIVER, {
      name: 'River',
      movementCost: 1, // Normal movement cost for land units
      passable: true,
      color: '#0ea5e9',
      possibleResources: [], // River has no special resources in Civ1 (Shield is a terrain variant)
      foodYield: 2,
      productionYield: 0,
      tradeYield: 1,
      canFoundCity: true, // Rivers are excellent for founding cities
      useConnections: true
    });

    // Preload river image if not already loaded
    if (!RiverTerrain.imageLoaded) {
      this.preloadImage();
    }
  }

  /**
   * Preload the river image (using ocean image as placeholder until river.png is available)
   */
  private preloadImage(): void {
    const img = new Image();
    img.onload = () => {
      RiverTerrain.riverImage = img;
      RiverTerrain.imageLoaded = true;
    };
    img.onerror = () => {
      RiverTerrain.imageLoaded = true;
    };
    // Using ocean image as placeholder - ideally should be river.png
    img.src = '/src/assets/civwintiles/ocean.png';
  }

  public isImagesLoaded(): boolean { return RiverTerrain.imageLoaded; }

  public createSprite(tileSize: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // Only use images - no procedural fallback
    if (RiverTerrain.imageLoaded && RiverTerrain.riverImage && RiverTerrain.riverImage.complete) {
      // Draw the river image scaled to the tile size
      ctx.drawImage(RiverTerrain.riverImage, 0, 0, tileSize, tileSize);
      return canvas;
    }

    // If image isn't loaded yet, return a simple colored tile
    this.fillRect(ctx, 0, 0, tileSize, tileSize, this.color);
    return canvas;
  }

  public createConnectedSprite(tileSize: number, connections: ConnectionPattern): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // Base river color
    this.fillRect(ctx, 0, 0, tileSize, tileSize, this.color);

    // Create flowing river based on connections
    this.drawConnectedRiverPattern(ctx, connections, tileSize);

    return canvas;
  }

  private drawConnectedRiverPattern(ctx: CanvasRenderingContext2D, connections: ConnectionPattern, tileSize: number): void {
    const centerX = tileSize / 2;
    const centerY = tileSize / 2;

    // Draw river channels based on connections
    ctx.fillStyle = '#38bdf8';

    // Horizontal flow (East-West)
    if ((connections & ConnectionMask.EAST) || (connections & ConnectionMask.WEST)) {
      this.drawRiverChannel(ctx, 0, tileSize, centerY - 2, centerY + 2, true, tileSize);
    }

    // Vertical flow (North-South)
    if ((connections & ConnectionMask.NORTH) || (connections & ConnectionMask.SOUTH)) {
      this.drawRiverChannel(ctx, 0, tileSize, centerX - 2, centerX + 2, false, tileSize);
    }

    // Draw curves for diagonal connections
    if (connections & (ConnectionMask.NORTHEAST | ConnectionMask.NORTHWEST | ConnectionMask.SOUTHEAST | ConnectionMask.SOUTHWEST)) {
      this.drawRiverCurves(ctx, connections, tileSize);
    }

    // Add water effects
    this.addRandomTexture(ctx, tileSize, ['#7dd3fc'], 0.025);
  }

  private drawRiverChannel(ctx: CanvasRenderingContext2D, start: number, end: number, width1: number, width2: number, horizontal: boolean, tileSize: number): void {
    for (let i = start; i < end; i++) {
      for (let w = width1; w <= width2; w++) {
        if (horizontal) {
          if (w >= 0 && w < tileSize && i >= 0 && i < tileSize) {
            ctx.fillRect(i, w, 1, 1);
          }
        } else {
          if (i >= 0 && i < tileSize && w >= 0 && w < tileSize) {
            ctx.fillRect(w, i, 1, 1);
          }
        }
      }
    }
  }

  private drawRiverCurves(ctx: CanvasRenderingContext2D, connections: ConnectionPattern, tileSize: number): void {
    const centerX = tileSize / 2;
    const centerY = tileSize / 2;
    const radius = tileSize / 3;

    // Draw curved connections to diagonal directions
    if (connections & ConnectionMask.NORTHEAST) {
      this.drawQuarterCircle(ctx, centerX, centerY, radius, 0, Math.PI / 2, tileSize);
    }
    if (connections & ConnectionMask.NORTHWEST) {
      this.drawQuarterCircle(ctx, centerX, centerY, radius, Math.PI / 2, Math.PI, tileSize);
    }
    if (connections & ConnectionMask.SOUTHWEST) {
      this.drawQuarterCircle(ctx, centerX, centerY, radius, Math.PI, 3 * Math.PI / 2, tileSize);
    }
    if (connections & ConnectionMask.SOUTHEAST) {
      this.drawQuarterCircle(ctx, centerX, centerY, radius, 3 * Math.PI / 2, 2 * Math.PI, tileSize);
    }
  }

  private drawQuarterCircle(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number, tileSize: number): void {
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / steps);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      if (x >= 0 && x < tileSize && y >= 0 && y < tileSize) {
        ctx.fillRect(Math.floor(x), Math.floor(y), 2, 2);
      }
    }
  }

  public getResourceProbability(resource: ResourceType): number {
    switch (resource) {
      case ResourceType.FISH:
        return 0.5; // 50% chance for fish in rivers (reduced by 50%)
      default:
        return 0;
    }
  }

  public getDescription(): string {
    return `${this.name}: Fresh flowing water that provides fish and supports nearby agriculture. ` +
           `Food +${this.foodYield}, Production +${this.productionYield}, Trade +${this.tradeYield}`;
  }
}
