/**
 * CityFoundingSystem (CityMaker) unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// TerrainManager uses `new Image()` in Node
vi.mock('../src/terrain/index', () => ({
  TerrainManager: {
    initialize: vi.fn(),
    getTerrainYields: vi.fn(() => ({ food: 2, production: 1, trade: 1 })),
    clearSpriteCache: vi.fn(),
  },
}));

// SoundEffects uses Audio API — stub out
vi.mock('../src/utils/SoundEffects', () => ({
  SoundEffects: {
    playCityFoundingSound: vi.fn(),
    playCivilizationFanfare: vi.fn(),
    playInvalidActionSound: vi.fn(),
  },
}));

import { CityFoundingSystem } from '../src/game/CityMaker';
import type { City, GameState, Player, Unit } from '../src/types/game';
import {
  GamePhase,
  GovernmentType,
  UnitType,
  TerrainType,
} from '../src/types/game';
import { CivilizationType } from '../src/game/CivilizationDefinitions';

// ── Helpers ────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Caesar',
    civilizationType: CivilizationType.ROMANS,
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

function makeSettler(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'settler-1',
    type: UnitType.SETTLERS,
    position: { x: 5, y: 5 },
    movementPoints: 1,
    maxMovementPoints: 1,
    health: 100,
    maxHealth: 100,
    playerId: 'p1',
    ...overrides,
  };
}

/** Minimal 10×10 world map. */
function makeWorldMap(height = 10, width = 10) {
  const map: any[][] = [];
  for (let y = 0; y < height; y++) {
    map[y] = [];
    for (let x = 0; x < width; x++) {
      map[y][x] = { position: { x, y }, terrain: TerrainType.GRASSLAND, improvements: [] };
    }
  }
  return map;
}

function makeGameState(
  players: Player[],
  units: Unit[],
  cities: City[] = [],
): GameState {
  return {
    turn: 1,
    currentPlayer: players[0].id,
    currentPlayerIsHuman: true,
    players,
    worldMap: makeWorldMap(),
    units,
    cities,
    gamePhase: GamePhase.PLAYING,
    score: 0,
    difficulty: 'chieftain',
  };
}

function makeSystem(state: GameState) {
  const emitted: { event: string; data?: any }[] = [];
  const removedFromQueue: string[] = [];
  const calcOutput = vi.fn(() => 2);

  const system = new CityFoundingSystem(
    state,
    (event, data) => emitted.push({ event, data }),
    (unitId) => removedFromQueue.push(unitId),
    calcOutput,
  );

  return { system, emitted, removedFromQueue, calcOutput };
}

// ── generateCityName ──────────────────────────────────────────────────────

describe('generateCityName', () => {
  it('returns first available civilization city name', () => {
    const player = makePlayer({ usedCityNames: [] });
    const state = makeGameState([player], []);
    const { system } = makeSystem(state);

    const name = system.generateCityName(player.id);

    // Romans' first city is 'Rome'
    expect(name).toBe('Rome');
  });

  it('skips already-used city names', () => {
    const player = makePlayer({ usedCityNames: ['Rome'] });
    const state = makeGameState([player], []);
    const { system } = makeSystem(state);

    const name = system.generateCityName(player.id);

    expect(name).toBe('Caesarea');
  });

  it('generates a random name when all civ names are used', () => {
    const allRomanCities = [
      'Rome', 'Caesarea', 'Carthage', 'Nicopolis', 'Byzantium', 'Brundisium',
      'Syracuse', 'Antioch', 'Palmyra', 'Cyrene', 'Gordion', 'Tyrus',
      'Jerusalem', 'Seleucia', 'Ravenna', 'Artaxata',
    ];
    const player = makePlayer({ usedCityNames: [...allRomanCities] });
    const state = makeGameState([player], []);
    const { system } = makeSystem(state);

    const name = system.generateCityName(player.id);

    // Should not be empty and not already in used names
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });

  it('returns "New City" for unknown player id', () => {
    const player = makePlayer();
    const state = makeGameState([player], []);
    const { system } = makeSystem(state);

    const name = system.generateCityName('nobody');

    expect(name).toBe('New City');
  });
});

// ── foundCity ─────────────────────────────────────────────────────────────

