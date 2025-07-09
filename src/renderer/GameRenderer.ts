import { GameState, Tile, Unit, City, TerrainType, UnitType, UnitCategory, ImprovementType, VisibilityState } from '../types/game';
import { Renderer } from './Renderer';
import { TerrainManager } from '../terrain/index';
import { UnitSprites } from './UnitSprites';
import { CitySprites } from './CitySprites';
import { ConnectionMask, ConnectionPattern } from '../types/terrain';
import { getUnitStats } from '../game/UnitDefinitions';
import { VisibilitySystem } from '../game/VisibilitySystem';
import { DebugSystem } from '../utils/DebugSystem';

export class GameRenderer {
  private renderer: Renderer;
  private selectedTile: { x: number, y: number } | null = null;
  private selectedUnit: Unit | null = null;
  private currentWorldMap: Tile[][] = []; // Cache the world map for connection analysis
  private currentGameState: GameState | null = null; // Cache the game state for city checks
  private readonly tileSize = 48; // Fixed tile size for terrain sprites
  private blinkState: boolean = false; // Track blinking state for current unit

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  // Render the entire game state
  public render(gameState: GameState, showGrid: boolean = false, game?: any): void {
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
    
    // Render grid overlay (only if enabled)
    if (showGrid) {
      this.renderGrid();
    }
    
    // Render selections
    this.renderSelections();
  }

  // Analyze connections for a tile at given coordinates
  private analyzeConnections(x: number, y: number, terrain: TerrainType): ConnectionPattern {
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

    return connections as ConnectionPattern;
  }

  // Render the map
  private renderMap(worldMap: Tile[][], game?: any): void {
    const renderContext = this.renderer.getRenderContext();
    const mapWidth = worldMap[0]?.length || 80;
    const mapHeight = worldMap.length || 50;
    
    // Calculate visible range with some padding for smooth scrolling
    const tilesWidth = Math.ceil(renderContext.canvas.width / this.tileSize) + 2;
    const tilesHeight = Math.ceil(renderContext.canvas.height / this.tileSize) + 2;
    
    const startX = Math.floor(renderContext.viewport.x) - 1;
    const endX = startX + tilesWidth;
    const startY = Math.max(0, Math.floor(renderContext.viewport.y) - 1);
    const endY = Math.min(mapHeight - 1, startY + tilesHeight);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        // Handle horizontal wrapping
        const wrappedX = ((x % mapWidth) + mapWidth) % mapWidth;
        
        if (y >= 0 && y < mapHeight) {
          const tile = worldMap[y][wrappedX];
          const connectionPattern = this.analyzeConnections(wrappedX, y, tile.terrain);
          
          // Get visibility state for this tile
          let visibilityState: VisibilityState = VisibilityState.VISIBLE; // Default for now
          if (game) {
            // Check if debug mode reveals all map
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

  // Render a single tile
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
    } else {
      // Fallback to colored rectangle if sprite not available
      const color = this.getTerrainColor(tile.terrain);
      this.renderer.fillRect(
        screenPos.x,
        screenPos.y,
        this.tileSize,
        this.tileSize,
        color
      );
    }

    // Render improvements on top of terrain
    this.renderImprovements(tile, screenPos, x, y);
    
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
          const roadConnections = this.analyzeRoadConnections(tileX, tileY);
          this.renderRoad(ctx, screenPos, roadConnections);
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

  // Render mine improvement
  private renderMine(ctx: CanvasRenderingContext2D, screenPos: { x: number, y: number }): void {
    const centerX = screenPos.x + this.tileSize / 2;
    const centerY = screenPos.y + this.tileSize / 2;
    
    // Draw mine entrance as a dark square with supports
    ctx.fillStyle = '#2F2F2F'; // Dark gray
    const mineSize = this.tileSize / 3;
    ctx.fillRect(
      centerX - mineSize / 2,
      centerY - mineSize / 2,
      mineSize,
      mineSize
    );
    
    // Draw mine supports
    ctx.strokeStyle = '#8B4513'; // Brown supports
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // Top support beam
    ctx.moveTo(centerX - mineSize / 2 - 2, centerY - mineSize / 2);
    ctx.lineTo(centerX + mineSize / 2 + 2, centerY - mineSize / 2);
    
    // Side supports
    ctx.moveTo(centerX - mineSize / 2, centerY - mineSize / 2);
    ctx.lineTo(centerX - mineSize / 2, centerY + mineSize / 2);
    ctx.moveTo(centerX + mineSize / 2, centerY - mineSize / 2);
    ctx.lineTo(centerX + mineSize / 2, centerY + mineSize / 2);
    
    ctx.stroke();
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
          // Check if the neighbor tile has a road
          const hasRoad = neighborTile.improvements.some(imp => imp.type === ImprovementType.ROAD);
          if (hasRoad) {
            connections |= dir.mask;
          }
        }
      }
    }

