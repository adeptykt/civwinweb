import { TerrainType, ResourceType } from '../types/game.js';
import { ConnectionPattern } from '../types/terrain.js';
import { t } from '../i18n/I18nService.js';

export interface TerrainProperties {
  /** Display name of the terrain */
  name: string;
  /** Base movement cost to enter this terrain */
  movementCost: number;
  /** Whether units can move through this terrain */
  passable: boolean;
  /** Base color for fallback rendering */
  color: string;
  /** Possible resources that can spawn on this terrain */
  possibleResources: ResourceType[];
  /** Base food yield */
  foodYield: number;
  /** Base production yield */
  productionYield: number;
  /** Base trade/commerce yield */
  tradeYield: number;
  /** Whether cities can be founded on this terrain */
  canFoundCity: boolean;
  /** Whether this terrain benefits from connection-based rendering */
  useConnections: boolean;
}

/**
 * Base class for all terrain types in the game.
 * Encapsulates common terrain functionality and properties.
 */
export abstract class TerrainBase {
  public readonly type: TerrainType;
  protected properties: TerrainProperties;

  constructor(type: TerrainType, properties: TerrainProperties) {
    this.type = type;
    this.properties = properties;
  }

  // Getters for terrain properties
  public get name(): string { return this.properties.name; }
  public get movementCost(): number { return this.properties.movementCost; }
  public get passable(): boolean { return this.properties.passable; }
  public get color(): string { return this.properties.color; }
  public get possibleResources(): ResourceType[] { return this.properties.possibleResources; }
  public get foodYield(): number { return this.properties.foodYield; }
  public get productionYield(): number { return this.properties.productionYield; }
  public get tradeYield(): number { return this.properties.tradeYield; }
  public get canFoundCity(): boolean { return this.properties.canFoundCity; }
  public get useConnections(): boolean { return this.properties.useConnections; }

  /**
   * Returns true when all images for this terrain type have finished loading.
   * Subclasses that preload images asynchronously should override this.
   */
  public isImagesLoaded(): boolean { return true; }

  /**
   * Create the basic sprite for this terrain type
   */
  public abstract createSprite(tileSize: number): HTMLCanvasElement;

  /**
   * Create a connected sprite for this terrain type (if applicable)
   */
  public createConnectedSprite(tileSize: number, _connections: ConnectionPattern): HTMLCanvasElement {
    // Default implementation: use basic sprite if connections not supported
    return this.createSprite(tileSize);
  }

  /**
   * Get the probability of a resource spawning on this terrain
   */
  public getResourceProbability(resource: ResourceType): number {
    if (!this.possibleResources.includes(resource)) {
      return 0;
    }
    // Default implementation - can be overridden by specific terrain types
    // Reduced by 50% from original 0.1 (10%) to 0.05 (5%)
    return 0.05;
  }

  /**
   * Get description text for this terrain type
   */
  public getDescription(): string {
    const key = `terrain.${this.type}.description`;
    const localized = t(key);
    if (localized !== key) {
      return localized;
    }
    return `${this.name}: Movement cost ${this.movementCost}, ` +
           `Food +${this.foodYield}, Production +${this.productionYield}, Trade +${this.tradeYield}`;
  }

  /**
   * Helper method to draw a filled rectangle on canvas
   */
  protected fillRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }

  /**
   * Helper method to draw a filled circle on canvas
   */
  protected fillCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Helper method to add random texture dots
   */
  protected addRandomTexture(ctx: CanvasRenderingContext2D, tileSize: number, colors: string[], density: number = 0.1): void {
    const dotCount = Math.floor(tileSize * tileSize * density);
    for (let i = 0; i < dotCount; i++) {
      const x = Math.floor(Math.random() * tileSize);
      const y = Math.floor(Math.random() * tileSize);
      const colorIndex = Math.floor(Math.random() * colors.length);
      ctx.fillStyle = colors[colorIndex];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}
