import type { ProjectionContext, ProjectionStrategy } from '../ProjectionStrategy';

const ORTHO_BASE_TILE_SIZE = 48;

export class OrthoProjection implements ProjectionStrategy {
  readonly mode = 'ortho' as const;

  getTileSize(): number {
    return ORTHO_BASE_TILE_SIZE;
  }

  private tileSize(ctx: ProjectionContext): number {
    return ctx.effectiveTileSize;
  }

  worldToScreen(worldX: number, worldY: number, ctx: ProjectionContext): { x: number; y: number } {
    let deltaX = worldX - ctx.viewport.x;
    if (deltaX >= ctx.mapWidth / 2) {
      deltaX -= ctx.mapWidth;
    } else if (deltaX < -ctx.mapWidth / 2) {
      deltaX += ctx.mapWidth;
    }
    const ts = this.tileSize(ctx);
    return {
      x: Math.round(deltaX * ts),
      y: Math.round((worldY - ctx.viewport.y) * ts),
    };
  }

  screenToWorld(screenX: number, screenY: number, ctx: ProjectionContext): { x: number; y: number } {
    const ts = this.tileSize(ctx);
    const worldX = screenX / ts + ctx.viewport.x;
    const worldY = screenY / ts + ctx.viewport.y;
    const normalizedX = ((worldX % ctx.mapWidth) + ctx.mapWidth) % ctx.mapWidth;
    return { x: Math.floor(normalizedX), y: Math.floor(worldY) };
  }

  isWorldPositionVisible(worldX: number, worldY: number, ctx: ProjectionContext): boolean {
    const { x: sx, y: sy } = this.worldToScreen(worldX, worldY, ctx);
    const ts = this.tileSize(ctx);
    return (
      sx + ts > 0 &&
      sx < ctx.displayWidth &&
      sy + ts > 0 &&
      sy < ctx.displayHeight
    );
  }

  getVisibleTileRange(ctx: ProjectionContext): {
    startX: number;
    endX: number;
    startY: number;
    endY: number;
  } {
    const ts = this.tileSize(ctx);
    const tilesWidth = Math.ceil(ctx.displayWidth / ts) + 1;
    const tilesHeight = Math.ceil(ctx.displayHeight / ts) + 1;
    return {
      startX: Math.floor(ctx.viewport.x),
      endX: Math.floor(ctx.viewport.x) + tilesWidth,
      startY: Math.floor(ctx.viewport.y),
      endY: Math.floor(ctx.viewport.y) + tilesHeight,
    };
  }

  snapViewport(x: number, y: number, ctx: ProjectionContext): { x: number; y: number } {
    const ts = this.tileSize(ctx);
    return {
      x: Math.round(x * ts) / ts,
      y: Math.round(y * ts) / ts,
    };
  }

  clampViewportY(y: number, ctx: ProjectionContext): number {
    const ts = this.tileSize(ctx);
    const maxY = ctx.mapHeight - ctx.displayHeight / ts;
    return Math.max(0, Math.min(Math.max(maxY, 0), y));
  }

  centerOn(worldX: number, worldY: number, ctx: ProjectionContext): { x: number; y: number } {
    const ts = this.tileSize(ctx);
    const tilesWidth = ctx.displayWidth / ts;
    const tilesHeight = ctx.displayHeight / ts;
    return {
      x: worldX - tilesWidth / 2,
      y: worldY - tilesHeight / 2,
    };
  }

  screenDragToViewportDelta(pixelDeltaX: number, pixelDeltaY: number, ctx: ProjectionContext): {
    deltaX: number;
    deltaY: number;
  } {
    const ts = this.tileSize(ctx);
    return {
      deltaX: pixelDeltaX / ts,
      deltaY: pixelDeltaY / ts,
    };
  }
}

export { ORTHO_BASE_TILE_SIZE };
