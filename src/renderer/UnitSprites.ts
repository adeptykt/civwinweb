import { UnitType } from '../types/game';
import { SettingsManager } from '../utils/SettingsManager';

/**
 * Unit sprite management system for handling unit graphics with player-specific recoloring.
 * Similar to TerrainSprites but focused on units that need player color customization.
 */
export class UnitSprites {
  private static spriteCache = new Map<string, HTMLCanvasElement>();
  private static baseImages = new Map<string, HTMLImageElement|HTMLCanvasElement>();
  private static imageLoadPromises = new Map<string, Promise<HTMLImageElement|HTMLCanvasElement>>();
  
  private static civ1UnitsImage: HTMLImageElement | null = null;
  private static civ1UnitsPromise: Promise<HTMLImageElement> | null = null;

  // Order of units at the bottom of civ1units.png
  private static readonly V2_UNIT_ORDER = [
    UnitType.SETTLERS,
    UnitType.MILITIA,
    UnitType.PHALANX,
    UnitType.LEGION,
    UnitType.MUSKETEERS,
    UnitType.RIFLEMEN,
    UnitType.CAVALRY,
    UnitType.KNIGHTS,
    UnitType.CATAPULT,
    UnitType.CANNON,
    UnitType.CHARIOT,
    UnitType.ARMOR,
    UnitType.MECH_INF,
    UnitType.ARTILLERY,
    UnitType.FIGHTER,
    UnitType.BOMBER,
    UnitType.TRIREME,
    UnitType.SAIL,
    UnitType.FRIGATE,
    UnitType.IRONCLAD,
    UnitType.CRUISER,
    UnitType.BATTLESHIP,
    UnitType.SUBMARINE,
    UnitType.CARRIER,
    UnitType.TRANSPORT,
    UnitType.NUCLEAR,
    UnitType.DIPLOMAT,
    UnitType.CARAVAN
  ];

