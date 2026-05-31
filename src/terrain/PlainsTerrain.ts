import { TerrainBase, TerrainProperties } from './TerrainBase';
import { TerrainType, ResourceType } from '../types/game';

/**
 * Plains terrain - open areas with better resources than grasslands but poorer soil.
 * Good for resources and trade routes when connected by roads.
 */
export class PlainsTerrain extends TerrainBase {
  private static plainsImages: HTMLImageElement[] = [];
  private static imagesLoaded = false;

  constructor() {
    super(TerrainType.PLAINS, {
      name: 'Plains',
      movementCost: 1,
      passable: true,
      color: '#daa520',
      possibleResources: [ResourceType.HORSES], // Plains has Horse special resource in Civ1
      foodYield: 1,
      productionYield: 1,
      tradeYield: 0,
      canFoundCity: true,
      useConnections: false
    });

    // Preload plains images if not already loaded
    if (!PlainsTerrain.imagesLoaded) {
      this.preloadImages();
    }
  }

  /**
   * Preload the plains images
   */
  private preloadImages(): void {
    const imagePaths = [
      '/src/assets/civwintiles/plains.png',
      '/src/assets/civwintiles/plains2.png',
      '/src/assets/civwintiles/plains3.png',
      '/src/assets/civwintiles/plains4.png'
    ];

    let loadedCount = 0;
    imagePaths.forEach((path, index) => {
      const img = new Image();
      img.onload = () => {
        PlainsTerrain.plainsImages[index] = img;
        if (++loadedCount === imagePaths.length) {
          PlainsTerrain.imagesLoaded = true;
        }
      };
      img.onerror = () => {
        if (++loadedCount === imagePaths.length) {
          PlainsTerrain.imagesLoaded = true;
        }
      };
      img.src = path;
    });
  }

  public isImagesLoaded(): boolean { return PlainsTerrain.imagesLoaded; }

  public createSprite(tileSize: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // Use only image-based rendering - randomly choose between plains variants
    if (PlainsTerrain.imagesLoaded && PlainsTerrain.plainsImages.length > 0) {
      // Equal probability for all three variants (33.33% each)
      const randomIndex = Math.floor(Math.random() * 3);
      
      const plainsImage = PlainsTerrain.plainsImages[randomIndex];

      if (plainsImage && plainsImage.complete) {
        // Draw the plains image scaled to the tile size
        ctx.drawImage(plainsImage, 0, 0, tileSize, tileSize);
        return canvas;
      }
    }

    return canvas;
  }

  public getResourceProbability(resource: ResourceType): number {
    switch (resource) {
      case ResourceType.HORSES:
        return 0.08; // 8% chance for horses in plains
      case ResourceType.WHEAT:
        return 0.05; // 5% chance for wheat
      default:
        return 0;
    }
  }

}
