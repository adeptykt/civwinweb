import { UnitType } from '../types/game';

/**
 * Unit sprite management system for handling unit graphics with player-specific recoloring.
 * Similar to TerrainSprites but focused on units that need player color customization.
 */
export class UnitSprites {
  private static spriteCache = new Map<string, HTMLCanvasElement>();
  private static baseImages = new Map<UnitType, HTMLImageElement>();
  private static imageLoadPromises = new Map<UnitType, Promise<HTMLImageElement>>();

  /**
   * Get a cached unit sprite (synchronous)
   */
  public static getCachedSprite(
    unitType: UnitType, 
    playerColor: string, 
    tileSize: number
  ): HTMLCanvasElement | null {
    const cacheKey = `${unitType}-${playerColor}-${tileSize}`;
    return this.spriteCache.get(cacheKey) || null;
  }

  /**
   * Get a unit sprite with player-specific coloring
   */
  public static async getUnitSprite(
    unitType: UnitType, 
    playerColor: string, 
    tileSize: number
  ): Promise<HTMLCanvasElement | null> {
    const cacheKey = `${unitType}-${playerColor}-${tileSize}`;
    
    // Check cache first
    if (this.spriteCache.has(cacheKey)) {
      return this.spriteCache.get(cacheKey)!;
    }

    try {
      // Load base image if not already loaded
      const baseImage = await this.loadBaseImage(unitType);
      if (!baseImage) {
        return null;
      }

      // Create recolored sprite
      const sprite = this.createRecoloredSprite(baseImage, playerColor, tileSize);
      
      // Cache the result
      this.spriteCache.set(cacheKey, sprite);
      
      return sprite;
    } catch (error) {
      console.warn(`Failed to create sprite for unit ${unitType}:`, error);
      return null;
    }
  }

  /**
   * Start loading a sprite asynchronously (fire and forget)
   */
  public static loadSpriteAsync(
    unitType: UnitType, 
    playerColor: string, 
    tileSize: number
  ): void {
    this.getUnitSprite(unitType, playerColor, tileSize).catch(error => {
      console.warn(`Background sprite loading failed for ${unitType}:`, error);
    });
  }

  /**
   * Load the base image for a unit type
   */
  private static async loadBaseImage(unitType: UnitType): Promise<HTMLImageElement | null> {
    // Check if already loaded
    if (this.baseImages.has(unitType)) {
      return this.baseImages.get(unitType)!;
    }

    // Check if loading is in progress
    if (this.imageLoadPromises.has(unitType)) {
      return await this.imageLoadPromises.get(unitType)!;
    }

    // Start loading
    const loadPromise = this.loadImage(unitType);
    this.imageLoadPromises.set(unitType, loadPromise);

    try {
      const image = await loadPromise;
      this.baseImages.set(unitType, image);
      this.imageLoadPromises.delete(unitType);
      return image;
    } catch (error) {
      this.imageLoadPromises.delete(unitType);
      console.warn(`Failed to load image for unit ${unitType}:`, error);
      return null;
    }
  }

  /**
   * Load an image from the assets folder
   */
  private static loadImage(unitType: UnitType): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image for ${unitType}`));
      
      // Map unit types to image file names
      const imagePath = this.getImagePath(unitType);
      img.src = imagePath;
    });
  }

  /**
   * Get the image path for a unit type
   */
  private static getImagePath(unitType: UnitType): string {
    // Map unit types to image file names
    switch (unitType) {
      // Non-combat units
      case UnitType.SETTLERS:
        return '/src/assets/settler.png';
        
      // Ancient military units
      case UnitType.MILITIA:
        return '/src/assets/militia.png';
      case UnitType.PHALANX:
        return '/src/assets/phalanx.png';
      case UnitType.LEGION:
        return '/src/assets/legion.png';
      case UnitType.ARCHER:
        return '/src/assets/archer.png';
      case UnitType.CAVALRY:
        return '/src/assets/calvary.png'; // Note: filename is "calvary.png"
      case UnitType.CHARIOT:
        return '/src/assets/chariot.png';
      case UnitType.CATAPULT:
        return '/src/assets/catapult.png';
        
      // Medieval military units
      case UnitType.KNIGHTS:
        return '/src/assets/knight.png';
        
      // Gunpowder units
      case UnitType.MUSKETEERS:
        return '/src/assets/muskateer.png'; // Note: filename is "muskateer.png"
      case UnitType.CANNON:
        return '/src/assets/cannon.png';
        
      // Industrial units
      case UnitType.RIFLEMEN:
        return '/src/assets/rifleman.png';
      case UnitType.ARTILLERY:
        return '/src/assets/artillery.png';
        
      // Modern units
      case UnitType.ARMOR:
        return '/src/assets/tank.png'; // Mapping tank.png to armor unit
      case UnitType.MECH_INF:
        return '/src/assets/mech_inf.png';
        
      // Air units
      case UnitType.FIGHTER:
        return '/src/assets/fighter.png';
      case UnitType.BOMBER:
        return '/src/assets/bomber.png';
        
      default:
        throw new Error(`No sprite available for unit type ${unitType}`);
    }
  }

  /**
   * Create a recolored version of the base sprite with light player color overlay
   */
  private static createRecoloredSprite(
    baseImage: HTMLImageElement, 
    playerColor: string, 
    tileSize: number
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // Calculate shrunk size (25x25 for a typical 32x32 tile, with padding)
    const unitSize = 40;//Math.min(25, Math.floor(tileSize * 0.78)); // ~78% of tile size, max 25px
    const offsetX = Math.floor((tileSize - unitSize) / 2);
    const offsetY = Math.floor((tileSize - unitSize) / 2);

    // Draw the base image scaled and centered with padding
    ctx.drawImage(baseImage, offsetX, offsetY, unitSize, unitSize);

    // Apply a light color overlay using blend modes (only over the unit area)
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.3; // Light overlay (30% opacity)
    ctx.fillStyle = playerColor;
    ctx.fillRect(offsetX, offsetY, unitSize, unitSize);

    // Reset blend mode and alpha
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;

    // Optional: Add a subtle color tint using 'overlay' blend mode for better color integration
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.15; // Very light overlay (15% opacity)
    ctx.fillStyle = playerColor;
    ctx.fillRect(offsetX, offsetY, unitSize, unitSize);

    // Reset to normal drawing mode
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;

    return canvas;
  }

  /**
   * Check if a unit type has a custom sprite available
   */
  public static hasCustomSprite(unitType: UnitType): boolean {
    try {
      this.getImagePath(unitType);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear sprite cache (useful for memory management or when tile size changes)
   */
  public static clearCache(): void {
    this.spriteCache.clear();
  }

  /**
   * Preload sprites for common unit types and player colors
   */
  public static async preloadSprites(
    unitTypes: UnitType[], 
    playerColors: string[], 
    tileSize: number
  ): Promise<void> {
    const promises: Promise<HTMLCanvasElement | null>[] = [];
    
    for (const unitType of unitTypes) {
      if (this.hasCustomSprite(unitType)) {
        for (const color of playerColors) {
          promises.push(this.getUnitSprite(unitType, color, tileSize));
        }
      }
    }
    
    await Promise.all(promises);
    console.log(`Preloaded ${promises.length} unit sprites`);
  }
}
