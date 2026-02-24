import { TerrainType, ResourceType } from '../types/game.js';
import { TerrainBase } from './TerrainBase.js';

/**
 * Tundra terrain - cold, partially frozen ground with sparse vegetation.
 * Harsh climate with limited food production.
 */
export class TundraTerrain extends TerrainBase {
  private static tundraImages: HTMLImageElement[] = [];
  private static imagesLoaded = false;

  constructor() {
    super(TerrainType.TUNDRA, {
      name: 'Tundra',
      movementCost: 1, // Normal movement cost
      passable: true,
      color: '#C0C0C0', // Gray
      possibleResources: [ResourceType.GAME], // Tundra terrain has Game special resource in Civ1
      foodYield: 1,
      productionYield: 0,
      tradeYield: 0,
      canFoundCity: true,
      useConnections: false
    });

    // Initialize image loading if not already done
    if (!TundraTerrain.imagesLoaded) {
      this.preloadImages();
    }
  }

  private preloadImages(): void {
    const imagePaths = [
      '/src/assets/civwintiles/grassland.png' // Placeholder until tundra.png is available
    ];

    let loadedCount = 0;
    imagePaths.forEach((path, index) => {
      const img = new Image();
      img.onload = () => {
        TundraTerrain.tundraImages[index] = img;
        if (++loadedCount === imagePaths.length) {
          TundraTerrain.imagesLoaded = true;
        }
      };
      img.onerror = () => {
        if (++loadedCount === imagePaths.length) {
          TundraTerrain.imagesLoaded = true;
        }
      };
      img.src = path;
    });
  }

  public isImagesLoaded(): boolean { return TundraTerrain.imagesLoaded; }

  public createSprite(tileSize: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // Use only image-based rendering
    if (TundraTerrain.imagesLoaded && TundraTerrain.tundraImages.length > 0) {
      // Random selection from loaded images
      const randomIndex = Math.floor(Math.random() * TundraTerrain.tundraImages.length);
      const selectedImage = TundraTerrain.tundraImages[randomIndex];
      
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
    return "Cold, partially frozen ground with sparse vegetation. " +
           "Harsh climate with limited food production but may provide game. " +
           "Movement cost: 1, Food: 1, Production: 0, Trade: 0";
  }

  /**
   * Check if this terrain is difficult to traverse
   */
  public isDifficultTerrain(): boolean {
    return false; // Normal movement cost
  }

  /**
   * Check if this terrain provides defensive bonuses
   */
  public getDefenseBonus(): number {
    return 0; // No defensive bonus
  }
}
