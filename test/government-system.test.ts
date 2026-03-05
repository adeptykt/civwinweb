/**
 * GovernmentSystem unit tests
 */
import { describe, it, expect, vi } from 'vitest';

// TerrainManager uses `new Image()` in Node — must mock before any transitive import
vi.mock('../src/terrain/index', () => ({
  TerrainManager: {
    initialize: vi.fn(),
    getTerrainYields: vi.fn(() => ({ food: 2, production: 1, trade: 1 })),
    clearSpriteCache: vi.fn(),
  },
}));

import { GovernmentSystem } from '../src/game/GovernmentSystem';
import type { GameState, Player } from '../src/types/game';
import { GamePhase, GovernmentType, TechnologyType } from '../src/types/game';

// ── Helpers ────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Caesar',
    civilizationType: 'roman' as any,
    color: '#f00',
    isHuman: true,
    science: 0,
    gold: 100,
    culture: 0,
    technologies: [],
    government: GovernmentType.DESPOTISM,
    taxRate: 40,
    luxuryRate: 10,
    usedCityNames: [],
    ...overrides,
  };
}

function makeGameState(player: Player, overrides: Partial<GameState> = {}): GameState {
  return {
    turn: 1,
    currentPlayer: player.id,
    currentPlayerIsHuman: player.isHuman,
    players: [player],
    worldMap: [],
    units: [],
    cities: [],
    gamePhase: GamePhase.PLAYING,
    score: 0,
    difficulty: 'chieftain',
    ...overrides,
  };
}

function makeSystem(state: GameState) {
  const emitted: { event: string; data?: any }[] = [];
  const emit = (event: string, data?: any) => emitted.push({ event, data });
  const system = new GovernmentSystem(state, emit);
  return { system, emitted };
}

// ── startRevolution ────────────────────────────────────────────────────────

describe('startRevolution', () => {
  it('sets government to ANARCHY and returns true', () => {
    const player = makePlayer({ government: GovernmentType.DESPOTISM });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    const result = system.startRevolution(player.id);

    expect(result).toBe(true);
    expect(player.government).toBe(GovernmentType.ANARCHY);
  });

  it('sets revolutionTurns between 2 and 5', () => {
    const player = makePlayer();
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    system.startRevolution(player.id);

    expect(player.revolutionTurns).toBeGreaterThanOrEqual(2);
    expect(player.revolutionTurns).toBeLessThanOrEqual(5);
  });

  it('emits revolutionStarted with playerId and turnsRemaining', () => {
    const player = makePlayer();
    const state = makeGameState(player);
    const { system, emitted } = makeSystem(state);

    system.startRevolution(player.id);

    expect(emitted).toHaveLength(1);
    expect(emitted[0].event).toBe('revolutionStarted');
    expect(emitted[0].data.playerId).toBe(player.id);
    expect(emitted[0].data.turnsRemaining).toBe(player.revolutionTurns);
  });

  it('returns false if player not found', () => {
    const player = makePlayer();
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    expect(system.startRevolution('nonexistent')).toBe(false);
  });

  it('returns false if game is not in PLAYING phase', () => {
    const player = makePlayer();
    const state = makeGameState(player, { gamePhase: GamePhase.SETUP });
    const { system } = makeSystem(state);

    expect(system.startRevolution(player.id)).toBe(false);
  });

  it('returns false if player is already in ANARCHY', () => {
    const player = makePlayer({ government: GovernmentType.ANARCHY });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    expect(system.startRevolution(player.id)).toBe(false);
  });

  it('does not emit when returning false', () => {
    const player = makePlayer({ government: GovernmentType.ANARCHY });
    const state = makeGameState(player);
    const { system, emitted } = makeSystem(state);

    system.startRevolution(player.id);

    expect(emitted).toHaveLength(0);
  });
});

// ── changeGovernment ──────────────────────────────────────────────────────

