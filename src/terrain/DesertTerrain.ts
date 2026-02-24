import { TerrainType, ResourceType } from '../types/game.js';
import { TerrainBase } from './TerrainBase.js';

/**
 * Desert terrain - harsh terrain with limited resources but potential for gold.
 * Higher movement cost and lower yields.
 */
export class DesertTerrain extends TerrainBase {
  private static desertImages: HTMLImageElement[] = [];
  private static imagesLoaded = false;

  constructor() {
    super(TerrainType.DESERT, {
      name: 'Desert',
      movementCost: 1,
      passable: true,
      color: '#fbbf24',
      possibleResources: [ResourceType.OASIS], // Desert has Oasis special resource in Civ1
      foodYield: 0,
      productionYield: 1,
      tradeYield: 0,
      canFoundCity: true,
      useConnections: false
    });

    // Preload desert images if not already loaded
    if (!DesertTerrain.imagesLoaded) {
      this.preloadImages();
    }
  }

  /**
   * Preload the desert images
   */
  private preloadImages(): void {
    const img = new Image();
    img.onload = () => {
      DesertTerrain.desertImages[0] = img;
      DesertTerrain.imagesLoaded = true;
    };
    img.onerror = () => {
      console.warn('Failed to load desert image: /src/assets/civwintiles/desert.png');
      DesertTerrain.imagesLoaded = true; // resolve so waitForImages() doesn't hang
    };
    img.src = '/src/assets/civwintiles/desert.png';
  }

  public isImagesLoaded(): boolean { return DesertTerrain.imagesLoaded; }

  public createSprite(tileSize: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // If images are loaded, randomly choose between desert variants
    if (DesertTerrain.imagesLoaded && DesertTerrain.desertImages.length > 0) {
      // Get available images (filter out null/undefined)
      const availableImages = DesertTerrain.desertImages.filter(img => img && img.complete);
      
      if (availableImages.length > 0) {
        // Equal probability for all available variants
        const randomIndex = Math.floor(Math.random() * availableImages.length);
        const desertImage = availableImages[randomIndex];
        
        // Draw the desert image scaled to the tile size
        ctx.drawImage(desertImage, 0, 0, tileSize, tileSize);
        return canvas;
      }
    }

    // If images aren't loaded yet, return a simple colored tile
    this.fillRect(ctx, 0, 0, tileSize, tileSize, this.color);
    return canvas;
  }

  public getResourceProbability(resource: ResourceType): number {
    switch (resource) {
      case ResourceType.GOLD:
        return 0.05;
      default:
        return 0;
    }
  }

  public getDescription(): string {
    return `${this.name}: Harsh terrain with potential for gold deposits. ` +
           `Food +${this.foodYield}, Production +${this.productionYield}, Trade +${this.tradeYield}`;
  }
}
