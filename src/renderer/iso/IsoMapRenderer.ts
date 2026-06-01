import { TerrainType, Tile, VisibilityState } from '../../types/game';
import type { Renderer } from '../Renderer';
import { ISO_HALF_H, ISO_HALF_W } from './IsoConfig';
import { getIsoSortKey, tileToScreen } from './IsoCoordinateSystem';
import { getIsoEdgeCoastMask } from '../../game/map/IsoMapTopology';
import { pointInTopAnchoredDiamond } from './IsoHitTest';
import { canvasUiFont } from '../../utils/fonts.js';

const TERRAIN_DEBUG_COLORS: Partial<Record<TerrainType, string>> = {
  [TerrainType.GRASSLAND]: '#4a8f3c',
  [TerrainType.PLAINS]: '#c4a35a',
  [TerrainType.DESERT]: '#d4b86a',
  [TerrainType.FOREST]: '#2d5a27',
  [TerrainType.HILLS]: '#8b7355',
  [TerrainType.MOUNTAINS]: '#9a9a9a',
  [TerrainType.OCEAN]: '#2b6cb0',
  [TerrainType.RIVER]: '#3b82c4',
  [TerrainType.JUNGLE]: '#1f6b32',
  [TerrainType.SWAMP]: '#4a6741',
  [TerrainType.ARCTIC]: '#e8f4ff',
  [TerrainType.TUNDRA]: '#b8c4b0',
};

interface VisibleIsoTile {
  x: number;
  y: number;
  sortKey: number;
  tile: Tile;
  visibility: VisibilityState;
}

export class IsoMapRenderer {
  private visibleTileBuffer: VisibleIsoTile[] = [];

  /** Debug isometric map: colored diamonds sorted back-to-front. */
  renderDebugMap(
    renderer: Renderer,
    worldMap: Tile[][],
    visibilityForTile: (x: number, y: number) => VisibilityState,
    showCoordinates: boolean
  ): void {
    const ctx = renderer.getProjectionContext();
    const mapWidth = worldMap[0]?.length ?? 80;
    const mapHeight = worldMap.length ?? 50;
    const range = renderer.getVisibleTileRange();
    const canvasCtx = renderer.getContext();

    this.visibleTileBuffer.length = 0;

    for (let y = range.startY; y <= range.endY; y++) {
      for (let x = range.startX; x <= range.endX; x++) {
        const wrappedX = ((x % mapWidth) + mapWidth) % mapWidth;
        if (y < 0 || y >= mapHeight) {
          continue;
        }
        const visibility = visibilityForTile(wrappedX, y);
        if (visibility === VisibilityState.UNSEEN) {
          this.visibleTileBuffer.push({
            x: wrappedX,
            y,
            sortKey: getIsoSortKey(wrappedX, y),
            tile: worldMap[y][wrappedX],
            visibility,
          });
          continue;
        }
        this.visibleTileBuffer.push({
          x: wrappedX,
          y,
          sortKey: getIsoSortKey(wrappedX, y),
          tile: worldMap[y][wrappedX],
          visibility,
        });
      }
    }

    this.visibleTileBuffer.sort((a, b) => a.sortKey - b.sortKey || a.x - b.x);

    for (const entry of this.visibleTileBuffer) {
      const top = tileToScreen(entry.x, entry.y, ctx.viewport, mapWidth, ISO_HALF_W, ISO_HALF_H);
      if (entry.visibility === VisibilityState.UNSEEN) {
        this.drawDiamond(canvasCtx, top.x, top.y, '#000000');
        continue;
      }

      const fill = TERRAIN_DEBUG_COLORS[entry.tile.terrain] ?? '#666666';
      this.drawDiamond(canvasCtx, top.x, top.y, fill);

      const coastMask = getIsoEdgeCoastMask(worldMap, entry.x, entry.y, mapWidth, mapHeight);
      if (coastMask !== 0) {
        this.drawCoastEdges(canvasCtx, top.x, top.y, coastMask);
      }

      this.strokeDiamond(canvasCtx, top.x, top.y, 'rgba(0,0,0,0.25)');

      if (entry.visibility === VisibilityState.EXPLORED) {
        this.drawDiamond(canvasCtx, top.x, top.y, 'rgba(0,0,0,0.5)');
      }

      if (showCoordinates) {
        canvasCtx.fillStyle = '#ffffff';
        canvasCtx.font = canvasUiFont(9);
        canvasCtx.textAlign = 'center';
        canvasCtx.textBaseline = 'middle';
        canvasCtx.fillText(`${entry.x},${entry.y}`, top.x, top.y + ISO_HALF_H);
      }
    }
  }

  drawDiamond(
    ctx: CanvasRenderingContext2D,
    topX: number,
    topY: number,
    fillStyle: string
  ): void {
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(topX + ISO_HALF_W, topY + ISO_HALF_H);
    ctx.lineTo(topX, topY + ISO_HALF_H * 2);
    ctx.lineTo(topX - ISO_HALF_W, topY + ISO_HALF_H);
    ctx.closePath();
    ctx.fill();
  }

  private strokeDiamond(
    ctx: CanvasRenderingContext2D,
    topX: number,
    topY: number,
    strokeStyle: string
  ): void {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(topX + ISO_HALF_W, topY + ISO_HALF_H);
    ctx.lineTo(topX, topY + ISO_HALF_H * 2);
    ctx.lineTo(topX - ISO_HALF_W, topY + ISO_HALF_H);
    ctx.closePath();
    ctx.stroke();
  }

  /** Highlight diamond edges that border land/ocean (Civ II style shores). */
  private drawCoastEdges(
    ctx: CanvasRenderingContext2D,
    topX: number,
    topY: number,
    mask: number
  ): void {
    ctx.strokeStyle = 'rgba(220, 240, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (mask & 1) {
      ctx.moveTo(topX - ISO_HALF_W, topY + ISO_HALF_H);
      ctx.lineTo(topX, topY);
    }
    if (mask & 2) {
      ctx.moveTo(topX, topY);
      ctx.lineTo(topX + ISO_HALF_W, topY + ISO_HALF_H);
    }
    if (mask & 4) {
      ctx.moveTo(topX + ISO_HALF_W, topY + ISO_HALF_H);
      ctx.lineTo(topX, topY + ISO_HALF_H * 2);
    }
    if (mask & 8) {
      ctx.moveTo(topX, topY + ISO_HALF_H * 2);
      ctx.lineTo(topX - ISO_HALF_W, topY + ISO_HALF_H);
    }
    ctx.stroke();
  }

  /** Draw iso grid overlay (diamond edges). */
  renderGrid(renderer: Renderer, mapWidth: number): void {
    const ctx = renderer.getProjectionContext();
    const range = renderer.getVisibleTileRange();
    const canvasCtx = renderer.getContext();

    for (let y = range.startY; y <= range.endY; y++) {
      for (let x = range.startX; x <= range.endX; x++) {
        const wrappedX = ((x % mapWidth) + mapWidth) % mapWidth;
        const top = tileToScreen(wrappedX, y, ctx.viewport, mapWidth, ISO_HALF_W, ISO_HALF_H);
        this.strokeDiamond(canvasCtx, top.x, top.y, 'rgba(255,255,255,0.15)');
      }
    }
  }
}

export { pointInTopAnchoredDiamond };
