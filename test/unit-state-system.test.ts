/**
 * UnitStateSystem unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// TerrainManager uses `new Image()` in Node — must mock before any transitive import
vi.mock('../src/terrain/index', () => ({
  TerrainManager: {
    initialize: vi.fn(),
    getTerrainYields: vi.fn(() => ({ food: 2, production: 1, trade: 1 })),
    clearSpriteCache: vi.fn(),
  },
}));

// SettingsManager is a singleton that reads from localStorage
vi.mock('../src/utils/SettingsManager', () => ({
  SettingsManager: {
    getInstance: vi.fn(() => ({
      getSetting: vi.fn(() => false),
      getSettings: vi.fn(() => ({ logGameEvents: false })),
    })),
  },
}));

// DebugSystem is a singleton — stub civ2 enhancements to a known value
vi.mock('../src/utils/DebugSystem', () => ({
  DebugSystem: {
    getInstance: vi.fn(() => ({
      isCiv2EnhancementsEnabled: vi.fn(() => false),
      logGameEvent: vi.fn(),
    })),
  },
}));

import { UnitStateSystem } from '../src/game/UnitStateSystem';
import type { GameState, Player, Unit, Tile } from '../src/types/game';
import {
  GamePhase,
  GovernmentType,
  UnitType,
  TerrainType,
  TechnologyType,
  UnitCategory,
} from '../src/types/game';

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

function makeTile(terrain: TerrainType, hasCity = false): Tile {
  const tile: Tile = {
    position: { x: 0, y: 0 },
    terrain,
    improvements: [],
  };
  if (hasCity) {
    (tile as any).city = { id: 'city-1', name: 'Rome' };
  }
  return tile;
}

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'unit-1',
    type: UnitType.MILITIA,
    position: { x: 2, y: 2 },
    movementPoints: 1,
    maxMovementPoints: 1,
    health: 100,
    maxHealth: 100,
    playerId: 'p1',
    fortified: false,
    fortifying: false,
    fortificationTurns: 0,
    sleeping: false,
    ...overrides,
  };
}

/** Build a minimal 5×5 worldMap with a grassland tile at (2,2) */
function makeWorldMap(terrain: TerrainType = TerrainType.GRASSLAND, hasCity = false): Tile[][] {
  const map: Tile[][] = [];
  for (let y = 0; y < 5; y++) {
    map[y] = [];
    for (let x = 0; x < 5; x++) {
      map[y][x] = makeTile(
        y === 2 && x === 2 ? terrain : TerrainType.GRASSLAND,
        y === 2 && x === 2 ? hasCity : false,
      );
    }
  }
  return map;
}

function makeGameState(
  unit: Unit,
  player: Player = makePlayer(),
  mapTerrain = TerrainType.GRASSLAND,
  hasCity = false,
): GameState {
  return {
    turn: 1,
    currentPlayer: player.id,
    currentPlayerIsHuman: true,
    players: [player],
    worldMap: makeWorldMap(mapTerrain, hasCity),
    units: [unit],
    cities: [],
    gamePhase: GamePhase.PLAYING,
    score: 0,
    difficulty: 'chieftain',
  };
}

function makeSystem(state: GameState) {
  const emitted: { event: string; data?: any }[] = [];
  const removedFromQueue: string[] = [];
  const activatedInQueue: Unit[] = [];

  const system = new UnitStateSystem(
    state,
    (event, data) => emitted.push({ event, data }),
    (unitId) => removedFromQueue.push(unitId),
    (unit) => activatedInQueue.push(unit),
  );

  return { system, emitted, removedFromQueue, activatedInQueue };
}

// ── fortifyUnit ───────────────────────────────────────────────────────────

