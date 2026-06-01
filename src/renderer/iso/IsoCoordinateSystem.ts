import { ISO_HALF_H, ISO_HALF_W, ISO_TILE_HEIGHT, ISO_TILE_WIDTH } from './IsoConfig';
import { pointInTopAnchoredDiamond } from './IsoHitTest';

export interface IsoViewport {
  x: number;
  y: number;
}

export interface IsoMapSize {
  width: number;
  height: number;
}

export interface IsoScreenPoint {
  x: number;
  y: number;
}

export interface IsoTilePoint {
  x: number;
  y: number;
}

/** Shortest wrapped delta along X for a horizontally wrapping map. */
export function wrappedDeltaX(deltaX: number, mapWidth: number): number {
  if (deltaX >= mapWidth / 2) {
    return deltaX - mapWidth;
  }
  if (deltaX < -mapWidth / 2) {
    return deltaX + mapWidth;
  }
  return deltaX;
}

/** Even-r stagger: odd rows shift half a tile right. */
function rowStaggerOffset(tileY: number, viewportY: number, halfW: number): number {
  return ((tileY & 1) - (Math.floor(viewportY) & 1)) * halfW;
}

export function tileToScreen(
  tileX: number,
  tileY: number,
  viewport: IsoViewport,
  mapWidth: number,
  halfW: number = ISO_HALF_W,
  halfH: number = ISO_HALF_H
): IsoScreenPoint {
  const dx = wrappedDeltaX(tileX - viewport.x, mapWidth);
  const dy = tileY - viewport.y;
  return {
    x: Math.round(dx * halfW * 2 + rowStaggerOffset(tileY, viewport.y, halfW)),
    y: Math.round(dy * halfH),
  };
}

/** Fractional tile coords relative to viewport origin. */
export function screenToTileFloat(
  screenX: number,
  screenY: number,
  viewport: IsoViewport,
  halfW: number = ISO_HALF_W,
  halfH: number = ISO_HALF_H
): IsoTilePoint {
  const dy = screenY / halfH;
  const ty = viewport.y + dy;
  const par = rowStaggerOffset(Math.floor(ty), viewport.y, halfW);
  const dx = (screenX - par) / (halfW * 2);
  return { x: viewport.x + dx, y: ty };
}

export function normalizeTileX(tileX: number, mapWidth: number): number {
  return ((tileX % mapWidth) + mapWidth) % mapWidth;
}

export function screenToTile(
  screenX: number,
  screenY: number,
  viewport: IsoViewport,
  mapWidth: number,
  mapHeight: number,
  halfW: number = ISO_HALF_W,
  halfH: number = ISO_HALF_H
): IsoTilePoint {
  const float = screenToTileFloat(screenX, screenY, viewport, halfW, halfH);
  const baseX = Math.floor(float.x);
  const baseY = Math.floor(float.y);

  let best: IsoTilePoint | null = null;
  let bestDist = Infinity;

  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const tx = baseX + ox;
      const ty = baseY + oy;
      if (ty < 0 || ty >= mapHeight) {
        continue;
      }
      const top = tileToScreen(tx, ty, viewport, mapWidth, halfW, halfH);
      const localX = screenX - top.x;
      const localY = screenY - top.y;
      if (!pointInTopAnchoredDiamond(localX, localY, halfW, halfH)) {
        continue;
      }
      const dist = localX * localX + (localY - halfH) * (localY - halfH);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x: normalizeTileX(tx, mapWidth), y: ty };
      }
    }
  }

  if (best) {
    return best;
  }

  return {
    x: normalizeTileX(baseX, mapWidth),
    y: Math.max(0, Math.min(mapHeight - 1, baseY)),
  };
}

export function getTileDiamondBounds(
  tileX: number,
  tileY: number,
  viewport: IsoViewport,
  mapWidth: number,
  halfW: number = ISO_HALF_W,
  halfH: number = ISO_HALF_H
): { left: number; top: number; right: number; bottom: number } {
  const top = tileToScreen(tileX, tileY, viewport, mapWidth, halfW, halfH);
  return {
    left: top.x - halfW,
    top: top.y,
    right: top.x + halfW,
    bottom: top.y + halfH * 2,
  };
}

export function isTileVisibleOnScreen(
  tileX: number,
  tileY: number,
  viewport: IsoViewport,
  mapWidth: number,
  canvasWidth: number,
  canvasHeight: number,
  halfW: number = ISO_HALF_W,
  halfH: number = ISO_HALF_H
): boolean {
  const b = getTileDiamondBounds(tileX, tileY, viewport, mapWidth, halfW, halfH);
  return b.right > 0 && b.left < canvasWidth && b.bottom > 0 && b.top < canvasHeight;
}

export function getVisibleTileRange(
  viewport: IsoViewport,
  _mapWidth: number,
  mapHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  halfW: number = ISO_HALF_W,
  halfH: number = ISO_HALF_H
): { startX: number; endX: number; startY: number; endY: number } {
  const corners = [
    screenToTileFloat(0, 0, viewport, halfW, halfH),
    screenToTileFloat(canvasWidth, 0, viewport, halfW, halfH),
    screenToTileFloat(0, canvasHeight, viewport, halfW, halfH),
    screenToTileFloat(canvasWidth, canvasHeight, viewport, halfW, halfH),
  ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y);
  }

  const pad = 3;
  return {
    startX: Math.floor(minX) - pad,
    endX: Math.ceil(maxX) + pad,
    startY: Math.max(0, Math.floor(minY) - pad),
    endY: Math.min(mapHeight - 1, Math.ceil(maxY) + pad),
  };
}

export function centerViewportOnTile(
  worldX: number,
  worldY: number,
  canvasWidth: number,
  canvasHeight: number,
  halfW: number = ISO_HALF_W,
  halfH: number = ISO_HALF_H
): IsoViewport {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const dy = (cy - halfH) / halfH;
  const vy = worldY - dy;
  const par = rowStaggerOffset(worldY, vy, halfW);
  const dx = (cx - par) / (halfW * 2);
  return { x: worldX - dx, y: vy };
}

export function clampViewportY(
  y: number,
  mapHeight: number,
  canvasHeight: number,
  halfH: number = ISO_HALF_H
): number {
  const rowStride = halfH;
  const diamondH = halfH * 2;
  const visibleScrollRows = Math.max(0, (canvasHeight - diamondH) / rowStride);
  const maxY = Math.max(0, mapHeight - 1 - visibleScrollRows);
  return Math.max(0, Math.min(maxY, y));
}

/** Inverse of screen drag: content follows pointer (matches ortho pan sign convention). */
export function screenDragToViewportDelta(
  pixelDeltaX: number,
  pixelDeltaY: number,
  halfW: number = ISO_HALF_W,
  halfH: number = ISO_HALF_H
): { deltaX: number; deltaY: number } {
  const tileW = halfW * 2;
  return {
    deltaY: pixelDeltaY / halfH,
    deltaX: pixelDeltaX / tileW,
  };
}

export function getIsoSortKey(tileX: number, tileY: number): number {
  return tileX + tileY;
}

export { ISO_TILE_WIDTH, ISO_TILE_HEIGHT, ISO_HALF_W, ISO_HALF_H };
