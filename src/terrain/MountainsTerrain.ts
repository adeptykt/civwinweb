import { TerrainType, ResourceType } from '../types/game.js';
import { TerrainBase } from './TerrainBase.js';
import { ConnectionPattern, ConnectionMask } from '../types/terrain.js';

/**
 * Mountains terrain - impassable terrain rich in resources.
 * Blocks movement but provides excellent production and gold.
 */
export class MountainsTerrain extends TerrainBase {
  private static mountainsImages: HTMLImageElement[] = [];
  private static imagesLoaded = false;

  constructor() {
    super(TerrainType.MOUNTAINS, {
      name: 'Mountains',
      movementCost: 3, // High movement cost but passable
      passable: true,
      color: '#8b7355',
      possibleResources: [ResourceType.GOLD], // Mountains has Gold special resource in Civ1
      foodYield: 0,
      productionYield: 3,
      tradeYield: 0,
      canFoundCity: true,
      useConnections: true
    });
    if (!MountainsTerrain.imagesLoaded) {
      this.preloadImages();
    }
  }

  private preloadImages(): void {
    const imagePaths = [
      '/src/assets/civwintiles/mountain.png'
      // '/src/assets/civwintiles/mountain2.png',  // Add when available
      // '/src/assets/civwintiles/mountain3.png'   // Add when available
    ];

    let loadedCount = 0;
    imagePaths.forEach((path, index) => {
      const img = new Image();
      img.onload = () => {
        MountainsTerrain.mountainsImages[index] = img;
        if (++loadedCount === imagePaths.length) {
          MountainsTerrain.imagesLoaded = true;
        }
      };
      img.onerror = () => {
        if (++loadedCount === imagePaths.length) {
          MountainsTerrain.imagesLoaded = true;
        }
      };
      img.src = path;
    });
  }

  public isImagesLoaded(): boolean { return MountainsTerrain.imagesLoaded; }

  public createSprite(tileSize: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // Use only image-based rendering
    if (MountainsTerrain.imagesLoaded && MountainsTerrain.mountainsImages.length > 0) {
      // Random selection from loaded images
      const randomIndex = Math.floor(Math.random() * MountainsTerrain.mountainsImages.length);
      const selectedImage = MountainsTerrain.mountainsImages[randomIndex];
      
      if (selectedImage && selectedImage.complete) {
        // Draw the mountains image scaled to the tile size
        ctx.drawImage(selectedImage, 0, 0, tileSize, tileSize);
        return canvas;
      }
    }

    return canvas;
  }

  public createConnectedSprite(tileSize: number, connections: ConnectionPattern): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // Base mountain color
    this.fillRect(ctx, 0, 0, tileSize, tileSize, this.color);

    // Create mountain ridges based on connections
    this.drawConnectedMountainPattern(ctx, connections, tileSize);

