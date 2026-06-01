import type { ProjectionContext, ProjectionStrategy } from '../ProjectionStrategy';
import {
  ISO_HALF_H,
  ISO_HALF_W,
  ISO_TILE_WIDTH,
  centerViewportOnTile,
  clampViewportY,
  getVisibleTileRange,
  isTileVisibleOnScreen,
  screenDragToViewportDelta,
  screenToTile,
  tileToScreen,
} from './IsoCoordinateSystem';

export class IsoProjection implements ProjectionStrategy {
  readonly mode = 'iso' as const;

  getTileSize(): number {
    return ISO_TILE_WIDTH;
  }

  worldToScreen(worldX: number, worldY: number, ctx: ProjectionContext): { x: number; y: number } {
    return tileToScreen(worldX, worldY, ctx.viewport, ctx.mapWidth, ISO_HALF_W, ISO_HALF_H);
  }

  screenToWorld(screenX: number, screenY: number, ctx: ProjectionContext): { x: number; y: number } {
    return screenToTile(
      screenX,
      screenY,
      ctx.viewport,
      ctx.mapWidth,
      ctx.mapHeight,
      ISO_HALF_W,
      ISO_HALF_H
    );
  }

  isWorldPositionVisible(worldX: number, worldY: number, ctx: ProjectionContext): boolean {
    return isTileVisibleOnScreen(
      worldX,
      worldY,
      ctx.viewport,
      ctx.mapWidth,
      ctx.displayWidth,
      ctx.displayHeight,
      ISO_HALF_W,
      ISO_HALF_H
    );
  }

  getVisibleTileRange(ctx: ProjectionContext): {
    startX: number;
    endX: number;
    startY: number;
    endY: number;
  } {
    return getVisibleTileRange(
      ctx.viewport,
      ctx.mapWidth,
      ctx.mapHeight,
      ctx.displayWidth,
      ctx.displayHeight,
      ISO_HALF_W,
      ISO_HALF_H
    );
  }

  snapViewport(x: number, y: number, _ctx: ProjectionContext): { x: number; y: number } {
    return { x, y };
  }

  clampViewportY(y: number, ctx: ProjectionContext): number {
    return clampViewportY(y, ctx.mapHeight, ctx.displayHeight, ISO_HALF_H);
  }

  centerOn(worldX: number, worldY: number, ctx: ProjectionContext): { x: number; y: number } {
    return centerViewportOnTile(
      worldX,
      worldY,
      ctx.displayWidth,
      ctx.displayHeight,
      ISO_HALF_W,
      ISO_HALF_H
    );
  }

  screenDragToViewportDelta(
    pixelDeltaX: number,
    pixelDeltaY: number,
    _ctx: ProjectionContext
  ): { deltaX: number; deltaY: number } {
    return screenDragToViewportDelta(pixelDeltaX, pixelDeltaY, ISO_HALF_W, ISO_HALF_H);
  }
}
