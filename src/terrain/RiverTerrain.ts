import { TerrainType, ResourceType } from '../types/game.js';
import { TerrainBase } from './TerrainBase.js';
import { ConnectionPattern, ConnectionMask } from '../types/terrain.js';

type RiverAssetName =
  | 'all'
  | 'bottomleft'
  | 'bottomleftright'
  | 'bottomright'
  | 'bottomtop'
  | 'bottomtopright'
  | 'leftright'
  | 'startbottom'
  | 'startleft'
  | 'startright'
  | 'starttop'
  | 'topleft'
  | 'topleftright'
  | 'topright';

// All river asset filenames that exist on disk.
const RIVER_ASSETS: RiverAssetName[] = [
  'all',
  'bottomleft',  'bottomleftright', 'bottomright', 'bottomtop', 'bottomtopright',
  'leftright',
  'startbottom', 'startleft',       'startright',  'starttop',
  'topleft',     'topleftright',    'topright',
];

/**
 * River terrain - flowing water that provides fish and fresh water.
 * Creates connected waterways across the map.
 */
export class RiverTerrain extends TerrainBase {
  private static images: Map<RiverAssetName, HTMLImageElement> = new Map();
  private static loadedCount = 0;
  private static readonly TOTAL = RIVER_ASSETS.length;
  /** Canvas cache keyed by "NSEW-flags@tileSize" to avoid re-drawing every frame. */
  private static spriteCache: Map<string, HTMLCanvasElement> = new Map();

  constructor() {
    super(TerrainType.RIVER, {
      name: 'River',
      movementCost: 1,
      passable: true,
      color: '#0ea5e9',
      possibleResources: [],
      foodYield: 2,
      productionYield: 0,
      tradeYield: 1,
      canFoundCity: true,
      useConnections: true,
    });

    if (RiverTerrain.loadedCount === 0 && RiverTerrain.images.size === 0) {
      this.preloadImages();
    }
  }

  /** Preload all seven directional river images. */
  private preloadImages(): void {
    for (const name of RIVER_ASSETS) {
      const img = new Image();
      img.onload  = () => { RiverTerrain.loadedCount++; };
      img.onerror = () => { RiverTerrain.loadedCount++; };
      img.src = `/src/assets/civwintiles/rivers/river-${name}.png`;
      RiverTerrain.images.set(name, img);
    }
  }

  public isImagesLoaded(): boolean { return RiverTerrain.loadedCount >= RiverTerrain.TOTAL; }

  /** Isolated river tile (no neighbours) — render as a short start-right stub. */
  public createSprite(tileSize: number): HTMLCanvasElement {
    return this.drawAsset('startright', tileSize) ?? this.colorFallback(tileSize);
  }

  /**
   * Select and render the correct directional river asset based on which cardinal
   * neighbours are also river tiles.  Only N/S/E/W connections matter — diagonal
   * bits from the connection mask are ignored.
   */
  public createConnectedSprite(tileSize: number, connections: ConnectionPattern): HTMLCanvasElement {
    const hasN = !!(connections & ConnectionMask.NORTH);
    const hasS = !!(connections & ConnectionMask.SOUTH);
    const hasE = !!(connections & ConnectionMask.EAST);
    const hasW = !!(connections & ConnectionMask.WEST);

    const cacheKey = `${hasN?'N':''}${hasS?'S':''}${hasE?'E':''}${hasW?'W':''}@${tileSize}`;
    const cached = RiverTerrain.spriteCache.get(cacheKey);
    if (cached) return cached;

    const sprite = this.resolveSprite(hasN, hasS, hasE, hasW, tileSize);
    if (this.isImagesLoaded()) RiverTerrain.spriteCache.set(cacheKey, sprite);
    return sprite;
  }

