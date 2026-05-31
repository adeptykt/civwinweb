import { describe, it, expect } from 'vitest';
import enGame from '../src/locales/en.game.json';
import enUi from '../src/locales/en.json';
import ruUi from '../src/locales/ru.json';
import { CivilizationType } from '../src/game/CivilizationDefinitions.js';
import { UnitType } from '../src/types/game.js';
import { I18nService } from '../src/i18n/I18nService.js';

/** Leaf string keys under an object tree, as dot paths (e.g. cityModal.food). */
function templateLeafKeys(obj: unknown, prefix = ''): Set<string> {
  const out = new Set<string>();
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return out;
  const o = obj as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    const p = prefix ? `${prefix}.${k}` : k;
    const v = o[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const sub of templateLeafKeys(v, p)) out.add(sub);
    } else {
      out.add(p);
    }
  }
  return out;
}

describe('locale catalogs', () => {
  it('en.game civilizations cover every CivilizationType', () => {
    const civs = (enGame as { civilizations: Record<string, Record<string, string>> }).civilizations;
    for (const id of Object.values(CivilizationType)) {
      expect(civs[id], `civilizations.${id}`).toBeDefined();
      expect(typeof civs[id].name).toBe('string');
      expect(typeof civs[id].description).toBe('string');
    }
  });

  it('en.game units cover every UnitType', () => {
    const units = (enGame as { units: Record<string, { name: string }> }).units;
    for (const id of Object.values(UnitType)) {
      expect(units[id], `units.${id}`).toBeDefined();
      expect(typeof units[id].name).toBe('string');
    }
  });

  it('ru UI landing menu keys match en', () => {
    const enL = (enUi as Record<string, unknown>).landing;
    const ruL = (ruUi as Record<string, unknown>).landing;
    expect(enL).toBeDefined();
    expect(ruL).toBeDefined();
    const enKeys = templateLeafKeys(enL, 'landing');
    const ruKeys = templateLeafKeys(ruL, 'landing');
    for (const k of enKeys) {
      expect(ruKeys.has(k), `missing ru ${k}`).toBe(true);
    }
  });

  it('ru UI difficultyScreen keys match en', () => {
    const enD = (enUi as Record<string, unknown>).difficultyScreen;
    const ruD = (ruUi as Record<string, unknown>).difficultyScreen;
    expect(enD).toBeDefined();
    expect(ruD).toBeDefined();
    const enKeys = templateLeafKeys(enD, 'difficultyScreen');
    const ruKeys = templateLeafKeys(ruD, 'difficultyScreen');
    for (const k of enKeys) {
      expect(ruKeys.has(k), `missing ru ${k}`).toBe(true);
    }
  });

  it('Russian locale returns translated tile context menu strings', () => {
    I18nService.getInstance().setLocale('ru', false);
    expect(I18nService.getInstance().t('tileContextMenu.tileInfo')).toBe('О клетке');
    expect(I18nService.getInstance().t('tileContextMenu.moveUnitHere')).toBe('Переместить сюда');
    I18nService.getInstance().setLocale('en', false);
  });

  it('ru UI tile context menu and tile info keys match en', () => {
    for (const section of ['tileContextMenu', 'tileInfo'] as const) {
      const enS = (enUi as Record<string, unknown>)[section];
      const ruS = (ruUi as Record<string, unknown>)[section];
      expect(enS, section).toBeDefined();
      expect(ruS, section).toBeDefined();
      const enKeys = templateLeafKeys(enS, section);
      const ruKeys = templateLeafKeys(ruS, section);
      for (const k of enKeys) {
        expect(ruKeys.has(k), `missing ru ${k}`).toBe(true);
      }
    }
  });

  it('ru UI tribal village encounter keys match en', () => {
    const enT = (enUi as Record<string, unknown>).tribalVillage;
    const ruT = (ruUi as Record<string, unknown>).tribalVillage;
    expect(enT).toBeDefined();
    expect(ruT).toBeDefined();
    const enKeys = templateLeafKeys(enT, 'tribalVillage');
    const ruKeys = templateLeafKeys(ruT, 'tribalVillage');
    for (const k of enKeys) {
      expect(ruKeys.has(k), `missing ru ${k}`).toBe(true);
    }
  });

  it('ru UI new-game setup screens and flow keys match en', () => {
    for (const section of [
      'competitionScreen',
      'tribeScreen',
      'namePromptScreen',
      'newGameFlow',
    ] as const) {
      const enS = (enUi as Record<string, unknown>)[section];
      const ruS = (ruUi as Record<string, unknown>)[section];
      expect(enS, section).toBeDefined();
      expect(ruS, section).toBeDefined();
      const enKeys = templateLeafKeys(enS, section);
      const ruKeys = templateLeafKeys(ruS, section);
      for (const k of enKeys) {
        expect(ruKeys.has(k), `missing ru ${k}`).toBe(true);
      }
    }
  });

  it('ru UI terrainNames, technologyEra, and statusPanel match en leaf keys', () => {
    for (const section of ['terrainNames', 'technologyEra', 'statusPanel'] as const) {
      const enS = (enUi as Record<string, unknown>)[section];
      const ruS = (ruUi as Record<string, unknown>)[section];
      expect(enS, section).toBeDefined();
      expect(ruS, section).toBeDefined();
      const enKeys = templateLeafKeys(enS, section);
      const ruKeys = templateLeafKeys(ruS, section);
      for (const k of enKeys) {
        expect(ruKeys.has(k), `missing ru ${k}`).toBe(true);
      }
    }
  });

  it('ru UI templates contain every en UI template leaf key', () => {
    const enT = (enUi as { templates?: Record<string, unknown> }).templates;
    const ruT = (ruUi as { templates?: Record<string, unknown> }).templates;
    expect(enT).toBeDefined();
    expect(ruT).toBeDefined();
    const enKeys = templateLeafKeys(enT, '');
    const ruKeys = templateLeafKeys(ruT, '');
    for (const k of enKeys) {
      expect(ruKeys.has(k), `missing ru templates.${k}`).toBe(true);
    }
  });

  it('ru diplomacyDialog keys match en', () => {
    const enD = (enUi as Record<string, unknown>).diplomacyDialog;
    const ruD = (ruUi as Record<string, unknown>).diplomacyDialog;
    expect(enD).toBeDefined();
    expect(ruD).toBeDefined();
    const enKeys = templateLeafKeys(enD, 'diplomacyDialog');
    const ruKeys = templateLeafKeys(ruD, 'diplomacyDialog');
    for (const k of enKeys) {
      expect(ruKeys.has(k), `missing ru ${k}`).toBe(true);
    }
  });
});