describe('foundCity', () => {
  it('creates a city and removes the settler', () => {
    const player = makePlayer();
    const settler = makeSettler({ position: { x: 5, y: 5 } });
    const state = makeGameState([player], [settler]);
    const { system } = makeSystem(state);

    const result = system.foundCity(settler.id);

    expect(result).toBe(true);
    expect(state.cities).toHaveLength(1);
    expect(state.cities[0].playerId).toBe(player.id);
    expect(state.units.find(u => u.id === settler.id)).toBeUndefined();
  });

  it('city is placed at the settler position', () => {
    const player = makePlayer();
    const settler = makeSettler({ position: { x: 3, y: 4 } });
    const state = makeGameState([player], [settler]);
    const { system } = makeSystem(state);

    system.foundCity(settler.id);

    expect(state.cities[0].position).toEqual({ x: 3, y: 4 });
  });

  it('uses provided city name', () => {
    const player = makePlayer();
    const settler = makeSettler();
    const state = makeGameState([player], [settler]);
    const { system } = makeSystem(state);

    system.foundCity(settler.id, 'Testonia');

    expect(state.cities[0].name).toBe('Testonia');
  });

  it('auto-generates a city name when none is provided', () => {
    const player = makePlayer({ usedCityNames: [] });
    const settler = makeSettler();
    const state = makeGameState([player], [settler]);
    const { system } = makeSystem(state);

    system.foundCity(settler.id);

    expect(state.cities[0].name).toBe('Rome');
  });

  it('marks the city name as used by the player', () => {
    const player = makePlayer({ usedCityNames: [] });
    const settler = makeSettler();
    const state = makeGameState([player], [settler]);
    const { system } = makeSystem(state);

    system.foundCity(settler.id, 'Newtown');

    expect(player.usedCityNames).toContain('Newtown');
  });

  it('emits cityFounded event', () => {
    const player = makePlayer();
    const settler = makeSettler();
    const state = makeGameState([player], [settler]);
    const { system, emitted } = makeSystem(state);

    system.foundCity(settler.id);

    expect(emitted[0].event).toBe('cityFounded');
    expect(emitted[0].data.playerId).toBe(player.id);
  });

  it('removes settler from the queue', () => {
    const player = makePlayer();
    const settler = makeSettler();
    const state = makeGameState([player], [settler]);
    const { system, removedFromQueue } = makeSystem(state);

    system.foundCity(settler.id);

    expect(removedFromQueue).toContain(settler.id);
  });

  it('returns false for a non-settler unit', () => {
    const player = makePlayer();
    const militia = makeSettler({ type: UnitType.MILITIA });
    const state = makeGameState([player], [militia]);
    const { system } = makeSystem(state);

    expect(system.foundCity(militia.id)).toBe(false);
  });

  it('returns false for an unknown unit id', () => {
    const player = makePlayer();
    const state = makeGameState([player], []);
    const { system } = makeSystem(state);

    expect(system.foundCity('nobody')).toBe(false);
  });

  it('returns false when position is out of y bounds (invalid)', () => {
    const player = makePlayer();
    const settler = makeSettler({ position: { x: 5, y: 99 } }); // beyond 10-row map
    const state = makeGameState([player], [settler]);
    const { system } = makeSystem(state);

    expect(system.foundCity(settler.id)).toBe(false);
  });

  it('returns false when too close to an existing city (< 3 tiles)', () => {
    const player = makePlayer();
    const settler = makeSettler({ position: { x: 5, y: 5 } });
    const existingCity: City = {
      id: 'c1', name: 'Rome', position: { x: 5, y: 6 }, // distance = 1
      population: 1, playerId: player.id, buildings: [], wonders: [],
      production: null, food: 0, foodStorage: 0, foodStorageCapacity: 0,
      production_points: 0, science: 0, culture: 0,
    };
    const state = makeGameState([player], [settler], [existingCity]);
    const { system } = makeSystem(state);

    expect(system.foundCity(settler.id)).toBe(false);
  });

  it('succeeds when city is exactly 3 tiles away', () => {
    const player = makePlayer();
    const settler = makeSettler({ position: { x: 5, y: 5 } });
    const existingCity: City = {
      id: 'c1', name: 'Rome', position: { x: 5, y: 8 }, // distance = 3
      population: 1, playerId: player.id, buildings: [], wonders: [],
      production: null, food: 0, foodStorage: 0, foodStorageCapacity: 0,
      production_points: 0, science: 0, culture: 0,
    };
    const state = makeGameState([player], [settler], [existingCity]);
    const { system } = makeSystem(state);

    expect(system.foundCity(settler.id)).toBe(true);
  });

  it('city starts with population 1 and empty buildings', () => {
    const player = makePlayer();
    const settler = makeSettler();
    const state = makeGameState([player], [settler]);
    const { system } = makeSystem(state);

    system.foundCity(settler.id);

    const city = state.cities[0];
    expect(city.population).toBe(1);
    expect(city.buildings).toEqual([]);
  });

  it('city has discoveredByPlayers set to founding player', () => {
    const player = makePlayer();
    const settler = makeSettler();
    const state = makeGameState([player], [settler]);
    const { system } = makeSystem(state);

    system.foundCity(settler.id);

    expect(state.cities[0].discoveredByPlayers).toContain(player.id);
  });
});

// ── renameCity ────────────────────────────────────────────────────────────

