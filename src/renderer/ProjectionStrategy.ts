import type { Viewport } from './Renderer';

export type RenderMode = 'ortho' | 'iso';

export interface ProjectionContext {
  viewport: Viewport;
  canvas: HTMLCanvasElement;
  mapWidth: number;
  mapHeight: number;
  /** CSS pixel width of the drawable area (after DPR scaling on the 2D context). */
  displayWidth: number;
  /** CSS pixel height of the drawable area. */
  displayHeight: number;
  /** Ortho: base tile size × zoom; iso: fixed diamond width. */
  effectiveTileSize: number;
}

/** World tile ↔ screen coordinate projection (ortho or isometric). */
export interface ProjectionStrategy {
  readonly mode: RenderMode;
  /** Logical tile size used by legacy ortho code paths (48 for ortho, iso tile width for iso). */
  getTileSize(): number;
  worldToScreen(worldX: number, worldY: number, ctx: ProjectionContext): { x: number; y: number };
  screenToWorld(screenX: number, screenY: number, ctx: ProjectionContext): { x: number; y: number };
  isWorldPositionVisible(worldX: number, worldY: number, ctx: ProjectionContext): boolean;
  getVisibleTileRange(ctx: ProjectionContext): {
    startX: number;
    endX: number;
    startY: number;
    endY: number;
  };
  snapViewport(x: number, y: number, ctx: ProjectionContext): { x: number; y: number };
  clampViewportY(y: number, ctx: ProjectionContext): number;
  centerOn(worldX: number, worldY: number, ctx: ProjectionContext): { x: number; y: number };
  /** Convert screen-space drag (pixels) to viewport tile deltas. */
  screenDragToViewportDelta(
    pixelDeltaX: number,
    pixelDeltaY: number,
    ctx: ProjectionContext
  ): { deltaX: number; deltaY: number };
}
