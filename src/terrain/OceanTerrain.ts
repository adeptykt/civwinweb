import { TerrainType, ResourceType } from '../types/game.js';
import { TerrainBase } from './TerrainBase.js';
import { ConnectionMask, ConnectionPattern } from '../types/terrain.js';

/**
 * CivWin ocean coast tiles.
 *
 * Naming: letters indicate where LAND lies on the map (N/S/E/W).
 * Artwork: `ocean_E*` draws ocean on the LEFT; `ocean_W*` draws ocean on the RIGHT;
 * `ocean_N*` has coast along the top; `ocean_S*` along the bottom.
 * NC/SC suffixes add a second coast along north or south (see W_SC, E_NC).
 */
type OceanAssetName =
  | 'open'
  | 'landlocked'
  | 'N'
  | 'E'
  | 'NCSC'
  | 'NCSC_N'
  | 'NCSC_S'
  | 'NCSC_W'
  | 'NCSC_E'
  | 'NCSC_NE'
  | 'NCSC_NW'
  | 'NCSC_SE'
  | 'NCSC_SW'
  | 'NCSC_NW_SE'
  | 'NCSC_NE_SW'
  | 'NCSC_open'
  | 'NE'
  | 'SE'
  | 'SW'
  | 'WN'
  | 'SCE'
  | 'NCEC'
  | 'N_EC'
  | 'N_WC'
  | 'N_WCEC'
  | 'S_EC'
  | 'S_WC'
  | 'S_WCEC'
  | 'E_NC'
  | 'E_SC'
  | 'E_hole'
  | 'E_hole_NC'
  | 'E_hole_SC'
  | 'W_NC'
  | 'W_SC'
  | 'W_hole'
  | 'W_hole_NC'
  | 'W_hole_SC'
  | 'N_hole_deep'
  | 'S_hole_deep';

const OCEAN_ASSETS: OceanAssetName[] = [
  'open',
  'landlocked',
  'N',
  'E',
  'NCSC',
  'NCSC_N',
  'NCSC_S',
  'NCSC_W',
  'NCSC_E',
  'NCSC_NE',
  'NCSC_NW',
  'NCSC_SE',
  'NCSC_SW',
  'NCSC_NW_SE',
  'NCSC_NE_SW',
  'NCSC_open',
  'NE',
  'SE',
  'SW',
  'WN',
  'SCE',
  'NCEC',
  'N_EC',
  'N_WC',
  'N_WCEC',
  'S_EC',
  'S_WC',
  'S_WCEC',
  'E_NC',
  'E_SC',
  'E_hole',
  'E_hole_NC',
  'E_hole_SC',
  'W_NC',
  'W_SC',
  'W_hole',
  'W_hole_NC',
  'W_hole_SC',
  'N_hole_deep',
  'S_hole_deep',
];

export class OceanTerrain extends TerrainBase {
  private static images: Map<OceanAssetName, HTMLImageElement> = new Map();
  private static loadedCount = 0;
  private static readonly TOTAL = OCEAN_ASSETS.length;
  private static spriteCache: Map<string, HTMLCanvasElement> = new Map();

  constructor() {
    super(TerrainType.OCEAN, {
      name: 'Ocean',
      movementCost: 999,
      passable: false,
      color: '#1e3a8a',
      possibleResources: [ResourceType.FISH],
      foodYield: 1,
      productionYield: 0,
      tradeYield: 2,
      canFoundCity: false,
      useConnections: true,
    });

    if (OceanTerrain.loadedCount === 0 && OceanTerrain.images.size === 0) {
      this.preloadImages();
    }
  }

  private static assetUrls(name: OceanAssetName): string[] {
    const file = name === 'open' ? 'ocean.png' : `ocean_${name}.png`;
    // Coast variants live under oceans/; base tiles (open, landlocked, E, …) are in civwintiles/.
    return [
      `/src/assets/civwintiles/oceans/${file}`,
      `/src/assets/civwintiles/${file}`,
    ];
  }