describe('renameCity', () => {
  it('renames a city and emits cityRenamed event', () => {
    const player = makePlayer({ usedCityNames: ['Rome'] });
    const city: City = {
      id: 'c1', name: 'Rome', position: { x: 5, y: 5 },
      population: 1, playerId: player.id, buildings: [], wonders: [],
      production: null, food: 0, foodStorage: 0, foodStorageCapacity: 0,
      production_points: 0, science: 0, culture: 0,
    };
    const state = makeGameState([player], [], [city]);
    const { system, emitted } = makeSystem(state);

    const result = system.renameCity(city.id, 'Nova Roma');

    expect(result).toBe(true);
    expect(city.name).toBe('Nova Roma');
    expect(emitted[0].event).toBe('cityRenamed');
    expect(emitted[0].data.oldName).toBe('Rome');
    expect(emitted[0].data.newName).toBe('Nova Roma');
  });

  it('removes old name and adds new name to player.usedCityNames', () => {
    const player = makePlayer({ usedCityNames: ['Rome'] });
    const city: City = {
      id: 'c1', name: 'Rome', position: { x: 5, y: 5 },
      population: 1, playerId: player.id, buildings: [], wonders: [],
      production: null, food: 0, foodStorage: 0, foodStorageCapacity: 0,
      production_points: 0, science: 0, culture: 0,
    };
    const state = makeGameState([player], [], [city]);
    const { system } = makeSystem(state);

    system.renameCity(city.id, 'Nova Roma');

    expect(player.usedCityNames).not.toContain('Rome');
    expect(player.usedCityNames).toContain('Nova Roma');
  });

  it('does not add duplicate to usedCityNames if name already there', () => {
    const player = makePlayer({ usedCityNames: ['Rome', 'Nova Roma'] });
    const city: City = {
      id: 'c1', name: 'Rome', position: { x: 5, y: 5 },
      population: 1, playerId: player.id, buildings: [], wonders: [],
      production: null, food: 0, foodStorage: 0, foodStorageCapacity: 0,
      production_points: 0, science: 0, culture: 0,
    };
    const state = makeGameState([player], [], [city]);
    const { system } = makeSystem(state);

    system.renameCity(city.id, 'Nova Roma');

    expect(player.usedCityNames.filter(n => n === 'Nova Roma')).toHaveLength(1);
  });

  it('returns false for unknown city id', () => {
    const player = makePlayer();
    const state = makeGameState([player], [], []);
    const { system } = makeSystem(state);

    expect(system.renameCity('nobody', 'Oops')).toBe(false);
  });
});

// ── getCityProductionOutput ───────────────────────────────────────────────

describe('getCityProductionOutput', () => {
  it('delegates to calcProductionOutput callback', () => {
    const player = makePlayer();
    const city: City = {
      id: 'c1', name: 'Rome', position: { x: 5, y: 5 },
      population: 1, playerId: player.id, buildings: [], wonders: [],
      production: null, food: 0, foodStorage: 0, foodStorageCapacity: 0,
      production_points: 0, science: 0, culture: 0,
    };
    const state = makeGameState([player], [], [city]);
    const { system, calcOutput } = makeSystem(state);

    const output = system.getCityProductionOutput(city.id);

    expect(calcOutput).toHaveBeenCalledWith(city, state);
    expect(output).toBe(2);
  });

  it('returns 0 for unknown city id', () => {
    const player = makePlayer();
    const state = makeGameState([player], [], []);
    const { system } = makeSystem(state);

    expect(system.getCityProductionOutput('nobody')).toBe(0);
  });
});

// ── initializeFoodStorageForExistingCities ────────────────────────────────

describe('initializeFoodStorageForExistingCities', () => {
  it('initializes foodStorageCapacity for cities that are missing it', () => {
    const player = makePlayer();
    const city: City = {
      id: 'c1', name: 'Rome', position: { x: 5, y: 5 },
      population: 1, playerId: player.id, buildings: [], wonders: [],
      production: null, food: 0, foodStorage: 0, foodStorageCapacity: undefined as any,
      production_points: 0, science: 0, culture: 0,
    };
    const state = makeGameState([player], [], [city]);
    const { system } = makeSystem(state);

    system.initializeFoodStorageForExistingCities();

    expect(city.foodStorageCapacity).toBeGreaterThan(0);
  });

  it('does not overwrite already-initialized cities', () => {
    const player = makePlayer();
    const city: City = {
      id: 'c1', name: 'Rome', position: { x: 5, y: 5 },
      population: 1, playerId: player.id, buildings: [], wonders: [],
      production: null, food: 0, foodStorage: 0, foodStorageCapacity: 99,
      production_points: 0, science: 0, culture: 0,
    };
    const state = makeGameState([player], [], [city]);
    const { system } = makeSystem(state);

    system.initializeFoodStorageForExistingCities();

    expect(city.foodStorageCapacity).toBe(99);
  });
});