describe('changeGovernment', () => {
  it('changes from ANARCHY to DESPOTISM (no tech required)', () => {
    const player = makePlayer({ government: GovernmentType.ANARCHY, revolutionTurns: 3 });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    const result = system.changeGovernment(player.id, GovernmentType.DESPOTISM);

    expect(result).toBe(true);
    expect(player.government).toBe(GovernmentType.DESPOTISM);
    expect(player.revolutionTurns).toBeUndefined();
  });

  it('emits governmentChanged event', () => {
    const player = makePlayer({ government: GovernmentType.ANARCHY });
    const state = makeGameState(player);
    const { system, emitted } = makeSystem(state);

    system.changeGovernment(player.id, GovernmentType.DESPOTISM);

    expect(emitted).toHaveLength(1);
    expect(emitted[0].event).toBe('governmentChanged');
    expect(emitted[0].data).toEqual({ playerId: player.id, newGovernment: GovernmentType.DESPOTISM });
  });

  it('returns false if player is not in ANARCHY', () => {
    const player = makePlayer({ government: GovernmentType.DESPOTISM });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    expect(system.changeGovernment(player.id, GovernmentType.MONARCHY)).toBe(false);
  });

  it('returns false if player lacks the required technology', () => {
    const player = makePlayer({ government: GovernmentType.ANARCHY, technologies: [] });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    // MONARCHY requires TechnologyType.MONARCHY
    expect(system.changeGovernment(player.id, GovernmentType.MONARCHY)).toBe(false);
  });

  it('succeeds when player has the required technology', () => {
    const player = makePlayer({
      government: GovernmentType.ANARCHY,
      technologies: [TechnologyType.MONARCHY],
    });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    expect(system.changeGovernment(player.id, GovernmentType.MONARCHY)).toBe(true);
    expect(player.government).toBe(GovernmentType.MONARCHY);
  });

  it('succeeds for REPUBLIC with THE_REPUBLIC tech', () => {
    const player = makePlayer({
      government: GovernmentType.ANARCHY,
      technologies: [TechnologyType.THE_REPUBLIC],
    });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    expect(system.changeGovernment(player.id, GovernmentType.REPUBLIC)).toBe(true);
  });

  it('succeeds for DEMOCRACY with DEMOCRACY tech', () => {
    const player = makePlayer({
      government: GovernmentType.ANARCHY,
      technologies: [TechnologyType.DEMOCRACY],
    });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    expect(system.changeGovernment(player.id, GovernmentType.DEMOCRACY)).toBe(true);
  });

  it('returns false for unknown player id', () => {
    const player = makePlayer({ government: GovernmentType.ANARCHY });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    expect(system.changeGovernment('nobody', GovernmentType.DESPOTISM)).toBe(false);
  });
});

// ── getAvailableGovernments ───────────────────────────────────────────────

describe('getAvailableGovernments', () => {
  it('returns [DESPOTISM] when player has no technologies', () => {
    const player = makePlayer({ technologies: [] });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    const govs = system.getAvailableGovernments(player.id);

    expect(govs).toContain(GovernmentType.DESPOTISM);
    expect(govs).not.toContain(GovernmentType.MONARCHY);
    expect(govs).not.toContain(GovernmentType.REPUBLIC);
    expect(govs).not.toContain(GovernmentType.DEMOCRACY);
  });

  it('includes MONARCHY when player has MONARCHY technology', () => {
    const player = makePlayer({ technologies: [TechnologyType.MONARCHY] });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    const govs = system.getAvailableGovernments(player.id);

    expect(govs).toContain(GovernmentType.MONARCHY);
  });

  it('includes REPUBLIC when player has THE_REPUBLIC technology', () => {
    const player = makePlayer({ technologies: [TechnologyType.THE_REPUBLIC] });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    expect(system.getAvailableGovernments(player.id)).toContain(GovernmentType.REPUBLIC);
  });

  it('includes DEMOCRACY when player has DEMOCRACY technology', () => {
    const player = makePlayer({ technologies: [TechnologyType.DEMOCRACY] });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    expect(system.getAvailableGovernments(player.id)).toContain(GovernmentType.DEMOCRACY);
  });

  it('includes all governments when player has all required technologies', () => {
    const player = makePlayer({
      technologies: [
        TechnologyType.MONARCHY,
        TechnologyType.COMMUNISM,
        TechnologyType.THE_REPUBLIC,
        TechnologyType.DEMOCRACY,
      ],
    });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    const govs = system.getAvailableGovernments(player.id);

    expect(govs).toContain(GovernmentType.DESPOTISM);
    expect(govs).toContain(GovernmentType.MONARCHY);
    expect(govs).toContain(GovernmentType.COMMUNISM);
    expect(govs).toContain(GovernmentType.REPUBLIC);
    expect(govs).toContain(GovernmentType.DEMOCRACY);
    // ANARCHY should never appear (it's not a choosable government)
    expect(govs).not.toContain(GovernmentType.ANARCHY);
  });

  it('returns empty array for unknown player', () => {
    const player = makePlayer();
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    expect(system.getAvailableGovernments('unknown')).toEqual([]);
  });
});

// ── getGovernmentEffects ──────────────────────────────────────────────────

