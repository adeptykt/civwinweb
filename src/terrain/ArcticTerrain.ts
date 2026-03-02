import { TerrainType, ResourceType } from '../types/game.js';
import { TerrainBase } from './TerrainBase.js';

/**
 * Arctic terrain - permanently frozen ice and snow.
 * Cold and hostile terrain with limited resources.
 */
export class ArcticTerrain extends TerrainBase {
  private static arcticImages: HTMLImageElement[] = [];
  private static imagesLoaded = false;

  constructor() {
    super(TerrainType.ARCTIC, {
      name: 'Arctic',
      movementCost: 2, // Difficult terrain to traverse
      passable: true,
      color: '#E0E0E0', // Light gray/white
      possibleResources: [ResourceType.SEAL], // Arctic terrain has Seal special resource in Civ1
      foodYield: 1,
      productionYield: 0,
      tradeYield: 0,
      canFoundCity: true,
      useConnections: false
    });

    // Initialize image loading if not already done
    if (!ArcticTerrain.imagesLoaded) {
      this.preloadImages();
    }
  }

  private preloadImages(): void {
    const imagePaths = [
      '/src/assets/civwintiles/arctic.png' // Placeholder until arctic.png is available
    ];

    let loadedCount = 0;
    imagePaths.forEach((path, index) => {
      const img = new Image();
      img.onload = () => {
        ArcticTerrain.arcticImages[index] = img;
        if (++loadedCount === imagePaths.length) {
          ArcticTerrain.imagesLoaded = true;
        }
      };
      img.onerror = () => {
        if (++loadedCount === imagePaths.length) {
          ArcticTerrain.imagesLoaded = true;
        }
      };
      img.src = path;
    });
  }

  public isImagesLoaded(): boolean { return ArcticTerrain.imagesLoaded; }

  public createSprite(tileSize: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // Use only image-based rendering
    if (ArcticTerrain.imagesLoaded && ArcticTerrain.arcticImages.length > 0) {
      // Random selection from loaded images
      const randomIndex = Math.floor(Math.random() * ArcticTerrain.arcticImages.length);
      const selectedImage = ArcticTerrain.arcticImages[randomIndex];
      
      if (selectedImage && selectedImage.complete) {
        ctx.drawImage(selectedImage, 0, 0, tileSize, tileSize);
        return canvas;
      }
    }

    return canvas;
  }

  /**
   * Get description for this terrain
   */
  public getDescription(): string {
    return "Permanently frozen ice and snow. " +
           "Cold and hostile terrain with limited resources but may provide seal hunting. " +
           "Movement cost: 2, Food: 1, Production: 0, Trade: 0";
  }

  /**
   * Check if this terrain is difficult to traverse
   */
  public isDifficultTerrain(): boolean {
    return true;
  }

  /**
   * Check if this terrain provides defensive bonuses
   */
  public getDefenseBonus(): number {
    return 0; // No defensive bonus
  }
}