  private preloadImages(): void {
    for (const name of OCEAN_ASSETS) {
      const img = new Image();
      const urls = OceanTerrain.assetUrls(name);
      let urlIndex = 0;

      const finish = () => {
        OceanTerrain.loadedCount++;
      };

      img.onload = () => {
        OceanTerrain.images.set(name, img);
        finish();
      };

      img.onerror = () => {
        urlIndex++;
        if (urlIndex < urls.length) {
          img.src = urls[urlIndex];
        } else {
          console.error(
            `[OceanTerrain] Could not load coast sprite "${name}" (tried: ${urls.join(', ')})`
          );
          finish();
        }
      };

      OceanTerrain.images.set(name, img);
      img.src = urls[0];
    }
  }

  public isImagesLoaded(): boolean {
    return OceanTerrain.loadedCount >= OceanTerrain.TOTAL;
  }

  /** Dev: clear autotile cache (e.g. strait-preview after tile size change). */
  public static clearSpriteCache(): void {
    OceanTerrain.spriteCache.clear();
  }

  public createSprite(tileSize: number): HTMLCanvasElement {
    return this.createConnectedSprite(tileSize, ConnectionMask.NONE);
  }

  public createConnectedSprite(tileSize: number, connections: ConnectionPattern): HTMLCanvasElement {
    const ln = (connections & ConnectionMask.NORTH) === 0;
    const ls = (connections & ConnectionMask.SOUTH) === 0;
    const le = (connections & ConnectionMask.EAST) === 0;
    const lw = (connections & ConnectionMask.WEST) === 0;
    const lne = (connections & ConnectionMask.NORTHEAST) === 0;
    const lnw = (connections & ConnectionMask.NORTHWEST) === 0;
    const lse = (connections & ConnectionMask.SOUTHEAST) === 0;
    const lsw = (connections & ConnectionMask.SOUTHWEST) === 0;

    const cacheKey =
      `${ln ? 'N' : ''}${ls ? 'S' : ''}${le ? 'E' : ''}${lw ? 'W' : ''}` +
      `${lne ? 'n' : ''}${lnw ? 'u' : ''}${lse ? 's' : ''}${lsw ? 'w' : ''}@${tileSize}`;
    const cached = OceanTerrain.spriteCache.get(cacheKey);
    if (cached) return cached;

    const sprite = this.resolveCoastSprite(ln, ls, le, lw, lne, lnw, lse, lsw, tileSize);
    if (this.isImagesLoaded()) {
      OceanTerrain.spriteCache.set(cacheKey, sprite);
    }
    return sprite;
  }