describe('fortifyUnit', () => {
  it('instantly fortifies a MILITIA on grassland (1-turn terrain)', () => {
    const unit = makeUnit({ type: UnitType.MILITIA, fortificationTurns: 0 });
    const state = makeGameState(unit, makePlayer(), TerrainType.GRASSLAND);
    const { system } = makeSystem(state);

    const result = system.fortifyUnit(unit.id);

    expect(result).toBe(true);
    expect(unit.fortified).toBe(true);
    expect(unit.fortifying).toBe(false);
    expect(unit.fortificationTurns).toBe(1);
    expect(unit.movementPoints).toBe(0);
  });

  it('starts fortifying (turn 1 of 2) on forest terrain', () => {
    const unit = makeUnit({ type: UnitType.MILITIA, fortificationTurns: 0 });
    const state = makeGameState(unit, makePlayer(), TerrainType.FOREST);
    const { system } = makeSystem(state);

    system.fortifyUnit(unit.id);

    expect(unit.fortifying).toBe(true);
    expect(unit.fortified).toBe(false);
    expect(unit.fortificationTurns).toBe(1);
  });

  it('completes fortification on second call on forest terrain', () => {
    const unit = makeUnit({ type: UnitType.MILITIA, fortificationTurns: 1, fortifying: true });
    const state = makeGameState(unit, makePlayer(), TerrainType.FOREST);
    const { system } = makeSystem(state);

    system.fortifyUnit(unit.id);

    expect(unit.fortified).toBe(true);
    expect(unit.fortifying).toBe(false);
    expect(unit.fortificationTurns).toBe(2);
  });

  it('instantly fortifies when unit is in a city regardless of terrain', () => {
    const unit = makeUnit({ type: UnitType.MILITIA, fortificationTurns: 0 });
    const state = makeGameState(unit, makePlayer(), TerrainType.FOREST, true); // city on forest
    const { system } = makeSystem(state);

    system.fortifyUnit(unit.id);

    expect(unit.fortified).toBe(true);
    expect(unit.fortificationTurns).toBe(1);
  });

  it('emits unitFortified event', () => {
    const unit = makeUnit({ type: UnitType.MILITIA });
    const state = makeGameState(unit);
    const { system, emitted } = makeSystem(state);

    system.fortifyUnit(unit.id);

    expect(emitted[0].event).toBe('unitFortified');
    expect(emitted[0].data).toBe(unit);
  });

  it('removes unit from queue', () => {
    const unit = makeUnit({ type: UnitType.MILITIA });
    const state = makeGameState(unit);
    const { system, removedFromQueue } = makeSystem(state);

    system.fortifyUnit(unit.id);

    expect(removedFromQueue).toContain(unit.id);
  });

  it('returns false for non-fortifiable unit (SETTLERS)', () => {
    const unit = makeUnit({ type: UnitType.SETTLERS });
    const state = makeGameState(unit);
    const { system } = makeSystem(state);

    expect(system.fortifyUnit(unit.id)).toBe(false);
  });

  it('returns false for unknown unit id', () => {
    const unit = makeUnit();
    const state = makeGameState(unit);
    const { system } = makeSystem(state);

    expect(system.fortifyUnit('nonexistent')).toBe(false);
  });

  it('returns false when tile is missing from world map', () => {
    const unit = makeUnit({ type: UnitType.MILITIA, position: { x: 99, y: 99 } });
    const state = makeGameState(unit);
    const { system } = makeSystem(state);

    expect(system.fortifyUnit(unit.id)).toBe(false);
  });

  it('fortifies instantly on desert (1-turn terrain)', () => {
    const unit = makeUnit({ type: UnitType.MILITIA });
    const state = makeGameState(unit, makePlayer(), TerrainType.DESERT);
    const { system } = makeSystem(state);

    system.fortifyUnit(unit.id);

    expect(unit.fortified).toBe(true);
    expect(unit.fortificationTurns).toBe(1);
  });

  it('takes 2 turns on hills terrain', () => {
    const unit = makeUnit({ type: UnitType.MILITIA, fortificationTurns: 0 });
    const state = makeGameState(unit, makePlayer(), TerrainType.HILLS);
    const { system } = makeSystem(state);

    system.fortifyUnit(unit.id);
    expect(unit.fortified).toBe(false);
    expect(unit.fortifying).toBe(true);

    system.fortifyUnit(unit.id);
    expect(unit.fortified).toBe(true);
  });
});

// ── wakeUnit ──────────────────────────────────────────────────────────────

describe('wakeUnit', () => {
  it('clears fortified flags', () => {
    const unit = makeUnit({ fortified: true, fortifying: false, fortificationTurns: 2 });
    const state = makeGameState(unit);
    const { system } = makeSystem(state);

    expect(system.wakeUnit(unit.id)).toBe(true);
    expect(unit.fortified).toBe(false);
    expect(unit.fortificationTurns).toBe(0);
  });

  it('emits unitWoken event', () => {
    const unit = makeUnit({ fortified: true });
    const state = makeGameState(unit);
    const { system, emitted } = makeSystem(state);

    system.wakeUnit(unit.id);

    expect(emitted[0].event).toBe('unitWoken');
  });

  it('returns false for unknown unit', () => {
    const unit = makeUnit();
    const state = makeGameState(unit);
    const { system } = makeSystem(state);

    expect(system.wakeUnit('nobody')).toBe(false);
  });
});