    return canvas;
  }

  private drawClassicMountainPattern(ctx: CanvasRenderingContext2D, tileSize: number): void {
    const centerX = tileSize / 2;
    const centerY = tileSize / 2;
    
    // Draw large central mountain with classic Civ coloring
    ctx.fillStyle = '#a68b5b'; // Medium brown
    this.drawTriangularPeak(ctx, centerX, centerY - 2, 12, 8, tileSize);
    
    // Draw smaller peaks around it
    ctx.fillStyle = '#9d8054'; // Slightly darker
    this.drawTriangularPeak(ctx, centerX - 8, centerY + 4, 8, 6, tileSize);
    this.drawTriangularPeak(ctx, centerX + 8, centerY + 2, 10, 7, tileSize);
    
    // Draw some smaller hills at the base
    ctx.fillStyle = '#8b7355'; // Base color
    this.drawTriangularPeak(ctx, centerX - 4, centerY + 8, 6, 4, tileSize);
    this.drawTriangularPeak(ctx, centerX + 6, centerY + 10, 5, 3, tileSize);
    
    // Add highlights on peaks (classic Civ style)
    ctx.fillStyle = '#c4a875'; // Light brown highlights
    this.addPeakHighlights(ctx, centerX, centerY - 2, 3, tileSize);
    this.addPeakHighlights(ctx, centerX + 8, centerY + 2, 2, tileSize);
    
    // Add dark shadows/valleys
    ctx.fillStyle = '#6b5d4f'; // Dark brown shadows
    this.addMountainShadows(ctx, tileSize);
  }

  private drawConnectedMountainPattern(ctx: CanvasRenderingContext2D, connections: ConnectionPattern, tileSize: number): void {
    const size = tileSize;
    const centerX = size / 2;
    const centerY = size / 2;

    // Draw mountain ridge lines connecting to adjacent mountains
    ctx.fillStyle = '#a68b5b';

    // Horizontal ridge (East-West connection)
    if ((connections & ConnectionMask.EAST) && (connections & ConnectionMask.WEST)) {
      this.drawHorizontalRidge(ctx, centerY - 2, centerY + 2, tileSize);
    }
    
    // Vertical ridge (North-South connection)
    if ((connections & ConnectionMask.NORTH) && (connections & ConnectionMask.SOUTH)) {
      this.drawVerticalRidge(ctx, centerX - 2, centerX + 2, tileSize);
    }

    // Draw peaks at connection points
    if (connections & ConnectionMask.NORTH) {
      this.drawTriangularPeak(ctx, centerX, centerY - size/3, 8, 6, tileSize);
    }
    if (connections & ConnectionMask.SOUTH) {
      this.drawTriangularPeak(ctx, centerX, centerY + size/3, 8, 6, tileSize);
    }
    if (connections & ConnectionMask.EAST) {
      this.drawTriangularPeak(ctx, centerX + size/3, centerY, 8, 6, tileSize);
    }
    if (connections & ConnectionMask.WEST) {
      this.drawTriangularPeak(ctx, centerX - size/3, centerY, 8, 6, tileSize);
    }

    // Always draw a central peak
    this.drawTriangularPeak(ctx, centerX, centerY, 10, 8, tileSize);

    // Add highlights and shadows
    ctx.fillStyle = '#c4a875';
    this.addPeakHighlights(ctx, centerX, centerY, 3, tileSize);
  }

  private drawTriangularPeak(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, width: number, height: number, tileSize: number): void {
    for (let y = 0; y < height; y++) {
      const currentWidth = width * (1 - y / height);
      const startX = centerX - currentWidth / 2;
      const endX = centerX + currentWidth / 2;
      
      for (let x = startX; x <= endX; x++) {
        const px = Math.floor(x);
        const py = Math.floor(centerY + y - height / 2);
        
        if (px >= 0 && px < tileSize && py >= 0 && py < tileSize) {
          ctx.fillRect(px, py, 1, 1);
        }
      }
    }
  }

  private addPeakHighlights(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, size: number, tileSize: number): void {
    for (let i = 0; i < size; i++) {
      const x = Math.floor(centerX - size/2 + i);
      const y = Math.floor(centerY - size/2);
      
      if (x >= 0 && x < tileSize && y >= 0 && y < tileSize) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  private addMountainShadows(ctx: CanvasRenderingContext2D, tileSize: number): void {
    // Add some scattered dark pixels for rocky texture and shadows
    for (let i = 0; i < Math.floor(tileSize * tileSize / 25); i++) {
      const x = Math.floor(Math.random() * tileSize);
      const y = Math.floor(Math.random() * tileSize);
      
      // Focus shadows more toward the bottom and sides
      if (y > tileSize * 0.6 || x < tileSize * 0.2 || x > tileSize * 0.8) {
        if (Math.random() < 0.7) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  private drawHorizontalRidge(ctx: CanvasRenderingContext2D, startY: number, endY: number, tileSize: number): void {
    ctx.fillStyle = '#9d8054';
    for (let y = startY; y <= endY; y++) {
      for (let x = 0; x < tileSize; x++) {
        const variance = Math.sin(x / tileSize * Math.PI * 2) * 2;
        const py = Math.floor(y + variance);
        if (py >= 0 && py < tileSize) {
          ctx.fillRect(x, py, 1, 1);
        }
      }
    }
  }

  private drawVerticalRidge(ctx: CanvasRenderingContext2D, startX: number, endX: number, tileSize: number): void {
    ctx.fillStyle = '#9d8054';
    for (let x = startX; x <= endX; x++) {
      for (let y = 0; y < tileSize; y++) {
        const variance = Math.sin(y / tileSize * Math.PI * 2) * 2;
        const px = Math.floor(x + variance);
        if (px >= 0 && px < tileSize) {
          ctx.fillRect(px, y, 1, 1);
        }
      }
    }
  }

  public getResourceProbability(resource: ResourceType): number {
    switch (resource) {
      case ResourceType.GOLD:
        return 0.25; // 25% chance for gold in mountains (reduced by 50%)
      case ResourceType.IRON:
        return 0.15; // 15% chance for iron (reduced by 50%)
      default:
        return 0;
    }
  }

  public getDescription(): string {
    return `${this.name}: Impassable terrain rich in gold and iron. Excellent for mining operations. ` +
           `Food +${this.foodYield}, Production +${this.productionYield}, Trade +${this.tradeYield}`;
  }
}
