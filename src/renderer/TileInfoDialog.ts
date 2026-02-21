import { Tile, Position, TerrainType } from '../types/game';

/**
 * Dialog displaying information about a tile
 */
export class TileInfoDialog {
  private backdrop: HTMLElement | null = null;
  private dialog: HTMLElement | null = null;

  constructor() {
    this.createDialogElements();
  }

  /**
   * Create the dialog DOM elements
   */
  private createDialogElements(): void {
    // Create backdrop
    if (!document.getElementById('tile-info-backdrop')) {
      const backdrop = document.createElement('div');
      backdrop.id = 'tile-info-backdrop';
      backdrop.className = 'tile-info-backdrop';
      backdrop.style.display = 'none';
      backdrop.addEventListener('click', () => this.hide());
      document.body.appendChild(backdrop);
      this.backdrop = backdrop;
    } else {
      this.backdrop = document.getElementById('tile-info-backdrop');
    }

    // Create dialog
    if (!document.getElementById('tile-info-dialog')) {
      const dialog = document.createElement('div');
      dialog.id = 'tile-info-dialog';
      dialog.className = 'tile-info-dialog';
      dialog.style.display = 'none';
      document.body.appendChild(dialog);
      this.dialog = dialog;
    } else {
      this.dialog = document.getElementById('tile-info-dialog');
    }
  }

  /**
   * Show the tile info dialog
   */
  public show(position: Position, tile: Tile): void {
    if (!this.dialog || !this.backdrop) return;

    const terrainName = this.getTerrainName(tile.terrain);
    const terrainDescription = this.getTerrainDescription(tile.terrain);

    let resourceInfo = '';
    if (tile.resource) {
      resourceInfo = `<div class="tile-info-row">
        <span class="tile-info-label">Resource</span>
        <span class="tile-info-value">${tile.resource.type}</span>
      </div>`;
    }

    let improvementInfo = '';
    if (tile.improvements && tile.improvements.length > 0) {
      const improvementsList = tile.improvements.map(imp => imp.type).join(', ');
      improvementInfo = `<div class="tile-info-row">
        <span class="tile-info-label">Improvements</span>
        <span class="tile-info-value">${improvementsList}</span>
      </div>`;
    }

    const imageSrc = this.getTerrainImageSrc(tile.terrain);

    this.dialog.innerHTML = `
      <div class="tile-info-dialog-header">
        <img class="tile-info-terrain-image" src="${imageSrc}" alt="${terrainName}" />
        <div class="tile-info-dialog-title">${terrainName}</div>
        <button class="tile-info-dialog-close" aria-label="Close">✕</button>
      </div>
      <div class="tile-info-dialog-content">
        <div class="tile-info-row">
          <span class="tile-info-label">Position</span>
          <span class="tile-info-value">(${position.x}, ${position.y})</span>
        </div>
        <div class="tile-info-row">
          <span class="tile-info-label">Terrain</span>
          <span class="tile-info-value">${terrainName}</span>
        </div>
        ${resourceInfo}
        ${improvementInfo}
        <div class="tile-info-description">
          ${terrainDescription}
        </div>
      </div>
    `;

    // Add close button handler
    const closeBtn = this.dialog.querySelector('.tile-info-dialog-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Show dialog
    this.backdrop.style.display = 'block';
    this.dialog.style.display = 'block';
  }

  /**
   * Hide the tile info dialog
   */
  public hide(): void {
    if (this.dialog) {
      this.dialog.style.display = 'none';
    }
    if (this.backdrop) {
      this.backdrop.style.display = 'none';
    }
  }

  /**
   * Get the image source path for a terrain type
   */
  private getTerrainImageSrc(terrain: string): string {
    const terrainImages: Record<string, string> = {
      [TerrainType.GRASSLAND]: '/src/assets/civwintiles/grassland.png',
      [TerrainType.PLAINS]: '/src/assets/civwintiles/plains.png',
      [TerrainType.DESERT]: '/src/assets/civwintiles/desert.png',
      [TerrainType.FOREST]: '/src/assets/civwintiles/forest.png',
      [TerrainType.HILLS]: '/src/assets/civwintiles/hill.png',
      [TerrainType.MOUNTAINS]: '/src/assets/civwintiles/mountain.png',
      [TerrainType.OCEAN]: '/src/assets/civwintiles/ocean.png',
      [TerrainType.RIVER]: '/src/assets/civwintiles/ocean.png',
      [TerrainType.JUNGLE]: '/src/assets/civwintiles/jungle.png',
      [TerrainType.SWAMP]: '/src/assets/civwintiles/swamp.png',
      [TerrainType.ARCTIC]: '/src/assets/civwintiles/plains.png',
      [TerrainType.TUNDRA]: '/src/assets/civwintiles/grassland.png'
    };
    return terrainImages[terrain] || '/src/assets/civwintiles/grassland.png';
  }

  /**
   * Get human-readable name for terrain type
   */
  private getTerrainName(terrain: string): string {
    const terrainNames: Record<string, string> = {
      [TerrainType.GRASSLAND]: 'Grassland',
      [TerrainType.PLAINS]: 'Plains',
      [TerrainType.DESERT]: 'Desert',
      [TerrainType.FOREST]: 'Forest',
      [TerrainType.HILLS]: 'Hills',
      [TerrainType.MOUNTAINS]: 'Mountains',
      [TerrainType.OCEAN]: 'Ocean',
      [TerrainType.RIVER]: 'River',
      [TerrainType.JUNGLE]: 'Jungle',
      [TerrainType.SWAMP]: 'Swamp',
      [TerrainType.ARCTIC]: 'Arctic',
      [TerrainType.TUNDRA]: 'Tundra'
    };
    return terrainNames[terrain] || terrain;
  }

  /**
   * Get description for terrain type
   */
  private getTerrainDescription(terrain: string): string {
    const descriptions: Record<string, string> = {
      [TerrainType.GRASSLAND]: 'Fertile grassland suitable for farming and settlement. Provides good food production.',
      [TerrainType.PLAINS]: 'Open plains with moderate fertility. Good for agriculture and unit movement.',
      [TerrainType.DESERT]: 'Harsh desert terrain. Low food production but may contain valuable resources.',
      [TerrainType.FOREST]: 'Dense forest providing timber and shielding units. Slows unit movement.',
      [TerrainType.HILLS]: 'Hilly terrain providing defensive advantages for units. Contains mineral resources.',
      [TerrainType.MOUNTAINS]: 'Impassable mountains. Create natural borders and barriers. Contain rare resources.',
      [TerrainType.OCEAN]: 'Deep water suitable for naval units. Essential for exploring the world.',
      [TerrainType.RIVER]: 'Flowing river providing water access and trade routes. Boosts city development.',
      [TerrainType.JUNGLE]: 'Dense jungle limiting vision and movement. May contain resources.',
      [TerrainType.SWAMP]: 'Marshy terrain difficult to traverse. Low productivity but defensible position.',
      [TerrainType.ARCTIC]: 'Frozen arctic wasteland. Inhospitable for settlements. Limited visibility.',
      [TerrainType.TUNDRA]: 'Cold tundra with sparse vegetation. Difficult to develop but contains resources.'
    };
    return descriptions[terrain] || 'Unknown terrain type.';
  }
}
