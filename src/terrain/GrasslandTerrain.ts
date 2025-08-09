import { TerrainType, ResourceType } from '../types/game.js';
import { TerrainBase } from './TerrainBase.js';

/**
 * Grassland terrain - the most basic and common terrain type.
 * Provides good balance of food and allows city founding.
 * In Civ1, some grassland tiles are "shield grassland" that produce +1 production.
 */
export class GrasslandTerrain extends TerrainBase {
  private static grasslandImages: HTMLImageElement[] = [];
  private static imagesLoaded = false;

  constructor() {
    super(TerrainType.GRASSLAND, {
      name: 'Grassland',
      movementCost: 1,
      passable: true,
      color: '#16a34a',
      possibleResources: [], // Grassland has no special resources in Civ1 (Shield is a terrain variant)
      foodYield: 2,
      productionYield: 0,
      tradeYield: 0,
      canFoundCity: true,
      useConnections: false
    });

    // Preload grassland images if not already loaded
    if (!GrasslandTerrain.imagesLoaded) {
      this.preloadImages();
    }
  }

  /**
   * Preload the grassland images
   */
  private preloadImages(): void {
    const imagePaths = [
      '/src/assets/civwintiles/grassland.png',
      '/src/assets/civwintiles/grassland2.png'
    ];

    imagePaths.forEach((path, index) => {
      const img = new Image();
      img.onload = () => {
        GrasslandTerrain.grasslandImages[index] = img;
        if (GrasslandTerrain.grasslandImages.length === imagePaths.length && 
            GrasslandTerrain.grasslandImages.every(img => img)) {
          GrasslandTerrain.imagesLoaded = true;
        }
      };
      img.onerror = () => {
        console.warn(`Failed to load grassland image: ${path}`);
      };
      img.src = path;
    });
  }

  public createSprite(tileSize: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // Only use images - no procedural fallback
    if (GrasslandTerrain.imagesLoaded && GrasslandTerrain.grasslandImages.length === 2) {
      // Use deterministic selection instead of random for caching consistency
      const selectedImage = GrasslandTerrain.grasslandImages[0]; // Always use first image
      
      if (selectedImage && selectedImage.complete) {
        // Draw the selected image scaled to the tile size
        ctx.drawImage(selectedImage, 0, 0, tileSize, tileSize);
        return canvas;
      }
    }

    // If images aren't loaded yet, return a simple colored tile
    this.fillRect(ctx, 0, 0, tileSize, tileSize, this.color);
    return canvas;
  }

  public getResourceProbability(_resource: ResourceType): number {
    // Grassland has no special resources in Civ1
    // Shield grassland is a terrain variant, not a special resource
    return 0;
  }
}
