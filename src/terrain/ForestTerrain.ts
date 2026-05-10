import { TerrainType, ResourceType } from '../types/game';
import { TerrainBase } from './TerrainBase';
import { ConnectionPattern, ConnectionMask } from '../types/terrain';

/**
 * Forest terrain - provides production bonus but blocks movement.
 * Dense vegetation that connects to adjacent forests.
 */
export class ForestTerrain extends TerrainBase {
  private static forestImages: HTMLImageElement[] = [];
  private static imagesLoaded = false;

  constructor() {
    super(TerrainType.FOREST, {
      name: 'Forest',
      movementCost: 1,
      passable: true,
      color: '#15803d',
      possibleResources: [ResourceType.GAME], // Forest has Game special resource in Civ1
      foodYield: 1,
      productionYield: 2,
      tradeYield: 0,
      canFoundCity: true,
      useConnections: true
    });
    
    // Preload images if not already loaded
    if (!ForestTerrain.imagesLoaded) {
      this.preloadImages();
    }
  }

  /**
   * Preload the forest images
   */
  private preloadImages(): void {
    const imagePaths = [
      '/src/assets/civwintiles/forest.png'
      // '/src/assets/civwintiles/forest2.png',  // Add when available
      // '/src/assets/civwintiles/forest3.png'   // Add when available
    ];

    let loadedCount = 0;
    imagePaths.forEach((path, index) => {
      const img = new Image();
      img.onload = () => {
        ForestTerrain.forestImages[index] = img;
        if (++loadedCount === imagePaths.length) {
          ForestTerrain.imagesLoaded = true;
        }
      };
      img.onerror = () => {
        if (++loadedCount === imagePaths.length) {
          ForestTerrain.imagesLoaded = true;
        }
      };
      img.src = path;
    });
  }

  public isImagesLoaded(): boolean { return ForestTerrain.imagesLoaded; }

  public createSprite(tileSize: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // Use only image-based rendering
    if (ForestTerrain.imagesLoaded && ForestTerrain.forestImages.length > 0) {
      // Random selection from loaded images
      const randomIndex = Math.floor(Math.random() * ForestTerrain.forestImages.length);
      const selectedImage = ForestTerrain.forestImages[randomIndex];
      
      if (selectedImage && selectedImage.complete) {
        ctx.drawImage(selectedImage, 0, 0, tileSize, tileSize);
        return canvas;
      }
    }

    return canvas;
    for (let i = 0; i < Math.floor(tileSize / 12); i++) {
      const x = Math.floor(Math.random() * (tileSize - 2));
      const y = Math.floor(Math.random() * (tileSize - 2));
      ctx.fillRect(x, y, 2, 2);
    }

    return canvas;
  }

  public createConnectedSprite(tileSize: number, connections: ConnectionPattern): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // Base forest color
    this.fillRect(ctx, 0, 0, tileSize, tileSize, this.color);

    // Create denser tree coverage where forests connect
    const treeColors = ['#166534', '#14532d', '#059669'];
    const baseDensity = Math.floor(tileSize / 8) + 2;
    const connectionBonus = this.countConnections(connections);
    const totalTrees = baseDensity + connectionBonus;
    
    for (let i = 0; i < totalTrees; i++) {
      const x = Math.floor(Math.random() * (tileSize - 6)) + 3;
      const y = Math.floor(Math.random() * (tileSize - 6)) + 3;
      const colorIndex = Math.floor(Math.random() * treeColors.length);
      ctx.fillStyle = treeColors[colorIndex];
      
      // Larger trees near connection edges
      const isNearConnection = this.isNearConnectionEdge(x, y, connections, tileSize);
      const canopySize = isNearConnection ? 4 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 2);
      
      this.drawTreeCanopy(ctx, x, y, canopySize);
    }

    // Add forest undergrowth
    this.addRandomTexture(ctx, tileSize, ['#22c55e'], 0.067);

    return canvas;
  }

  private drawTreeCanopy(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, size: number): void {
    for (let dy = -size/2; dy <= size/2; dy++) {
      for (let dx = -size/2; dx <= size/2; dx++) {
        if (dx*dx + dy*dy <= (size/2)*(size/2)) {
          const px = Math.floor(centerX + dx);
          const py = Math.floor(centerY + dy);
          if (px >= 0 && py >= 0) {
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }
    }
  }

  private countConnections(connections: ConnectionPattern): number {
    let count = 0;
    for (let i = 0; i < 8; i++) {
      if (connections & (1 << i)) count++;
    }
    return count;
  }

  private isNearConnectionEdge(x: number, y: number, connections: ConnectionPattern, tileSize: number): boolean {
    const edgeDistance = tileSize / 4;
    
    // Check if near any connected edge
    if ((connections & ConnectionMask.NORTH) && y < edgeDistance) return true;
    if ((connections & ConnectionMask.SOUTH) && y > tileSize - edgeDistance) return true;
    if ((connections & ConnectionMask.EAST) && x > tileSize - edgeDistance) return true;
    if ((connections & ConnectionMask.WEST) && x < edgeDistance) return true;
    
    return false;
  }

  public getResourceProbability(resource: ResourceType): number {
    if (!this.possibleResources.includes(resource)) {
      return 0;
    }
    // Reduced default probability by 50% for forest terrain
    return 0.05; // 5% chance (reduced from default 10%)
  }

}
