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

    // If images are loaded, randomly choose between grassland.png and grassland2.png
    if (GrasslandTerrain.imagesLoaded && GrasslandTerrain.grasslandImages.length === 2) {
      const randomIndex = Math.floor(Math.random() * 2);
      const selectedImage = GrasslandTerrain.grasslandImages[randomIndex];
      
      if (selectedImage && selectedImage.complete) {
        // Draw the selected image scaled to the tile size
        ctx.drawImage(selectedImage, 0, 0, tileSize, tileSize);
        return canvas;
      }
    }

    // Fallback to procedural generation if images aren't loaded
    // Base grass color
    this.fillRect(ctx, 0, 0, tileSize, tileSize, this.color);

    // Add grass texture using random dots and small patches (top-down view)
    const grassColors = ['#22c55e', '#15803d', '#166534', '#10b981'];
    const dotCount = Math.floor(tileSize * tileSize / 6);
    
    for (let i = 0; i < dotCount; i++) {
      const x = Math.floor(Math.random() * tileSize);
      const y = Math.floor(Math.random() * tileSize);
      const colorIndex = Math.floor(Math.random() * grassColors.length);
      ctx.fillStyle = grassColors[colorIndex];
      
      // Vary the size of grass patches for more organic look
      const patchSize = Math.random() < 0.7 ? 1 : 2;
      ctx.fillRect(x, y, patchSize, patchSize);
    }

    // Add some scattered darker grass areas
    ctx.fillStyle = '#14532d';
    for (let i = 0; i < Math.floor(tileSize / 4); i++) {
      const x = Math.floor(Math.random() * (tileSize - 3));
      const y = Math.floor(Math.random() * (tileSize - 3));
      ctx.fillRect(x, y, 2 + Math.floor(Math.random() * 2), 1 + Math.floor(Math.random() * 2));
    }

    return canvas;
  }

  public getResourceProbability(_resource: ResourceType): number {
    // Grassland has no special resources in Civ1
    // Shield grassland is a terrain variant, not a special resource
    return 0;
  }
}
