import { describe, it, expect, beforeEach } from 'vitest';
import {
  getMapDimensionsForRenderMode,
  getNewGameMapDimensions,
  ISO_MAP_HEIGHT,
  ISO_MAP_WIDTH,
  ORTHO_MAP_HEIGHT,
  ORTHO_MAP_WIDTH,
} from '../src/game/MapDimensions';
import { SettingsManager } from '../src/utils/SettingsManager';

describe('MapDimensions', () => {
  beforeEach(() => {
    SettingsManager.getInstance().setSetting('renderMode', 'ortho');
  });

  it('uses 80×50 for ortho mode', () => {
    expect(getMapDimensionsForRenderMode('ortho')).toEqual({
      width: ORTHO_MAP_WIDTH,
      height: ORTHO_MAP_HEIGHT,
    });
  });

  it('uses 79×119 for iso mode', () => {
    expect(getMapDimensionsForRenderMode('iso')).toEqual({
      width: ISO_MAP_WIDTH,
      height: ISO_MAP_HEIGHT,
    });
  });

  it('getNewGameMapDimensions follows renderMode setting', () => {
    SettingsManager.getInstance().setSetting('renderMode', 'iso');
    expect(getNewGameMapDimensions()).toEqual({ width: 79, height: 119 });
  });
});
