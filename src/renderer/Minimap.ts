import { GameState, Tile, TerrainType, VisibilityState } from '../types/game';
import { Renderer } from './Renderer';
import { VisibilitySystem } from '../game/VisibilitySystem';
import { DebugSystem } from '../utils/DebugSystem';

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mainRenderer: Renderer;
  private gameState: GameState | null = null;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private window: HTMLElement;
  private isVisible = true;
  private onViewportChange?: () => void;

  constructor(canvas: HTMLCanvasElement, mainRenderer: Renderer, onViewportChange?: () => void) {
    this.canvas = canvas;
    this.mainRenderer = mainRenderer;
    this.onViewportChange = onViewportChange;
    
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D rendering context for minimap');
    }
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;

    // Get the minimap window
    this.window = document.getElementById('minimap-window')!;
    
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Window dragging
    const header = this.window.querySelector('.minimap-header') as HTMLElement;
    
    header.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      const rect = this.window.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
      
      document.addEventListener('mousemove', this.onWindowDrag);
      document.addEventListener('mouseup', this.onWindowDragEnd);
      e.preventDefault();
    });

    // Close button
    const closeBtn = document.getElementById('minimap-close')!;
    closeBtn.addEventListener('click', () => {
      this.hide();
    });

    // Canvas clicking for navigation
    this.canvas.addEventListener('click', (e) => {
      this.onMinimapClick(e);
    });

    // Canvas hovering for coordinate display
    this.canvas.addEventListener('mousemove', (e) => {
      this.onMinimapHover(e);
    });

    this.canvas.addEventListener('mouseleave', () => {
      const coordsElement = document.getElementById('minimap-coords');
      if (coordsElement) {
        coordsElement.textContent = 'Click to navigate';
      }
    });
  }

  private onWindowDrag = (e: MouseEvent) => {
    if (!this.isDragging) return;
    
    const x = e.clientX - this.dragOffset.x;
    const y = e.clientY - this.dragOffset.y;
    
    // Keep window within viewport bounds
    const maxX = window.innerWidth - this.window.offsetWidth;
    const maxY = window.innerHeight - this.window.offsetHeight;
    
    this.window.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    this.window.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
  };

  private onWindowDragEnd = () => {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.onWindowDrag);
    document.removeEventListener('mouseup', this.onWindowDragEnd);
  };

  private onMinimapClick(e: MouseEvent): void {
    if (!this.gameState) return;

    const rect = this.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert minimap click to world coordinates
    const mapWidth = this.gameState.worldMap[0]?.length || 80;
    const mapHeight = this.gameState.worldMap.length || 50;

    const worldX = (clickX / this.canvas.width) * mapWidth;
    const worldY = (clickY / this.canvas.height) * mapHeight;

    // Center the main view on the clicked location
    this.mainRenderer.setViewport(
      worldX - (this.mainRenderer.getRenderContext().canvas.width / this.mainRenderer.getRenderContext().tileSize) / 2,
      worldY - (this.mainRenderer.getRenderContext().canvas.height / this.mainRenderer.getRenderContext().tileSize) / 2
    );

    // Trigger a re-render of the main game view
    if (this.onViewportChange) {
      this.onViewportChange();
    }
  }

  private onMinimapHover(e: MouseEvent): void {
    if (!this.gameState) return;

    const rect = this.canvas.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const hoverY = e.clientY - rect.top;

    // Convert minimap coordinates to world coordinates
    const mapWidth = this.gameState.worldMap[0]?.length || 80;
    const mapHeight = this.gameState.worldMap.length || 50;

    const worldX = Math.floor((hoverX / this.canvas.width) * mapWidth);
    const worldY = Math.floor((hoverY / this.canvas.height) * mapHeight);

    // Update status bar
    const coordsElement = document.getElementById('minimap-coords');
    if (coordsElement) {
      coordsElement.textContent = `(${worldX}, ${worldY})`;
    }
  }

  public updateGameState(gameState: GameState): void {
    this.gameState = gameState;
    this.render();
  }

  public render(): void {
    if (!this.gameState || !this.isVisible) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const worldMap = this.gameState.worldMap;
    if (worldMap.length === 0) return;

    const mapWidth = worldMap[0].length;
    const mapHeight = worldMap.length;

    // Calculate scale to fit the world map in the minimap
    const scaleX = this.canvas.width / mapWidth;
    const scaleY = this.canvas.height / mapHeight;

    // Update scale display
    const scaleElement = document.getElementById('minimap-scale');
    if (scaleElement) {
      const scale = Math.round(1 / Math.min(scaleX, scaleY));
      scaleElement.textContent = `Scale: 1:${scale}`;
    }

    // Render the world map
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const tile = worldMap[y][x];
        
        // Get visibility state for this tile
        const debugSystem = DebugSystem.getInstance();
        let visibilityState: VisibilityState;
        
        if (debugSystem.shouldRevealAllMap()) {
          visibilityState = VisibilityState.VISIBLE;
        } else {
          visibilityState = VisibilitySystem.getTileVisibility(
            this.gameState,
            this.gameState.currentPlayer,
            { x, y }
          );
        }
        
        let color: string;
        if (visibilityState === VisibilityState.UNSEEN) {
          // Unseen areas are black
          color = '#000000';
        } else {
          // Visible and explored areas show terrain color
          color = this.getTerrainColor(tile.terrain);
          
          // Add fog overlay for explored (but not currently visible) areas
          if (visibilityState === VisibilityState.EXPLORED) {
            color = this.applyFogOverlay(color);
          }
        }
        
        const pixelX = Math.floor(x * scaleX);
        const pixelY = Math.floor(y * scaleY);
        const pixelWidth = Math.ceil(scaleX);
        const pixelHeight = Math.ceil(scaleY);

        this.ctx.fillStyle = color;
        this.ctx.fillRect(pixelX, pixelY, pixelWidth, pixelHeight);
      }
    }

    // Render cities as white dots (only if visible)
    const debugSystem = DebugSystem.getInstance();
    this.gameState.cities.forEach(city => {
      let shouldShowCity = false;
      
      if (debugSystem.shouldRevealAllMap()) {
        shouldShowCity = true;
      } else {
        const visibilityState = VisibilitySystem.getTileVisibility(
          this.gameState!,
          this.gameState!.currentPlayer,
          city.position
        );
        shouldShowCity = visibilityState !== VisibilityState.UNSEEN;
      }
      
      if (shouldShowCity) {
        const pixelX = Math.floor(city.position.x * scaleX);
        const pixelY = Math.floor(city.position.y * scaleY);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(pixelX - 1, pixelY - 1, 3, 3);
      }
    });

    // Render units as colored dots (only if visible)
    this.gameState.units.forEach(unit => {
      let shouldShowUnit = false;
      
      if (debugSystem.shouldRevealAllMap()) {
        shouldShowUnit = true;
      } else {
        const visibilityState = VisibilitySystem.getTileVisibility(
          this.gameState!,
          this.gameState!.currentPlayer,
          unit.position
        );
        shouldShowUnit = visibilityState === VisibilityState.VISIBLE;
      }
      
      if (shouldShowUnit) {
        const pixelX = Math.floor(unit.position.x * scaleX);
        const pixelY = Math.floor(unit.position.y * scaleY);
        
        this.ctx.fillStyle = '#FF0000'; // Red for units
        this.ctx.fillRect(pixelX, pixelY, 2, 2);
      }
    });

    // Render viewport indicator
    this.renderViewportIndicator(scaleX, scaleY);
  }

  private renderViewportIndicator(scaleX: number, scaleY: number): void {
    if (!this.gameState) return;
    
    const renderContext = this.mainRenderer.getRenderContext();
    const viewport = renderContext.viewport;
    const tileSize = renderContext.tileSize;
    
    const mapWidth = this.gameState.worldMap[0]?.length || 80;
    const mapHeight = this.gameState.worldMap.length || 50;

    // Calculate visible area in world coordinates
    const visibleWidth = renderContext.canvas.width / tileSize;
    const visibleHeight = renderContext.canvas.height / tileSize;

    // Normalize viewport X coordinate to handle wrapping
    const normalizedViewportX = ((viewport.x % mapWidth) + mapWidth) % mapWidth;
    
    // Convert to minimap coordinates
    const minimapX = Math.floor(normalizedViewportX * scaleX);
    const minimapY = Math.floor(viewport.y * scaleY);
    const minimapWidth = Math.ceil(visibleWidth * scaleX);
    const minimapHeight = Math.ceil(visibleHeight * scaleY);

    // Check if the viewport rectangle wraps around the right edge
    const minimapWidthTotal = this.canvas.width;
    const rightEdge = minimapX + minimapWidth;
    
    if (rightEdge > minimapWidthTotal) {
      // Rectangle wraps around - draw two parts
      
      // Right part (from minimapX to right edge of minimap)
      const rightPartWidth = minimapWidthTotal - minimapX;
      this.drawViewportRectangle(minimapX, minimapY, rightPartWidth, minimapHeight);
      
      // Left part (from left edge of minimap to overflow amount)
      const leftPartWidth = rightEdge - minimapWidthTotal;
      this.drawViewportRectangle(0, minimapY, leftPartWidth, minimapHeight);
    } else {
      // Normal case - no wrapping
      this.drawViewportRectangle(minimapX, minimapY, minimapWidth, minimapHeight);
    }
  }

  private drawViewportRectangle(x: number, y: number, width: number, height: number): void {
    // Draw viewport rectangle with white border
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, width, height);
    
    // Add a slight inner shadow for better visibility
    if (width > 2 && height > 2) {
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
    }
  }

  private getTerrainColor(terrain: TerrainType): string {
    switch (terrain) {
      case 'grassland': return '#4CAF50';
      case 'plains': return '#8BC34A';
      case 'forest': return '#2E7D32';
      case 'hills': return '#8D6E63';
      case 'mountains': return '#424242';
      case 'desert': return '#FF9800';
      case 'jungle': return '#1B5E20';
      case 'ocean': return '#2196F3';
      case 'river': return '#03A9F4';
      default: return '#9E9E9E';
    }
  }

  /**
   * Apply fog overlay to a terrain color
   */
  private applyFogOverlay(baseColor: string): string {
    // Convert hex color to RGB, apply dark overlay, convert back
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Darken the color for fog effect (multiply by 0.5)
    const fogR = Math.floor(r * 0.5);
    const fogG = Math.floor(g * 0.5);
    const fogB = Math.floor(b * 0.5);
    
    return `rgb(${fogR}, ${fogG}, ${fogB})`;
  }

  public show(): void {
    this.isVisible = true;
    this.window.classList.remove('hidden');
    this.render();
  }

  public hide(): void {
    this.isVisible = false;
    this.window.classList.add('hidden');
  }

  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public isShowing(): boolean {
    return this.isVisible;
  }
}