  /**
   * Pick coast tile from adjacent land (connection bit clear = land in that direction).
   */
  private resolveCoastSprite(
    ln: boolean,
    ls: boolean,
    le: boolean,
    lw: boolean,
    lne: boolean,
    lnw: boolean,
    lse: boolean,
    lsw: boolean,
    tileSize: number
  ): HTMLCanvasElement {
    const n = [ln, ls, le, lw].filter(Boolean).length;

    if (ln && ls && le && lw) {
      return this.drawAsset('landlocked', tileSize) ?? this.colorFallback(tileSize);
    }
    if (n === 0) {
      return this.drawAsset('open', tileSize) ?? this.colorFallback(tileSize);
    }

    // Three-sided bay — pick hole variant from land on open-side diagonals
    if (n === 3) {
      if (!lw) return this.drawHoleOpen('w', lnw, lne, lsw, lse, tileSize);
      if (!le) return this.drawHoleOpen('e', lnw, lne, lsw, lse, tileSize);
      if (!ln) return this.drawHoleOpen('n', lnw, lne, lsw, lse, tileSize);
      if (!ls) return this.drawHoleOpen('s', lnw, lne, lsw, lse, tileSize);
    }

    // Straits named by water flow: horizontal W↔E (land N+S) → NCSC; vertical N↔S (land E+W) → rot90
    if (ln && ls && !le && !lw) {
      return this.drawStrait(lnw, lne, lsw, lse, tileSize, 'horizontal');
    }
    if (le && lw && !ln && !ls) {
      return this.drawStrait(lnw, lne, lsw, lse, tileSize, 'vertical');
    }

    // Outer corners (two adjacent land cardinals)
    if (ls && lw) {
      if (lnw && !lse) {
        return this.transformAsset('SCE', tileSize, 90);
      }
      if (!lnw && lse) {
        return this.transformAsset('SCE', tileSize, 0, true);
      }
      if (lnw && lse) {
        return this.transformAsset('NCEC', tileSize, 180);
      }
      return this.drawAsset('SW', tileSize) ?? this.colorFallback(tileSize);
    }
    if (ln && lw) {
      if (lsw && !lne) {
        return this.transformAsset('SCE', tileSize, 90, true);
      }
      if (!lsw && lne) {
        return this.transformAsset('SCE', tileSize, 180);
      }
      if (lsw && lne) {
        return this.transformAsset('NCEC', tileSize, -90);
      }
      return this.drawAsset('WN', tileSize) ?? this.colorFallback(tileSize);
    }
    if (ln && le) {
      if (lnw && !lse) {
        return this.transformAsset('SCE', tileSize, 180, true);
      }
      if (!lnw && lse) {
        return this.transformAsset('SCE', tileSize, -90);
      }
      if (lnw && lse) {
        return this.drawAsset('NCEC', tileSize) ?? this.colorFallback(tileSize);
      }
      return this.drawAsset('NE', tileSize) ?? this.colorFallback(tileSize);
    }
    if (ls && le) {
      if (lsw && !lne) {
        return this.drawAsset('SCE', tileSize) ?? this.colorFallback(tileSize);
      }
      if (!lsw && lne) {
        return this.transformAsset('SCE', tileSize, 90, false, true);
      }
      if (lsw && lne) {
        return this.transformAsset('NCEC', tileSize, 90);
      }
      return this.drawAsset('SE', tileSize) ?? this.colorFallback(tileSize);
    }

    // Single cardinal coast
    if (ln && !ls && !le && !lw) {
      if (lnw && lne) {
        return this.drawAsset('N_WCEC', tileSize) ?? this.colorFallback(tileSize);
      }
      if (lnw) {
        return this.drawAsset('N_EC', tileSize) ?? this.colorFallback(tileSize);
      }
      if (lne) {
        return this.drawAsset('N_WC', tileSize) ?? this.colorFallback(tileSize);
      }
      return this.drawAsset('N', tileSize) ?? this.colorFallback(tileSize);
    }

    if (ls && !ln && !le && !lw) {
      if (lsw && lse) {
        return this.drawAsset('S_WCEC', tileSize) ?? this.colorFallback(tileSize);
      }
      if (lsw) {
        return this.drawAsset('S_EC', tileSize) ?? this.colorFallback(tileSize);
      }
      if (lse) {
        return this.drawAsset('S_WC', tileSize) ?? this.colorFallback(tileSize);
      }
      return this.transformAsset('N', tileSize, 180);
    }

    if (le && !ln && !ls && !lw) {
      if (lne && lse) {
        return this.transformAsset('N_WCEC', tileSize, 90);
      }
      if (lne) {
        return this.drawAsset('E_NC', tileSize) ?? this.colorFallback(tileSize);
      }
      if (lse) {
        return this.drawAsset('E_SC', tileSize) ?? this.colorFallback(tileSize);
      }
      return this.transformAsset('N', tileSize, 90);
    }

    if (lw && !ln && !ls && !le) {
      if (lnw && lsw) {
        return this.transformAsset('N_WCEC', tileSize, -90);
      }
      // W_SC: ocean right + horizontal shore on top in art → extra land to the north
      if (lnw) {
        return this.drawAsset('W_NC', tileSize) ?? this.colorFallback(tileSize);
      }
      // Flipped W_SC: horizontal shore on bottom → extra land to the south
      if (lsw) {
        return this.drawAsset('W_SC', tileSize) ?? this.colorFallback(tileSize);
      }
      return this.transformAsset('N', tileSize, -90);
    }

    return this.colorFallback(tileSize);
  }

