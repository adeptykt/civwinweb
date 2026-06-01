import { GameState, Tile, TerrainType, VisibilityState } from '../types/game';
import { Renderer } from './Renderer';
import { VisibilitySystem } from '../game/VisibilitySystem';
import { DebugSystem } from '../utils/DebugSystem';
import { t } from '../i18n/I18nService.js';
import { attachPointerDragHandle } from '../utils/PointerDragHelper.js';

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mainRenderer: Renderer;
  private gameState: GameState | null = null;
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
    const header = this.window.querySelector('.minimap-header') as HTMLElement;
    attachPointerDragHandle(header, this.window);

    // Close button
    const closeBtn = document.getElementById('minimap-close')!;
    closeBtn.addEventListener('click', () => {
      this.hide();
    });

    const onCanvasPointer = (e: PointerEvent): void => {
      if (e.pointerType === 'touch') e.preventDefault();
      if (e.button !== 0) return;
      this.onMinimapPointer(e.clientX, e.clientY);
    };

    this.canvas.addEventListener('pointerdown', onCanvasPointer);

    this.canvas.addEventListener('pointermove', (e) => {
      this.onMinimapPointer(e.clientX, e.clientY, true);
    });

    this.canvas.addEventListener('pointerleave', () => {
      const coordsElement = document.getElementById('minimap-coords');
      if (coordsElement) {
        coordsElement.textContent = t('templates.minimap.coordsHint');
      }
    });
  }

  private onMinimapPointer(clientX: number, clientY: number, hoverOnly = false): void {
    if (!this.gameState) return;

    const rect = this.canvas.getBoundingClientRect();
    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;

    const mapWidth = this.gameState.worldMap[0]?.length || 80;
    const mapHeight = this.gameState.worldMap.length || 50;

    const worldX = (pointerX / rect.width) * mapWidth;
    const worldY = (pointerY / rect.height) * mapHeight;

    if (hoverOnly) {
      const coordsElement = document.getElementById('minimap-coords');
      if (coordsElement) {
        coordsElement.textContent = `(${Math.floor(worldX)}, ${Math.floor(worldY)})`;
      }
      return;
    }

    if (this.mainRenderer.isIsoMode()) {
      this.mainRenderer.centerOn(worldX, worldY);
    } else {
      const mainCtx = this.mainRenderer.getRenderContext();
      this.mainRenderer.setViewport(
        worldX - (mainCtx.displayWidth / mainCtx.tileSize) / 2,
        worldY - (mainCtx.displayHeight / mainCtx.tileSize) / 2,
      );
    }

    if (this.onViewportChange) {
      this.onViewportChange();
    }
  }

  private syncMobilePanelClass(): void {
    if (document.body.classList.contains('is-mobile')) {
      this.window.classList.toggle('mobile-panel-visible', this.isVisible);
    } else {
      this.window.classList.remove('mobile-panel-visible');
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
      scaleElement.textContent = t('templates.minimap.scalePattern', { n: String(scale) });
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
        if (visibilityState === VisibilityState.UNSEEN) {
          shouldShowCity = false;
        } else if (city.playerId === this.gameState!.currentPlayer) {
          shouldShowCity = true;
        } else {
          shouldShowCity = city.discoveredByPlayers?.includes(this.gameState!.currentPlayer) ?? false;
        }
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

    const mapWidth = this.gameState.worldMap[0]?.length || 80;
    const mapHeight = this.gameState.worldMap.length || 50;

    let minimapX: number;
    let minimapY: number;
    let minimapWidth: number;
    let minimapHeight: number;

    if (this.mainRenderer.isIsoMode()) {
      const range = this.mainRenderer.getVisibleTileRange();
      const normalizedViewportX = ((viewport.x % mapWidth) + mapWidth) % mapWidth;
      minimapX = normalizedViewportX * scaleX;
      minimapY = Math.max(0, range.startY) * scaleY;
      minimapWidth = Math.max(1, (range.endX - range.startX + 1) * scaleX);
      minimapHeight = Math.max(1, (range.endY - range.startY + 1) * scaleY);
    } else {
      const tileSize = renderContext.tileSize;
      const visibleWidth = renderContext.displayWidth / tileSize;
      const visibleHeight = renderContext.displayHeight / tileSize;
      const normalizedViewportX = ((viewport.x % mapWidth) + mapWidth) % mapWidth;
      minimapX = Math.floor(normalizedViewportX * scaleX);
      minimapY = Math.floor(viewport.y * scaleY);
      minimapWidth = Math.ceil(visibleWidth * scaleX);
      minimapHeight = Math.ceil(visibleHeight * scaleY);
    }

    const minimapWidthTotal = this.canvas.width;
    const rightEdge = minimapX + minimapWidth;

    if (rightEdge > minimapWidthTotal) {
      const rightPartWidth = minimapWidthTotal - minimapX;
      this.drawViewportRectangle(minimapX, minimapY, rightPartWidth, minimapHeight);

      const leftPartWidth = rightEdge - minimapWidthTotal;
      this.drawViewportRectangle(0, minimapY, leftPartWidth, minimapHeight);
    } else {
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
    this.syncMobilePanelClass();
    this.render();
  }

  public hide(): void {
    this.isVisible = false;
    this.window.classList.add('hidden');
    this.syncMobilePanelClass();
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
