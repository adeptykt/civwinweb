import { TerrainType, ResourceType } from '../types/game.js';
import { TerrainBase } from './TerrainBase.js';
import { ConnectionPattern, ConnectionMask } from '../types/terrain.js';

/**
 * Hills terrain - elevated terrain that provides production bonus.
 * Good for mining and defensive positions.
 */
export class HillsTerrain extends TerrainBase {
  private static hillsImages: HTMLImageElement[] = [];
  private static imagesLoaded = false;

  constructor() {
    super(TerrainType.HILLS, {
      name: 'Hills',
      movementCost: 1,
      passable: true,
      color: '#84cc16',
      possibleResources: [ResourceType.COAL], // Hills has Coal special resource in Civ1
      foodYield: 1,
      productionYield: 1,
      tradeYield: 0,
      canFoundCity: true,
      useConnections: true
    });
    if (!HillsTerrain.imagesLoaded) {
      this.preloadImages();
    }
  }

  /**
   * Preload the hills images
   */
  private preloadImages(): void {
    const imagePaths = [
      '/src/assets/civwintiles/hill.png'
      // '/src/assets/civwintiles/hill2.png',  // Add when available
      // '/src/assets/civwintiles/hill3.png'   // Add when available
    ];

    imagePaths.forEach((path, index) => {
      const img = new Image();
      img.onload = () => {
        HillsTerrain.hillsImages[index] = img;
        if (HillsTerrain.hillsImages.length === imagePaths.length &&
          HillsTerrain.hillsImages.every(img => img)) {
          HillsTerrain.imagesLoaded = true;
        }
      };
      img.onerror = () => {
        console.warn(`Failed to load hills image: ${path}`);
      };
      img.src = path;
    });
  }

  public createSprite(tileSize: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // Use only image-based rendering
    if (HillsTerrain.imagesLoaded && HillsTerrain.hillsImages.length > 0) {
      // Equal probability for all available variants (currently just one)
      const randomIndex = Math.floor(Math.random() * HillsTerrain.hillsImages.length);

      const hillsImage = HillsTerrain.hillsImages[randomIndex];

      if (hillsImage && hillsImage.complete) {
        // Draw the hills image scaled to the tile size
        ctx.drawImage(hillsImage, 0, 0, tileSize, tileSize);
        return canvas;
      }
    }

    // Error: images should be loaded, log issue if fallback is reached
    console.warn('Hills terrain images not loaded, returning blank canvas');
    return canvas;
  }

  public createConnectedSprite(tileSize: number, connections: ConnectionPattern): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // Base hill color
    this.fillRect(ctx, 0, 0, tileSize, tileSize, this.color);

    // Create rolling elevation based on connections
    this.drawConnectedHillPattern(ctx, connections, tileSize);

    return canvas;
  }

  private drawConnectedHillPattern(ctx: CanvasRenderingContext2D, connections: ConnectionPattern, tileSize: number): void {
    const centerX = tileSize / 2;
    const centerY = tileSize / 2;

    // Create rolling elevation based on connections
    ctx.fillStyle = '#a3e635';

    // Draw elevation flows toward connected directions
    if (connections & ConnectionMask.NORTH) {
      this.drawHillFlow(ctx, centerX, centerY, 0, -1, tileSize);
    }
    if (connections & ConnectionMask.SOUTH) {
      this.drawHillFlow(ctx, centerX, centerY, 0, 1, tileSize);
    }
    if (connections & ConnectionMask.EAST) {
      this.drawHillFlow(ctx, centerX, centerY, 1, 0, tileSize);
    }
    if (connections & ConnectionMask.WEST) {
      this.drawHillFlow(ctx, centerX, centerY, -1, 0, tileSize);
    }

    // Add central hill mass
    const radius = Math.min(centerX, centerY) - 4;
    for (let r = radius; r > 0; r -= 2) {
      const shade = r / radius;
      ctx.fillStyle = shade > 0.5 ? '#a3e635' : '#65a30d';

      for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r * 0.8;

        if (x >= 0 && x < tileSize && y >= 0 && y < tileSize) {
          ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
        }
      }
    }
  }

  private drawHillFlow(ctx: CanvasRenderingContext2D, startX: number, startY: number, dirX: number, dirY: number, tileSize: number): void {
    const steps = tileSize / 2;
    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const x = startX + dirX * i;
      const y = startY + dirY * i;

      if (x >= 0 && x < tileSize && y >= 0 && y < tileSize) {
        const width = Math.max(1, (1 - progress) * 6);
        for (let w = -width / 2; w <= width / 2; w++) {
          const px = Math.floor(x + w);
          const py = Math.floor(y);
          if (px >= 0 && px < tileSize) {
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }
    }
  }

  public getResourceProbability(resource: ResourceType): number {
    switch (resource) {
      case ResourceType.IRON:
        return 0.1; // 10% chance for iron in hills (reduced by 50%)
      case ResourceType.HORSES:
        return 0.025; // 2.5% chance for horses (reduced by 50%)
      default:
        return 0;
    }
  }

  public getDescription(): string {
    return `${this.name}: Elevated terrain good for mining and defense. ` +
      `Food +${this.foodYield}, Production +${this.productionYield}, Trade +${this.tradeYield}`;
  }
}