// ── wakeAndActivateUnit ───────────────────────────────────────────────────

describe('wakeAndActivateUnit', () => {
  it('wakes the unit and triggers activateUnitInQueue', () => {
    const unit = makeUnit({ fortified: true, fortificationTurns: 2, movementPoints: 0 });
    const state = makeGameState(unit);
    const { system, activatedInQueue } = makeSystem(state);

    const result = system.wakeAndActivateUnit(unit.id);

    expect(result).toBe(true);
    expect(unit.fortified).toBe(false);
    expect(activatedInQueue).toContain(unit);
  });

  it('restores movement points when unit has none', () => {
    const unit = makeUnit({ type: UnitType.MILITIA, movementPoints: 0 });
    const state = makeGameState(unit);
    const { system } = makeSystem(state);

    system.wakeAndActivateUnit(unit.id);

    expect(unit.movementPoints).toBeGreaterThan(0);
  });

  it('does not change movement points when unit still has some', () => {
    const unit = makeUnit({ type: UnitType.MILITIA, movementPoints: 1 });
    const state = makeGameState(unit);
    const { system } = makeSystem(state);

    system.wakeAndActivateUnit(unit.id);

    expect(unit.movementPoints).toBe(1);
  });

  it('emits unitActivated event', () => {
    const unit = makeUnit({ fortified: true });
    const state = makeGameState(unit);
    const { system, emitted } = makeSystem(state);

    system.wakeAndActivateUnit(unit.id);

    const activatedEvent = emitted.find(e => e.event === 'unitActivated');
    expect(activatedEvent).toBeTruthy();
  });

  it('returns false if unit belongs to different player', () => {
    const unit = makeUnit({ playerId: 'p2' });
    const state = makeGameState(unit); // currentPlayer = 'p1'
    const { system } = makeSystem(state);

    expect(system.wakeAndActivateUnit(unit.id)).toBe(false);
  });

  it('returns false for unknown unit', () => {
    const unit = makeUnit();
    const state = makeGameState(unit);
    const { system } = makeSystem(state);

    expect(system.wakeAndActivateUnit('nobody')).toBe(false);
  });
});

// ── sleepUnit ─────────────────────────────────────────────────────────────

describe('sleepUnit', () => {
  it('puts a unit to sleep and zeroes movement', () => {
    const unit = makeUnit({ type: UnitType.MILITIA, sleeping: false, movementPoints: 1 });
    const state = makeGameState(unit);
    const { system } = makeSystem(state);

    const result = system.sleepUnit(unit.id);

    expect(result).toBe(true);
    expect(unit.sleeping).toBe(true);
    expect(unit.movementPoints).toBe(0);
  });

  it('removes unit from queue', () => {
    const unit = makeUnit({ type: UnitType.MILITIA });
    const state = makeGameState(unit);
    const { system, removedFromQueue } = makeSystem(state);

    system.sleepUnit(unit.id);

    expect(removedFromQueue).toContain(unit.id);
  });

  it('emits unitSlept event', () => {
    const unit = makeUnit({ type: UnitType.MILITIA });
    const state = makeGameState(unit);
    const { system, emitted } = makeSystem(state);

    system.sleepUnit(unit.id);

    expect(emitted[0].event).toBe('unitSlept');
  });

  it('returns false for unknown unit', () => {
    const unit = makeUnit();
    const state = makeGameState(unit);
    const { system } = makeSystem(state);

    expect(system.sleepUnit('nobody')).toBe(false);
  });
});

// ── wakeUpUnit ────────────────────────────────────────────────────────────

describe('wakeUpUnit', () => {
  it('wakes a sleeping unit', () => {
    const unit = makeUnit({ sleeping: true });
    const state = makeGameState(unit);
    const { system } = makeSystem(state);

    const result = system.wakeUpUnit(unit.id);

    expect(result).toBe(true);
    expect(unit.sleeping).toBe(false);
  });

  it('emits unitWokeUp event', () => {
    const unit = makeUnit({ sleeping: true });
    const state = makeGameState(unit);
    const { system, emitted } = makeSystem(state);

    system.wakeUpUnit(unit.id);

    expect(emitted[0].event).toBe('unitWokeUp');
  });

  it('returns false if unit is not sleeping', () => {
    const unit = makeUnit({ sleeping: false });
    const state = makeGameState(unit);
    const { system } = makeSystem(state);

    expect(system.wakeUpUnit(unit.id)).toBe(false);
  });

  it('returns false for unknown unit', () => {
    const unit = makeUnit({ sleeping: true });
    const state = makeGameState(unit);
    const { system } = makeSystem(state);

    expect(system.wakeUpUnit('nobody')).toBe(false);
  });
});

