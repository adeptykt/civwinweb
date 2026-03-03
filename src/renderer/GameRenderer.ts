import { GameState, Tile, Unit, City, TerrainType, UnitType, UnitCategory, ImprovementType, VisibilityState, Position } from '../types/game';
import { pickResourceEmoji } from '../constants/resource-emoji';
import { Renderer, RenderContext } from './Renderer';
import { TerrainManager } from '../terrain/index';
import { UnitSprites } from './UnitSprites';
import { CitySprites } from './CitySprites';
import { ConnectionMask, ConnectionPattern } from '../types/terrain';
import { getUnitStats } from '../game/UnitDefinitions';
import { VisibilitySystem } from '../game/VisibilitySystem';
import { DebugSystem } from '../utils/DebugSystem';

interface UnitDeathAnimationState {
  unitId: string;
  position: Position;
  offset: { x: number; y: number };
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  imageData: ImageData;
  pixelIndices: number[];
  clearedCount: number;
  totalTargetPixels: number;
  startTime: number;
  duration: number;
}

export class GameRenderer {
  private renderer: Renderer;
  private selectedTile: { x: number, y: number } | null = null;
  private selectedUnit: Unit | null = null;
  private gotoHoverTile: { x: number, y: number } | null = null;
  private currentWorldMap: Tile[][] = []; // Cache the world map for connection analysis
  private currentGameState: GameState | null = null; // Cache the game state for city checks
  private readonly tileSize = 48; // Fixed tile size for terrain sprites
  private blinkState: boolean = false; // Track blinking state for current unit
  private unitDeathAnimations: UnitDeathAnimationState[] = [];

  // P3: Connection analysis caches – keyed "x,y:terrain" or "x,y".
  // Cleared on new game load or any tile improvement change.
  private terrainConnectionCache: Map<string, ConnectionPattern> = new Map();
  private roadConnectionCache: Map<string, ConnectionPattern> = new Map();

  // P4: Offscreen terrain layer. Rebuilt only when viewport changes, canvas
  // resizes, or the dirty flag is set. Avoids redrawing 400+ tiles every frame.
  private terrainLayer: HTMLCanvasElement | null = null;
  private terrainLayerDirty: boolean = true;
  private terrainLayerViewportX: number = -9999;
  private terrainLayerViewportY: number = -9999;
  private terrainLayerZoom: number = -1;
  private terrainLayerCanvasW: number = -1;
  private terrainLayerCanvasH: number = -1;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  // Render the entire game state
  public render(gameState: GameState, showGrid: boolean = false, game?: any): void {
    const now = performance.now();
    this.renderer.clear();
    if (gameState.worldMap.length === 0) {
      console.error('No world map data to render');
      return;
    };

    // Cache the world map for connection analysis
    this.currentWorldMap = gameState.worldMap;
    // Cache the game state for city checks
    this.currentGameState = gameState;

    // Render map tiles
    this.renderMap(gameState.worldMap, game);
    
    // Render cities
    this.renderCities(gameState.cities, gameState);
    
    // Render units
    this.renderUnits(gameState.units, gameState);
  this.renderUnitDeathAnimations(now);
    
    // Render grid overlay (only if enabled)
    if (showGrid) {
      this.renderGrid();
    }
    
    // Render selections
    this.renderSelections();
  }

  /** Clear connection caches and mark terrain dirty – call on new game or tile improvement. */
  public invalidateConnectionCache(): void {
    this.terrainConnectionCache.clear();
    this.roadConnectionCache.clear();
    this.terrainLayerDirty = true;
  }

  /** Mark the terrain layer as needing a full rebuild (e.g. fog-of-war changes). */
  public markTerrainLayerDirty(): void {
    this.terrainLayerDirty = true;
  }

  // Analyze connections for a tile at given coordinates
  private analyzeConnections(x: number, y: number, terrain: TerrainType): ConnectionPattern {
    const cacheKey = `${x},${y}:${terrain}`;
    const cached = this.terrainConnectionCache.get(cacheKey);
    if (cached !== undefined) return cached;

    let connections = 0;
    const mapWidth = this.currentWorldMap[0]?.length || 80;
    const mapHeight = this.currentWorldMap.length || 50;
    
    // Check all 8 directions
    const directions = [
      { dx: -1, dy: -1, mask: ConnectionMask.NORTHWEST },
      { dx: 0, dy: -1, mask: ConnectionMask.NORTH },
      { dx: 1, dy: -1, mask: ConnectionMask.NORTHEAST },
      { dx: -1, dy: 0, mask: ConnectionMask.WEST },
      { dx: 1, dy: 0, mask: ConnectionMask.EAST },
      { dx: -1, dy: 1, mask: ConnectionMask.SOUTHWEST },
      { dx: 0, dy: 1, mask: ConnectionMask.SOUTH },
      { dx: 1, dy: 1, mask: ConnectionMask.SOUTHEAST }
    ];

    for (const dir of directions) {
      let checkX = x + dir.dx;
      let checkY = y + dir.dy;
      
      // Handle horizontal wrapping
      checkX = ((checkX % mapWidth) + mapWidth) % mapWidth;
      
      // Check bounds for Y (no vertical wrapping)
      if (checkY >= 0 && checkY < mapHeight) {
        const neighborTile = this.currentWorldMap[checkY][checkX];
        if (neighborTile && neighborTile.terrain === terrain) {
          connections |= dir.mask;
        }
      }
    }

    const result = connections as ConnectionPattern;
    this.terrainConnectionCache.set(cacheKey, result);
    return result;
  }

  // Render the map – offscreen canvas cache avoids redrawing terrain every frame.
  private renderMap(worldMap: Tile[][], game?: any): void {
    const renderContext = this.renderer.getRenderContext();
    const { viewport, canvas } = renderContext;

    const viewportChanged =
      viewport.x !== this.terrainLayerViewportX ||
      viewport.y !== this.terrainLayerViewportY ||
      viewport.zoom !== this.terrainLayerZoom;

    const canvasSizeChanged =
      canvas.width !== this.terrainLayerCanvasW ||
      canvas.height !== this.terrainLayerCanvasH;

    if (!this.terrainLayerDirty && !viewportChanged && !canvasSizeChanged && this.terrainLayer) {
      // Fast path: blit the cached terrain layer in a single drawImage call.
      this.renderer.getContext().drawImage(this.terrainLayer, 0, 0);
      return;
    }

    // Create or resize the offscreen canvas to match main canvas.
    if (!this.terrainLayer || canvasSizeChanged) {
      this.terrainLayer = document.createElement('canvas');
      this.terrainLayer.width = canvas.width;
      this.terrainLayer.height = canvas.height;
    }

    const offCtx = this.terrainLayer.getContext('2d')!;
    offCtx.imageSmoothingEnabled = false;
    offCtx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all terrain tiles to the offscreen canvas.
    this.renderer.useOffscreenContext(offCtx);
    this.renderMapTiles(worldMap, game, renderContext);
    this.renderer.restoreContext();

    // Update cache metadata.
    this.terrainLayerDirty = false;
    this.terrainLayerViewportX = viewport.x;
    this.terrainLayerViewportY = viewport.y;
    this.terrainLayerZoom = viewport.zoom;
    this.terrainLayerCanvasW = canvas.width;
    this.terrainLayerCanvasH = canvas.height;

    // Composite the freshly-built layer onto the main canvas.
    this.renderer.getContext().drawImage(this.terrainLayer, 0, 0);
  }

