/**
 * TerrainImprovementSystem unit tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock TerrainManager before any imports that transitively load it
// (terrain sprites call `new Image()` which doesn't exist in Node)
vi.mock('../src/terrain/index', () => ({
  TerrainManager: {
    initialize: vi.fn(),
    getTerrainYields: vi.fn((type: string) => {
      const yields: Record<string, { food: number; production: number; trade: number }> = {
        grassland: { food: 2, production: 1, trade: 1 },
        plains:    { food: 1, production: 1, trade: 1 },
        desert:    { food: 0, production: 1, trade: 0 },
        forest:    { food: 1, production: 2, trade: 0 },
        hills:     { food: 1, production: 2, trade: 0 },
        mountains: { food: 0, production: 1, trade: 0 },
        river:     { food: 2, production: 0, trade: 1 },
        jungle:    { food: 1, production: 1, trade: 0 },
        ocean:     { food: 1, production: 0, trade: 2 },
      };
      return yields[type] ?? { food: 0, production: 0, trade: 0 };
    }),
  },
}));

// Mock SettingsManager so tests don't rely on singleton state
vi.mock('../src/utils/SettingsManager', () => ({
  SettingsManager: {
    getInstance: vi.fn(() => ({
      getSetting: vi.fn(() => false), // anyTileImprovement = false by default
    })),
  },
}));

import { TerrainImprovementSystem } from '../src/game/TerrainImprovementSystem';
import type { GameState, Unit, Tile } from '../src/types/game';
import { UnitType, TerrainType, ImprovementType, TechnologyType, GamePhase } from '../src/types/game';
import { SettingsManager } from '../src/utils/SettingsManager';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTile(terrain: TerrainType, improvements: ImprovementType[] = []): Tile {
  return {
    position: { x: 0, y: 0 },
    terrain,
    improvements: improvements.map(type => ({ type, completedTurn: 1 })),
  };
}

function makeSettler(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'settler-1',
    type: UnitType.SETTLERS,
    position: { x: 2, y: 2 },
    movementPoints: 1,
    maxMovementPoints: 1,
    health: 100,
    maxHealth: 100,
    playerId: 'player-0',
    experience: 0,
    isVeteran: false,
    fortified: false,
    ...overrides,
  };
}

function makeGameState(
  settler: Unit,
  mapOverrides: Partial<Tile>[][] = [],
  techOverrides: TechnologyType[] = []
): GameState {
  // 5×5 map, all grassland by default
  const worldMap: Tile[][] = Array.from({ length: 5 }, (_, y) =>
    Array.from({ length: 5 }, (_, x) => ({
      position: { x, y },
      terrain: TerrainType.GRASSLAND,
      improvements: [],
    }))
  );

  // Apply any tile overrides
  mapOverrides.forEach((row, y) =>
    row.forEach((tile, x) => {
      if (tile) Object.assign(worldMap[y][x], tile);
    })
  );

  return {
    turn: 5,
    currentPlayer: 'player-0',
    currentPlayerIsHuman: true,
    players: [
      {
        id: 'player-0',
        name: 'Human',
        civilizationType: 'romans' as any,
        color: '#f00',
        isHuman: true,
        science: 0,
        gold: 50,
        culture: 0,
        technologies: techOverrides,
        currentResearchProgress: 0,
        government: 'despotism' as any,
        taxRate: 40,
        luxuryRate: 10,
        usedCityNames: [],
      },
    ],
    worldMap,
    units: [settler],
    cities: [],
    gamePhase: GamePhase.PLAYING,
    score: 0,
    difficulty: 'chieftain',
  };
}

function makeSystem(state: GameState) {
  const emitted: Array<{ event: string; data: any }> = [];
  const removedFromQueue: string[] = [];

  const emit = vi.fn((event: string, data?: any) => emitted.push({ event, data }));
  const removeFromQueue = vi.fn((unitId: string) => removedFromQueue.push(unitId));

  const system = new TerrainImprovementSystem(state, emit, removeFromQueue);
  return { system, emitted, removedFromQueue, emit, removeFromQueue };
}

// ── buildRoad ──────────────────────────────────────────────────────────────

describe('TerrainImprovementSystem.buildRoad', () => {
  let settler: Unit;
  let state: GameState;

  beforeEach(() => {
    settler = makeSettler({ position: { x: 2, y: 2 } });
    state = makeGameState(settler);
  });

  it('starts road building on a valid grassland tile', () => {
    const { system, emitted, removedFromQueue } = makeSystem(state);

    const result = system.buildRoad('settler-1');

    expect(result).toBe(true);
    expect(settler.buildingRoad).toBe(true);
    expect(settler.roadBuildingTurns).toBe(0);
    expect(settler.movementPoints).toBe(0);
    expect(removedFromQueue).toContain('settler-1');
    expect(emitted.find(e => e.event === 'roadBuildingStarted')).toBeDefined();
  });

  it('returns false for a non-settler unit', () => {
    const warrior = makeSettler({ id: 'warrior-1', type: UnitType.MILITIA });
    state.units.push(warrior);

    const { system } = makeSystem(state);
    expect(system.buildRoad('warrior-1')).toBe(false);
  });

  it('returns false when unit does not belong to current player', () => {
    settler.playerId = 'other-player';
    const { system } = makeSystem(state);
    expect(system.buildRoad('settler-1')).toBe(false);
  });

  it('returns false on ocean tiles', () => {
    state.worldMap[2][2].terrain = TerrainType.OCEAN;
    const { system } = makeSystem(state);
    expect(system.buildRoad('settler-1')).toBe(false);
  });

  it('returns false if unit is already building a road', () => {
    settler.buildingRoad = true;
    const { system } = makeSystem(state);
    expect(system.buildRoad('settler-1')).toBe(false);
  });

  it('returns false on river tile without Bridge Building tech', () => {
    state.worldMap[2][2].terrain = TerrainType.RIVER;
    const { system } = makeSystem(state);
    expect(system.buildRoad('settler-1')).toBe(false);
  });

  it('allows road on river tile with Bridge Building tech', () => {
    state.worldMap[2][2].terrain = TerrainType.RIVER;
    state.players[0].technologies = [TechnologyType.BRIDGE_BUILDING];
    const { system } = makeSystem(state);
    expect(system.buildRoad('settler-1')).toBe(true);
  });

  it('returns false if railroad already exists on the tile', () => {
    state.worldMap[2][2].improvements = [{ type: ImprovementType.RAILROAD, completedTurn: 1 }];
    const { system } = makeSystem(state);
    expect(system.buildRoad('settler-1')).toBe(false);
  });

  it('returns false if road exists but player lacks Railroad tech', () => {
    state.worldMap[2][2].improvements = [{ type: ImprovementType.ROAD, completedTurn: 1 }];
    const { system } = makeSystem(state);
    expect(system.buildRoad('settler-1')).toBe(false);
  });

  it('allows upgrading road to railroad when player has Railroad tech', () => {
    state.worldMap[2][2].improvements = [{ type: ImprovementType.ROAD, completedTurn: 1 }];
    state.players[0].technologies = [TechnologyType.RAILROAD];
    const { system } = makeSystem(state);
    expect(system.buildRoad('settler-1')).toBe(true);
  });

  it('cancels active goto order when road building starts', () => {
    settler.gotoDestination = { x: 4, y: 4 };
    const { system, emitted } = makeSystem(state);

    system.buildRoad('settler-1');

    expect(settler.gotoDestination).toBeUndefined();
    expect(emitted.find(e => e.event === 'gotoCancelled')).toBeDefined();
  });

  it('bypasses terrain restrictions when anyTileImprovement is true', () => {
    state.worldMap[2][2].terrain = TerrainType.RIVER;
    vi.mocked(SettingsManager.getInstance).mockReturnValue({
      getSetting: vi.fn(() => true),
    } as any);
    const { system } = makeSystem(state);
    expect(system.buildRoad('settler-1')).toBe(true);
    // Restore default mock
    vi.mocked(SettingsManager.getInstance).mockReturnValue({
      getSetting: vi.fn(() => false),
    } as any);
  });
});

// ── cancelRoadBuilding ─────────────────────────────────────────────────────

describe('TerrainImprovementSystem.cancelRoadBuilding', () => {
  it('clears road building state and emits event', () => {
    const settler = makeSettler({ buildingRoad: true, roadBuildingTurns: 1 });
    const state = makeGameState(settler);
    const { system, emitted } = makeSystem(state);

    expect(system.cancelRoadBuilding('settler-1')).toBe(true);
    expect(settler.buildingRoad).toBe(false);
    expect(settler.roadBuildingTurns).toBe(0);
    expect(emitted.find(e => e.event === 'roadBuildingCancelled')).toBeDefined();
  });

  it('returns false for unknown unit id', () => {
    const state = makeGameState(makeSettler());
    const { system } = makeSystem(state);
    expect(system.cancelRoadBuilding('nonexistent')).toBe(false);
  });

  it('returns true even when unit was not building a road (no-op)', () => {
    const settler = makeSettler({ buildingRoad: false });
    const state = makeGameState(settler);
    const { system } = makeSystem(state);
    expect(system.cancelRoadBuilding('settler-1')).toBe(true);
  });
});

// ── buildIrrigation ────────────────────────────────────────────────────────

describe('TerrainImprovementSystem.buildIrrigation', () => {
  it('builds irrigation on a grassland tile adjacent to a river', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 } });
    const state = makeGameState(settler);
    state.worldMap[2][1].terrain = TerrainType.RIVER; // adjacent west

    const { system, emitted } = makeSystem(state);
    const result = system.buildIrrigation('settler-1');

    expect(result).toBe(true);
    const tile = state.worldMap[2][2];
    expect(tile.improvements?.some(i => i.type === ImprovementType.IRRIGATION)).toBe(true);
    expect(emitted.find(e => e.event === 'terrainImproved')).toBeDefined();
  });

  it('builds irrigation adjacent to ocean', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 } });
    const state = makeGameState(settler);
    state.worldMap[1][2].terrain = TerrainType.OCEAN; // adjacent north

    const { system } = makeSystem(state);
    expect(system.buildIrrigation('settler-1')).toBe(true);
  });

  it('builds irrigation adjacent to an already-irrigated tile (chain irrigation)', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 } });
    const state = makeGameState(settler);
    state.worldMap[2][3].improvements = [{ type: ImprovementType.IRRIGATION, completedTurn: 1 }]; // east neighbor

    const { system } = makeSystem(state);
    expect(system.buildIrrigation('settler-1')).toBe(true);
  });

  it('returns false with no water access on landlocked tile', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 } });
    const state = makeGameState(settler);
    // All neighbors remain grassland — no water source

    const { system } = makeSystem(state);
    expect(system.buildIrrigation('settler-1')).toBe(false);
  });

  it('returns false if irrigation already exists', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 } });
    const state = makeGameState(settler);
    state.worldMap[1][2].terrain = TerrainType.OCEAN;
    state.worldMap[2][2].improvements = [{ type: ImprovementType.IRRIGATION, completedTurn: 1 }];

    const { system } = makeSystem(state);
    expect(system.buildIrrigation('settler-1')).toBe(false);
  });

  it('removes an existing mine when irrigation is placed', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 } });
    const state = makeGameState(settler);
    state.worldMap[1][2].terrain = TerrainType.OCEAN;
    state.worldMap[2][2].improvements = [{ type: ImprovementType.MINE, completedTurn: 1 }];

    const { system } = makeSystem(state);
    system.buildIrrigation('settler-1');

    const tile = state.worldMap[2][2];
    expect(tile.improvements?.some(i => i.type === ImprovementType.MINE)).toBe(false);
    expect(tile.improvements?.some(i => i.type === ImprovementType.IRRIGATION)).toBe(true);
  });

  it('returns false on non-irrigatable terrain (forest)', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 } });
    const state = makeGameState(settler);
    state.worldMap[2][2].terrain = TerrainType.FOREST;
    state.worldMap[1][2].terrain = TerrainType.RIVER;

    const { system } = makeSystem(state);
    expect(system.buildIrrigation('settler-1')).toBe(false);
  });

  it('returns false for a non-settler unit', () => {
    const warrior = makeSettler({ id: 'warrior-1', type: UnitType.MILITIA });
    const state = makeGameState(warrior);
    state.worldMap[1][2].terrain = TerrainType.OCEAN;
    const { system } = makeSystem(state);
    expect(system.buildIrrigation('warrior-1')).toBe(false);
  });
});

// ── buildMine ──────────────────────────────────────────────────────────────

describe('TerrainImprovementSystem.buildMine', () => {
  it('starts mine building on hills', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 } });
    const state = makeGameState(settler);
    state.worldMap[2][2].terrain = TerrainType.HILLS;

    const { system, emitted, removedFromQueue } = makeSystem(state);
    const result = system.buildMine('settler-1');

    expect(result).toBe(true);
    expect(settler.buildingMine).toBe(true);
    expect(settler.mineBuildingTurns).toBe(0);
    expect(settler.movementPoints).toBe(0);
    expect(removedFromQueue).toContain('settler-1');
    expect(emitted.find(e => e.event === 'mineBuildingStarted')).toBeDefined();
  });

  it('starts mine building on mountains', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 } });
    const state = makeGameState(settler);
    state.worldMap[2][2].terrain = TerrainType.MOUNTAINS;

    const { system } = makeSystem(state);
    expect(system.buildMine('settler-1')).toBe(true);
  });

  it('starts mine building on desert', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 } });
    const state = makeGameState(settler);
    state.worldMap[2][2].terrain = TerrainType.DESERT;

    const { system } = makeSystem(state);
    expect(system.buildMine('settler-1')).toBe(true);
  });

  it('returns false on ocean tile', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 } });
    const state = makeGameState(settler);
    state.worldMap[2][2].terrain = TerrainType.OCEAN;

    const { system } = makeSystem(state);
    expect(system.buildMine('settler-1')).toBe(false);
  });

  it('returns false if mine already exists', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 } });
    const state = makeGameState(settler);
    state.worldMap[2][2].terrain = TerrainType.HILLS;
    state.worldMap[2][2].improvements = [{ type: ImprovementType.MINE, completedTurn: 1 }];

    const { system } = makeSystem(state);
    expect(system.buildMine('settler-1')).toBe(false);
  });

  it('returns false if already building a mine', () => {
    const settler = makeSettler({ buildingMine: true });
    const state = makeGameState(settler);
    const { system } = makeSystem(state);
    expect(system.buildMine('settler-1')).toBe(false);
  });

  it('cancels goto order when mine building starts', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 }, gotoDestination: { x: 4, y: 4 } });
    const state = makeGameState(settler);
    state.worldMap[2][2].terrain = TerrainType.HILLS;

    const { system, emitted } = makeSystem(state);
    system.buildMine('settler-1');

    expect(settler.gotoDestination).toBeUndefined();
    expect(emitted.find(e => e.event === 'gotoCancelled')).toBeDefined();
  });

  it('returns false for a non-settler unit', () => {
    const warrior = makeSettler({ id: 'warrior-1', type: UnitType.MILITIA });
    warrior.position = { x: 2, y: 2 };
    const state = makeGameState(warrior);
    state.worldMap[2][2].terrain = TerrainType.HILLS;
    const { system } = makeSystem(state);
    expect(system.buildMine('warrior-1')).toBe(false);
  });
});

// ── cancelMineBuilding ─────────────────────────────────────────────────────

describe('TerrainImprovementSystem.cancelMineBuilding', () => {
  it('clears mine building state and emits event', () => {
    const settler = makeSettler({ buildingMine: true, mineBuildingTurns: 2 });
    const state = makeGameState(settler);
    const { system, emitted } = makeSystem(state);

    expect(system.cancelMineBuilding('settler-1')).toBe(true);
    expect(settler.buildingMine).toBe(false);
    expect(settler.mineBuildingTurns).toBe(0);
    expect(emitted.find(e => e.event === 'mineBuildingCancelled')).toBeDefined();
  });

  it('returns false for unknown unit id', () => {
    const state = makeGameState(makeSettler());
    const { system } = makeSystem(state);
    expect(system.cancelMineBuilding('nonexistent')).toBe(false);
  });

  it('returns false when unit was not building a mine', () => {
    const settler = makeSettler({ buildingMine: false });
    const state = makeGameState(settler);
    const { system } = makeSystem(state);
    expect(system.cancelMineBuilding('settler-1')).toBe(false);
  });
});

// ── buildFortress ──────────────────────────────────────────────────────────

describe('TerrainImprovementSystem.buildFortress', () => {
  it('builds a fortress with Construction tech on grassland', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 } });
    const state = makeGameState(settler, [], [TechnologyType.CONSTRUCTION]);

    const { system, emitted, removedFromQueue } = makeSystem(state);
    const result = system.buildFortress('settler-1');

    expect(result).toBe(true);
    expect(settler.movementPoints).toBe(0);
    expect(removedFromQueue).toContain('settler-1');
    const tile = state.worldMap[2][2];
    expect(tile.improvements?.some(i => i.type === ImprovementType.FORTRESS)).toBe(true);
    expect(emitted.find(e => e.event === 'terrainImproved')).toBeDefined();
  });

  it('returns false without Construction technology', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 } });
    const state = makeGameState(settler, [], []); // no techs

    const { system } = makeSystem(state);
    expect(system.buildFortress('settler-1')).toBe(false);
  });

  it('returns false on ocean tile', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 } });
    const state = makeGameState(settler, [], [TechnologyType.CONSTRUCTION]);
    state.worldMap[2][2].terrain = TerrainType.OCEAN;

    const { system } = makeSystem(state);
    expect(system.buildFortress('settler-1')).toBe(false);
  });

  it('returns false if fortress already exists', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 } });
    const state = makeGameState(settler, [], [TechnologyType.CONSTRUCTION]);
    state.worldMap[2][2].improvements = [{ type: ImprovementType.FORTRESS, completedTurn: 1 }];

    const { system } = makeSystem(state);
    expect(system.buildFortress('settler-1')).toBe(false);
  });

  it('returns false if position is occupied by a city', () => {
    const settler = makeSettler({ position: { x: 2, y: 2 } });
    const state = makeGameState(settler, [], [TechnologyType.CONSTRUCTION]);
    state.cities.push({
      id: 'c1', name: 'Rome', position: { x: 2, y: 2 },
      population: 1, playerId: 'player-0', buildings: [], wonders: [],
      production: null, food: 0, foodStorage: 0, foodStorageCapacity: 20,
      production_points: 0, science: 0, culture: 0,
    });

    const { system } = makeSystem(state);
    expect(system.buildFortress('settler-1')).toBe(false);
  });

  it('returns false for a non-settler unit', () => {
    const warrior = makeSettler({ id: 'warrior-1', type: UnitType.MILITIA });
    const state = makeGameState(warrior, [], [TechnologyType.CONSTRUCTION]);
    const { system } = makeSystem(state);
    expect(system.buildFortress('warrior-1')).toBe(false);
  });
});

// ── getTerrainYieldsWithImprovements ───────────────────────────────────────

describe('TerrainImprovementSystem.getTerrainYieldsWithImprovements', () => {
  it('returns base yields with no improvements', () => {
    const state = makeGameState(makeSettler());
    const { system } = makeSystem(state);

    const yields = system.getTerrainYieldsWithImprovements(2, 2);
    // Grassland base: food 2, production 1, trade 1
    expect(yields.food).toBe(2);
    expect(yields.production).toBe(1);
    expect(yields.trade).toBe(1);
  });

  it('adds +1 food for irrigation', () => {
    const state = makeGameState(makeSettler());
    state.worldMap[2][2].improvements = [{ type: ImprovementType.IRRIGATION, completedTurn: 1 }];
    const { system } = makeSystem(state);

    const yields = system.getTerrainYieldsWithImprovements(2, 2);
    expect(yields.food).toBe(3); // 2 base + 1 irrigation
  });

  it('adds +3 production for mine on hills', () => {
    const state = makeGameState(makeSettler());
    state.worldMap[2][2].terrain = TerrainType.HILLS;
    state.worldMap[2][2].improvements = [{ type: ImprovementType.MINE, completedTurn: 1 }];
    const { system } = makeSystem(state);

    const yields = system.getTerrainYieldsWithImprovements(2, 2);
    expect(yields.production).toBe(5); // 2 base hills + 3 mine
  });

  it('adds +1 production for mine on mountains', () => {
    const state = makeGameState(makeSettler());
    state.worldMap[2][2].terrain = TerrainType.MOUNTAINS;
    state.worldMap[2][2].improvements = [{ type: ImprovementType.MINE, completedTurn: 1 }];
    const { system } = makeSystem(state);

    const yields = system.getTerrainYieldsWithImprovements(2, 2);
    expect(yields.production).toBe(2); // 1 base mountains + 1 mine
  });

  it('adds +1 production for mine on desert', () => {
    const state = makeGameState(makeSettler());
    state.worldMap[2][2].terrain = TerrainType.DESERT;
    state.worldMap[2][2].improvements = [{ type: ImprovementType.MINE, completedTurn: 1 }];
    const { system } = makeSystem(state);

    const yields = system.getTerrainYieldsWithImprovements(2, 2);
    expect(yields.production).toBe(2); // 1 base desert + 1 mine
  });

  it('adds +1 trade for road on grassland', () => {
    const state = makeGameState(makeSettler());
    state.worldMap[2][2].improvements = [{ type: ImprovementType.ROAD, completedTurn: 1 }];
    const { system } = makeSystem(state);

    const yields = system.getTerrainYieldsWithImprovements(2, 2);
    expect(yields.trade).toBe(2); // 1 base grassland + 1 road
  });

  it('adds +1 trade for road on plains', () => {
    const state = makeGameState(makeSettler());
    state.worldMap[2][2].terrain = TerrainType.PLAINS;
    state.worldMap[2][2].improvements = [{ type: ImprovementType.ROAD, completedTurn: 1 }];
    const { system } = makeSystem(state);

    const yields = system.getTerrainYieldsWithImprovements(2, 2);
    expect(yields.trade).toBe(2); // 1 base plains + 1 road
  });

  it('does not add trade for road on forest', () => {
    const state = makeGameState(makeSettler());
    state.worldMap[2][2].terrain = TerrainType.FOREST;
    state.worldMap[2][2].improvements = [{ type: ImprovementType.ROAD, completedTurn: 1 }];
    const { system } = makeSystem(state);

    const yields = system.getTerrainYieldsWithImprovements(2, 2);
    expect(yields.trade).toBe(0); // forest base trade 0, no road bonus
  });

  it('stacks improvements correctly (irrigation + road on grassland)', () => {
    const state = makeGameState(makeSettler());
    state.worldMap[2][2].improvements = [
      { type: ImprovementType.IRRIGATION, completedTurn: 1 },
      { type: ImprovementType.ROAD, completedTurn: 1 },
    ];
    const { system } = makeSystem(state);

    const yields = system.getTerrainYieldsWithImprovements(2, 2);
    expect(yields.food).toBe(3);    // 2 base + 1 irrigation
    expect(yields.trade).toBe(2);   // 1 base + 1 road
  });

  it('returns zeroes for an out-of-bounds tile', () => {
    const state = makeGameState(makeSettler());
    const { system } = makeSystem(state);

    const yields = system.getTerrainYieldsWithImprovements(99, 99);
    expect(yields).toEqual({ food: 0, production: 0, trade: 0 });
  });
});
