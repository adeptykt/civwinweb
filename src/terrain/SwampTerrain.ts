import { TerrainType, ResourceType } from '../types/game.js';
import { TerrainBase } from './TerrainBase.js';

/**
 * Swamp terrain - wetlands with murky water and marsh vegetation.
 * Difficult to traverse and unhealthy but can provide fish and rare resources.
 */
export class SwampTerrain extends TerrainBase {
  private static swampImages: HTMLImageElement[] = [];
  private static imagesLoaded = false;

  constructor() {
    super(TerrainType.SWAMP, {
      name: 'Swamp',
      movementCost: 2, // Difficult terrain to traverse
      passable: true,
      color: '#556B2F', // Dark olive green
      possibleResources: [ResourceType.OIL], // Swamp has Oil special resource in Civ1
      foodYield: 1,
      productionYield: 0,
      tradeYield: 0,
      canFoundCity: true,
      useConnections: false
    });
    
    // Preload images if not already loaded
    if (!SwampTerrain.imagesLoaded) {
      this.preloadImages();
    }
  }

  /**
   * Preload the swamp images
   */
  private preloadImages(): void {
    const imagePaths = [
      '/src/assets/civwintiles/swamp.png'
      // '/src/assets/civwintiles/swamp2.png',  // Add when available
      // '/src/assets/civwintiles/swamp3.png'   // Add when available
    ];

    imagePaths.forEach((path, index) => {
      const img = new Image();
      img.onload = () => {
        SwampTerrain.swampImages[index] = img;
        if (SwampTerrain.swampImages.length === imagePaths.length &&
          SwampTerrain.swampImages.every(img => img)) {
          SwampTerrain.imagesLoaded = true;
        }
      };
      img.onerror = () => {
        console.warn(`Failed to load swamp image: ${path}`);
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
    if (SwampTerrain.imagesLoaded && SwampTerrain.swampImages.length > 0) {
      // Random selection from loaded images
      const randomIndex = Math.floor(Math.random() * SwampTerrain.swampImages.length);
      const selectedImage = SwampTerrain.swampImages[randomIndex];
      
      if (selectedImage && selectedImage.complete) {
        ctx.drawImage(selectedImage, 0, 0, tileSize, tileSize);
        return canvas;
      }
    }

    // Error: images should be loaded, log issue if fallback is reached
    console.warn('Swamp terrain images not loaded, returning blank canvas');
    return canvas;
  }

  /**
   * Get display name for this terrain
   */
  public getDescription(): string {
    return "Wetlands filled with murky water and marsh vegetation. " +
           "Difficult to traverse and unhealthy, but may provide fish resources. " +
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
    return 0.1; // Small defensive bonus due to difficult terrain
  }
}