  /**
   * Exhaustive 16-case lookup for all N/S/E/W combinations.
   * Every combination has either a dedicated asset or a simple horizontal flip.
   */
  private resolveSprite(hasN: boolean, hasS: boolean, hasE: boolean, hasW: boolean, tileSize: number): HTMLCanvasElement {
    // 4-way cross
    if (hasN && hasS && hasE && hasW)
      return this.drawAsset('all', tileSize) ?? this.colorFallback(tileSize);

    // T-junctions
    if (hasN && hasS && hasE && !hasW)
      return this.drawAsset('bottomtopright',  tileSize) ?? this.colorFallback(tileSize);
    if (hasN && hasS && !hasE && hasW)
      // Mirror of bottomtopright (N+S+E flipped → N+S+W)
      return this.transformAsset('bottomtopright', tileSize, 0, true);
    if (hasN && !hasS && hasE && hasW)
      return this.drawAsset('topleftright',    tileSize) ?? this.colorFallback(tileSize);
    if (!hasN && hasS && hasE && hasW)
      return this.drawAsset('bottomleftright', tileSize) ?? this.colorFallback(tileSize);

    // Straight runs
    if (hasN && hasS)
      return this.drawAsset('bottomtop',  tileSize) ?? this.colorFallback(tileSize);
    if (hasE && hasW)
      return this.drawAsset('leftright',  tileSize) ?? this.colorFallback(tileSize);

    // Corners
    if (hasN && hasE) return this.drawAsset('topright',    tileSize) ?? this.colorFallback(tileSize);
    if (hasN && hasW) return this.drawAsset('topleft',     tileSize) ?? this.colorFallback(tileSize);
    if (hasS && hasE) return this.drawAsset('bottomright', tileSize) ?? this.colorFallback(tileSize);
    if (hasS && hasW) return this.drawAsset('bottomleft',  tileSize) ?? this.colorFallback(tileSize);

    // Single-direction starts
    if (hasE)  return this.drawAsset('startright',  tileSize) ?? this.colorFallback(tileSize);
    if (hasW)  return this.drawAsset('startleft',   tileSize) ?? this.colorFallback(tileSize);
    if (hasN)  return this.drawAsset('starttop',    tileSize) ?? this.colorFallback(tileSize);
    if (hasS)  return this.drawAsset('startbottom', tileSize) ?? this.colorFallback(tileSize);

    // Isolated tile
    return this.drawAsset('startright', tileSize) ?? this.colorFallback(tileSize);
  }

  // ── Rendering helpers ──────────────────────────────────────────────────────

  /** Draw a named river asset scaled to tileSize.  Returns null if not yet loaded. */
  private drawAsset(name: RiverAssetName, tileSize: number): HTMLCanvasElement | null {
    const img = RiverTerrain.images.get(name);
    if (!img || !img.complete || img.naturalWidth === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width  = tileSize;
    canvas.height = tileSize;
    canvas.getContext('2d')!.drawImage(img, 0, 0, tileSize, tileSize);
    return canvas;
  }

  /**
   * Draw an asset with an optional rotation (degrees) and/or horizontal flip.
   * Used to synthesise missing variants (e.g. bottomleft, starttop, startbottom).
   */
  private transformAsset(
    name: RiverAssetName,
    tileSize: number,
    rotateDeg: number,
    flipX = false,
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width  = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;
    const img = RiverTerrain.images.get(name);

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.translate(tileSize / 2, tileSize / 2);
      if (rotateDeg) ctx.rotate((rotateDeg * Math.PI) / 180);
      if (flipX) ctx.scale(-1, 1);
      ctx.drawImage(img, -tileSize / 2, -tileSize / 2, tileSize, tileSize);
      ctx.restore();
    } else {
      // Image not yet loaded — solid colour placeholder
      ctx.fillStyle = this.color;
      ctx.fillRect(0, 0, tileSize, tileSize);
    }
    return canvas;
  }

  private colorFallback(tileSize: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width  = tileSize;
    canvas.height = tileSize;
    this.fillRect(canvas.getContext('2d')!, 0, 0, tileSize, tileSize, this.color);
    return canvas;
  }

  public getResourceProbability(resource: ResourceType): number {
    switch (resource) {
      case ResourceType.FISH:
        return 0.5; // 50% chance for fish in rivers (reduced by 50%)
      default:
        return 0;
    }
  }

  public getDescription(): string {
    return `${this.name}: Fresh flowing water that provides fish and supports nearby agriculture. ` +
           `Food +${this.foodYield}, Production +${this.productionYield}, Trade +${this.tradeYield}`;
  }
}
