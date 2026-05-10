import { TerrainType, ResourceType } from '../types/game.js';
import { TerrainBase } from './TerrainBase.js';
import { ConnectionMask } from '../types/terrain.js';

/**
 * Ocean terrain - water terrain that blocks land units.
 * Source of fish resources and trade routes.
 */
export class OceanTerrain extends TerrainBase {
  private static oceanImages: HTMLImageElement[] = [];
  private static oceanBorderImages: { [key: string]: HTMLImageElement } = {};
  private static imagesLoaded = false;

  constructor() {
    super(TerrainType.OCEAN, {
      name: 'Ocean',
      movementCost: 999, // Impassable for land units
      passable: false,
      color: '#1e3a8a',
      possibleResources: [ResourceType.FISH],
      foodYield: 1,
      productionYield: 0,
      tradeYield: 2,
      canFoundCity: false,
      useConnections: true  // Enable connections for coastline borders
    });
    
    // Preload images if not already loaded
    if (!OceanTerrain.imagesLoaded) {
      this.preloadImages();
    }
  }

  /**
   * Preload the ocean images
   */
  private preloadImages(): void {
    const imagePaths = [
      '/src/assets/civwintiles/ocean.png'
      // '/src/assets/civwintiles/ocean2.png',  // Add when available
      // '/src/assets/civwintiles/ocean3.png'   // Add when available
    ];

    const borderImagePaths: { [key: string]: string } = {
      top: '/src/assets/civwintiles/ocean_N.png',
      bottom: '/src/assets/civwintiles/ocean_S.png',
      left: '/src/assets/civwintiles/ocean_W.png',
      right: '/src/assets/civwintiles/ocean_E.png',
      sw: '/src/assets/civwintiles/oceans/ocean_SW.png',
      landlocked: '/src/assets/civwintiles/ocean_landlocked.png'
    };

    let loadedCount = 0;
    const totalImages = imagePaths.length + Object.keys(borderImagePaths).length;

    // Load main ocean images
    imagePaths.forEach((path, index) => {
      const img = new Image();
      img.onload = () => {
        OceanTerrain.oceanImages[index] = img;
        loadedCount++;
        if (loadedCount === totalImages) {
          OceanTerrain.imagesLoaded = true;
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === totalImages) {
          OceanTerrain.imagesLoaded = true;
        }
      };
      img.src = path;
    });

    // Load border images
    Object.entries(borderImagePaths).forEach(([key, path]) => {
      const img = new Image();
      img.onload = () => {
        OceanTerrain.oceanBorderImages[key] = img;
        loadedCount++;
        if (loadedCount === totalImages) {
          OceanTerrain.imagesLoaded = true;
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === totalImages) {
          OceanTerrain.imagesLoaded = true;
        }
      };
      img.src = path;
    });
  }

  public isImagesLoaded(): boolean { return OceanTerrain.imagesLoaded; }

  public createSprite(tileSize: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // Use only image-based rendering
    if (OceanTerrain.imagesLoaded && OceanTerrain.oceanImages.length > 0) {
      // Use first available image for consistency
      const selectedImage = OceanTerrain.oceanImages[0];
      
      if (selectedImage && selectedImage.complete) {
        ctx.drawImage(selectedImage, 0, 0, tileSize, tileSize);
        return canvas;
      }
    }

    // If images aren't loaded yet, try to load them again
    if (!OceanTerrain.imagesLoaded) {
      this.preloadImages();
      // Return a temporary placeholder with a distinct pattern so we can see the issue
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(0, 0, tileSize, tileSize);
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.max(8, tileSize / 4)}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('?', tileSize / 2, tileSize / 2 + tileSize / 8);
      return canvas;
    }