// ── wakeUpAndActivateUnit ─────────────────────────────────────────────────

describe('wakeUpAndActivateUnit', () => {
  it('wakes a sleeping unit and activates in queue', () => {
    const unit = makeUnit({ type: UnitType.MILITIA, sleeping: true, movementPoints: 0 });
    const state = makeGameState(unit);
    const { system, activatedInQueue } = makeSystem(state);

    const result = system.wakeUpAndActivateUnit(unit.id);

    expect(result).toBe(true);
    expect(unit.sleeping).toBe(false);
    expect(unit.movementPoints).toBeGreaterThan(0);
    expect(activatedInQueue).toContain(unit);
  });

  it('emits unitActivated event', () => {
    const unit = makeUnit({ sleeping: true });
    const state = makeGameState(unit);
    const { system, emitted } = makeSystem(state);

    system.wakeUpAndActivateUnit(unit.id);

    expect(emitted.some(e => e.event === 'unitActivated')).toBe(true);
  });

  it('returns false if unit belongs to a different player', () => {
    const unit = makeUnit({ sleeping: true, playerId: 'p2' });
    const state = makeGameState(unit);
    const { system } = makeSystem(state);

    expect(system.wakeUpAndActivateUnit(unit.id)).toBe(false);
  });

  it('returns false for unknown unit', () => {
    const unit = makeUnit({ sleeping: true });
    const state = makeGameState(unit);
    const { system } = makeSystem(state);

    expect(system.wakeUpAndActivateUnit('nobody')).toBe(false);
  });
});

// ── createUnit ────────────────────────────────────────────────────────────

describe('createUnit', () => {
  it('creates a unit and adds it to gameState.units', () => {
    const player = makePlayer({ technologies: [] });
    const state: GameState = {
      turn: 1,
      currentPlayer: player.id,
      currentPlayerIsHuman: true,
      players: [player],
      worldMap: [],
      units: [],
      cities: [],
      gamePhase: GamePhase.PLAYING,
      score: 0,
      difficulty: 'chieftain',
    };
    const unit = makeUnit();
    const { system } = makeSystem({ ...state });
    const created = system.createUnit(UnitType.MILITIA, { x: 1, y: 1 }, player.id);

    expect(created).not.toBeNull();
    expect(created!.type).toBe(UnitType.MILITIA);
    expect(created!.playerId).toBe(player.id);
  });

  it('emits unitCreated event', () => {
    const player = makePlayer({ technologies: [] });
    const state: GameState = {
      turn: 1, currentPlayer: player.id, currentPlayerIsHuman: true,
      players: [player], worldMap: [], units: [], cities: [],
      gamePhase: GamePhase.PLAYING, score: 0, difficulty: 'chieftain',
    };
    const { system, emitted } = makeSystem(state);

    system.createUnit(UnitType.MILITIA, { x: 0, y: 0 }, player.id);

    expect(emitted[0].event).toBe('unitCreated');
  });

  it('returns null when player lacks required technology', () => {
    const player = makePlayer({ technologies: [] });
    const state: GameState = {
      turn: 1, currentPlayer: player.id, currentPlayerIsHuman: true,
      players: [player], worldMap: [], units: [], cities: [],
      gamePhase: GamePhase.PLAYING, score: 0, difficulty: 'chieftain',
    };
    const { system } = makeSystem(state);

    // PHALANX requires BRONZE_WORKING
    const result = system.createUnit(UnitType.PHALANX, { x: 0, y: 0 }, player.id);

    expect(result).toBeNull();
  });

  it('succeeds when player has required technology', () => {
    const player = makePlayer({ technologies: [TechnologyType.BRONZE_WORKING] });
    const state: GameState = {
      turn: 1, currentPlayer: player.id, currentPlayerIsHuman: true,
      players: [player], worldMap: [], units: [], cities: [],
      gamePhase: GamePhase.PLAYING, score: 0, difficulty: 'chieftain',
    };
    const { system } = makeSystem(state);

    const result = system.createUnit(UnitType.PHALANX, { x: 0, y: 0 }, player.id);

    expect(result).not.toBeNull();
    expect(result!.type).toBe(UnitType.PHALANX);
  });

  it('returns null for unknown player id', () => {
    const player = makePlayer();
    const state: GameState = {
      turn: 1, currentPlayer: player.id, currentPlayerIsHuman: true,
      players: [player], worldMap: [], units: [], cities: [],
      gamePhase: GamePhase.PLAYING, score: 0, difficulty: 'chieftain',
    };
    const { system } = makeSystem(state);

    expect(system.createUnit(UnitType.MILITIA, { x: 0, y: 0 }, 'unknown')).toBeNull();
  });
});

