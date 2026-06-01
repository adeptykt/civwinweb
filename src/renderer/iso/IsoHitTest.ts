import { ISO_HALF_H, ISO_HALF_W } from './IsoConfig';

/** True when (localX, localY) is inside a diamond anchored at top vertex (0, 0). */
export function pointInTopAnchoredDiamond(
  localX: number,
  localY: number,
  halfW: number = ISO_HALF_W,
  halfH: number = ISO_HALF_H
): boolean {
  if (localY < 0 || localY > halfH * 2) {
    return false;
  }
  const maxDx = halfW * (1 - Math.abs(localY - halfH) / halfH);
  return Math.abs(localX) <= maxDx + 1e-6;
}
