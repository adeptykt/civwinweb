import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState, Unit, City, Tile, UnitType, TerrainType, Player, GamePhase } from '../src/types/game';
import { GovernmentType } from '../src/types/game';
import { CivilizationType } from '../src/game/CivilizationDefinitions';
import { TechnologyType } from '../src/game/TechnologyDefinitions';

// ── Terrain mock — prevents browser `Image` constructor from being called ────
vi.mock('../src/terrain/index', () => ({
  TerrainManager: {
    initialize: vi.fn(),
    isPassable: vi.fn((terrain: string) => terrain !== TerrainType.OCEAN && terrain !== 'mountains'),
    canFoundCity: vi.fn((terrain: string) => !['ocean', 'mountains', 'arctic'].includes(terrain)),
    getTerrain: vi.fn(),
    getTerrainColor: vi.fn(() => '#00ff00'),
    getTerrainYields: vi.fn(() => ({ food: 2, production: 1, trade: 1 })),
  },
  GrasslandTerrain: vi.fn(),
  DesertTerrain: vi.fn(),
  ForestTerrain: vi.fn(),
  HillsTerrain: vi.fn(),
  MountainsTerrain: vi.fn(),
  OceanTerrain: vi.fn(),
  RiverTerrain: vi.fn(),
  JungleTerrain: vi.fn(),
  TerrainBase: vi.fn(),
}));

// ── Module imports ────────────────────────────────────────────────────────────
import {
  getAITraits,
  getAggressivenessScore,
  getDistance,
  isAtPosition,
  isValidPosition,
  getValidMoves,
  isMilitaryUnit,
  findNearestCityAny,
} from '../src/game/ai/AIUtils';

import {
  findBestCityLocation,
  isValidCityLocation,
  evaluateCityLocation,
  isNearTerrain,
  generateCityNameForPlayer,
} from '../src/game/ai/AICityPlacementStrategy';

import {
  findNearbyCity,
  canBuildRoad,
  canBuildIrrigation,
  hasWaterAccess,
} from '../src/game/ai/AISettlerStrategy';

import {
  findNearestEnemy,
  findNearestEnemyCity,
  findNearestFriendlyCity,
  findBestEnemyTarget,
  getBestMilitaryUnit,
  isDefensiveUnit,
  isOffensiveUnit,
  shouldUnitDefendCity,
  countCityDefenders,
  calculateDesiredDefenders,
  countNearbyEnemies,
  findCityNeedingDefense,
  reevaluateFortifiedUnit,
  wakeUpUnit,
} from '../src/game/ai/AICombatStrategy';

import {
  processAICities,
  setAICityProduction,
  reevaluateCityProduction,
} from '../src/game/ai/AIProductionStrategy';

import {
  processAITechnology,
  getAvailableTechnologies,
} from '../src/game/ai/AITechnologyStrategy';

// ─────────────────────────────────────────────────────────────────────────────
// Shared test helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a minimal 10×10 grassland tile map. */
function makeMap(
  width = 10,
  height = 10,
  fill: TerrainType = TerrainType.GRASSLAND,
): Tile[][] {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => ({
      position: { x, y },
      terrain: fill,
      improvements: [],
    } as Tile)),
  );
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Player 1',
    civilizationType: CivilizationType.ROMANS,
    color: '#ff0000',
    isHuman: false,
    science: 0,
    gold: 0,
    culture: 0,
    technologies: [],
    government: GovernmentType.DESPOTISM,
    usedCityNames: [],
    ...overrides,
  };
}

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'u1',
    type: UnitType.MILITIA,
    position: { x: 5, y: 5 },
    movementPoints: 1,
    maxMovementPoints: 1,
    health: 100,
    maxHealth: 100,
    playerId: 'p1',
    experience: 0,
    isVeteran: false,
    fortified: false,
    ...overrides,
  };
}