// ── getAvailableUnits ─────────────────────────────────────────────────────

describe('getAvailableUnits', () => {
  it('returns MILITIA and SETTLERS for a player with no technologies (civ2 off)', () => {
    const player = makePlayer({ technologies: [] });
    const state: GameState = {
      turn: 1, currentPlayer: player.id, currentPlayerIsHuman: true,
      players: [player], worldMap: [], units: [], cities: [],
      gamePhase: GamePhase.PLAYING, score: 0, difficulty: 'chieftain',
    };
    const { system } = makeSystem(state);

    const units = system.getAvailableUnits(player.id);

    expect(units).toContain(UnitType.MILITIA);
    expect(units).toContain(UnitType.SETTLERS);
  });

  it('does not include tech-gated units without the required tech', () => {
    const player = makePlayer({ technologies: [] });
    const state: GameState = {
      turn: 1, currentPlayer: player.id, currentPlayerIsHuman: true,
      players: [player], worldMap: [], units: [], cities: [],
      gamePhase: GamePhase.PLAYING, score: 0, difficulty: 'chieftain',
    };
    const { system } = makeSystem(state);

    const units = system.getAvailableUnits(player.id);

    expect(units).not.toContain(UnitType.PHALANX); // requires BRONZE_WORKING
    expect(units).not.toContain(UnitType.CAVALRY);  // requires HORSEBACK_RIDING
  });

  it('includes PHALANX once player has BRONZE_WORKING', () => {
    const player = makePlayer({ technologies: [TechnologyType.BRONZE_WORKING] });
    const state: GameState = {
      turn: 1, currentPlayer: player.id, currentPlayerIsHuman: true,
      players: [player], worldMap: [], units: [], cities: [],
      gamePhase: GamePhase.PLAYING, score: 0, difficulty: 'chieftain',
    };
    const { system } = makeSystem(state);

    expect(system.getAvailableUnits(player.id)).toContain(UnitType.PHALANX);
  });

  it('excludes obsoleted units', () => {
    // PHALANX is obsoleted by GUNPOWDER
    const player = makePlayer({
      technologies: [TechnologyType.BRONZE_WORKING, TechnologyType.GUNPOWDER],
    });
    const state: GameState = {
      turn: 1, currentPlayer: player.id, currentPlayerIsHuman: true,
      players: [player], worldMap: [], units: [], cities: [],
      gamePhase: GamePhase.PLAYING, score: 0, difficulty: 'chieftain',
    };
    const { system } = makeSystem(state);

    expect(system.getAvailableUnits(player.id)).not.toContain(UnitType.PHALANX);
  });

  it('returns empty array for unknown player', () => {
    const player = makePlayer();
    const state: GameState = {
      turn: 1, currentPlayer: player.id, currentPlayerIsHuman: true,
      players: [player], worldMap: [], units: [], cities: [],
      gamePhase: GamePhase.PLAYING, score: 0, difficulty: 'chieftain',
    };
    const { system } = makeSystem(state);

    expect(system.getAvailableUnits('nobody')).toEqual([]);
  });

  it('excludes civ2 non-standard units when enhancements are disabled', () => {
    const player = makePlayer({ technologies: [] });
    const state: GameState = {
      turn: 1, currentPlayer: player.id, currentPlayerIsHuman: true,
      players: [player], worldMap: [], units: [], cities: [],
      gamePhase: GamePhase.PLAYING, score: 0, difficulty: 'chieftain',
    };
    const { system } = makeSystem(state);

    const units = system.getAvailableUnits(player.id);

    expect(units).not.toContain(UnitType.WARRIOR);
    expect(units).not.toContain(UnitType.SCOUT);
    expect(units).not.toContain(UnitType.ARCHER);
    expect(units).not.toContain(UnitType.SPEARMAN);
  });
});
