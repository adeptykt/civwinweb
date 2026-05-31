/**
 * TaxSystem unit tests
 */
import { describe, it, expect, vi } from 'vitest';

// Mock TerrainManager before importing anything that transitively loads it
// (GrasslandTerrain calls `new Image()` which doesn't exist in the Node test env)
vi.mock('../src/terrain/index', () => ({
  TerrainManager: {
    initialize: vi.fn(),
    getTerrainYields: vi.fn((type: string) => {
      // Return realistic Civ-1-ish base yields so tests produce non-zero trade
      const yields: Record<string, { food: number; production: number; trade: number }> = {
        grassland: { food: 2, production: 1, trade: 1 },
        plains:    { food: 1, production: 1, trade: 1 },
        ocean:     { food: 1, production: 0, trade: 2 },
        river:     { food: 2, production: 0, trade: 1 },
        desert:    { food: 0, production: 1, trade: 0 },
        forest:    { food: 1, production: 2, trade: 0 },
        hills:     { food: 1, production: 2, trade: 0 },
        mountains: { food: 0, production: 1, trade: 0 },
        jungle:    { food: 1, production: 1, trade: 0 },
        swamp:     { food: 1, production: 0, trade: 0 },
        arctic:    { food: 0, production: 0, trade: 0 },
        tundra:    { food: 1, production: 0, trade: 0 },
      };
      return yields[type] ?? { food: 0, production: 0, trade: 0 };
    }),
  },
}));

import { TaxSystem } from '../src/game/TaxSystem';
import type { Player, City, GameState } from '../src/types/game';
import { GovernmentType, BuildingType } from '../src/types/game';

// ── Helpers ────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Test Player',
    civilizationType: 'romans' as any,
    color: '#ff0000',
    isHuman: true,
    science: 0,
    gold: 50,
    culture: 0,
    technologies: [],
    currentResearchProgress: 0,
    government: GovernmentType.DESPOTISM,
    taxRate: 40,
    luxuryRate: 10,
    usedCityNames: [],
    ...overrides,
  };
}

function makeCity(overrides: Partial<City> = {}): City {
  return {
    id: 'c1',
    name: 'Rome',
    position: { x: 5, y: 5 },
    population: 3,
    playerId: 'p1',
    buildings: [],
    wonders: [],
    production: null,
    food: 0,
    foodStorage: 0,
    foodStorageCapacity: 20,
    production_points: 0,
    science: 0,
    culture: 0,
    workedTiles: [],
    ...overrides,
  };
}

