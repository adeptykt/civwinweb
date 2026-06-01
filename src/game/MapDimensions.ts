import type { RenderMode } from '../utils/SettingsManager';
import { SettingsManager } from '../utils/SettingsManager';

/** Civ I default map size (ortho mode). */
export const ORTHO_MAP_WIDTH = 80;
export const ORTHO_MAP_HEIGHT = 50;

/** Civ II-style isometric map size (odd width for even-r wrap seam). */
export const ISO_MAP_WIDTH = 79;
export const ISO_MAP_HEIGHT = 119;

export function getMapDimensionsForRenderMode(
  renderMode: RenderMode
): { width: number; height: number } {
  return renderMode === 'iso'
    ? { width: ISO_MAP_WIDTH, height: ISO_MAP_HEIGHT }
    : { width: ORTHO_MAP_WIDTH, height: ORTHO_MAP_HEIGHT };
}

/** Map size used when starting a new game (follows current renderMode setting). */
export function getNewGameMapDimensions(): { width: number; height: number } {
  return getMapDimensionsForRenderMode(SettingsManager.getInstance().getSetting('renderMode'));
}
