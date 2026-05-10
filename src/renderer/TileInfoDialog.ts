import { Tile, Position, TerrainType } from '../types/game';
import { getResourceYieldBonus } from '../game/ResourceBonuses';
import { TerrainManager } from '../terrain/index';
import { pickResourceEmoji } from '../constants/resource-emoji';
import { t } from '../i18n/I18nService.js';
import { getTerrainDisplayName, getImprovementDisplayName } from '../utils/DisplayNames.js';

/**
 * Dialog displaying information about a tile
 */
export class TileInfoDialog {
  private backdrop: HTMLElement | null = null;
  private dialog: HTMLElement | null = null;
  /** Remember last tile so we can re-render when the locale changes while open. */
  private lastView: { position: Position; tile: Tile } | null = null;

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

    this.lastView = { position, tile };

    const terrainName = getTerrainDisplayName(tile.terrain);
    const terrainDescription = this.getTerrainDescription(tile.terrain);
    const imageSrc = this.getTerrainImageSrc(tile.terrain);

    // ── Base yields (terrain only) ──────────────────────────────────────────
    const baseYields = TerrainManager.getTerrainYields(tile.terrain);
    if (tile.terrainVariant === 'shield') baseYields.production += 1;

    // ── Resources ───────────────────────────────────────────────────────────
    const resources: string[] = (tile.resources as string[] | undefined) ?? [];
    let resourceHTML = '';
    for (const resource of resources) {
      const emoji = pickResourceEmoji(resource, tile.position.x, tile.position.y);
      const name = this.getResourceDisplayName(resource);
      const bonus = getResourceYieldBonus(resource, tile.terrain);
      const desc = this.getResourceDescription(resource);
      const bonusParts: string[] = [];
      if (bonus.food) bonusParts.push(t('tileInfo.bonusFood', { n: bonus.food }));
      if (bonus.production) bonusParts.push(t('tileInfo.bonusShield', { n: bonus.production }));
      if (bonus.trade) bonusParts.push(t('tileInfo.bonusTrade', { n: bonus.trade }));
      // accumulate bonuses into baseYields for total display below
      baseYields.food += bonus.food;
      baseYields.production += bonus.production;
      baseYields.trade += bonus.trade;

      resourceHTML += `
        <div class="tile-info-resource-block">
          <div class="tile-info-resource-header">
            <span class="tile-info-resource-emoji">${emoji}</span>
            <span class="tile-info-resource-name">${name}</span>
          </div>
          ${bonusParts.length ? `<div class="tile-info-resource-bonus">${bonusParts.join(' &nbsp; ')}</div>` : ''}
          ${desc ? `<div class="tile-info-resource-desc">${desc}</div>` : ''}
        </div>`;
    }

    // ── Improvements ────────────────────────────────────────────────────────
    let improvementHTML = '';
    if (tile.improvements && tile.improvements.length > 0) {
      const labels = (tile.improvements as Array<{ type: string }>).map(imp => {
        const n = getImprovementDisplayName(imp.type);
        return `<span class="tile-info-improvement-tag">${n}</span>`;
      }).join('');
      improvementHTML = `
        <div class="tile-info-row">
          <span class="tile-info-label">${t('tileInfo.improvements')}</span>
          <span class="tile-info-value tile-info-improvements">${labels}</span>
        </div>`;
    }

    // ── Total yields (after resources, before improvements for simplicity) ──
    const yieldHTML = `
      <div class="tile-info-row">
        <span class="tile-info-label">${t('tileInfo.yields')}</span>
        <span class="tile-info-value tile-info-yields">
          <span class="yield-item">🌾 ${baseYields.food}</span>
          <span class="yield-item">🛡️ ${baseYields.production}</span>
          <span class="yield-item">💱 ${baseYields.trade}</span>
        </span>
      </div>`;

    const closeAria = t('tileInfo.closeAria');

    this.dialog.innerHTML = `
      <div class="tile-info-dialog-header">
        <img class="tile-info-terrain-image" src="${imageSrc}" alt="${terrainName}" />
        <div class="tile-info-dialog-title">${terrainName}</div>
        <button class="tile-info-dialog-close" aria-label="${closeAria}">✕</button>
      </div>
      <div class="tile-info-dialog-content">
        <div class="tile-info-row">
          <span class="tile-info-label">${t('tileInfo.position')}</span>
          <span class="tile-info-value">(${position.x}, ${position.y})</span>
        </div>
        ${yieldHTML}
        ${resourceHTML}
        ${improvementHTML}
        <div class="tile-info-description">${terrainDescription}</div>
      </div>
    `;

    const closeBtn = this.dialog.querySelector('.tile-info-dialog-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hide());

    this.backdrop.style.display = 'block';
    this.dialog.style.display = 'block';
  }

  /**
   * Hide the tile info dialog
   */
  public hide(): void {
    this.lastView = null;
    if (this.dialog) {
      this.dialog.style.display = 'none';
    }
    if (this.backdrop) {
      this.backdrop.style.display = 'none';
    }
  }

  /** Rebuild content with current locale if the dialog is visible. */
  public refreshI18nIfOpen(): void {
    if (
      !this.lastView ||
      !this.dialog ||
      this.dialog.style.display !== 'block' ||
      !this.backdrop ||
      this.backdrop.style.display !== 'block'
    ) {
      return;
    }
    this.show(this.lastView.position, this.lastView.tile);
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
      [TerrainType.ARCTIC]: '/src/assets/civwintiles/arctic.png',
      [TerrainType.TUNDRA]: '/src/assets/civwintiles/tundra.png',
    };
    return terrainImages[terrain] || '/src/assets/civwintiles/grassland.png';
  }

  private getTerrainDescription(terrain: string): string {
    const key = `terrain.${terrain}.description`;
    const s = t(key);
    if (s !== key) return s;
    return t('tileInfo.unknownTerrain');
  }

  private getResourceDisplayName(resource: string): string {
    const key = `tileInfo.resourceNames.${resource}`;
    const s = t(key);
    if (s !== key) return s;
    return resource.charAt(0).toUpperCase() + resource.slice(1);
  }

  private getResourceDescription(resource: string): string {
    const key = `tileInfo.resourceDescriptions.${resource}`;
    const s = t(key);
    return s !== key ? s : '';
  }
}
