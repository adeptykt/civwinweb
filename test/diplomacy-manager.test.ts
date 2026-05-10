import { describe, it, expect } from 'vitest';
import { DiplomacyManager, DiplomaticStatus, AIMood } from '../src/game/DiplomacyManager';
import { CivilizationType } from '../src/game/CivilizationDefinitions';
import { Player, GovernmentType } from '../src/types/game';

describe('DiplomacyManager', () => {
  const createMockPlayer = (id: string, civ: CivilizationType, gov: string, gold = 0): Player => {
    return {
      id,
      name: `Player ${id}`,
      civilizationType: civ,
      color: '#fff',
      isHuman: false,
      science: 0,
      gold,
      culture: 0,
      technologies: [],
      government: gov as any,
      taxRate: 40,
      luxuryRate: 10,
      usedCityNames: []
    };
  };

  it('initially has uncontacted status', () => {
    const dm = new DiplomacyManager();
    const rel = dm.getRelationship('p1', 'p2');
    expect(rel.status).toBe(DiplomaticStatus.UNCONTACTED);
  });

  it('can update status to war', () => {
    const dm = new DiplomacyManager();
    dm.updateStatus('p1', 'p2', DiplomaticStatus.WAR);
    const rel = dm.getRelationship('p2', 'p1');
    expect(rel.status).toBe(DiplomaticStatus.WAR);
  });

  it('threat level works based on Civ1 rules', () => {
    const dm = new DiplomacyManager();
    const babylon = createMockPlayer('1', 'babylonian', 'despotism');
    const mongol = createMockPlayer('2', 'mongol', 'despotism');
    const roman = createMockPlayer('3', 'romans', 'despotism');

    expect(dm.getThreatLevel(babylon)).toBe(0);
    expect(dm.getThreatLevel(mongol)).toBe(6);
    expect(dm.getThreatLevel(roman)).toBe(3);
  });

  it('correctly assesses if Senate forces peace/blocks war', () => {
    const dm = new DiplomacyManager();
    const rep = createMockPlayer('1', 'american', 'republic');
    const dem = createMockPlayer('2', 'american', 'democracy');
    const des = createMockPlayer('3', 'american', 'despotism');

    expect(dm.doesSenateForcePeace(rep)).toBe(true);
    expect(dm.doesSenateForcePeace(dem)).toBe(true);
    expect(dm.doesSenateForcePeace(des)).toBe(false);

    expect(dm.doesSenateBlockSneakAttack(rep)).toBe(true);
    expect(dm.doesSenateBlockSneakAttack(des)).toBe(false);
  });

  it('calculates AI mood correctly', () => {
    const dm = new DiplomacyManager();
    const mongol = createMockPlayer('ai1', 'mongol', 'despotism', 100);
    const babylon = createMockPlayer('ai2', 'babylonian', 'despotism', 100);
    const human = createMockPlayer('human', 'romans', 'despotism', 100);

    // Mongol threat 6, AI stronger: effective 6 → Demanding (needs ≥7 for Aggressive)
    expect(dm.calculateAIMood(mongol, human, true, 1)).toBe(AIMood.DEMANDING);
    // Mongol aggressive, AI weaker: threat ≥5 → Hostile
    expect(dm.calculateAIMood(mongol, human, false, 1)).toBe(AIMood.HOSTILE);

    // Babylon threat 0, AI stronger: effective 0 → Cautious
    expect(dm.calculateAIMood(babylon, human, true, 1)).toBe(AIMood.CAUTIOUS);
    // Babylon friendly, AI weaker → Amiable
    expect(dm.calculateAIMood(babylon, human, false, 1)).toBe(AIMood.AMIABLE);
  });
});