    return connections as ConnectionPattern;
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
  private renderUnitBody(screenPos: {x: number, y: number}, tileSize: number, category: UnitCategory, color: string): void {
    const centerX = screenPos.x + tileSize / 2;
    const centerY = screenPos.y + tileSize / 2;
    const size = tileSize / 3.5;

    switch (category) {
      case UnitCategory.LAND:
        // Circle for land units
        this.renderer.fillCircle(centerX, centerY, size, color);
        break;
      case UnitCategory.NAVAL:
        // Rectangle for naval units
        this.renderer.fillRect(
          centerX - size, 
          centerY - size/2, 
          size * 2, 
          size, 
          color
        );
        break;
      case UnitCategory.AIR:
        // Triangle for air units
        this.renderer.fillTriangle(
          centerX, centerY - size,
          centerX - size, centerY + size/2,
          centerX + size, centerY + size/2,
          color
        );
        break;
      case UnitCategory.SPECIAL:
        // Diamond for special units
        this.renderer.fillDiamond(centerX, centerY, size, color);
        break;
    }
  }

  // Render unit symbol/text
  private renderUnitSymbol(screenPos: {x: number, y: number}, tileSize: number, symbol: string): void {
    const centerX = screenPos.x + tileSize / 2;
    const centerY = screenPos.y + tileSize / 2;
    
    this.renderer.fillText(
      symbol,
      centerX,
      centerY + 2,
      'white',
      `${Math.floor(tileSize / 8)}px Arial`,
      'center'
    );
  }

  // Render veteran indicator (star)
  private renderVeteranIndicator(screenPos: {x: number, y: number}, tileSize: number): void {
    this.renderer.fillText(
      '★',
      screenPos.x + tileSize - 6,
      screenPos.y + 8,
      '#FFD700',
      '8px Arial',
      'center'
    );
  }

  // Render fortification and sleep indicators
  private renderFortificationIndicator(screenPos: {x: number, y: number}, tileSize: number, unit: Unit): void {
    if (unit.sleeping) {
      // Show "Z" for sleeping units
      this.renderer.fillText(
        'Z',
        screenPos.x + tileSize - 8,
        screenPos.y + tileSize - 8,
        '#4169E1',
        '12px Arial',
        'center'
      );
    } else if (unit.fortifying) {
      // Show "F" for units in the process of fortifying (first turn of 2-turn fortification)
      this.renderer.fillText(
        'F',
        screenPos.x + tileSize - 8,
        screenPos.y + tileSize - 8,
        '#FFFF00',
        '12px Arial',
        'center'
      );
    } else if (unit.buildingRoad) {
      // Show "R" for units in the process of building a road
      this.renderer.fillText(
        'R',
        screenPos.x + tileSize - 8,
        screenPos.y + tileSize - 8,
        '#8B4513',
        '12px Arial',
        'center'
      );
    } else if (unit.fortified) {
      // Show dark border for fully fortified units
      this.renderer.strokeRect(
        screenPos.x + 2,
        screenPos.y + 2,
        tileSize - 4,
        tileSize - 4,
        '#333333',
        3
      );
    }
  }

