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

    // If images are loaded, use the swamp image
    if (SwampTerrain.imagesLoaded && SwampTerrain.swampImages.length > 0) {
      // Random selection from loaded images
      const randomIndex = Math.floor(Math.random() * SwampTerrain.swampImages.length);
      const selectedImage = SwampTerrain.swampImages[randomIndex];
      
      if (selectedImage && selectedImage.complete) {
        ctx.drawImage(selectedImage, 0, 0, tileSize, tileSize);
        return canvas;
      }
    }

    // Fallback to procedural generation if images aren't loaded
    // Base swamp color (dark olive green)
    this.fillRect(ctx, 0, 0, tileSize, tileSize, this.color);

    // Add murky water patches
    const waterColors = ['#2F4F4F', '#3C5A5A', '#456464'];
    const waterPatches = Math.floor(tileSize * tileSize / 8);
    
    for (let i = 0; i < waterPatches; i++) {
      const x = Math.floor(Math.random() * tileSize);
      const y = Math.floor(Math.random() * tileSize);
      const colorIndex = Math.floor(Math.random() * waterColors.length);
      ctx.fillStyle = waterColors[colorIndex];
      
      // Create irregular water patches
      const patchSize = 2 + Math.floor(Math.random() * 4);
      ctx.fillRect(x, y, patchSize, patchSize);
    }

    // Add marsh vegetation (reeds and grasses)
    const vegetationColors = ['#6B8E23', '#8FBC8F', '#9ACD32'];
    const vegetationDensity = Math.floor(tileSize * tileSize / 6);
    
    for (let i = 0; i < vegetationDensity; i++) {
      const x = Math.floor(Math.random() * tileSize);
      const y = Math.floor(Math.random() * tileSize);
      const colorIndex = Math.floor(Math.random() * vegetationColors.length);
      ctx.fillStyle = vegetationColors[colorIndex];
      
      // Create thin vertical lines for reeds
      if (Math.random() < 0.6) {
        const reedHeight = 3 + Math.floor(Math.random() * 6);
        ctx.fillRect(x, y, 1, reedHeight);
      } else {
        // Small patches of marsh grass
        ctx.fillRect(x, y, 2, 2);
      }
    }

    // Add some bubbles and swamp gas effects
    const bubbleCount = Math.floor(tileSize / 8);
    ctx.fillStyle = '#4A5D4A';
    
    for (let i = 0; i < bubbleCount; i++) {
      const x = Math.floor(Math.random() * tileSize);
      const y = Math.floor(Math.random() * tileSize);
      
      // Small circular bubbles
      ctx.beginPath();
      ctx.arc(x, y, 1 + Math.random() * 2, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Add subtle mist/fog effect with light patches
    this.addRandomTexture(ctx, tileSize, ['#778877', '#889988'], 0.02);

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