  /** Suffix = diagonals without land (ocean corners), e.g. NCSC_NW = ocean at NW. */
  private straitSuffix(
    lnw: boolean,
    lne: boolean,
    lsw: boolean,
    lse: boolean
  ):
    | 'open'
    | 'N'
    | 'S'
    | 'W'
    | 'E'
    | 'NW'
    | 'NE'
    | 'SW'
    | 'SE'
    | 'NW_SE'
    | 'NE_SW'
    | 'full' {
    const oNW = !lnw;
    const oNE = !lne;
    const oSW = !lsw;
    const oSE = !lse;
    const ocean = [oNW, oNE, oSW, oSE];
    const n = ocean.filter(Boolean).length;

    if (n === 4) return 'open';
    if (n === 0) return 'full';
    if (n === 1) {
      if (oNW) return 'NW';
      if (oNE) return 'NE';
      if (oSW) return 'SW';
      return 'SE';
    }
    if (n === 2) {
      if (oNW && oNE) return 'N';
      if (oSW && oSE) return 'S';
      if (oNW && oSW) return 'W';
      if (oNE && oSE) return 'E';
      if (oNW && oSE) return 'NW_SE';
      return 'NE_SW';
    }
    // 3 ocean diagonals (one land corner) — rare; reuse widest strait
    return 'open';
  }

  /**
   * Vertical flow (land E+W): remap diagonals before NCSC lookup, then rotate sprite 90° CW.
   * (lsw,lse,lnw,lne) — e.g. map pinch N → NCSC_S → rot90.
   */
  private straitDiagonalsForVerticalFlow(
    lnw: boolean,
    lne: boolean,
    lsw: boolean,
    lse: boolean
  ): { lnw: boolean; lne: boolean; lsw: boolean; lse: boolean } {
    return { lnw: lsw, lne: lse, lsw: lnw, lse: lne };
  }

  private drawStrait(
    lnw: boolean,
    lne: boolean,
    lsw: boolean,
    lse: boolean,
    tileSize: number,
    flow: 'horizontal' | 'vertical'
  ): HTMLCanvasElement {
    const diags =
      flow === 'vertical'
        ? this.straitDiagonalsForVerticalFlow(lnw, lne, lsw, lse)
        : { lnw, lne, lsw, lse };
    const suffix = this.straitSuffix(diags.lnw, diags.lne, diags.lsw, diags.lse);
    const canvas = this.drawStraitVariant(suffix, tileSize);
    if (flow === 'horizontal') return canvas;
    return this.rotateStraitCanvas(canvas, tileSize, 90);
  }

