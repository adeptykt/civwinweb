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
      '/src/assets/civwintiles/plains3.png'
    ];

    imagePaths.forEach((path, index) => {
      const img = new Image();
      img.onload = () => {
        PlainsTerrain.plainsImages[index] = img;
        if (PlainsTerrain.plainsImages.length === imagePaths.length &&
          PlainsTerrain.plainsImages.every(img => img)) {
          PlainsTerrain.imagesLoaded = true;
        }
      };
      img.onerror = () => {
        console.warn(`Failed to load plains image: ${path}`);
      };
      img.src = path;
    });
  }

  public createSprite(tileSize: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // If images are loaded, randomly choose between plains variants
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

    // Fallback to procedural generation if images aren't loaded
    // Base plains color (golden brown)
    this.fillRect(ctx, 0, 0, tileSize, tileSize, this.color);

    // Add grass texture
    ctx.fillStyle = '#cd853f';
    for (let y = 0; y < tileSize; y += 6) {
      for (let x = 0; x < tileSize; x += 8) {
        const offset = (y / 6) % 2 === 0 ? 0 : 4;
        if (Math.random() < 0.6) {
          ctx.fillRect(x + offset, y, 2, 3);
        }
      }
    }

    // Add some scattered patches of different colors
    ctx.fillStyle = '#b8860b';
    for (let i = 0; i < 15; i++) {
      const x = Math.floor(Math.random() * tileSize);
      const y = Math.floor(Math.random() * tileSize);
      ctx.fillRect(x, y, 2, 2);
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

  public getDescription(): string {
    return `${this.name}: Open terrain good for resources and trade routes. ` +
      `Food +${this.foodYield}, Production +${this.productionYield}, Trade +${this.tradeYield}`;
  }
}