  // Iterate and render all visible tiles into whichever context is currently active.
  private renderMapTiles(worldMap: Tile[][], game: any, renderContext: RenderContext): void {
    const mapWidth = worldMap[0]?.length || 80;
    const mapHeight = worldMap.length || 50;

    // +2 horizontal padding covers the wrap seam; +1 vertical handles fractional viewport Y.
    const tilesWidth = Math.ceil(renderContext.canvas.width / this.tileSize) + 2;
    const tilesHeight = Math.ceil(renderContext.canvas.height / this.tileSize) + 1;

    const startX = Math.floor(renderContext.viewport.x) - 1;
    const endX = startX + tilesWidth;
    const startY = Math.max(0, Math.floor(renderContext.viewport.y) - 1);
    const endY = Math.min(mapHeight - 1, startY + tilesHeight);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const wrappedX = ((x % mapWidth) + mapWidth) % mapWidth;
        if (y >= 0 && y < mapHeight) {
          const tile = worldMap[y][wrappedX];
          const connectionPattern = this.analyzeConnections(wrappedX, y, tile.terrain);

          let visibilityState: VisibilityState = VisibilityState.VISIBLE;
          if (game) {
            const debugSystem = DebugSystem.getInstance();
            if (debugSystem.shouldRevealAllMap()) {
              visibilityState = VisibilityState.VISIBLE;
            } else {
              visibilityState = VisibilitySystem.getTileVisibility(
                this.currentGameState!,
                this.currentGameState!.currentPlayer,
                { x: wrappedX, y }
              );
            }
          }

          this.renderTile(tile, x, y, connectionPattern, visibilityState);
        }
      }
    }
  }

  private renderTile(tile: Tile, x: number, y: number, connectionPattern: ConnectionPattern, visibilityState: VisibilityState = VisibilityState.VISIBLE): void {
    const screenPos = this.renderer.worldToScreen(x, y);
    
    // Handle unseen tiles (completely black)
    if (visibilityState === VisibilityState.UNSEEN) {
      this.renderer.fillRect(
        screenPos.x,
        screenPos.y,
        this.tileSize,
        this.tileSize,
        '#000000'
      );
      return;
    }
    
    const terrainSprite = TerrainManager.getTerrainSprite(
      tile.terrain, 
      this.tileSize,
      connectionPattern,
      tile.terrainVariant
    );
    
    if (terrainSprite) {
      // Draw the terrain sprite
      const ctx = this.renderer.getContext();
      ctx.drawImage(
        terrainSprite,
        screenPos.x,
        screenPos.y,
        this.tileSize,
        this.tileSize
      );
    }

    // Render improvements on top of terrain
    this.renderImprovements(tile, screenPos, x, y);

    // Render special resource indicator (emoji badge, top-right corner)
    if (tile.resources && tile.resources.length > 0) {
      this.renderResources(tile, screenPos);
    }
    
    // Apply fog of war overlay for explored but not visible tiles
    if (visibilityState === VisibilityState.EXPLORED) {
      const ctx = this.renderer.getContext();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Semi-transparent black overlay
      ctx.fillRect(
        screenPos.x,
        screenPos.y,
        this.tileSize,
        this.tileSize
      );
    }
  }

  // Render improvements on a tile
  private renderImprovements(tile: Tile, screenPos: { x: number, y: number }, tileX: number, tileY: number): void {
    if (!tile.improvements || tile.improvements.length === 0) {
      return;
    }

    const ctx = this.renderer.getContext();
    
    for (const improvement of tile.improvements) {
      switch (improvement.type) {
        case ImprovementType.ROAD:
        case ImprovementType.RAILROAD:
          const roadConnections = this.analyzeRoadConnections(tileX, tileY);
          if (improvement.type === ImprovementType.RAILROAD) {
            this.renderRailroad(ctx, screenPos, roadConnections);
          } else {
            this.renderRoad(ctx, screenPos, roadConnections);
          }
          break;
        case ImprovementType.IRRIGATION:
          this.renderIrrigation(ctx, screenPos);
          break;
        case ImprovementType.MINE:
          this.renderMine(ctx, screenPos);
          break;
        case ImprovementType.FORTRESS:
          this.renderFortress(ctx, screenPos);
          break;
      }
    }
  }

  /**
   * Shows the first resource found on the tile. Sized proportionally so it
   * reads clearly at the default 48 px tile size and still visible at smaller sizes.
   */
  private renderResources(tile: Tile, screenPos: { x: number; y: number }): void {
    const resource = tile.resources![0];
    const emoji = pickResourceEmoji(resource, tile.position.x, tile.position.y);
    if (!emoji) return;

    const ctx = this.renderer.getContext();
    const ts  = this.tileSize;

    const fontSize = Math.max(10, Math.round(ts * 0.42));
    const cx = screenPos.x + ts / 2;
    const cy = screenPos.y + ts / 2;

    ctx.save();
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, cx, cy);
    ctx.restore();
  }

  // Render road improvement
  private renderRoad(ctx: CanvasRenderingContext2D, screenPos: { x: number, y: number }, connections: ConnectionPattern): void {
    const centerX = screenPos.x + this.tileSize / 2;
    const centerY = screenPos.y + this.tileSize / 2;
    
    ctx.strokeStyle = '#654321'; // Darker brown road color to match Civilization 1
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    // Use tile position to create deterministic but natural-looking variations
    const tileX = Math.floor(screenPos.x / this.tileSize);
    const tileY = Math.floor(screenPos.y / this.tileSize);
    const seedX = (tileX * 17 + tileY * 23) % 100; // Deterministic pseudo-random
    const seedY = (tileX * 31 + tileY * 41) % 100;

    // If no connections, draw a small road stub with slight curves
    if (connections === 0) {
      // Create a small natural-looking crossroads
      const offsetX = (seedX / 100 - 0.5) * 2;
      const offsetY = (seedY / 100 - 0.5) * 2;
      
      ctx.moveTo(centerX - 8, centerY + offsetY);
      ctx.quadraticCurveTo(centerX + offsetX, centerY - offsetY, centerX + 8, centerY + offsetY);
      ctx.moveTo(centerX + offsetX, centerY - 8);
      ctx.quadraticCurveTo(centerX - offsetX, centerY + offsetY, centerX + offsetX, centerY + 8);
    } else {
      // Draw road segments based on connections with natural curves
      
      // Cardinal directions (main roads) - terrain-following jagged paths
      if (connections & ConnectionMask.NORTH) {
        const startOffset = ((seedY + 7) % 100 / 100 - 0.5) * 3;
        
        // Create jagged path with multiple segments following terrain
        ctx.moveTo(centerX + startOffset, centerY);
        
        const segments = 5;
        for (let i = 1; i <= segments; i++) {
          const progress = i / segments;
          const y = centerY - (this.tileSize / 2) * progress;
          
          // Terrain following variation - stronger jag
          const jaggerSeed = ((seedX + i * 23 + seedY * 7) % 100 / 100 - 0.5);
          const jaggerOffset = jaggerSeed * 6; // Increased variation
          
          // Natural terrain-following curve
          const terrainFollow = Math.sin(progress * Math.PI) * 2;
          const x = centerX - startOffset * progress + jaggerOffset + terrainFollow;
          
          ctx.lineTo(x, y);
        }
      }
      
      if (connections & ConnectionMask.EAST) {
        const startOffset = ((seedX + 11) % 100 / 100 - 0.5) * 3;
        
        // Create jagged path with multiple segments following terrain
        ctx.moveTo(centerX, centerY + startOffset);
        
        const segments = 5;
        for (let i = 1; i <= segments; i++) {
          const progress = i / segments;
          const x = centerX + (this.tileSize / 2) * progress;
          
          // Terrain following variation
          const jaggerSeed = ((seedY + i * 29 + seedX * 11) % 100 / 100 - 0.5);
          const jaggerOffset = jaggerSeed * 6;
          
          // Natural terrain-following curve
          const terrainFollow = Math.sin(progress * Math.PI) * 2;
          const y = centerY - startOffset * progress + jaggerOffset + terrainFollow;
          
          ctx.lineTo(x, y);
        }
      }
      
      if (connections & ConnectionMask.SOUTH) {
        const startOffset = ((seedY + 37) % 100 / 100 - 0.5) * 3;
        
        // Create jagged path with multiple segments following terrain
        ctx.moveTo(centerX - startOffset, centerY);
        
        const segments = 5;
        for (let i = 1; i <= segments; i++) {
          const progress = i / segments;
          const y = centerY + (this.tileSize / 2) * progress;
          
          // Terrain following variation
          const jaggerSeed = ((seedX + i * 31 + seedY * 13) % 100 / 100 - 0.5);
          const jaggerOffset = jaggerSeed * 6;
          
          // Natural terrain-following curve
          const terrainFollow = Math.sin(progress * Math.PI) * 2;
          const x = centerX + startOffset * progress + jaggerOffset + terrainFollow;
          
          ctx.lineTo(x, y);
        }
      }
      
      if (connections & ConnectionMask.WEST) {
        const startOffset = ((seedX + 47) % 100 / 100 - 0.5) * 3;
        
        // Create jagged path with multiple segments following terrain
        ctx.moveTo(centerX, centerY - startOffset);
        
        const segments = 5;
        for (let i = 1; i <= segments; i++) {
          const progress = i / segments;
          const x = centerX - (this.tileSize / 2) * progress;
          
          // Terrain following variation
          const jaggerSeed = ((seedY + i * 37 + seedX * 17) % 100 / 100 - 0.5);
          const jaggerOffset = jaggerSeed * 6;
          
          // Natural terrain-following curve
          const terrainFollow = Math.sin(progress * Math.PI) * 2;
          const y = centerY + startOffset * progress + jaggerOffset + terrainFollow;
          
          ctx.lineTo(x, y);
        }
      }

      // Diagonal connections (secondary roads with more pronounced curves)
      if (connections & ConnectionMask.NORTHEAST) {
        const curveOffset1 = ((seedX + 51) % 100 / 100 - 0.5) * 8;
        const curveOffset2 = ((seedY + 59) % 100 / 100 - 0.5) * 8;
        
        ctx.moveTo(centerX, centerY);
        ctx.bezierCurveTo(
          centerX + this.tileSize / 6 + curveOffset1, centerY - this.tileSize / 8 + curveOffset2,
          centerX + this.tileSize / 3 + curveOffset2, centerY - this.tileSize / 6 + curveOffset1,
          screenPos.x + this.tileSize, screenPos.y
        );
      }
      
      if (connections & ConnectionMask.SOUTHEAST) {
        const curveOffset1 = ((seedX + 61) % 100 / 100 - 0.5) * 8;
        const curveOffset2 = ((seedY + 67) % 100 / 100 - 0.5) * 8;
        
        ctx.moveTo(centerX, centerY);
        ctx.bezierCurveTo(
          centerX + this.tileSize / 6 + curveOffset1, centerY + this.tileSize / 8 + curveOffset2,
          centerX + this.tileSize / 3 + curveOffset2, centerY + this.tileSize / 6 + curveOffset1,
          screenPos.x + this.tileSize, screenPos.y + this.tileSize
        );
      }
      
      if (connections & ConnectionMask.SOUTHWEST) {
        const curveOffset1 = ((seedX + 71) % 100 / 100 - 0.5) * 8;
        const curveOffset2 = ((seedY + 73) % 100 / 100 - 0.5) * 8;
        
        ctx.moveTo(centerX, centerY);
        ctx.bezierCurveTo(
          centerX - this.tileSize / 6 + curveOffset1, centerY + this.tileSize / 8 + curveOffset2,
          centerX - this.tileSize / 3 + curveOffset2, centerY + this.tileSize / 6 + curveOffset1,
          screenPos.x, screenPos.y + this.tileSize
        );
      }
      
      if (connections & ConnectionMask.NORTHWEST) {
        const curveOffset1 = ((seedX + 79) % 100 / 100 - 0.5) * 8;
        const curveOffset2 = ((seedY + 83) % 100 / 100 - 0.5) * 8;
        
        ctx.moveTo(centerX, centerY);
        ctx.bezierCurveTo(
          centerX - this.tileSize / 6 + curveOffset1, centerY - this.tileSize / 8 + curveOffset2,
          centerX - this.tileSize / 3 + curveOffset2, centerY - this.tileSize / 6 + curveOffset1,
          screenPos.x, screenPos.y
        );
      }
    }
    
    ctx.stroke();
  }

  // Render railroad improvement
  private renderRailroad(ctx: CanvasRenderingContext2D, screenPos: { x: number, y: number }, connections: ConnectionPattern): void {
    const centerX = screenPos.x + this.tileSize / 2;
    const centerY = screenPos.y + this.tileSize / 2;
    
    ctx.strokeStyle = '#444444'; // Dark gray color to match Civilization 1
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.setLineDash([4, 2]); // Dashed line for railroads

    // If no connections, draw a small road stub
    if (connections === 0) {
      ctx.moveTo(centerX - 8, centerY);
      ctx.lineTo(centerX + 8, centerY);
      ctx.moveTo(centerX, centerY - 8);
      ctx.lineTo(centerX, centerY + 8);
    } else {
      // Draw straight railroad segments based on connections
      if (connections & ConnectionMask.NORTH) {
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX, centerY - this.tileSize / 2);
      }
      
      if (connections & ConnectionMask.EAST) {
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + this.tileSize / 2, centerY);
      }
      
      if (connections & ConnectionMask.SOUTH) {
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX, centerY + this.tileSize / 2);
      }
      
      if (connections & ConnectionMask.WEST) {
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX - this.tileSize / 2, centerY);
      }

      // Diagonal connections
      if (connections & ConnectionMask.NORTHEAST) {
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(screenPos.x + this.tileSize, screenPos.y);
      }
      
      if (connections & ConnectionMask.SOUTHEAST) {
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(screenPos.x + this.tileSize, screenPos.y + this.tileSize);
      }
      
      if (connections & ConnectionMask.SOUTHWEST) {
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(screenPos.x, screenPos.y + this.tileSize);
      }
      
      if (connections & ConnectionMask.NORTHWEST) {
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(screenPos.x, screenPos.y);
      }
    }
    
    ctx.stroke();
    // Reset line dash to solid afterwards to not affect other drawings
    ctx.setLineDash([]);
  }

  // Render irrigation improvement
  private renderIrrigation(ctx: CanvasRenderingContext2D, screenPos: { x: number, y: number }): void {
    const centerX = screenPos.x + this.tileSize / 2;
    const centerY = screenPos.y + this.tileSize / 2;
    
    // Draw water channels in blue with dotted lines
    ctx.strokeStyle = '#4169E1'; // Royal blue
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 2]); // Create dotted line pattern (3px line, 2px gap)
    ctx.beginPath();
    
    // Draw irrigation channels in a grid pattern
    const spacing = this.tileSize / 4;
    for (let i = 1; i < 4; i++) {
      // Horizontal channels (straight)
      ctx.moveTo(screenPos.x + 4, screenPos.y + i * spacing);
      ctx.lineTo(screenPos.x + this.tileSize - 4, screenPos.y + i * spacing);
      
      // Vertical channels (wavy)
      const startX = screenPos.x + i * spacing;
      const startY = screenPos.y + 4;
      const endY = screenPos.y + this.tileSize - 4;
      const waveAmplitude = 2; // How far the wave goes left/right
      const waveFrequency = 0.3; // How many waves along the line
      
      ctx.moveTo(startX, startY);
      
      // Draw wavy vertical line using small segments
      const segments = 8; // Number of segments to create the wave
      for (let j = 1; j <= segments; j++) {
        const progress = j / segments;
        const y = startY + (endY - startY) * progress;
        const waveOffset = Math.sin(progress * Math.PI * waveFrequency * 4) * waveAmplitude;
        const x = startX + waveOffset;
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash to solid for other elements
    
    // Draw multiple vertical red bars in top right and bottom left corners
    ctx.strokeStyle = '#DC143C'; // Crimson red
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // Parameters for multiple bars with varying lengths
    const shortBarLength = this.tileSize / 8;
    const longBarLength = this.tileSize / 5;
    const barOffset = this.tileSize / 8; // Distance from corner
    const barSpacing = 4; // 4 pixels between bars (increased for better visibility)
    const groupGap = 1; // 8 pixels between the two groups (increased for better separation)
    
    // Top right corner - 4 vertical bars (2 long together, then 2 short together)
    const topRightX = screenPos.x + this.tileSize - barOffset;
    const topRightY = screenPos.y + barOffset;
    
    // First group: 2 long bars
    ctx.moveTo(topRightX, topRightY);
    ctx.lineTo(topRightX, topRightY + longBarLength);
    ctx.moveTo(topRightX - barSpacing, topRightY);
    ctx.lineTo(topRightX - barSpacing, topRightY + longBarLength);
    
    // Second group: 2 short bars
    ctx.moveTo(topRightX - barSpacing * 2 - groupGap, topRightY);
    ctx.lineTo(topRightX - barSpacing * 2 - groupGap, topRightY + shortBarLength);
    ctx.moveTo(topRightX - barSpacing * 3 - groupGap, topRightY);
    ctx.lineTo(topRightX - barSpacing * 3 - groupGap, topRightY + shortBarLength);
    
    // Bottom left corner - 4 vertical bars (2 long together, then 2 short together)
    const bottomLeftX = screenPos.x + barOffset;
    const bottomLeftY = screenPos.y + this.tileSize - barOffset;
    
    // First group: 2 long bars
    ctx.moveTo(bottomLeftX, bottomLeftY);
    ctx.lineTo(bottomLeftX, bottomLeftY - longBarLength);
    ctx.moveTo(bottomLeftX + barSpacing, bottomLeftY);
    ctx.lineTo(bottomLeftX + barSpacing, bottomLeftY - longBarLength);
    
    // Second group: 2 short bars
    ctx.moveTo(bottomLeftX + barSpacing * 2 + groupGap, bottomLeftY);
    ctx.lineTo(bottomLeftX + barSpacing * 2 + groupGap, bottomLeftY - shortBarLength);
    ctx.moveTo(bottomLeftX + barSpacing * 3 + groupGap, bottomLeftY);
    ctx.lineTo(bottomLeftX + barSpacing * 3 + groupGap, bottomLeftY - shortBarLength);
    
    ctx.stroke();
  }

  // Render mine improvement — Civ1-style mine shaft entrance (portal frame + dark opening)
  private renderMine(ctx: CanvasRenderingContext2D, screenPos: { x: number, y: number }): void {
    const ts = this.tileSize;

    // Position the portal in the lower-centre of the tile
    const portalW = Math.round(ts * 0.35);  // ~17px on a 48px tile
    const portalH = Math.round(ts * 0.24);  // ~11px
    const postW   = Math.max(2, Math.round(ts * 0.06)); // timber post thickness ~3px
    const cx = screenPos.x + ts / 2;
    const by = screenPos.y + ts - Math.round(ts * 0.1); // bottom of portal

    const left   = cx - portalW / 2;
    const right  = cx + portalW / 2;
    const top    = by - portalH;
    const openL  = left  + postW;
    const openR  = right - postW;
    const openW  = openR - openL;

    ctx.save();

    // ── Dark tunnel opening ───────────────────────────────────────────────
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(openL, top + postW, openW, portalH - postW);

    // ── Timber frame ─────────────────────────────────────────────────────
    // Shadow outline first for contrast against any terrain
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(left - 1,  top - 1,    portalW + 2, postW + 2);   // lintel shadow
    ctx.fillRect(left - 1,  top - 1,    postW  + 2,  portalH + 2); // left post shadow
    ctx.fillRect(right - postW - 1, top - 1, postW + 2, portalH + 2); // right post shadow

    // Lintel (horizontal top beam)
    ctx.fillStyle = '#8B5E3C';
    ctx.fillRect(left, top, portalW, postW);
    // Left post
    ctx.fillRect(left, top, postW, portalH);
    // Right post
    ctx.fillRect(right - postW, top, postW, portalH);

    // Wood grain highlight (top-left edge of each beam — one lighter pixel row)
    ctx.fillStyle = '#B07D52';
    ctx.fillRect(left, top, portalW, 1);          // top of lintel
    ctx.fillRect(left, top, 1, portalH);           // left edge of left post
    ctx.fillRect(right - postW, top, 1, portalH);  // left edge of right post

    // ── Small "X" bracing inside the opening (Civ1 detail) ───────────────
    const mx = (openL + openR) / 2;
    const midY = top + postW + (portalH - postW) / 2;
    ctx.strokeStyle = 'rgba(180,130,70,0.55)';
    ctx.lineWidth = 1;
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(openL + 1, top + postW + 1);
    ctx.lineTo(openR - 1, by - 1);
    ctx.moveTo(openR - 1, top + postW + 1);
    ctx.lineTo(openL + 1, by - 1);
    ctx.stroke();

    ctx.restore();
  }

  // Render fortress improvement
  private renderFortress(ctx: CanvasRenderingContext2D, screenPos: { x: number, y: number }): void {
    const centerX = screenPos.x + this.tileSize / 2;
    const centerY = screenPos.y + this.tileSize / 2;
    const fortressSize = Math.min(this.tileSize * 0.6, 16);

    // Draw fortress walls (stone gray)
    ctx.fillStyle = '#696969';
    ctx.strokeStyle = '#2F4F4F';
    ctx.lineWidth = 2;

    // Draw main fortress structure (square with thick walls)
    const wallThickness = fortressSize / 8;
    const innerSize = fortressSize - wallThickness * 2;
    
    // Outer walls
    ctx.fillRect(
      centerX - fortressSize / 2,
      centerY - fortressSize / 2,
      fortressSize,
      fortressSize
    );
    
    // Inner courtyard (darker)
    ctx.fillStyle = '#555555';
    ctx.fillRect(
      centerX - innerSize / 2,
      centerY - innerSize / 2,
      innerSize,
      innerSize
    );

    // Draw corner towers (small squares at corners)
    const towerSize = fortressSize / 4;
    ctx.fillStyle = '#696969';
    
    // Top-left tower
    ctx.fillRect(
      centerX - fortressSize / 2 - towerSize / 2,
      centerY - fortressSize / 2 - towerSize / 2,
      towerSize,
      towerSize
    );
    
    // Top-right tower
    ctx.fillRect(
      centerX + fortressSize / 2 - towerSize / 2,
      centerY - fortressSize / 2 - towerSize / 2,
      towerSize,
      towerSize
    );
    
    // Bottom-left tower
    ctx.fillRect(
      centerX - fortressSize / 2 - towerSize / 2,
      centerY + fortressSize / 2 - towerSize / 2,
      towerSize,
      towerSize
    );
    
    // Bottom-right tower
    ctx.fillRect(
      centerX + fortressSize / 2 - towerSize / 2,
      centerY + fortressSize / 2 - towerSize / 2,
      towerSize,
      towerSize
    );

    // Draw fortress outline
    ctx.strokeRect(
      centerX - fortressSize / 2,
      centerY - fortressSize / 2,
      fortressSize,
      fortressSize
    );
  }

  // Get fallback color for terrain
  private getTerrainColor(terrain: TerrainType): string {
    switch (terrain) {
      case TerrainType.GRASSLAND: return '#90EE90';
      case TerrainType.PLAINS: return '#daa520';
      case TerrainType.DESERT: return '#F4A460';
      case TerrainType.FOREST: return '#228B22';
      case TerrainType.HILLS: return '#8B7355';
      case TerrainType.MOUNTAINS: return '#696969';
      case TerrainType.OCEAN: return '#4682B4';
      case TerrainType.RIVER: return '#87CEEB';
      case TerrainType.JUNGLE: return '#006400';
      case TerrainType.SWAMP: return '#556B2F';
      case TerrainType.ARCTIC: return '#E0E0E0';
      case TerrainType.TUNDRA: return '#C0C0C0';
      default: return '#D2691E';
    }
  }

  // Render all cities
  private renderCities(cities: City[], gameState: GameState): void {
    cities.forEach(city => {
      // Only render cities that are visible to the current player
      const debugSystem = DebugSystem.getInstance();
      let shouldShowCity = false;
      
      if (debugSystem.shouldRevealAllMap()) {
        // Debug mode: show all cities
        shouldShowCity = true;
      } else {
        // Normal mode: show cities on visible or explored tiles
        const visibilityState = VisibilitySystem.getTileVisibility(
          gameState,
          gameState.currentPlayer,
          city.position
        );
        shouldShowCity = visibilityState !== VisibilityState.UNSEEN;
      }
      
      if (shouldShowCity) {
        this.renderCity(city, gameState);
      }
    });
  }

  // Render a single city
  private renderCity(city: City, gameState?: GameState): void {
    const screenPos = this.renderer.worldToScreen(city.position.x, city.position.y);
    const renderContext = this.renderer.getRenderContext();
    const tileSize = renderContext.tileSize;
    
    // Try to get player color for the city
    let playerColor = '#8B4513'; // Default brown color as fallback
    if (gameState) {
      const player = gameState.players.find(p => p.id === city.playerId);
      if (player) {
        playerColor = player.color;
      }
    }
    
    // Check if there are any units at the city position
    let hasUnits = false;
    if (gameState) {
      hasUnits = gameState.units.some(unit => 
        unit.position.x === city.position.x && unit.position.y === city.position.y
      );
    }
    
    // Use the new CitySprites system with population and unit presence
    const citySprite = CitySprites.getCitySprite(playerColor, tileSize, city.population, hasUnits);
    if (citySprite) {
      // Draw the city sprite
      const ctx = this.renderer.getContext();
      ctx.drawImage(citySprite, screenPos.x, screenPos.y, tileSize, tileSize);
    } else {
      // Fallback to simple rectangle if sprite creation fails
      this.renderer.fillRect(
        screenPos.x + tileSize / 4,
        screenPos.y + tileSize / 4,
        tileSize / 2,
        tileSize / 2,
        playerColor
      );
    }
    
    // City name - render below the city
    this.renderer.fillText(
      city.name,
      screenPos.x + tileSize / 2,
      screenPos.y + tileSize + 15,
      '#FFFFFF',
      '12px Civilization, MS Sans Serif, sans-serif',
      'center'
    );
  }

  // Render all units
  private renderUnits(units: Unit[], gameState: GameState): void {
    // Group units by position to handle multiple units on the same tile
    const unitsByPosition = new Map<string, Unit[]>();
    
    units.forEach(unit => {
      // Only render units that are visible to the current player
      const debugSystem = DebugSystem.getInstance();
      let shouldShowUnit = false;
      
      if (debugSystem.shouldRevealAllMap()) {
        // Debug mode: show all units
        shouldShowUnit = true;
      } else {
        // Normal mode: only show units on visible tiles
        const visibilityState = VisibilitySystem.getTileVisibility(
          gameState,
          gameState.currentPlayer,
          unit.position
        );
        shouldShowUnit = visibilityState === VisibilityState.VISIBLE;
      }
      
      if (shouldShowUnit) {
        const posKey = `${unit.position.x},${unit.position.y}`;
        if (!unitsByPosition.has(posKey)) {
          unitsByPosition.set(posKey, []);
        }
        unitsByPosition.get(posKey)!.push(unit);
      }
    });
    
    // Render each group of units
    unitsByPosition.forEach(unitsAtPosition => {
      this.renderUnitsAtPosition(unitsAtPosition, gameState);
    });
  }

  // Render multiple units at the same position
  private renderUnitsAtPosition(units: Unit[], gameState: GameState): void {
    if (units.length === 0) return;
    
    const firstUnit = units[0];
    const screenPos = this.renderer.worldToScreen(firstUnit.position.x, firstUnit.position.y);
    const renderContext = this.renderer.getRenderContext();
    const tileSize = renderContext.tileSize;
    
    if (units.length === 1) {
      // Single unit - render normally
      this.renderUnit(units[0], gameState);
      return;
    }
    
    // Multiple units - find the selected unit and render it prominently
    const selectedUnit = units.find(unit => this.selectedUnit && this.selectedUnit.id === unit.id);
    const otherUnits = units.filter(unit => !selectedUnit || unit.id !== selectedUnit.id);
    
    // Render background units in a stacked pattern (slightly offset and dimmed)
    otherUnits.forEach((unit, index) => {
      const offset = (index + 1) * 3; // Small offset for stacking effect
      const adjustedScreenPos = {
        x: screenPos.x + offset,
        y: screenPos.y + offset
      };
      
      // Check if unit should be rendered (for blinking effect)
      if (this.shouldRenderUnit(unit)) {
        this.renderUnitWithAlpha(unit, adjustedScreenPos, tileSize, 0.6, gameState); // Dimmed
      }
    });
    
    // Render selected unit on top with full opacity and highlight
    if (selectedUnit && this.shouldRenderUnit(selectedUnit)) {
      this.renderUnitWithAlpha(selectedUnit, screenPos, tileSize, 1.0, gameState); // Full opacity
      
      // Add prominent selection indicator for the active unit
      this.renderer.strokeRect(
        screenPos.x - 2, 
        screenPos.y - 2, 
        tileSize + 4, 
        tileSize + 4, 
        '#FFEB3B', 
        4
      );
      
      // Add a secondary highlight to make it more visible
      this.renderer.strokeRect(
        screenPos.x + 1, 
        screenPos.y + 1, 
        tileSize - 2, 
        tileSize - 2, 
        '#FFF59D', 
        2
      );
    }
    
    // Show unit count indicator when there are multiple units
    if (units.length > 1) {
      const countBgX = screenPos.x + tileSize - 18;
      const countBgY = screenPos.y + tileSize - 18;
      
      // Background circle for count
      this.renderer.fillCircle(countBgX + 9, countBgY + 9, 8, 'rgba(0, 0, 0, 0.7)');
      
      // Count text
      this.renderer.fillText(
        units.length.toString(),
        countBgX + 9,
        countBgY + 11,
        '#FFFFFF',
        '10px Arial',
        'center'
      );
    }
  }

  // Render a single unit
  private renderUnit(unit: Unit, gameState: GameState): void {
    // Check if unit should be rendered (for blinking effect)
    if (!this.shouldRenderUnit(unit)) {
      return;
    }

    const screenPos = this.renderer.worldToScreen(unit.position.x, unit.position.y);
    const renderContext = this.renderer.getRenderContext();
    const tileSize = renderContext.tileSize;
    
    // Use the alpha rendering method with full opacity
    this.renderUnitWithAlpha(unit, screenPos, tileSize, 1.0, gameState);
    
    // Selection indicator for single unit (when not part of a multi-unit stack)
    if (this.selectedUnit && this.selectedUnit.id === unit.id) {
      this.renderer.strokeRect(
        screenPos.x, 
        screenPos.y, 
        tileSize, 
        tileSize, 
        '#FFEB3B', 
        3
      );
    }
  }

  // Analyze road connections to adjacent tiles
  private analyzeRoadConnections(x: number, y: number): ConnectionPattern {
    const cacheKey = `${x},${y}`;
    const cached = this.roadConnectionCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const mapWidth = this.currentWorldMap[0]?.length || 80;
    const mapHeight = this.currentWorldMap.length || 50;

    let connections = 0;
    
    // Check all 8 directions for roads (cardinal and diagonal)
    const directions = [
      { dx: 0, dy: -1, mask: ConnectionMask.NORTH },      // North
      { dx: 1, dy: -1, mask: ConnectionMask.NORTHEAST },  // Northeast
      { dx: 1, dy: 0, mask: ConnectionMask.EAST },        // East  
      { dx: 1, dy: 1, mask: ConnectionMask.SOUTHEAST },   // Southeast
      { dx: 0, dy: 1, mask: ConnectionMask.SOUTH },       // South
      { dx: -1, dy: 1, mask: ConnectionMask.SOUTHWEST },  // Southwest
      { dx: -1, dy: 0, mask: ConnectionMask.WEST },       // West
      { dx: -1, dy: -1, mask: ConnectionMask.NORTHWEST }  // Northwest
    ];

    for (const dir of directions) {
      let checkX = x + dir.dx;
      let checkY = y + dir.dy;
      
      // Handle horizontal wrapping
      checkX = ((checkX % mapWidth) + mapWidth) % mapWidth;
      
      // Check bounds for Y (no vertical wrapping)
      if (checkY >= 0 && checkY < mapHeight) {
        const neighborTile = this.currentWorldMap[checkY][checkX];
        if (neighborTile && neighborTile.improvements) {
          // Check if the neighbor tile has a road or railroad
          const hasRoad = neighborTile.improvements.some(imp => imp.type === ImprovementType.ROAD || imp.type === ImprovementType.RAILROAD);
          if (hasRoad) {
            connections |= dir.mask;
          }
        }
      }
    }

    const result = connections as ConnectionPattern;
    this.roadConnectionCache.set(cacheKey, result);
    return result;
  }

  // Get color for unit type
  private getUnitColor(unitType: UnitType, category: UnitCategory): string {
    switch (category) {
      case UnitCategory.LAND:
        switch (unitType) {
          case UnitType.MILITIA: return '#8D6E63';
          case UnitType.PHALANX: return '#795548';
          case UnitType.LEGION: return '#D32F2F';
          case UnitType.CAVALRY: return '#F57C00';
          case UnitType.CHARIOT: return '#FF9800';
          case UnitType.KNIGHTS: return '#9C27B0';
          case UnitType.MUSKETEERS: return '#303F9F';
          case UnitType.RIFLEMEN: return '#1976D2';
          case UnitType.CANNON: return '#424242';
          case UnitType.CATAPULT: return '#6D4C41';
          case UnitType.ARTILLERY: return '#37474F';
          case UnitType.ARMOR: return '#388E3C';
          case UnitType.MECH_INF: return '#689F38';
          // Legacy units
          case UnitType.WARRIOR: return '#F44336';
          case UnitType.ARCHER: return '#9C27B0';
          case UnitType.SPEARMAN: return '#795548';
          default: return '#FF5722';
        }
      case UnitCategory.NAVAL:
        return '#2196F3';
      case UnitCategory.AIR:
        return '#E91E63';
      case UnitCategory.SPECIAL:
        switch (unitType) {
          case UnitType.SETTLERS: return '#4CAF50';
          case UnitType.DIPLOMAT: return '#9E9E9E';
          case UnitType.CARAVAN: return '#FF9800';
          case UnitType.NUCLEAR: return '#FF1744';
          case UnitType.SCOUT: return '#2196F3';
          default: return '#4CAF50';
        }
      default:
        return '#FF5722';
    }
  }

  // Get symbol for unit type  
  private getUnitSymbol(unitType: UnitType): string {
    switch (unitType) {
      case UnitType.SETTLERS: return 'S';
      case UnitType.DIPLOMAT: return 'D';
      case UnitType.CARAVAN: return 'C';
      case UnitType.MILITIA: return 'M';
      case UnitType.PHALANX: return 'P';
      case UnitType.LEGION: return 'L';
      case UnitType.CAVALRY: return 'Cv';
      case UnitType.CHARIOT: return 'Ch';
      case UnitType.KNIGHTS: return 'K';
      case UnitType.MUSKETEERS: return 'Ms';
      case UnitType.RIFLEMEN: return 'R';
      case UnitType.CANNON: return 'Cn';
      case UnitType.CATAPULT: return 'Ct';
      case UnitType.ARTILLERY: return 'A';
      case UnitType.ARMOR: return 'Ar';
      case UnitType.MECH_INF: return 'MI';
      case UnitType.TRIREME: return 'Tr';
      case UnitType.SAIL: return 'Sa';
      case UnitType.FRIGATE: return 'F';
      case UnitType.IRONCLAD: return 'I';
      case UnitType.CRUISER: return 'Cr';
      case UnitType.BATTLESHIP: return 'B';
      case UnitType.CARRIER: return 'CV';
      case UnitType.TRANSPORT: return 'T';
      case UnitType.SUBMARINE: return 'Sub';
      case UnitType.FIGHTER: return 'Fi';
      case UnitType.BOMBER: return 'Bo';
      case UnitType.NUCLEAR: return 'N';
      // Legacy units
      case UnitType.WARRIOR: return 'W';
      case UnitType.SCOUT: return 'Sc';
      case UnitType.ARCHER: return 'Ar';
      case UnitType.SPEARMAN: return 'Sp';
      default: return 'U';
    }
  }

  // Render unit body based on category
  private renderUnitBody(
    screenPos: {x: number, y: number},
    tileSize: number,
    category: UnitCategory,
    color: string,
    ctx: CanvasRenderingContext2D = this.renderer.getContext()
  ): void {
    const centerX = screenPos.x + tileSize / 2;
    const centerY = screenPos.y + tileSize / 2;
    const size = tileSize / 3.5;

    ctx.fillStyle = color;

    switch (category) {
      case UnitCategory.LAND:
        ctx.beginPath();
        ctx.arc(centerX, centerY, size, 0, 2 * Math.PI);
        ctx.fill();
        break;
      case UnitCategory.NAVAL:
        ctx.fillRect(centerX - size, centerY - size / 2, size * 2, size);
        break;
      case UnitCategory.AIR:
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - size);
        ctx.lineTo(centerX - size, centerY + size / 2);
        ctx.lineTo(centerX + size, centerY + size / 2);
        ctx.closePath();
        ctx.fill();
        break;
      case UnitCategory.SPECIAL:
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - size);
        ctx.lineTo(centerX + size, centerY);
        ctx.lineTo(centerX, centerY + size);
        ctx.lineTo(centerX - size, centerY);
        ctx.closePath();
        ctx.fill();
        break;
    }
  }

  // Render unit symbol/text
  private renderUnitSymbol(
    screenPos: {x: number, y: number},
    tileSize: number,
    symbol: string,
    ctx: CanvasRenderingContext2D = this.renderer.getContext()
  ): void {
    const centerX = screenPos.x + tileSize / 2;
    const centerY = screenPos.y + tileSize / 2;

    ctx.fillStyle = 'white';
    ctx.font = `${Math.floor(tileSize / 8)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, centerX, centerY + 2);
  }

  // Render veteran indicator (star)
  private renderVeteranIndicator(
    screenPos: {x: number, y: number},
    tileSize: number,
    ctx: CanvasRenderingContext2D = this.renderer.getContext()
  ): void {
    ctx.fillStyle = '#FFD700';
    ctx.font = '8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', screenPos.x + tileSize - 6, screenPos.y + 8);
  }

  // Render fortification and sleep indicators
  private renderFortificationIndicator(
    screenPos: {x: number, y: number},
    tileSize: number,
    unit: Unit,
    ctx: CanvasRenderingContext2D = this.renderer.getContext()
  ): void {
    const indicatorX = screenPos.x + tileSize - 8;
    const indicatorY = screenPos.y + tileSize - 8;

    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (unit.sleeping) {
      ctx.fillStyle = '#4169E1';
      ctx.fillText('Z', indicatorX, indicatorY);
    } else if (unit.fortifying) {
      ctx.fillStyle = '#FFFF00';
      ctx.fillText('F', indicatorX, indicatorY);
    } else if (unit.buildingRoad) {
      ctx.fillStyle = '#8B4513';
      ctx.fillText('R', indicatorX, indicatorY);
    } else if (unit.buildingMine) {
      ctx.fillStyle = '#FFD700';
      ctx.fillText('M', indicatorX, indicatorY);
    } else if (unit.fortified) {
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 3;
      ctx.strokeRect(
        screenPos.x + 2,
        screenPos.y + 2,
        tileSize - 4,
        tileSize - 4
      );
    }
  }

  // Render health bar
  private renderHealthBar(
    screenPos: {x: number, y: number},
    tileSize: number,
    health: number,
    maxHealth: number,
    ctx: CanvasRenderingContext2D = this.renderer.getContext()
  ): void {
    const healthBarWidth = tileSize * 0.8;
    const healthBarHeight = 4;
    const healthPercentage = health / maxHealth;

    const x = screenPos.x + (tileSize - healthBarWidth) / 2;
    const y = screenPos.y + tileSize - healthBarHeight - 2;

    ctx.fillStyle = '#FF0000';
    ctx.fillRect(x, y, healthBarWidth, healthBarHeight);

    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(x, y, healthBarWidth * healthPercentage, healthBarHeight);
  }

  // Render selection indicators
  private renderSelections(): void {
    if (this.selectedTile) {
      const screenPos = this.renderer.worldToScreen(this.selectedTile.x, this.selectedTile.y);
      const renderContext = this.renderer.getRenderContext();
      const tileSize = renderContext.tileSize;
      
      this.renderer.strokeRect(
        screenPos.x, 
        screenPos.y, 
        tileSize, 
        tileSize, 
        '#FFFFFF', 
        2
      );
    }

    // Goto-mode hover highlight – cyan border + corner brackets
    if (this.gotoHoverTile) {
      const screenPos = this.renderer.worldToScreen(this.gotoHoverTile.x, this.gotoHoverTile.y);
      const renderContext = this.renderer.getRenderContext();
      const tileSize = renderContext.tileSize;
      const ctx = this.renderer.getContext();

      // Outer glow
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
      ctx.lineWidth = 6;
      ctx.strokeRect(screenPos.x - 2, screenPos.y - 2, tileSize + 4, tileSize + 4);

      // Solid cyan border
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2;
      ctx.strokeRect(screenPos.x, screenPos.y, tileSize, tileSize);

      // Corner bracket accents
      const b = Math.min(8, tileSize / 4);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#FFFFFF';
      // Top-left
      ctx.beginPath(); ctx.moveTo(screenPos.x, screenPos.y + b); ctx.lineTo(screenPos.x, screenPos.y); ctx.lineTo(screenPos.x + b, screenPos.y); ctx.stroke();
      // Top-right
      ctx.beginPath(); ctx.moveTo(screenPos.x + tileSize - b, screenPos.y); ctx.lineTo(screenPos.x + tileSize, screenPos.y); ctx.lineTo(screenPos.x + tileSize, screenPos.y + b); ctx.stroke();
      // Bottom-right
      ctx.beginPath(); ctx.moveTo(screenPos.x + tileSize, screenPos.y + tileSize - b); ctx.lineTo(screenPos.x + tileSize, screenPos.y + tileSize); ctx.lineTo(screenPos.x + tileSize - b, screenPos.y + tileSize); ctx.stroke();
      // Bottom-left
      ctx.beginPath(); ctx.moveTo(screenPos.x + b, screenPos.y + tileSize); ctx.lineTo(screenPos.x, screenPos.y + tileSize); ctx.lineTo(screenPos.x, screenPos.y + tileSize - b); ctx.stroke();

      ctx.restore();
    }
  }

  // Render grid overlay
  private renderGrid(): void {
    const renderContext = this.renderer.getRenderContext();
    const visibleRange = this.renderer.getVisibleTileRange();
    const tileSize = renderContext.tileSize;
    
    // Vertical lines
    for (let x = visibleRange.startX; x <= visibleRange.endX; x++) {
      const screenX = (x - renderContext.viewport.x) * tileSize;
      this.renderer.drawLine(
        screenX, 
        0, 
        screenX,
        renderContext.canvas.height, 
        'rgba(0, 0, 0, 0.1)', 
        1
      );
    }
    
    // Horizontal lines
    for (let y = visibleRange.startY; y <= visibleRange.endY; y++) {
      const screenY = (y - renderContext.viewport.y) * tileSize;
      this.renderer.drawLine(
        0, 
        screenY, 
        renderContext.canvas.width, 
        screenY, 
        'rgba(0, 0, 0, 0.1)', 
        1
      );
    }
  }

  /** Update the tile highlighted while goto-mode is active (null to clear). */
  public setGotoHoverTile(pos: { x: number, y: number } | null): void {
    this.gotoHoverTile = pos;
  }

  // Handle tile selection
  public selectTile(x: number, y: number): void {
    this.selectedTile = { x, y };
  }

  // Handle unit selection
  public selectUnit(unit: Unit): void {
    this.selectedUnit = unit;
  }

  // Clear selections
  public clearSelections(): void {
    this.selectedTile = null;
    this.selectedUnit = null;
  }

  // Get selected tile
  public getSelectedTile(): { x: number, y: number } | null {
    return this.selectedTile;
  }

  // Get selected unit
  public getSelectedUnit(): Unit | null {
    return this.selectedUnit;
  }

  // Toggle unit blinking effect
  public toggleUnitBlink(): void {
    this.blinkState = !this.blinkState;
  }

  // Check if unit should be rendered (for blinking effect)
  private shouldRenderUnit(unit: Unit): boolean {
    // Hide fortified units inside cities from the main map view
    if (unit.fortified && this.isUnitInCity(unit)) {
      return false;
    }
    
    // If this is the selected unit and blinking is enabled, check blink state
    if (this.selectedUnit && this.selectedUnit.id === unit.id) {
      // Fortified, fortifying, sleeping, or road-building units should never blink
      if (unit.fortified || unit.fortifying || unit.sleeping || unit.buildingRoad) {
        return true; // Always render inactive units (no blinking)
      }
      return this.blinkState;
    }
    // Always render non-selected units
    return true;
  }

  private drawUnitAt(
    ctx: CanvasRenderingContext2D,
    unit: Unit,
    tileSize: number,
    gameState: GameState,
    screenPos: { x: number, y: number },
    alpha: number = 1.0
  ): void {
    ctx.save();
    const originalFilter = ctx.filter;

    ctx.globalAlpha = alpha;

    if (unit.sleeping) {
      ctx.filter = 'grayscale(100%) brightness(0.7)';
    }

    const player = gameState.players.find(p => p.id === unit.playerId);
    const playerColor = player?.color || '#FFFFFF';
    let drawn = false;

    if (UnitSprites.hasCustomSprite(unit.type)) {
      const sprite = UnitSprites.getCachedSprite(unit.type, playerColor, tileSize);
      if (sprite) {
        ctx.drawImage(sprite, screenPos.x, screenPos.y, tileSize, tileSize);
        drawn = true;
      } else {
        UnitSprites.loadSpriteAsync(unit.type, playerColor, tileSize);
      }
    }

    if (!drawn) {
      const stats = getUnitStats(unit.type);
      let unitColor = this.getUnitColor(unit.type, stats.category);

      if (unit.sleeping) {
        unitColor = '#808080';
      }

      this.renderUnitBody(screenPos, tileSize, stats.category, unitColor, ctx);
      const unitSymbol = this.getUnitSymbol(unit.type);
      this.renderUnitSymbol(screenPos, tileSize, unitSymbol, ctx);
    }

    ctx.filter = originalFilter;
    this.renderUnitOverlays(unit, screenPos, tileSize, ctx);

    ctx.restore();
  }

  // Render unit with alpha (transparency)
  private renderUnitWithAlpha(unit: Unit, screenPos: {x: number, y: number}, tileSize: number, alpha: number, gameState: GameState): void {
    const ctx = this.renderer.getContext();
    this.drawUnitAt(ctx, unit, tileSize, gameState, screenPos, alpha);
  }

  public startUnitDeathAnimation(unit: Unit, gameState: GameState): void {
    const debugSystem = DebugSystem.getInstance();
    let shouldAnimate = false;

    if (debugSystem.shouldRevealAllMap()) {
      shouldAnimate = true;
    } else {
      const visibilityState = VisibilitySystem.getTileVisibility(gameState, gameState.currentPlayer, unit.position);
      shouldAnimate = visibilityState === VisibilityState.VISIBLE;
    }

    if (!shouldAnimate) {
      return;
    }

    const renderContext = this.renderer.getRenderContext();
    const tileSize = renderContext.tileSize;
    const offset = this.computeStackOffset(unit, gameState);
    const snapshot = this.createUnitSnapshot(unit, gameState, tileSize);

    if (!snapshot) {
      return;
    }

    const animation: UnitDeathAnimationState = {
      unitId: unit.id,
      position: { ...unit.position },
      offset,
      canvas: snapshot.canvas,
      context: snapshot.context,
      imageData: snapshot.imageData,
      pixelIndices: snapshot.pixelIndices,
      clearedCount: 0,
      totalTargetPixels: snapshot.pixelIndices.length,
      startTime: performance.now(),
  duration: 500
    };

    this.unitDeathAnimations = this.unitDeathAnimations.filter(anim => anim.unitId !== unit.id);
    this.unitDeathAnimations.push(animation);
  }

  private renderUnitDeathAnimations(timestamp: number): void {
    if (this.unitDeathAnimations.length === 0) {
      return;
    }

    const ctx = this.renderer.getContext();
    const tileSize = this.renderer.getRenderContext().tileSize;
    const completedIndices: number[] = [];

    this.unitDeathAnimations.forEach((animation, index) => {
      const elapsed = timestamp - animation.startTime;
      const progress = Math.min(1, animation.duration === 0 ? 1 : elapsed / animation.duration);

      const targetCleared = Math.floor(progress * animation.totalTargetPixels);
      if (targetCleared > animation.clearedCount) {
        const data = animation.imageData.data;
        for (let i = animation.clearedCount; i < targetCleared; i++) {
          const dataIndex = animation.pixelIndices[i];
          data[dataIndex] = 0;
          data[dataIndex + 1] = 0;
          data[dataIndex + 2] = 0;
          data[dataIndex + 3] = 0;
        }
        animation.context.putImageData(animation.imageData, 0, 0);
        animation.clearedCount = targetCleared;
      }

      const screenPos = this.renderer.worldToScreen(animation.position.x, animation.position.y);

      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - progress * 0.2);
      ctx.drawImage(
        animation.canvas,
        Math.round(screenPos.x + animation.offset.x),
        Math.round(screenPos.y + animation.offset.y),
        tileSize,
        tileSize
      );
      ctx.restore();

      if (progress >= 1 && animation.clearedCount >= animation.totalTargetPixels) {
        completedIndices.push(index);
      }
    });

    for (let i = completedIndices.length - 1; i >= 0; i--) {
      this.unitDeathAnimations.splice(completedIndices[i], 1);
    }
  }

  public hasActiveUnitDeathAnimations(): boolean {
    return this.unitDeathAnimations.length > 0;
  }

  private computeStackOffset(unit: Unit, gameState: GameState): { x: number; y: number } {
    const unitsAtPosition = gameState.units.filter(u => u.position.x === unit.position.x && u.position.y === unit.position.y);

    if (unitsAtPosition.length <= 1) {
      return { x: 0, y: 0 };
    }

    const selectedUnit = unitsAtPosition.find(u => this.selectedUnit && this.selectedUnit.id === u.id);

    if (selectedUnit && selectedUnit.id === unit.id) {
      return { x: 0, y: 0 };
    }

    const stack = selectedUnit
      ? unitsAtPosition.filter(u => u.id !== selectedUnit.id)
      : unitsAtPosition;

    const index = stack.findIndex(u => u.id === unit.id);
    if (index === -1) {
      return { x: 0, y: 0 };
    }

    const offsetValue = (index + 1) * 3;
    return { x: offsetValue, y: offsetValue };
  }

  private createUnitSnapshot(unit: Unit, gameState: GameState, tileSize: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; imageData: ImageData; pixelIndices: number[] } | null {
    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }
    context.imageSmoothingEnabled = false;

    const unitClone: Unit = {
      ...unit,
      position: { ...unit.position }
    };

    this.drawUnitAt(context, unitClone, tileSize, gameState, { x: 0, y: 0 }, 1.0);

    const imageData = context.getImageData(0, 0, tileSize, tileSize);
    const pixels: number[] = [];
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) {
        pixels.push(i);
      }
    }

    if (pixels.length === 0) {
      return null;
    }

    this.shuffleArray(pixels);

    return {
      canvas,
      context,
      imageData,
      pixelIndices: pixels
    };
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // Render unit status overlays (veteran, fortification, sleep, health, movement)
  private renderUnitOverlays(
    unit: Unit,
    screenPos: {x: number, y: number},
    tileSize: number,
    ctx: CanvasRenderingContext2D = this.renderer.getContext()
  ): void {
    if (unit.isVeteran) {
      this.renderVeteranIndicator(screenPos, tileSize, ctx);
    }

    if (unit.fortified || unit.fortifying || unit.sleeping || unit.buildingRoad || unit.buildingMine) {
      this.renderFortificationIndicator(screenPos, tileSize, unit, ctx);
    }

    if (unit.health < unit.maxHealth) {
      this.renderHealthBar(screenPos, tileSize, unit.health, unit.maxHealth, ctx);
    }

    // Goto order indicator — bottom-left corner, cyan "G"
    if (unit.gotoDestination) {
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Small dark backing circle for readability
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.arc(screenPos.x + 8, screenPos.y + tileSize - 8, 7, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = '#00E5FF';
      ctx.fillText('G', screenPos.x + 8, screenPos.y + tileSize - 7);
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(unit.movementPoints.toString(), screenPos.x + 2, screenPos.y + 14);
  }

  // Check if a unit is inside a city
  private isUnitInCity(unit: Unit): boolean {
    if (!this.currentGameState) return false;
    
    // Check if there's a city at the unit's position
    return this.currentGameState.cities.some(city => 
      city.position.x === unit.position.x && city.position.y === unit.position.y
    );
  }
}