  /**
   * Get a cached unit sprite (synchronous)
   */
  public static getCachedSprite(
    unitType: UnitType, 
    playerColor: string, 
    tileSize: number
  ): HTMLCanvasElement | null {
    const unitSet = SettingsManager.getInstance().getSetting('unitSet');
    const cacheKey = `${unitType}-${playerColor}-${tileSize}-set:${unitSet}`;
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
    const unitSet = SettingsManager.getInstance().getSetting('unitSet');
    const cacheKey = `${unitType}-${playerColor}-${tileSize}-set:${unitSet}`;
    
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
  private static async loadBaseImage(unitType: UnitType): Promise<HTMLImageElement | HTMLCanvasElement | null> {
    const unitSet = SettingsManager.getInstance().getSetting('unitSet');
    const baseKey = `${unitType}-set:${unitSet}`;

    // Check if already loaded
    if (this.baseImages.has(baseKey)) {
      return this.baseImages.get(baseKey)!;
    }

    // Check if loading is in progress
    if (this.imageLoadPromises.has(baseKey)) {
      return await this.imageLoadPromises.get(baseKey)!;
    }

    let loadPromise: Promise<HTMLImageElement | HTMLCanvasElement>;

    if (unitSet === 'v2') {
      loadPromise = this.loadV2Sprite(unitType);
    } else {
      loadPromise = this.loadImage(unitType, unitSet);
    }

    this.imageLoadPromises.set(baseKey, loadPromise);

    try {
      const image = await loadPromise;
      this.baseImages.set(baseKey, image);
      this.imageLoadPromises.delete(baseKey);
      return image;
    } catch (error) {
      this.imageLoadPromises.delete(baseKey);
      console.warn(`Failed to load image for unit ${unitType}:`, error);
      return null;
    }
  }

  private static async loadV2Sprite(unitType: UnitType): Promise<HTMLCanvasElement> {
    if (!this.civ1UnitsPromise) {
      this.civ1UnitsPromise = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.civ1UnitsImage = img;
          resolve(img);
        };
        img.onerror = () => reject(new Error('Failed to load civ1units.png'));
        img.src = '/src/assets/civ1units.png';
      });
    }

    const img = await this.civ1UnitsPromise;

    const unitIndex = this.V2_UNIT_ORDER.indexOf(unitType);
    if (unitIndex === -1) {
      throw new Error(`Unit ${unitType} not found in V2 mapping`);
    }

    // Coordinates: sprites start at y=320, 32x32 each, 20 sprites per row.
    const x = (unitIndex % 20) * 32;
    const y = 320 + Math.floor(unitIndex / 20) * 32;

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, x, y, 32, 32, 0, 0, 32, 32);

    return canvas;
  }

  /**
   * Load an image from the assets folder
   */
  private static loadImage(unitType: UnitType, unitSet: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image for ${unitType}`));
      
      // Map unit types to image file names
      const imagePath = this.getImagePath(unitType, unitSet);
      img.src = imagePath;
    });
  }

  /**
   * Get the image path for a unit type
   */
  private static getImagePath(unitType: UnitType, unitSet: string): string {
    let filename = '';
    // Map unit types to image file names
    switch (unitType) {
      // Non-combat units
      case UnitType.SETTLERS:
        filename = 'settler.png'; break;
        
      // Ancient military units
      case UnitType.MILITIA:
        filename = 'militia.png'; break;
      case UnitType.PHALANX:
        filename = 'phalanx.png'; break;
      case UnitType.LEGION:
        filename = 'legion.png'; break;
      case UnitType.ARCHER:
        filename = 'archer.png'; break;
      case UnitType.CAVALRY:
        filename = 'calvary.png'; break; // Note: filename is "calvary.png"
      case UnitType.CHARIOT:
        filename = 'chariot.png'; break;
      case UnitType.CATAPULT:
        filename = 'catapult.png'; break;
        
      // Medieval military units
      case UnitType.KNIGHTS:
        filename = 'knight.png'; break;
        
      // Gunpowder units
      case UnitType.MUSKETEERS:
        filename = 'muskateer.png'; break; // Note: filename is "muskateer.png"
      case UnitType.CANNON:
        filename = 'cannon.png'; break;
        
      // Industrial units
      case UnitType.RIFLEMEN:
        filename = 'rifleman.png'; break;
      case UnitType.ARTILLERY:
        filename = 'artillery.png'; break;
        
      // Modern units
      case UnitType.ARMOR:
        filename = 'tank.png'; break; // Mapping tank.png to armor unit
      case UnitType.MECH_INF:
        filename = 'mech_inf.png'; break;
        
      // Air units
      case UnitType.FIGHTER:
        filename = 'fighter.png'; break;
      case UnitType.BOMBER:
        filename = 'bomber.png'; break;
        
      default:
        throw new Error(`No sprite available for unit type ${unitType}`);
    }
    
    if (unitSet === 'v3') {
      return `/src/assets/v3units/${filename}`;
    }
    return `/src/assets/${filename}`;
  }

  /**
   * Create a recolored version of the base sprite with light player color overlay
   */
  private static createRecoloredSprite(
    baseImage: HTMLImageElement | HTMLCanvasElement, 
    playerColor: string, 
    tileSize: number
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    const unitSet = SettingsManager.getInstance().getSetting('unitSet');

    let unitSize = 40;
    let offsetX = Math.floor((tileSize - unitSize) / 2);
    let offsetY = Math.floor((tileSize - unitSize) / 2);

    if (unitSet === 'v3') {
      // V3 units should fill out the space without a transparent border
      unitSize = tileSize;
      offsetX = 0;
      offsetY = 0;

      // Draw background color
      ctx.fillStyle = playerColor;
      ctx.fillRect(0, 0, tileSize, tileSize);
      
      // We'll read the original image's corner color by drawing it onto a temporary canvas
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = tileSize;
      tempCanvas.height = tileSize;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(baseImage, 0, 0, tileSize, tileSize);
      
      const imgData = tempCtx.getImageData(0, 0, tileSize, tileSize);
      const data = imgData.data;
      
      // Top-left pixel is assumed to be the background color
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];
      const bgA = data[3];

      // Dynamically key out colors that are bright grayscale (the baked-in checkerboard)
      // so the playerColor shows through the "transparent" space
      if (bgA > 250) {
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];
          
          const avg = (r + g + b) / 3;
          // Check if pixel is "bright gray/white" from the baked checkerboard
          if (avg > 170 && Math.abs(r - avg) < 20 && Math.abs(g - avg) < 20 && Math.abs(b - avg) < 20) {
            // Set alpha to 0 for these background pixels
            data[i+3] = 0; 
          }
        }
        tempCtx.putImageData(imgData, 0, 0);
      }
      
      // Draw the keyed image onto our main canvas (which already has the playerColor background)
      ctx.drawImage(tempCanvas, 0, 0);
    } else {
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
    }

    return canvas;
  }

  /**
   * Check if a unit type has a custom sprite available
   */
  public static hasCustomSprite(unitType: UnitType): boolean {
    const unitSet = SettingsManager.getInstance().getSetting('unitSet');
    if (unitSet === 'v2') {
      return this.V2_UNIT_ORDER.includes(unitType);
    }
    try {
      this.getImagePath(unitType, unitSet);
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
