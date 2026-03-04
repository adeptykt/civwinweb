import { describe, it, expect } from 'vitest';
import { DiplomacyManager, DiplomaticStatus, AIMood } from '../src/game/DiplomacyManager';
import { CivilizationType } from '../src/game/CivilizationDefinitions';
import { Player, GovernmentType } from '../src/types/game';

describe('DiplomacyManager', () => {
  const createMockPlayer = (id: string, civ: CivilizationType, gov: string): Player => {
    return {
      id,
      name: `Player ${id}`,
      civilizationType: civ,
      color: '#fff',
      isHuman: false,
      science: 0,
      gold: 0,
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
    const mongol = createMockPlayer('ai1', 'mongol', 'despotism');
    const babylon = createMockPlayer('ai2', 'babylonian', 'despotism');
    const human = createMockPlayer('human', 'romans', 'despotism');

    // Mongol (Aggressive), AI is stronger -> Aggressive
    expect(dm.calculateAIMood(mongol, human, true)).toBe(AIMood.AGGRESSIVE);
    // Mongol (Aggressive), AI is weaker (Human stronger) -> Hostile
    expect(dm.calculateAIMood(mongol, human, false)).toBe(AIMood.HOSTILE);

    // Babylon (Friendly), AI is stronger -> Demanding
    expect(dm.calculateAIMood(babylon, human, true)).toBe(AIMood.DEMANDING);
    // Babylon (Friendly), AI is weaker (Human stronger) -> Amiable
    expect(dm.calculateAIMood(babylon, human, false)).toBe(AIMood.AMIABLE);
  });
});