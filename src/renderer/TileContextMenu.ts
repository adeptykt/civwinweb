import { Unit, Tile, Position } from '../types/game';

/**
 * Context menu for right-clicking on tiles
 * Shows friendly units and tile information options
 */
export class TileContextMenu {
  private container: HTMLElement | null = null;
  private isVisible = false;

  constructor() {
    this.createMenuElement();
  }

  /**
   * Create the menu DOM element
   */
  private createMenuElement(): void {
    if (document.getElementById('tile-context-menu')) {
      this.container = document.getElementById('tile-context-menu');
      return;
    }

    const menu = document.createElement('div');
    menu.id = 'tile-context-menu';
    menu.className = 'tile-context-menu';
    menu.style.display = 'none';
    menu.style.position = 'fixed';
    menu.style.zIndex = '10000';
    
    document.body.appendChild(menu);
    this.container = menu;
  }

  /**
   * Show the context menu at the given position with options
   * @param x - Screen X coordinate
   * @param y - Screen Y coordinate
   * @param position - The tile position in the game world
   * @param friendlyUnits - Units on the tile belonging to the current player
   * @param tile - The tile being clicked
   * @param onSelectUnit - Callback when a unit is selected
   * @param onShowTileInfo - Callback when tile info is requested
   */
  public show(
    x: number,
    y: number,
    position: Position,
    friendlyUnits: Unit[],
    tile: Tile,
    onSelectUnit: (unit: Unit) => void,
    onShowTileInfo: (position: Position, tile: Tile) => void
  ): void {
    if (!this.container) return;

    // Clear previous menu content
    this.container.innerHTML = '';

    // Add unit options
    if (friendlyUnits.length > 0) {
      for (const unit of friendlyUnits) {
        const unitOption = document.createElement('div');
        unitOption.className = 'tile-context-menu-item unit-option';
        unitOption.innerHTML = `<span class="unit-icon">⚔</span><span class="unit-label">${this.getUnitLabel(unit)}</span>`;
        
        unitOption.addEventListener('click', () => {
          onSelectUnit(unit);
          this.hide();
        });

        this.container.appendChild(unitOption);
      }

      // Add separator
      const separator = document.createElement('div');
      separator.className = 'tile-context-menu-separator';
      this.container.appendChild(separator);
    }

    // Add tile info option
    const tileInfoOption = document.createElement('div');
    tileInfoOption.className = 'tile-context-menu-item tile-info-option';
    tileInfoOption.innerHTML = '<span class="info-icon">ℹ</span><span>Tile Info</span>';
    
    tileInfoOption.addEventListener('click', () => {
      onShowTileInfo(position, tile);
      this.hide();
    });

    this.container.appendChild(tileInfoOption);

    // Position and show menu
    this.container.style.left = x + 'px';
    this.container.style.top = y + 'px';
    this.container.style.display = 'block';
    this.isVisible = true;

    // Close menu when clicking elsewhere
    const closeHandler = (event: MouseEvent) => {
      if (!this.container?.contains(event.target as Node)) {
        this.hide();
        document.removeEventListener('click', closeHandler);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', closeHandler);
    }, 0);
  }

  /**
   * Hide the context menu
   */
  public hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
      this.isVisible = false;
    }
  }

  /**
   * Check if menu is currently visible
   */
  public getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Get a descriptive label for a unit
   */
  private getUnitLabel(unit: Unit): string {
    const typeLabel = unit.type.charAt(0).toUpperCase() + unit.type.slice(1);
    const moves = unit.movementPoints > 0 ? ` (${unit.movementPoints} moves)` : ' (no moves)';
    return typeLabel + moves;
  }
}