  private drawStraitVariant(
    suffix: ReturnType<OceanTerrain['straitSuffix']>,
    tileSize: number
  ): HTMLCanvasElement {
    switch (suffix) {
      case 'open':
        return this.drawAsset('NCSC_open', tileSize) ?? this.colorFallback(tileSize);
      case 'full':
        // Vertical flow uses the same NCSC as horizontal, then drawStrait rotates 90°
        return this.drawAsset('NCSC', tileSize) ?? this.colorFallback(tileSize);
      case 'N':
        return this.drawAsset('NCSC_N', tileSize) ?? this.colorFallback(tileSize);
      case 'S':
        return (
          this.drawAsset('NCSC_S', tileSize) ??
          this.transformAsset('NCSC_N', tileSize, 180) ??
          this.colorFallback(tileSize)
        );
      case 'W':
        return this.drawAsset('NCSC_W', tileSize) ?? this.colorFallback(tileSize);
      case 'E':
        return (
          this.drawAsset('NCSC_E', tileSize) ??
          this.transformAsset('NCSC_W', tileSize, 0, true) ??
          this.colorFallback(tileSize)
        );
      case 'NW':
        return this.drawAsset('NCSC_NW', tileSize) ?? this.colorFallback(tileSize);
      case 'NE':
        return this.drawAsset('NCSC_NE', tileSize) ?? this.colorFallback(tileSize);
      case 'SW':
        return (
          this.drawAsset('NCSC_SW', tileSize) ??
          this.transformAsset('NCSC_NW', tileSize, 180) ??
          this.colorFallback(tileSize)
        );
      case 'SE':
        return (
          this.drawAsset('NCSC_SE', tileSize) ??
          this.transformAsset('NCSC_NE', tileSize, 180) ??
          this.colorFallback(tileSize)
        );
      case 'NW_SE':
        return this.drawAsset('NCSC_NW_SE', tileSize) ?? this.colorFallback(tileSize);
      case 'NE_SW':
        return (
          this.drawAsset('NCSC_NE_SW', tileSize) ??
          this.transformAsset('NCSC_NW_SE', tileSize, 0, true) ??
          this.colorFallback(tileSize)
        );
    }
  }