    ctx.fillStyle = '#ff0000'; // Red to indicate error
    ctx.fillRect(0, 0, tileSize, tileSize);
    return canvas;
  }

  public getResourceProbability(resource: ResourceType): number {
    switch (resource) {
      case ResourceType.FISH:
        return 0.06; // ~6% chance for fish in ocean
      default:
        return 0;
    }
  }

  /**
   * Create a connected sprite for ocean with coastline borders
   */
  public createConnectedSprite(tileSize: number, connections: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;

    // Check if this ocean tile is completely landlocked (surrounded by land on all sides)
    const isLandlocked = (connections & (
      ConnectionMask.NORTH | ConnectionMask.SOUTH | 
      ConnectionMask.EAST | ConnectionMask.WEST |
      ConnectionMask.NORTHEAST | ConnectionMask.NORTHWEST |
      ConnectionMask.SOUTHEAST | ConnectionMask.SOUTHWEST
    )) === 0;

    // If landlocked, use the landlocked sprite
    if (isLandlocked && OceanTerrain.imagesLoaded && OceanTerrain.oceanBorderImages.landlocked) {
      const landlockedImage = OceanTerrain.oceanBorderImages.landlocked;
      if (landlockedImage && landlockedImage.complete) {
        ctx.drawImage(landlockedImage, 0, 0, tileSize, tileSize);
        return canvas;
      }
    }

    // Otherwise, draw the base ocean image if available
    if (OceanTerrain.imagesLoaded && OceanTerrain.oceanImages.length > 0) {
      // Use first available image for consistency
      const selectedImage = OceanTerrain.oceanImages[0];
      
      if (selectedImage && selectedImage.complete) {
        ctx.drawImage(selectedImage, 0, 0, tileSize, tileSize);
      } else {
        const baseSprite = this.createSprite(tileSize);
        ctx.drawImage(baseSprite, 0, 0);
      }
    } else {
      const baseSprite = this.createSprite(tileSize);
      ctx.drawImage(baseSprite, 0, 0);
    }

    // Then add coastline borders where there are adjacent land tiles
    this.addCoastlineBorders(ctx, connections, tileSize);

    return canvas;
  }

  /**
   * Add coastline borders to ocean tiles adjacent to land
   */
  private addCoastlineBorders(ctx: CanvasRenderingContext2D, connections: number, tileSize: number): void {
    const borderWidth = Math.max(2, Math.floor(tileSize / 16));
    const landColor = '#228B22'; // Forest green for natural land
    const shoreColor = '#F4A460'; // Sandy yellow for shore border
    
    // Check each direction for lack of ocean connection (indicating land)
    const hasLandNorth = (connections & ConnectionMask.NORTH) === 0;
    const hasLandSouth = (connections & ConnectionMask.SOUTH) === 0;
    const hasLandEast = (connections & ConnectionMask.EAST) === 0;
    const hasLandWest = (connections & ConnectionMask.WEST) === 0;
    const hasLandNE = (connections & ConnectionMask.NORTHEAST) === 0;
    const hasLandNW = (connections & ConnectionMask.NORTHWEST) === 0;
    const hasLandSE = (connections & ConnectionMask.SOUTHEAST) === 0;
    const hasLandSW = (connections & ConnectionMask.SOUTHWEST) === 0;

    // Special composite corner checks
    const useSW = hasLandSouth && hasLandWest && !hasLandNorth && !hasLandEast && !hasLandNW && !hasLandSE && 
                 OceanTerrain.oceanBorderImages.sw && OceanTerrain.oceanBorderImages.sw.complete;

    // Draw coastline borders
    if (useSW) {
      ctx.drawImage(OceanTerrain.oceanBorderImages.sw, 0, 0, tileSize, tileSize);
    } else {
      if (hasLandSouth) {
        this.drawCoastlineBorder(ctx, 'south', tileSize, borderWidth, landColor, shoreColor);
      }
      if (hasLandWest) {
        this.drawCoastlineBorder(ctx, 'west', tileSize, borderWidth, landColor, shoreColor);
      }
    }

    if (hasLandNorth) {
      this.drawCoastlineBorder(ctx, 'north', tileSize, borderWidth, landColor, shoreColor);
    }
    if (hasLandEast) {
      this.drawCoastlineBorder(ctx, 'east', tileSize, borderWidth, landColor, shoreColor);
    }

    // Draw corner connections for smooth coastlines
    if (hasLandNE && !hasLandNorth && !hasLandEast) {
      
    }
    if (hasLandNW && !hasLandNorth && !hasLandWest) {
      
    }
    if (hasLandSE && !hasLandSouth && !hasLandEast) {
     
    }
    if (hasLandSW && !hasLandSouth && !hasLandWest) {
      
    }
  }

  /**
   * Draw a coastline border using the appropriate ocean border sprite
   */
  private drawCoastlineBorder(
    ctx: CanvasRenderingContext2D,
    side: 'north' | 'south' | 'east' | 'west',
    tileSize: number,
    borderWidth: number,
    landColor: string,
    shoreColor: string
  ): void {
    const borderImageMap = {
      'north': 'top',
      'south': 'bottom',
      'east': 'right',
      'west': 'left'
    };

    const borderKey = borderImageMap[side];
    const borderImage = OceanTerrain.oceanBorderImages[borderKey];

    if (borderImage && borderImage.complete) {
      // Draw the border sprite
      ctx.drawImage(borderImage, 0, 0, tileSize, tileSize);
    } else {
      // Fallback to simple colored border if sprite not loaded
      this.drawSimpleBorder(ctx, side, tileSize, borderWidth, landColor, shoreColor);
    }
  }

  /**
   * Fallback method to draw simple colored borders
   */
  private drawSimpleBorder(
    ctx: CanvasRenderingContext2D,
    side: 'north' | 'south' | 'east' | 'west',
    tileSize: number,
    borderWidth: number,
    landColor: string,
    shoreColor: string
  ): void {
    const shoreWidth = Math.max(1, Math.floor(borderWidth / 2));
    
    switch (side) {
      case 'north':
        // Green land strip at the top
        ctx.fillStyle = landColor;
        ctx.fillRect(0, 0, tileSize, borderWidth);
        // Yellow shore border
        ctx.fillStyle = shoreColor;
        ctx.fillRect(0, borderWidth, tileSize, shoreWidth);
        break;
        
      case 'south':
        // Green land strip at the bottom
        ctx.fillStyle = landColor;
        ctx.fillRect(0, tileSize - borderWidth, tileSize, borderWidth);
        // Yellow shore border
        ctx.fillStyle = shoreColor;
        ctx.fillRect(0, tileSize - borderWidth - shoreWidth, tileSize, shoreWidth);
        break;
        
      case 'east':
        // Green land strip on the right
        ctx.fillStyle = landColor;
        ctx.fillRect(tileSize - borderWidth, 0, borderWidth, tileSize);
        // Yellow shore border
        ctx.fillStyle = shoreColor;
        ctx.fillRect(tileSize - borderWidth - shoreWidth, 0, shoreWidth, tileSize);
        break;
        
      case 'west':
        // Green land strip on the left
        ctx.fillStyle = landColor;
        ctx.fillRect(0, 0, borderWidth, tileSize);
        // Yellow shore border
        ctx.fillStyle = shoreColor;
        ctx.fillRect(borderWidth, 0, shoreWidth, tileSize);
        break;
    }
  }
}