describe('getGovernmentEffects', () => {
  it('returns effects for the current government', () => {
    const player = makePlayer({ government: GovernmentType.DESPOTISM });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    const effects = system.getGovernmentEffects(player.id);

    expect(effects).not.toBeNull();
    expect(effects!.productionPenalty).toBe(true); // Despotism has production penalty
    expect(effects!.taxCollection).toBe(true);
  });

  it('returns anarchy effects (no taxCollection)', () => {
    const player = makePlayer({ government: GovernmentType.ANARCHY });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    const effects = system.getGovernmentEffects(player.id);

    expect(effects!.taxCollection).toBe(false);
    expect(effects!.scientificResearch).toBe(false);
  });

  it('returns republic effects (tradeBonus, unhappiness from military)', () => {
    const player = makePlayer({
      government: GovernmentType.REPUBLIC,
      technologies: [TechnologyType.THE_REPUBLIC],
    });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    const effects = system.getGovernmentEffects(player.id);

    expect(effects!.tradeBonus).toBe(true);
    expect(effects!.unhappinessFromMilitary).toBe(1);
    expect(effects!.martialLawAvailable).toBe(false);
  });

  it('returns democracy effects (no corruption)', () => {
    const player = makePlayer({ government: GovernmentType.DEMOCRACY });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    const effects = system.getGovernmentEffects(player.id);

    expect(effects!.corruptionType).toBe('none');
    expect(effects!.unhappinessFromMilitary).toBe(2);
  });

  it('returns null for unknown player', () => {
    const player = makePlayer();
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    expect(system.getGovernmentEffects('nobody')).toBeNull();
  });
});

// ── setTaxRates ───────────────────────────────────────────────────────────

describe('setTaxRates', () => {
  it('sets tax and luxury rates and returns true', () => {
    const player = makePlayer({ taxRate: 40, luxuryRate: 10 });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    const result = system.setTaxRates(player.id, 50, 20);

    expect(result).toBe(true);
    expect(player.taxRate).toBe(50);
    expect(player.luxuryRate).toBe(20);
  });

  it('snaps rates to nearest 10', () => {
    const player = makePlayer();
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    system.setTaxRates(player.id, 37, 13);

    expect(player.taxRate).toBe(40);
    expect(player.luxuryRate).toBe(10);
  });

  it('clamps taxRate to 100', () => {
    const player = makePlayer();
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    system.setTaxRates(player.id, 150, 0);

    expect(player.taxRate).toBe(100);
    expect(player.luxuryRate).toBe(0);
  });

  it('clamps luxuryRate so that taxRate + luxuryRate <= 100', () => {
    const player = makePlayer();
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    system.setTaxRates(player.id, 70, 50); // 70 + 50 = 120 — luxury capped at 30

    expect(player.taxRate).toBe(70);
    expect(player.luxuryRate).toBe(30);
  });

  it('allows 0, 0 (all science)', () => {
    const player = makePlayer();
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    system.setTaxRates(player.id, 0, 0);

    expect(player.taxRate).toBe(0);
    expect(player.luxuryRate).toBe(0);
  });

  it('returns false for unknown player', () => {
    const player = makePlayer();
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    expect(system.setTaxRates('nobody', 50, 20)).toBe(false);
  });
});

// ── getTaxRates ───────────────────────────────────────────────────────────

describe('getTaxRates', () => {
  it('returns scienceRate as 100 - taxRate - luxuryRate', () => {
    const player = makePlayer({ taxRate: 40, luxuryRate: 10 });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    const rates = system.getTaxRates(player.id);

    expect(rates).not.toBeNull();
    expect(rates!.taxRate).toBe(40);
    expect(rates!.luxuryRate).toBe(10);
    expect(rates!.scienceRate).toBe(50);
  });

  it('returns all zeroes during ANARCHY (no tax collection)', () => {
    const player = makePlayer({ government: GovernmentType.ANARCHY, taxRate: 40, luxuryRate: 10 });
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    const rates = system.getTaxRates(player.id);

    expect(rates).toEqual({ taxRate: 0, luxuryRate: 0, scienceRate: 0 });
  });

  it('returns null for unknown player', () => {
    const player = makePlayer();
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    expect(system.getTaxRates('nobody')).toBeNull();
  });
});

// ── getPlayerTaxSummary ───────────────────────────────────────────────────

describe('getPlayerTaxSummary', () => {
  it('returns a summary object with expected keys', () => {
    const player = makePlayer();
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    const summary = system.getPlayerTaxSummary(player.id);

    expect(summary).not.toBeNull();
    expect(summary).toHaveProperty('goldIncome');
    expect(summary).toHaveProperty('scienceIncome');
    expect(summary).toHaveProperty('luxuryIncome');
    expect(summary).toHaveProperty('netGoldIncome');
    expect(summary).toHaveProperty('maintenanceCost');
    expect(summary).toHaveProperty('unitSupportCost');
  });

  it('returns zero income for a player with no cities', () => {
    const player = makePlayer();
    const state = makeGameState(player, { cities: [] });
    const { system } = makeSystem(state);

    const summary = system.getPlayerTaxSummary(player.id);

    expect(summary!.goldIncome).toBe(0);
    expect(summary!.scienceIncome).toBe(0);
  });

  it('returns null for unknown player', () => {
    const player = makePlayer();
    const state = makeGameState(player);
    const { system } = makeSystem(state);

    expect(system.getPlayerTaxSummary('nobody')).toBeNull();
  });
});