  // Render health bar
  private renderHealthBar(screenPos: {x: number, y: number}, tileSize: number, health: number, maxHealth: number): void {
    const healthBarWidth = tileSize * 0.8;
    const healthBarHeight = 4;
    const healthPercentage = health / maxHealth;
    
    // Background
    this.renderer.fillRect(
      screenPos.x + (tileSize - healthBarWidth) / 2,
      screenPos.y + tileSize - healthBarHeight - 2,
      healthBarWidth,
      healthBarHeight,
      '#FF0000'
    );
    
    // Health
    this.renderer.fillRect(
      screenPos.x + (tileSize - healthBarWidth) / 2,
      screenPos.y + tileSize - healthBarHeight - 2,
      healthBarWidth * healthPercentage,
      healthBarHeight,
      '#4CAF50'
    );
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

  // Render unit with alpha (transparency)
  private renderUnitWithAlpha(unit: Unit, screenPos: {x: number, y: number}, tileSize: number, alpha: number, gameState: GameState): void {
    const ctx = this.renderer.getContext();
    const originalAlpha = ctx.globalAlpha;
    const originalFilter = ctx.filter;
    
    // Set alpha for this unit
    ctx.globalAlpha = alpha;
    
    // Apply grayscale filter for sleeping units
    if (unit.sleeping) {
      ctx.filter = 'grayscale(100%) brightness(0.7)';
    }
    
    // Try to use custom sprite first if available (synchronous check)
    if (UnitSprites.hasCustomSprite(unit.type)) {
      // Get player color
      const player = gameState.players.find(p => p.id === unit.playerId);
      const playerColor = player?.color || '#FFFFFF';
      
      // Try to get cached sprite synchronously
      const sprite = UnitSprites.getCachedSprite(unit.type, playerColor, tileSize);
      if (sprite) {
        // Draw the sprite
        ctx.drawImage(sprite, screenPos.x, screenPos.y, tileSize, tileSize);
        
        // Restore filter before rendering overlays
        ctx.filter = originalFilter;
        
        // Add overlays for unit status
        this.renderUnitOverlays(unit, screenPos, tileSize);
        
        // Restore alpha and return
        ctx.globalAlpha = originalAlpha;
        return;
      }
      
      // If sprite not cached, load it asynchronously for next frame
      UnitSprites.loadSpriteAsync(unit.type, playerColor, tileSize);
    }
    
    // Fallback to geometric rendering for units without sprites or while loading
    const stats = getUnitStats(unit.type);
    let unitColor = this.getUnitColor(unit.type, stats.category);
    const unitSymbol = this.getUnitSymbol(unit.type);
    
    // Make sleeping units gray for geometric rendering
    if (unit.sleeping) {
      unitColor = '#808080'; // Gray color for sleeping units
    }
    
    // Unit body - different shapes for different categories
    this.renderUnitBody(screenPos, tileSize, stats.category, unitColor);
    
    // Unit symbol/text
    this.renderUnitSymbol(screenPos, tileSize, unitSymbol);
    
    // Restore filter before rendering overlays
    ctx.filter = originalFilter;
    
    // Render overlays
    this.renderUnitOverlays(unit, screenPos, tileSize);
    
    // Restore original alpha
    ctx.globalAlpha = originalAlpha;
  }

  // Render unit status overlays (veteran, fortification, sleep, health, movement)
  private renderUnitOverlays(unit: Unit, screenPos: {x: number, y: number}, tileSize: number): void {
    // Veteran indicator
    if (unit.isVeteran) {
      this.renderVeteranIndicator(screenPos, tileSize);
    }
    
    // Fortification, sleep, or road building indicator
    if (unit.fortified || unit.fortifying || unit.sleeping || unit.buildingRoad) {
      this.renderFortificationIndicator(screenPos, tileSize, unit);
    }
    
    // Health bar
    if (unit.health < unit.maxHealth) {
      this.renderHealthBar(screenPos, tileSize, unit.health, unit.maxHealth);
    }
    
    // Movement points indicator
    this.renderer.fillText(
      unit.movementPoints.toString(),
      screenPos.x + 2,
      screenPos.y + 14,
      '#FFFFFF',
      '12px Arial'
    );
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