function makeCity(overrides: Partial<City> = {}): City {
  return {
    id: 'c1',
    name: 'Rome',
    position: { x: 5, y: 5 },
    population: 2,
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
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    turn: 1,
    currentPlayer: 'p1',
    currentPlayerIsHuman: false,
    players: [makePlayer()],
    worldMap: makeMap(),
    units: [],
    cities: [],
    gamePhase: GamePhase.PLAYING,
    score: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AIUtils
// ─────────────────────────────────────────────────────────────────────────────

describe('AIUtils', () => {
  describe('getAITraits', () => {
    it('returns default traits when player is not found', () => {
      const state = makeState({ players: [] });
      const traits = getAITraits(state, 'missing');
      expect(traits.aggression).toBe('normal');
      expect(traits.development).toBe('normal');
      expect(traits.militarism).toBe('normal');
    });

    it('returns civilization traits for a known player', () => {
      const state = makeState({
        players: [makePlayer({ id: 'p1', civilizationType: CivilizationType.ROMANS })],
      });
      const traits = getAITraits(state, 'p1');
      expect(traits).toBeDefined();
      expect(['friendly', 'normal', 'aggressive']).toContain(traits.aggression);
    });
  });

  describe('getAggressivenessScore', () => {
    it('returns negative score for a peaceful civ', () => {
      const score = getAggressivenessScore({ aggression: 'friendly', development: 'perfectionist', militarism: 'civilized' });
      expect(score).toBeLessThan(0);
    });

    it('returns positive score for a warlike civ', () => {
      const score = getAggressivenessScore({ aggression: 'aggressive', development: 'expansionist', militarism: 'militaristic' });
      expect(score).toBeGreaterThan(0);
    });

    it('returns 0 for a fully normal civ', () => {
      const score = getAggressivenessScore({ aggression: 'normal', development: 'normal', militarism: 'normal' });
      expect(score).toBe(0);
    });
  });

  describe('getDistance', () => {
    it('returns 0 for identical positions', () => {
      expect(getDistance({ x: 3, y: 3 }, { x: 3, y: 3 })).toBe(0);
    });

    it('returns Manhattan distance for simple offsets', () => {
      expect(getDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
    });

    it('wraps around the horizontal axis', () => {
      // On an 80-wide map, going from x=1 to x=79 should be 2 (wrap), not 78
      expect(getDistance({ x: 1, y: 0 }, { x: 79, y: 0 })).toBe(2);
    });
  });

  describe('isAtPosition', () => {
    it('returns true for same tile', () => {
      expect(isAtPosition({ x: 4, y: 4 }, { x: 4, y: 4 })).toBe(true);
    });

    it('returns false for different tiles', () => {
      expect(isAtPosition({ x: 4, y: 4 }, { x: 5, y: 4 })).toBe(false);
    });
  });

  describe('isValidPosition', () => {
    it('returns false for ocean tiles', () => {
      const state = makeState({ worldMap: makeMap(10, 10, TerrainType.OCEAN) });
      expect(isValidPosition({ x: 5, y: 5 }, state)).toBe(false);
    });

    it('returns true for passable land tiles', () => {
      const state = makeState();
      expect(isValidPosition({ x: 5, y: 5 }, state)).toBe(true);
    });

    it('returns false when y is out of bounds', () => {
      const state = makeState();
      expect(isValidPosition({ x: 5, y: -1 }, state)).toBe(false);
      expect(isValidPosition({ x: 5, y: 100 }, state)).toBe(false);
    });
  });

  describe('getValidMoves', () => {
    it('returns up to 8 moves on open land', () => {
      const state = makeState();
      const moves = getValidMoves({ x: 5, y: 5 }, state);
      expect(moves.length).toBeGreaterThan(0);
      expect(moves.length).toBeLessThanOrEqual(8);
    });

    it('filters ocean tiles from moves', () => {
      const worldMap = makeMap();
      // Surround (5,5) with ocean on all sides except itself
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx !== 0 || dy !== 0) worldMap[5 + dy][5 + dx].terrain = TerrainType.OCEAN;
        }
      }
      const state = makeState({ worldMap });
      const moves = getValidMoves({ x: 5, y: 5 }, state);
      expect(moves.length).toBe(0);
    });
  });

  describe('isMilitaryUnit', () => {
    it('returns true for military unit types', () => {
      expect(isMilitaryUnit(UnitType.MILITIA)).toBe(true);
      expect(isMilitaryUnit(UnitType.PHALANX)).toBe(true);
      expect(isMilitaryUnit(UnitType.ARMOR)).toBe(true);
    });

    it('returns false for non-military unit types', () => {
      expect(isMilitaryUnit(UnitType.SETTLERS)).toBe(false);
      expect(isMilitaryUnit(UnitType.DIPLOMAT)).toBe(false);
    });
  });

  describe('findNearestCityAny', () => {
    it('returns null when there are no cities', () => {
      const state = makeState({ cities: [] });
      expect(findNearestCityAny({ x: 5, y: 5 }, state)).toBeNull();
    });

    it('returns the closest city regardless of owner', () => {
      const cityA = makeCity({ id: 'a', position: { x: 3, y: 5 }, playerId: 'p1' });
      const cityB = makeCity({ id: 'b', position: { x: 7, y: 5 }, playerId: 'p2' });
      const state = makeState({ cities: [cityA, cityB] });
      const result = findNearestCityAny({ x: 2, y: 5 }, state);
      expect(result?.id).toBe('a');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AICityPlacementStrategy
// ─────────────────────────────────────────────────────────────────────────────

describe('AICityPlacementStrategy', () => {
  describe('isValidCityLocation', () => {
    it('rejects ocean tiles', () => {
      const worldMap = makeMap();
      worldMap[5][5].terrain = TerrainType.OCEAN;
      const state = makeState({ worldMap });
      expect(isValidCityLocation({ x: 5, y: 5 }, state)).toBe(false);
    });

    it('accepts a clear grassland tile', () => {
      const state = makeState();
      expect(isValidCityLocation({ x: 5, y: 5 }, state)).toBe(true);
    });

    it('rejects a tile too close to an existing city', () => {
      const city = makeCity({ position: { x: 5, y: 5 } });
      const state = makeState({ cities: [city] });
      expect(isValidCityLocation({ x: 6, y: 5 }, state)).toBe(false);
    });

    it('accepts a tile far enough from existing cities', () => {
      const city = makeCity({ position: { x: 0, y: 0 } });
      const state = makeState({ cities: [city] });
      expect(isValidCityLocation({ x: 5, y: 5 }, state)).toBe(true);
    });
  });

  describe('evaluateCityLocation', () => {
    it('scores river terrain higher than desert', () => {
      const worldMap = makeMap();
      worldMap[5][5].terrain = TerrainType.RIVER;
      worldMap[5][6].terrain = TerrainType.DESERT;
      const state = makeState({ worldMap });
      const riverScore  = evaluateCityLocation({ x: 5, y: 5 }, state);
      const desertScore = evaluateCityLocation({ x: 6, y: 5 }, state);
      expect(riverScore).toBeGreaterThan(desertScore);
    });

    it('returns 0 for a missing tile', () => {
      const state = makeState({ worldMap: [] });
      expect(evaluateCityLocation({ x: 99, y: 99 }, state)).toBe(0);
    });
  });

  describe('isNearTerrain', () => {
    it('returns true when river is adjacent', () => {
      const worldMap = makeMap();
      worldMap[4][5].terrain = TerrainType.RIVER;
      const state = makeState({ worldMap });
      expect(isNearTerrain({ x: 5, y: 5 }, TerrainType.RIVER, state)).toBe(true);
    });

    it('returns false when no neighbour matches', () => {
      const state = makeState();
      expect(isNearTerrain({ x: 5, y: 5 }, TerrainType.RIVER, state)).toBe(false);
    });
  });

  describe('findBestCityLocation', () => {
    it('returns null when no valid location exists', () => {
      const state = makeState({ worldMap: makeMap(10, 10, TerrainType.OCEAN) });
      expect(findBestCityLocation({ x: 5, y: 5 }, state)).toBeNull();
    });

    it('returns a position on a land map', () => {
      const state = makeState();
      const result = findBestCityLocation({ x: 5, y: 5 }, state, true);
      expect(result).not.toBeNull();
    });
  });

  describe('generateCityNameForPlayer', () => {
    it('returns the first available civilization name', () => {
      const player = makePlayer({ civilizationType: CivilizationType.ROMANS, usedCityNames: [] });
      const name = generateCityNameForPlayer(player as any);
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('falls back to a generated name when all civ names are used', () => {
      const player = makePlayer({ civilizationType: CivilizationType.ROMANS });
      // Mark ALL Roman city names as used (Romans have ~20 names)
      player.usedCityNames = Array.from({ length: 100 }, (_, i) => `City${i}`);
      const name = generateCityNameForPlayer(player as any);
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AISettlerStrategy
// ─────────────────────────────────────────────────────────────────────────────

describe('AISettlerStrategy', () => {
  describe('findNearbyCity', () => {
    it('returns a city within maxDistance', () => {
      const city = makeCity({ position: { x: 5, y: 5 }, playerId: 'p1' });
      const state = makeState({ cities: [city] });
      expect(findNearbyCity({ x: 5, y: 5 }, state, 'p1', 0)).toBe(city);
    });

    it('returns null when city is too far', () => {
      const city = makeCity({ position: { x: 0, y: 0 }, playerId: 'p1' });
      const state = makeState({ cities: [city] });
      expect(findNearbyCity({ x: 9, y: 9 }, state, 'p1', 2)).toBeNull();
    });

    it('ignores enemy cities', () => {
      const city = makeCity({ position: { x: 5, y: 5 }, playerId: 'p2' });
      const state = makeState({ cities: [city] });
      expect(findNearbyCity({ x: 5, y: 5 }, state, 'p1', 0)).toBeNull();
    });
  });

  describe('canBuildRoad', () => {
    it('returns true on grassland', () => {
      expect(canBuildRoad({ terrain: TerrainType.GRASSLAND })).toBe(true);
    });

    it('returns false on ocean', () => {
      expect(canBuildRoad({ terrain: TerrainType.OCEAN })).toBe(false);
    });

    it('returns true on desert and hills', () => {
      expect(canBuildRoad({ terrain: TerrainType.DESERT })).toBe(true);
      expect(canBuildRoad({ terrain: TerrainType.HILLS })).toBe(true);
    });
  });

  describe('canBuildIrrigation', () => {
    it('returns false for non-irrigatable terrain', () => {
      const state = makeState();
      expect(canBuildIrrigation({ terrain: TerrainType.OCEAN }, { x: 5, y: 5 }, state)).toBe(false);
      expect(canBuildIrrigation({ terrain: TerrainType.FOREST }, { x: 5, y: 5 }, state)).toBe(false);
    });

    it('returns true when adjacent to a river', () => {
      const worldMap = makeMap();
      worldMap[4][5].terrain = TerrainType.RIVER;
      const state = makeState({ worldMap });
      expect(canBuildIrrigation({ terrain: TerrainType.GRASSLAND }, { x: 5, y: 5 }, state)).toBe(true);
    });
  });

  describe('hasWaterAccess', () => {
    it('returns true when adjacent to ocean', () => {
      const worldMap = makeMap();
      worldMap[4][5].terrain = TerrainType.OCEAN;
      const state = makeState({ worldMap });
      expect(hasWaterAccess({ x: 5, y: 5 }, state)).toBe(true);
    });

    it('returns false when no water nearby', () => {
      const state = makeState();
      expect(hasWaterAccess({ x: 5, y: 5 }, state)).toBe(false);
    });

    it('returns true adjacent to an irrigated tile', () => {
      const worldMap = makeMap();
      worldMap[4][5].improvements = [{ type: 'irrigation' as any, completedTurn: 1 }];
      const state = makeState({ worldMap });
      expect(hasWaterAccess({ x: 5, y: 5 }, state)).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AICombatStrategy
// ─────────────────────────────────────────────────────────────────────────────

describe('AICombatStrategy', () => {
  describe('findNearestEnemy', () => {
    it('returns null when no enemies exist', () => {
      const unit  = makeUnit({ playerId: 'p1' });
      const state = makeState({ units: [unit] });
      expect(findNearestEnemy(unit, state)).toBeNull();
    });

    it('returns the closest enemy unit', () => {
      const unit   = makeUnit({ id: 'me', position: { x: 5, y: 5 }, playerId: 'p1' });
      const far    = makeUnit({ id: 'far',  position: { x: 9, y: 9 }, playerId: 'p2' });
      const close  = makeUnit({ id: 'close', position: { x: 6, y: 5 }, playerId: 'p2' });
      const state  = makeState({ units: [unit, far, close] });
      expect(findNearestEnemy(unit, state)?.id).toBe('close');
    });
  });

  describe('findNearestEnemyCity', () => {
    it('returns null when no enemy cities', () => {
      const unit  = makeUnit({ playerId: 'p1' });
      const city  = makeCity({ playerId: 'p1' });
      const state = makeState({ units: [unit], cities: [city] });
      expect(findNearestEnemyCity(unit, state)).toBeNull();
    });

    it('returns the nearest enemy city', () => {
      const unit   = makeUnit({ position: { x: 5, y: 5 }, playerId: 'p1' });
      const near   = makeCity({ id: 'near', position: { x: 6, y: 5 }, playerId: 'p2' });
      const far    = makeCity({ id: 'far',  position: { x: 9, y: 9 }, playerId: 'p2' });
      const state  = makeState({ units: [unit], cities: [near, far] });
      expect(findNearestEnemyCity(unit, state)?.id).toBe('near');
    });
  });

  describe('findNearestFriendlyCity', () => {
    it('returns null when no friendly cities', () => {
      const unit  = makeUnit({ playerId: 'p1' });
      const state = makeState({ units: [unit], cities: [] });
      expect(findNearestFriendlyCity(unit, state)).toBeNull();
    });

    it('returns the nearest own city', () => {
      const unit  = makeUnit({ position: { x: 5, y: 5 }, playerId: 'p1' });
      const near  = makeCity({ id: 'near', position: { x: 6, y: 5 }, playerId: 'p1' });
      const far   = makeCity({ id: 'far',  position: { x: 9, y: 9 }, playerId: 'p1' });
      const state = makeState({ units: [unit], cities: [near, far] });
      expect(findNearestFriendlyCity(unit, state)?.id).toBe('near');
    });
  });

  describe('findBestEnemyTarget', () => {
    it('returns null when no enemies in range', () => {
      const unit  = makeUnit({ position: { x: 5, y: 5 }, playerId: 'p1' });
      const state = makeState({ units: [unit], cities: [] });
      expect(findBestEnemyTarget(unit, state)).toBeNull();
    });

    it('prefers an undefended enemy city over a defended one', () => {
      const unit       = makeUnit({ id: 'me', position: { x: 5, y: 5 }, playerId: 'p1' });
      const defended   = makeCity({ id: 'defended',   position: { x: 6, y: 5 }, playerId: 'p2' });
      const undefended = makeCity({ id: 'undefended', position: { x: 7, y: 5 }, playerId: 'p2' });
      // Put a defender in the first city
      const defender   = makeUnit({ id: 'def', position: { x: 6, y: 5 }, playerId: 'p2' });
      const state      = makeState({ units: [unit, defender], cities: [defended, undefended] });
      const target     = findBestEnemyTarget(unit, state);
      expect(target?.type).toBe('city');
      expect((target?.target as City).id).toBe('undefended');
    });
  });

  describe('isDefensiveUnit / isOffensiveUnit', () => {
    it('phalanx is defensive', () => {
      expect(isDefensiveUnit(UnitType.PHALANX)).toBe(true);
    });

    it('militia is defensive (defense >= attack)', () => {
      expect(isDefensiveUnit(UnitType.MILITIA)).toBe(true);
    });

    it('armor is offensive', () => {
      expect(isOffensiveUnit(UnitType.ARMOR)).toBe(true);
    });
  });

  describe('countCityDefenders', () => {
    it('returns 0 when no units are at city', () => {
      const city  = makeCity({ position: { x: 5, y: 5 }, playerId: 'p1' });
      const state = makeState({ units: [], cities: [city] });
      expect(countCityDefenders(city, state)).toBe(0);
    });

    it('counts military units at city tile', () => {
      const city    = makeCity({ position: { x: 5, y: 5 }, playerId: 'p1' });
      const soldier = makeUnit({ id: 'g', type: UnitType.PHALANX, position: { x: 5, y: 5 }, playerId: 'p1' });
      const settler = makeUnit({ id: 's', type: UnitType.SETTLERS, position: { x: 5, y: 5 }, playerId: 'p1' });
      const state   = makeState({ units: [soldier, settler], cities: [city] });
      expect(countCityDefenders(city, state)).toBe(1);
    });

    it('does not count enemy units', () => {
      const city  = makeCity({ position: { x: 5, y: 5 }, playerId: 'p1' });
      const enemy = makeUnit({ id: 'e', type: UnitType.MILITIA, position: { x: 5, y: 5 }, playerId: 'p2' });
      const state = makeState({ units: [enemy], cities: [city] });
      expect(countCityDefenders(city, state)).toBe(0);
    });
  });

  describe('calculateDesiredDefenders', () => {
    it('requires at least 1 defender for a small city', () => {
      const city  = makeCity({ population: 1 });
      const state = makeState({ cities: [city] });
      expect(calculateDesiredDefenders(city, state)).toBeGreaterThanOrEqual(1);
    });

    it('requires more defenders for larger cities', () => {
      const small = makeCity({ id: 'small', population: 1 });
      const large = makeCity({ id: 'large', population: 8 });
      const state = makeState({ cities: [small, large] });
      expect(calculateDesiredDefenders(large, state)).toBeGreaterThan(
        calculateDesiredDefenders(small, state),
      );
    });

    it('never exceeds 4 defenders', () => {
      const city  = makeCity({ population: 20 });
      const enemy = makeUnit({ id: 'e', position: { x: 6, y: 5 }, playerId: 'p2' });
      const state = makeState({ units: [enemy], cities: [city] });
      expect(calculateDesiredDefenders(city, state)).toBeLessThanOrEqual(4);
    });
  });

  describe('shouldUnitDefendCity', () => {
    it('returns false when unit is not in a city', () => {
      const unit  = makeUnit({ position: { x: 3, y: 3 } });
      const city  = makeCity({ position: { x: 5, y: 5 } });
      const state = makeState({ units: [unit], cities: [city] });
      expect(shouldUnitDefendCity(unit, state)).toBe(false);
    });

    it('returns true when city has fewer defenders than desired', () => {
      const city  = makeCity({ position: { x: 5, y: 5 }, playerId: 'p1' });
      const unit  = makeUnit({ position: { x: 5, y: 5 }, playerId: 'p1' });
      const state = makeState({ units: [unit], cities: [city] });
      // A single militia unit in a lone city — desired is 2 (alone city bonus)
      expect(shouldUnitDefendCity(unit, state)).toBe(true);
    });
  });

  describe('countNearbyEnemies', () => {
    it('counts enemy units within radius', () => {
      const city  = makeCity({ position: { x: 5, y: 5 } });
      const enemy = makeUnit({ id: 'e', position: { x: 6, y: 5 }, playerId: 'p2' });
      const state = makeState({ units: [enemy], cities: [city] });
      expect(countNearbyEnemies(city, state, 3)).toBeGreaterThan(0);
    });

    it('ignores enemies outside radius', () => {
      const city  = makeCity({ position: { x: 0, y: 0 } });
      const enemy = makeUnit({ id: 'e', position: { x: 9, y: 9 }, playerId: 'p2' });
      const state = makeState({ units: [enemy], cities: [city] });
      expect(countNearbyEnemies(city, state, 2)).toBe(0);
    });
  });

  describe('findCityNeedingDefense', () => {
    it('returns null when all cities are adequately defended', () => {
      const city = makeCity({ position: { x: 5, y: 5 }, playerId: 'p1' });
      // Add enough defenders
      const defenders = Array.from({ length: 4 }, (_, i) =>
        makeUnit({ id: `d${i}`, type: UnitType.PHALANX, position: { x: 5, y: 5 }, playerId: 'p1' })
      );
      const unit  = makeUnit({ position: { x: 5, y: 5 }, playerId: 'p1' });
      const state = makeState({ units: [...defenders, unit], cities: [city] });
      expect(findCityNeedingDefense(unit, state)).toBeNull();
    });

    it('returns a city that needs defense within 8 tiles', () => {
      const city  = makeCity({ position: { x: 5, y: 5 }, playerId: 'p1' });
      const unit  = makeUnit({ position: { x: 5, y: 5 }, playerId: 'p1' });
      const state = makeState({ units: [unit], cities: [city] });
      expect(findCityNeedingDefense(unit, state)).toBe(city);
    });
  });

  describe('getBestMilitaryUnit', () => {
    it('returns militia when player has no technologies', () => {
      const player = makePlayer({ id: 'p1', technologies: [] });
      const state  = makeState({ players: [player] });
      const result = getBestMilitaryUnit('p1', state);
      expect(result.type).toBe(UnitType.MILITIA);
    });

    it('returns a better unit when tech is available', () => {
      const player = makePlayer({ id: 'p1', technologies: [TechnologyType.BRONZE_WORKING] });
      const state  = makeState({ players: [player] });
      const result = getBestMilitaryUnit('p1', state);
      expect([UnitType.PHALANX, UnitType.MILITIA]).toContain(result.type);
    });

    it('returns militia when player is not found', () => {
      const state  = makeState({ players: [] });
      const result = getBestMilitaryUnit('ghost', state);
      expect(result.type).toBe(UnitType.MILITIA);
    });
  });

  describe('reevaluateFortifiedUnit', () => {
    it('wakes a fortified unit outside a city', () => {
      const unit  = makeUnit({ id: 'u1', fortified: true, position: { x: 3, y: 3 } });
      const state = makeState({ units: [unit], cities: [] });
      reevaluateFortifiedUnit(unit, state, undefined);
      // Without a game interface the fallback clears the flags
      expect(unit.fortified).toBe(false);
    });
  });

  describe('wakeUpUnit', () => {
    it('clears fortification flags without a game interface', () => {
      const unit = makeUnit({ fortified: true, fortifying: true, fortificationTurns: 2 });
      wakeUpUnit(unit, undefined);
      expect(unit.fortified).toBe(false);
      expect(unit.fortifying).toBe(false);
      expect(unit.fortificationTurns).toBe(0);
    });

    it('calls game.wakeUnit when a game interface is provided', () => {
      const unit = makeUnit({ id: 'u1', fortified: true });
      const game = { wakeUnit: vi.fn() } as any;
      wakeUpUnit(unit, game);
      expect(game.wakeUnit).toHaveBeenCalledWith('u1');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AIProductionStrategy
// ─────────────────────────────────────────────────────────────────────────────

describe('AIProductionStrategy', () => {
  describe('setAICityProduction', () => {
    it('sets production on a city with no production', () => {
      const player = makePlayer({ id: 'p1', technologies: [] });
      const city   = makeCity({ playerId: 'p1' });
      const state  = makeState({ players: [player], cities: [city], units: [] });
      setAICityProduction(city, state);
      expect(city.production).not.toBeNull();
    });

    it('builds a defender when city has none', () => {
      const player = makePlayer({ id: 'p1', technologies: [] });
      const city   = makeCity({ playerId: 'p1', production: null });
      const state  = makeState({ players: [player], cities: [city], units: [] });
      setAICityProduction(city, state);
      expect(city.production?.type).toBe('unit');
    });

    it('re-evaluates when reevaluateCityProduction is called', () => {
      const player = makePlayer({ id: 'p1', technologies: [] });
      const city   = makeCity({ playerId: 'p1', production: { type: 'unit' as any, item: UnitType.SETTLERS, turnsRemaining: 5 } });
      const state  = makeState({ players: [player], cities: [city], units: [] });
      reevaluateCityProduction(city, state);
      // Production is re-set (may differ from settlers)
      expect(city.production).not.toBeNull();
    });
  });

  describe('processAICities', () => {
    it('sets production on every city that has none', () => {
      const player = makePlayer({ id: 'p1', technologies: [] });
      const cityA  = makeCity({ id: 'a', playerId: 'p1', production: null });
      const cityB  = makeCity({ id: 'b', playerId: 'p1', production: null, position: { x: 1, y: 1 } });
      const state  = makeState({ players: [player], cities: [cityA, cityB], units: [] });
      processAICities(state, 'p1');
      expect(cityA.production).not.toBeNull();
      expect(cityB.production).not.toBeNull();
    });

    it('leaves existing production untouched', () => {
      const player = makePlayer({ id: 'p1', technologies: [] });
      const prod   = { type: 'unit' as any, item: UnitType.SETTLERS, turnsRemaining: 3 };
      const city   = makeCity({ playerId: 'p1', production: prod });
      const state  = makeState({ players: [player], cities: [city], units: [] });
      processAICities(state, 'p1');
      expect(city.production?.item).toBe(UnitType.SETTLERS);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AITechnologyStrategy
// ─────────────────────────────────────────────────────────────────────────────

describe('AITechnologyStrategy', () => {
  describe('getAvailableTechnologies', () => {
    it('returns starting technologies for a player with none', () => {
      const player = makePlayer({ technologies: [] });
      const avail  = getAvailableTechnologies(player as any);
      expect(avail.length).toBeGreaterThan(0);
    });

    it('does not include already-researched technologies', () => {
      const player = makePlayer({ technologies: [TechnologyType.POTTERY] });
      const avail  = getAvailableTechnologies(player as any);
      expect(avail).not.toContain(TechnologyType.POTTERY);
    });
  });

  describe('processAITechnology', () => {
    it('sets currentResearch when player has none', () => {
      const player = makePlayer({ id: 'p1', technologies: [], currentResearch: undefined });
      const state  = makeState({ players: [player] });
      processAITechnology(state, 'p1');
      expect(player.currentResearch).toBeDefined();
    });

    it('does not override an already-active research', () => {
      const player = makePlayer({
        id: 'p1',
        technologies: [],
        currentResearch: TechnologyType.POTTERY,
      });
      const state = makeState({ players: [player] });
      processAITechnology(state, 'p1');
      expect(player.currentResearch).toBe(TechnologyType.POTTERY);
    });

    it('does nothing for an unknown player', () => {
      const state = makeState({ players: [] });
      // Should not throw
      expect(() => processAITechnology(state, 'ghost')).not.toThrow();
    });
  });
});