  private rotateStraitCanvas(
    source: HTMLCanvasElement,
    tileSize: number,
    deg: number
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;
    ctx.save();
    ctx.translate(tileSize / 2, tileSize / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(source, -tileSize / 2, -tileSize / 2, tileSize, tileSize);
    ctx.restore();
    return canvas;
  }

  /**
   * Bay opening toward openTo (ocean on that side).
   * cornerA/cornerB = land on the two diagonals along the open edge (CCW: W→NW,SW; E→NE,SE; N→NW,NE; S→SW,SE).
   */
  private drawHoleOpen(
    openTo: 'n' | 's' | 'e' | 'w',
    lnw: boolean,
    lne: boolean,
    lsw: boolean,
    lse: boolean,
    tileSize: number
  ): HTMLCanvasElement {
    switch (openTo) {
      case 'w':
        return this.resolveHoleCorners(
          'E_hole',
          'E_hole_NC',
          'E_hole_SC',
          lnw,
          lsw,
          tileSize,
          { deep: 'N_hole_deep', rotateDeg: 90 }
        );
      case 'e':
        return this.resolveHoleCorners(
          'W_hole',
          'W_hole_NC',
          'W_hole_SC',
          lne,
          lse,
          tileSize,
          { deep: 'N_hole_deep', rotateDeg: -90 },
          () => this.transformAsset('E_hole_NC', tileSize, 0, true)
        );
      case 'n':
        return this.resolveHoleCorners(
          null,
          null,
          null,
          lnw,
          lne,
          tileSize,
          { deep: 'S_hole_deep', rotateDeg: 0 },
          () => this.transformAsset('E_hole_SC', tileSize, 90),
          () => this.transformAsset('E_hole_NC', tileSize, 90),
          () => this.transformAsset('E_hole', tileSize, 90)
        );
      case 's':
        return this.resolveHoleCorners(
          null,
          null,
          null,
          lsw,
          lse,
          tileSize,
          { deep: 'N_hole_deep', rotateDeg: 0 },
          () => this.transformAsset('E_hole_NC', tileSize, -90),
          () => this.transformAsset('E_hole_SC', tileSize, -90),
          () => this.transformAsset('E_hole', tileSize, -90)
        );
    }
  }

  private resolveHoleCorners(
    base: OceanAssetName | null,
    nc: OceanAssetName | null,
    sc: OceanAssetName | null,
    cornerA: boolean,
    cornerB: boolean,
    tileSize: number,
    both: { deep: OceanAssetName; rotateDeg: number },
    ncFallback?: () => HTMLCanvasElement,
    scFallback?: () => HTMLCanvasElement,
    baseFallback?: () => HTMLCanvasElement
  ): HTMLCanvasElement {
    if (cornerA && !cornerB) {
      return (
        (nc ? this.drawAsset(nc, tileSize) : null) ??
        ncFallback?.() ??
        (base ? this.drawAsset(base, tileSize) : null) ??
        baseFallback?.() ??
        this.colorFallback(tileSize)
      );
    }
    if (!cornerA && cornerB) {
      return (
        (sc ? this.drawAsset(sc, tileSize) : null) ??
        scFallback?.() ??
        (base ? this.drawAsset(base, tileSize) : null) ??
        baseFallback?.() ??
        this.colorFallback(tileSize)
      );
    }
    if (cornerA && cornerB) {
      if (this.isAssetReady(both.deep)) {
        return this.transformAsset(both.deep, tileSize, both.rotateDeg);
      }
      return baseFallback?.() ?? this.colorFallback(tileSize);
    }
    return (
      (base ? this.drawAsset(base, tileSize) : null) ??
      baseFallback?.() ??
      this.colorFallback(tileSize)
    );
  }

  private isAssetReady(name: OceanAssetName): boolean {
    const img = OceanTerrain.images.get(name);
    return !!(img && img.complete && img.naturalWidth > 0);
  }

  private drawAsset(name: OceanAssetName, tileSize: number): HTMLCanvasElement | null {
    const img = OceanTerrain.images.get(name);
    if (!img || !img.complete || img.naturalWidth === 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    canvas.getContext('2d')!.drawImage(img, 0, 0, tileSize, tileSize);
    return canvas;
  }

  private transformAsset(
    name: OceanAssetName,
    tileSize: number,
    rotateDeg: number,
    flipX = false,
    flipY = false
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d')!;
    const img = OceanTerrain.images.get(name);

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.translate(tileSize / 2, tileSize / 2);
      if (rotateDeg) ctx.rotate((rotateDeg * Math.PI) / 180);
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.drawImage(img, -tileSize / 2, -tileSize / 2, tileSize, tileSize);
      ctx.restore();
    } else {
      ctx.fillStyle = this.color;
      ctx.fillRect(0, 0, tileSize, tileSize);
    }
    return canvas;
  }

  private colorFallback(tileSize: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    this.fillRect(canvas.getContext('2d')!, 0, 0, tileSize, tileSize, this.color);
    return canvas;
  }

  /** Dev: suffix / asset hint for strait-preview.html */
  public getStraitPreviewMeta(
    flow: 'horizontal' | 'vertical',
    lnw: boolean,
    lne: boolean,
    lsw: boolean,
    lse: boolean
  ): { mapSuffix: string; artSuffix: string; asset: string } {
    const mapSuffix = this.straitSuffix(lnw, lne, lsw, lse);
    if (flow === 'horizontal') {
      return {
        mapSuffix,
        artSuffix: mapSuffix,
        asset: this.straitAssetLabel(mapSuffix),
      };
    }
    const d = this.straitDiagonalsForVerticalFlow(lnw, lne, lsw, lse);
    const artSuffix = this.straitSuffix(d.lnw, d.lne, d.lsw, d.lse);
    return {
      mapSuffix,
      artSuffix,
      asset: `${this.straitAssetLabel(artSuffix)} ↻90°`,
    };
  }

  private straitAssetLabel(suffix: ReturnType<OceanTerrain['straitSuffix']>): string {
    if (suffix === 'full') return 'NCSC';
    if (suffix === 'open') return 'NCSC_open';
    return `NCSC_${suffix}`;
  }

  public getResourceProbability(resource: ResourceType): number {
    switch (resource) {
      case ResourceType.FISH:
        return 0.06;
      default:
        return 0;
    }
  }
}