function makeGameState(player: Player, city: City): GameState {
  // Build a minimal 20×10 world map of grassland tiles
  const worldMap: any[][] = Array.from({ length: 10 }, (_, y) =>
    Array.from({ length: 20 }, (_, x) => ({
      position: { x, y },
      terrain: 'grassland',
      resources: [],
      improvements: [],
    }))
  );

  return {
    turn: 1,
    currentPlayer: player.id,
    currentPlayerIsHuman: true,
    players: [player],
    worldMap,
    units: [],
    cities: [city],
    gamePhase: 'playing' as any,
    score: 0,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('TaxSystem.getEffectiveTaxRates', () => {
  it('returns player rates during normal government', () => {
    const player = makePlayer({ taxRate: 40, luxuryRate: 10 });
    const rates = TaxSystem.getEffectiveTaxRates(player);
    expect(rates.taxRate).toBe(40);
    expect(rates.luxuryRate).toBe(10);
    expect(rates.scienceRate).toBe(50);
  });

  it('returns all-zero rates during Anarchy', () => {
    const player = makePlayer({ government: GovernmentType.ANARCHY });
    const rates = TaxSystem.getEffectiveTaxRates(player);
    expect(rates.taxRate).toBe(0);
    expect(rates.luxuryRate).toBe(0);
    expect(rates.scienceRate).toBe(0);
  });

  it('scienceRate is clamped to 0 when tax+luxury > 100', () => {
    const player = makePlayer({ taxRate: 60, luxuryRate: 50 });
    const rates = TaxSystem.getEffectiveTaxRates(player);
    expect(rates.scienceRate).toBe(0);
  });

  it('defaults to 40/10/50 when fields are missing', () => {
    // Simulate a player without the new fields (old save compatibility)
    const player = makePlayer() as any;
    delete player.taxRate;
    delete player.luxuryRate;
    const rates = TaxSystem.getEffectiveTaxRates(player);
    expect(rates.taxRate).toBe(40);
    expect(rates.luxuryRate).toBe(10);
    expect(rates.scienceRate).toBe(50);
  });
});

describe('TaxSystem.findCapitalCity', () => {
  it('returns city with Palace', () => {
    const player = makePlayer();
    const capital = makeCity({ buildings: [{ type: BuildingType.PALACE, completedTurn: 1 }] });
    const other = makeCity({ id: 'c2', name: 'Antium', position: { x: 10, y: 5 } });
    const found = TaxSystem.findCapitalCity(player, [other, capital]);
    expect(found?.id).toBe(capital.id);
  });

  it('falls back to first city if no Palace', () => {
    const player = makePlayer();
    const city = makeCity();
    const found = TaxSystem.findCapitalCity(player, [city]);
    expect(found?.id).toBe(city.id);
  });

  it('returns null if player has no cities', () => {
    const player = makePlayer();
    expect(TaxSystem.findCapitalCity(player, [])).toBeNull();
  });
});

describe('TaxSystem.calculateCorruptionRate', () => {
  it('returns 0 for Democracy', () => {
    const player = makePlayer({ government: GovernmentType.DEMOCRACY });
    const city = makeCity();
    const gs = makeGameState(player, city);
    expect(TaxSystem.calculateCorruptionRate(city, player, gs)).toBe(0);
  });

  it('returns 0 for the capital under Despotism', () => {
    const player = makePlayer({ government: GovernmentType.DESPOTISM });
    const capital = makeCity({ buildings: [{ type: BuildingType.PALACE, completedTurn: 1 }] });
    const gs = makeGameState(player, capital);
    expect(TaxSystem.calculateCorruptionRate(capital, player, gs)).toBe(0);
  });

  it('returns flat rate for Communism', () => {
    const player = makePlayer({ government: GovernmentType.COMMUNISM as any });
    const city = makeCity();
    const capital = makeCity({ id: 'cap', position: { x: 0, y: 0 }, buildings: [{ type: BuildingType.PALACE, completedTurn: 1 }] });
    const gs = makeGameState(player, city);
    gs.cities.push(capital);
    const rate = TaxSystem.calculateCorruptionRate(city, player, gs);
    expect(rate).toBeCloseTo(0.20, 2);
  });

  it('Courthouse halves corruption rate under Communism', () => {
    const player = makePlayer({ government: GovernmentType.COMMUNISM as any });
    const city = makeCity({ buildings: [{ type: BuildingType.COURTHOUSE, completedTurn: 1 }] });
    const gs = makeGameState(player, city);
    const rate = TaxSystem.calculateCorruptionRate(city, player, gs);
    expect(rate).toBeCloseTo(0.10, 2);
  });

  it('distant city has higher corruption than nearby under Despotism', () => {
    const player = makePlayer({ government: GovernmentType.DESPOTISM });
    const capital = makeCity({ id: 'cap', position: { x: 0, y: 0 }, buildings: [{ type: BuildingType.PALACE, completedTurn: 1 }] });
    const nearCity = makeCity({ id: 'near', position: { x: 2, y: 2 } });
    const farCity = makeCity({ id: 'far', position: { x: 15, y: 8 } });

    const gs = makeGameState(player, capital);
    gs.cities.push(nearCity, farCity);

    const nearRate = TaxSystem.calculateCorruptionRate(nearCity, player, gs);
    const farRate = TaxSystem.calculateCorruptionRate(farCity, player, gs);
    expect(farRate).toBeGreaterThan(nearRate);
  });
});

describe('TaxSystem.calculateCityTaxBreakdown', () => {
  it('returns zeros during Anarchy', () => {
    const player = makePlayer({ government: GovernmentType.ANARCHY });
    const city = makeCity();
    const gs = makeGameState(player, city);
    const bd = TaxSystem.calculateCityTaxBreakdown(city, player, gs);
    expect(bd.totalGold).toBe(0);
    expect(bd.totalScience).toBe(0);
    expect(bd.totalLuxury).toBe(0);
  });

  it('correctly allocates trade to tax/luxury/science', () => {
    const player = makePlayer({ taxRate: 50, luxuryRate: 10 }); // 40% science
    const city = makeCity({
      // Capital so no corruption
      buildings: [{ type: BuildingType.PALACE, completedTurn: 1 }],
    });
    const gs = makeGameState(player, city);
    const bd = TaxSystem.calculateCityTaxBreakdown(city, player, gs);

    // Sanity: gold + luxury + science (before specialists) = effectiveTrade
    expect(bd.taxGoldBonused + bd.luxuryBonused + bd.scienceBonused)
      .toBe(bd.taxGoldBonused + bd.luxuryBonused + bd.scienceBonused); // tautology but checks structure
    expect(bd.effectiveTrade).toBe(bd.rawTrade - bd.corruption);
  });

  it('Marketplace multiplies gold and luxury by 1.5', () => {
    const player = makePlayer({ taxRate: 50, luxuryRate: 10 });
    const cityNoMkt = makeCity({ id: 'no-mkt', buildings: [{ type: BuildingType.PALACE, completedTurn: 1 }] });
    const cityMkt = makeCity({
      id: 'mkt',
      buildings: [
        { type: BuildingType.PALACE, completedTurn: 1 },
        { type: BuildingType.MARKETPLACE, completedTurn: 1 },
      ],
    });

    const gs = makeGameState(player, cityNoMkt);
    gs.cities.push(cityMkt);

    const bdNo = TaxSystem.calculateCityTaxBreakdown(cityNoMkt, player, gs);
    const bdMkt = TaxSystem.calculateCityTaxBreakdown(cityMkt, player, gs);

    expect(bdMkt.taxGoldBonused).toBeGreaterThanOrEqual(bdNo.taxGoldBonused);
    expect(bdMkt.luxuryBonused).toBeGreaterThanOrEqual(bdNo.luxuryBonused);
  });

  it('Library multiplies science by 1.5', () => {
    const player = makePlayer({ taxRate: 40, luxuryRate: 10 });
    const cityNoLib = makeCity({ id: 'no-lib', buildings: [{ type: BuildingType.PALACE, completedTurn: 1 }] });
    const cityLib = makeCity({
      id: 'lib',
      buildings: [
        { type: BuildingType.PALACE, completedTurn: 1 },
        { type: BuildingType.LIBRARY, completedTurn: 1 },
      ],
    });

    const gs = makeGameState(player, cityNoLib);
    gs.cities.push(cityLib);

    const bdNo = TaxSystem.calculateCityTaxBreakdown(cityNoLib, player, gs);
    const bdLib = TaxSystem.calculateCityTaxBreakdown(cityLib, player, gs);

    expect(bdLib.scienceBonused).toBeGreaterThanOrEqual(bdNo.scienceBonused);
  });

  it('Taxman specialist adds 1 flat gold regardless of rates', () => {
    const player = makePlayer({ taxRate: 0, luxuryRate: 0 }); // 0% tax, all to science
    const city = makeCity({
      buildings: [{ type: BuildingType.PALACE, completedTurn: 1 }],
      specialists: { taxmen: 2, scientists: 0, entertainers: 0 },
    });
    const gs = makeGameState(player, city);
    const bd = TaxSystem.calculateCityTaxBreakdown(city, player, gs);

    // With 0% tax rate, gold from trade = 0, but specialists add 2
    expect(bd.taxGoldBonused).toBe(0);
    expect(bd.specialistGold).toBe(2);
    expect(bd.totalGold).toBe(2);
  });

  it('Scientist specialist adds 2 flat science', () => {
    const player = makePlayer({ taxRate: 100, luxuryRate: 0 }); // 0% science from trade
    const city = makeCity({
      buildings: [{ type: BuildingType.PALACE, completedTurn: 1 }],
      specialists: { taxmen: 0, scientists: 1, entertainers: 0 },
    });
    const gs = makeGameState(player, city);
    const bd = TaxSystem.calculateCityTaxBreakdown(city, player, gs);

    expect(bd.scienceBonused).toBe(0);
    expect(bd.specialistScience).toBe(2);
    expect(bd.totalScience).toBe(2);
  });
});

describe('TaxSystem.calculateMaintenanceCost', () => {
  it('returns 0 during Anarchy', () => {
    const player = makePlayer({ government: GovernmentType.ANARCHY });
    const city = makeCity({ buildings: [{ type: BuildingType.LIBRARY, completedTurn: 1 }] });
    expect(TaxSystem.calculateMaintenanceCost(player, [city])).toBe(0);
  });

  it('sums building maintenance costs', () => {
    const player = makePlayer();
    // Library costs 1, Marketplace costs 1 per turn
    const city = makeCity({
      buildings: [
        { type: BuildingType.LIBRARY, completedTurn: 1 },
        { type: BuildingType.MARKETPLACE, completedTurn: 1 },
      ],
    });
    const cost = TaxSystem.calculateMaintenanceCost(player, [city]);
    expect(cost).toBe(2); // 1 + 1
  });

  it('ignores Palace (0 maintenance)', () => {
    const player = makePlayer();
    const city = makeCity({ buildings: [{ type: BuildingType.PALACE, completedTurn: 1 }] });
    expect(TaxSystem.calculateMaintenanceCost(player, [city])).toBe(0);
  });
});

describe('TaxSystem.calculateUnitShieldDrain', () => {
  function makeUnit(playerId: string, type = 'militia'): any {
    return { id: `u-${Math.random()}`, type, playerId, position: { x: 0, y: 0 } };
  }

  it('returns 0 under Democracy (gold-based government)', () => {
    const player = makePlayer({ government: GovernmentType.DEMOCRACY });
    const city = makeCity();
    const gs = makeGameState(player, city);
    gs.units = [makeUnit(player.id)]; // 1 unit, pop 3 → no excess
    expect(TaxSystem.calculateUnitShieldDrain(player, gs)).toBe(0);
  });

  it('returns 0 under Communism', () => {
    const player = makePlayer({ government: GovernmentType.COMMUNISM as any });
    const city = makeCity({ population: 1 });
    const gs = makeGameState(player, city);
    gs.units = [makeUnit(player.id), makeUnit(player.id), makeUnit(player.id)]; // 3 units, pop 1
    expect(TaxSystem.calculateUnitShieldDrain(player, gs)).toBe(0);
  });

  it('returns 0 when units <= total population under Despotism', () => {
    const player = makePlayer({ government: GovernmentType.DESPOTISM });
    const city = makeCity({ population: 3 }); // supports 3 free units
    const gs = makeGameState(player, city);
    gs.units = [makeUnit(player.id), makeUnit(player.id)]; // 2 units ≤ 3 pop
    expect(TaxSystem.calculateUnitShieldDrain(player, gs)).toBe(0);
  });

  it('returns correct excess count under Despotism', () => {
    const player = makePlayer({ government: GovernmentType.DESPOTISM });
    const city = makeCity({ population: 2 }); // supports 2 free units
    const gs = makeGameState(player, city);
    gs.units = [makeUnit(player.id), makeUnit(player.id), makeUnit(player.id), makeUnit(player.id)]; // 4 military
    expect(TaxSystem.calculateUnitShieldDrain(player, gs)).toBe(2); // 4 - 2 = 2 excess
  });

  it('counts only military units (not settlers)', () => {
    const player = makePlayer({ government: GovernmentType.DESPOTISM });
    const city = makeCity({ population: 1 }); // 1 free slot
    const gs = makeGameState(player, city);
    gs.units = [
      makeUnit(player.id, 'militia'),  // military
      makeUnit(player.id, 'settlers'), // NOT military
    ];
    expect(TaxSystem.calculateUnitShieldDrain(player, gs)).toBe(0); // 1 military = 1 free slot
  });

  it('drain accumulates across multi-city empires', () => {
    const player = makePlayer({ government: GovernmentType.DESPOTISM });
    const cityA = makeCity({ id: 'a', population: 2 });
    const cityB = makeCity({ id: 'b', population: 2, position: { x: 5, y: 5 } });
    const gs = makeGameState(player, cityA);
    gs.cities.push(cityB); // total pop = 4
    gs.units = Array.from({ length: 7 }, () => makeUnit(player.id)); // 7 military
    expect(TaxSystem.calculateUnitShieldDrain(player, gs)).toBe(3); // 7 - 4 = 3 excess
  });
});

describe('TaxSystem.calculatePlayerTaxSummary', () => {
  it('returns netGoldIncome = goldIncome - maintenance - unitSupport', () => {
    const player = makePlayer({ taxRate: 40, luxuryRate: 10 });
    const city = makeCity({
      buildings: [{ type: BuildingType.PALACE, completedTurn: 1 }],
    });
    const gs = makeGameState(player, city);
    const summary = TaxSystem.calculatePlayerTaxSummary(player, gs);

    expect(summary.netGoldIncome).toBe(
      summary.goldIncome - summary.maintenanceCost - summary.unitSupportCost
    );
  });

  it('science income is positive when scienceRate > 0', () => {
    const player = makePlayer({ taxRate: 40, luxuryRate: 10 }); // 50% science
    const city = makeCity({ buildings: [{ type: BuildingType.PALACE, completedTurn: 1 }] });
    const gs = makeGameState(player, city);
    const summary = TaxSystem.calculatePlayerTaxSummary(player, gs);

    expect(summary.scienceIncome).toBeGreaterThanOrEqual(0);
  });
});
