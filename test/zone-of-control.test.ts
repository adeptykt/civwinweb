/**
 * Zone of Control (ZoC) tests
 *
 * Rules (Civ 1 faithful):
 *  - Every land-category military unit exerts ZoC over its 8 adjacent tiles.
 *  - Diplomats and Caravans never exert ZoC and are immune to it.
 *  - Naval and Air units neither exert nor are affected by ZoC.
 *  - A unit in enemy ZoC cannot move to another tile also in enemy ZoC.
 *  - A friendly city at the destination neutralises ZoC.
 *  - A railroad connection on both from- and to-tiles bypasses ZoC.
 *  - Stack rule: a tile contributes one ZoC source regardless of stack size.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (must come before any transitive import of browser APIs) ─────────────

vi.mock('../src/terrain/index', () => ({
  TerrainManager: {
    initialize: vi.fn(),
    getTerrainYields: vi.fn(() => ({ food: 2, production: 1, trade: 1 })),
    clearSpriteCache: vi.fn(),
  },
}));

vi.mock('../src/utils/SoundEffects', () => ({
  SoundEffects: {
    playMoveSound: vi.fn(),
    playInvalidActionSound: vi.fn(),
    playAttackSound: vi.fn(),
    playCombatSound: vi.fn(),
    playCityFoundedSound: vi.fn(),
    playCivilizationFanfare: vi.fn(),
  },
}));

vi.mock('../src/game/VisibilitySystem', () => ({
  VisibilitySystem: {
    initializeVisibility: vi.fn(),
    updateVisibilityForPlayer: vi.fn(),
    updateVisibilityForUnitMove: vi.fn(),
    getTileVisibility: vi.fn(() => 'visible'),
  },
}));

vi.mock('../src/game/ai/AISettlerStrategy', () => ({
  findBestInfrastructureAction: vi.fn(() => null),
}));

vi.mock('../src/game/CivilizationDefinitions', () => ({
  getCivilization: vi.fn(() => null),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  Unit,
  UnitType,
  Tile,
  TerrainType,
  GameState,
  GamePhase,
  ImprovementType,
  City,
} from '../src/types/game';
import { UnitMovementSystem } from '../src/game/UnitMovementSystem';
import { findPath } from '../src/utils/Pathfinder';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMap(
  width = 20,
  height = 10,
  fill: TerrainType = TerrainType.GRASSLAND,
): Tile[][] {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => ({
      position: { x, y },
      terrain: fill,
      improvements: [],
    }) as Tile),
  );
}

let _unitCounter = 0;
function makeUnit(
  type: UnitType,
  playerId: string,
  x: number,
  y: number,
  overrides: Partial<Unit> = {},
): Unit {
  return {
    id: `unit-${++_unitCounter}`,
    type,
    position: { x, y },
    movementPoints: 2,
    maxMovementPoints: 2,
    health: 100,
    maxHealth: 100,
    playerId,
    experience: 0,
    isVeteran: false,
    fortified: false,
    fortifying: false,
    fortificationTurns: 0,
    sleeping: false,
    buildingRoad: false,
    buildingMine: false,
    automating: false,
    ...overrides,
  } as Unit;
}

function makeCity(id: string, playerId: string, x: number, y: number): City {
  return {
    id,
    name: `City-${id}`,
    position: { x, y },
    population: 1,
    playerId,
    buildings: [],
    production: null,
    food: 0,
    foodStorage: 0,
    foodStorageCapacity: 20,
    production_points: 0,
    science: 0,
    culture: 0,
    usedCityNames: [],
  } as unknown as City;
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    worldMap: makeMap(20, 10),
    units: [],
    cities: [],
    players: [
      { id: 'p1', isHuman: true, civilizationType: 'roman', name: 'P1' } as any,
      { id: 'p2', isHuman: false, civilizationType: 'greek', name: 'P2' } as any,
    ],
    currentPlayer: 'p1',
    turnNumber: 1,
    phase: GamePhase.PLAYER_TURN,
    gameOver: false,
    ...overrides,
  } as GameState;
}

function makeSystem(state: GameState): UnitMovementSystem {
  return new UnitMovementSystem(
    state,
    vi.fn(),  // emit
    vi.fn(),  // removeUnitFromQueue
    vi.fn(),  // initiateAutomaticCombat
    vi.fn(),  // checkForDefeatedPlayers
    vi.fn(),  // buildRoad
    vi.fn(),  // buildIrrigation
    vi.fn(),  // buildMine
    { isAtWar: vi.fn(() => false), getRelationship: vi.fn() } as any,  // diplomacyManager
  );
}

// ── isZoCExempt (static) ──────────────────────────────────────────────────────

describe('UnitMovementSystem.isZoCExempt', () => {
  it('returns true for Diplomat', () => {
    const unit = makeUnit(UnitType.DIPLOMAT, 'p1', 0, 0);
    expect(UnitMovementSystem.isZoCExempt(unit)).toBe(true);
  });

  it('returns true for Caravan', () => {
    const unit = makeUnit(UnitType.CARAVAN, 'p1', 0, 0);
    expect(UnitMovementSystem.isZoCExempt(unit)).toBe(true);
  });

  it('returns true for Trireme (naval)', () => {
    const unit = makeUnit(UnitType.TRIREME, 'p1', 0, 0);
    expect(UnitMovementSystem.isZoCExempt(unit)).toBe(true);
  });

  it('returns true for Sail (naval)', () => {
    const unit = makeUnit(UnitType.SAIL, 'p1', 0, 0);
    expect(UnitMovementSystem.isZoCExempt(unit)).toBe(true);
  });

  it('returns false for Militia (land)', () => {
    const unit = makeUnit(UnitType.MILITIA, 'p1', 0, 0);
    expect(UnitMovementSystem.isZoCExempt(unit)).toBe(false);
  });

  it('returns false for Legion (land)', () => {
    const unit = makeUnit(UnitType.LEGION, 'p1', 0, 0);
    expect(UnitMovementSystem.isZoCExempt(unit)).toBe(false);
  });

  it('returns false for Settlers (land special)', () => {
    const unit = makeUnit(UnitType.SETTLERS, 'p1', 0, 0);
    expect(UnitMovementSystem.isZoCExempt(unit)).toBe(false);
  });
});

// ── isInEnemyZoC ──────────────────────────────────────────────────────────────

describe('UnitMovementSystem.isInEnemyZoC', () => {
  let state: GameState;
  let system: UnitMovementSystem;

  beforeEach(() => {
    state = makeGameState();
    system = makeSystem(state);
  });

  it('returns false when no enemy units exist', () => {
    expect(system.isInEnemyZoC({ x: 5, y: 5 }, 'p1')).toBe(false);
  });

  it('returns false when position is the enemy unit tile itself', () => {
    // ZoC covers the 8 *adjacent* tiles, not the tile occupied by the unit
    state.units = [makeUnit(UnitType.MILITIA, 'p2', 5, 5)];
    expect(system.isInEnemyZoC({ x: 5, y: 5 }, 'p1')).toBe(false);
  });

  it('returns true for a tile directly adjacent (cardinal) to an enemy land unit', () => {
    state.units = [makeUnit(UnitType.MILITIA, 'p2', 5, 5)];
    expect(system.isInEnemyZoC({ x: 6, y: 5 }, 'p1')).toBe(true);  // east
    expect(system.isInEnemyZoC({ x: 4, y: 5 }, 'p1')).toBe(true);  // west
    expect(system.isInEnemyZoC({ x: 5, y: 6 }, 'p1')).toBe(true);  // south
    expect(system.isInEnemyZoC({ x: 5, y: 4 }, 'p1')).toBe(true);  // north
  });

  it('returns true for a tile diagonally adjacent to an enemy land unit', () => {
    state.units = [makeUnit(UnitType.LEGION, 'p2', 5, 5)];
    expect(system.isInEnemyZoC({ x: 6, y: 6 }, 'p1')).toBe(true);  // SE
    expect(system.isInEnemyZoC({ x: 4, y: 4 }, 'p1')).toBe(true);  // NW
  });

  it('returns false for a tile 2 or more steps away from the enemy unit', () => {
    state.units = [makeUnit(UnitType.MILITIA, 'p2', 5, 5)];
    expect(system.isInEnemyZoC({ x: 7, y: 5 }, 'p1')).toBe(false);
    expect(system.isInEnemyZoC({ x: 3, y: 5 }, 'p1')).toBe(false);
    expect(system.isInEnemyZoC({ x: 5, y: 8 }, 'p1')).toBe(false);
  });

  it('returns false when the only adjacent enemy is a Diplomat', () => {
    state.units = [makeUnit(UnitType.DIPLOMAT, 'p2', 5, 5)];
    expect(system.isInEnemyZoC({ x: 6, y: 5 }, 'p1')).toBe(false);
  });

  it('returns false when the only adjacent enemy is a Caravan', () => {
    state.units = [makeUnit(UnitType.CARAVAN, 'p2', 5, 5)];
    expect(system.isInEnemyZoC({ x: 6, y: 5 }, 'p1')).toBe(false);
  });

  it('returns false when the only adjacent enemy is a naval unit', () => {
    state.units = [makeUnit(UnitType.TRIREME, 'p2', 5, 5)];
    expect(system.isInEnemyZoC({ x: 6, y: 5 }, 'p1')).toBe(false);
  });

  it('ignores friendly units when checking ZoC', () => {
    state.units = [makeUnit(UnitType.MILITIA, 'p1', 5, 5)];
    // Own Militia adjacent — no ZoC
    expect(system.isInEnemyZoC({ x: 6, y: 5 }, 'p1')).toBe(false);
  });

  it('stack rule: multiple enemy units on the same tile produce only one ZoC source', () => {
    // Two enemies stacked — should behave identically to one
    state.units = [
      makeUnit(UnitType.MILITIA, 'p2', 5, 5),
      makeUnit(UnitType.LEGION, 'p2', 5, 5),
    ];
    // Tile (6,5) is in ZoC once — not double
    expect(system.isInEnemyZoC({ x: 6, y: 5 }, 'p1')).toBe(true);
    // Tile (7,5) is still outside ZoC (2 tiles away), stack doesn't expand range
    expect(system.isInEnemyZoC({ x: 7, y: 5 }, 'p1')).toBe(false);
  });

  it('handles horizontal wrap at the left/right map edge', () => {
    // Map width = 20.  Enemy at x=0; tile x=19 should be adjacent (west with wrap).
    state.units = [makeUnit(UnitType.MILITIA, 'p2', 0, 5)];
    expect(system.isInEnemyZoC({ x: 19, y: 5 }, 'p1')).toBe(true);
  });
});

// ── isZoCBlocked ──────────────────────────────────────────────────────────────

describe('UnitMovementSystem.isZoCBlocked', () => {
  let state: GameState;
  let system: UnitMovementSystem;
  let mover: Unit;

  beforeEach(() => {
    state = makeGameState();
    system = makeSystem(state);
    // Friendly land unit at (5,5)
    mover = makeUnit(UnitType.MILITIA, 'p1', 5, 5);
    state.units = [mover];
  });

  // ── basic pass-through ───────────────────────────────────────────────────

  it('is not blocked when from-tile is not in enemy ZoC', () => {
    // Enemy far away — (5,5) is not in ZoC
    state.units.push(makeUnit(UnitType.MILITIA, 'p2', 10, 10));
    expect(system.isZoCBlocked(mover, { x: 5, y: 5 }, { x: 6, y: 5 })).toBe(false);
  });

  it('is not blocked when from-tile is in ZoC but to-tile is not', () => {
    // Enemy at (6,5) → ZoC covers (5,5). Moving to (4,5) is outside ZoC.
    state.units.push(makeUnit(UnitType.MILITIA, 'p2', 6, 5));
    expect(system.isZoCBlocked(mover, { x: 5, y: 5 }, { x: 4, y: 5 })).toBe(false);
  });

  // ── core blocking ────────────────────────────────────────────────────────

  it('is blocked when both from- and to-tiles are in enemy ZoC', () => {
    // Enemy at (6,5) casts ZoC over both (5,5) and (5,4)
    state.units.push(makeUnit(UnitType.MILITIA, 'p2', 6, 5));
    expect(system.isZoCBlocked(mover, { x: 5, y: 5 }, { x: 5, y: 4 })).toBe(true);
  });

  it('is blocked by a wall of two enemies closing a gap (classic Civ 1 wall effect)', () => {
    // Two enemies: (4,4) and (4,6). Both cast ZoC over (5,5) and (5,5)→(5,4)/(5,6).
    // Moving (5,5)→(5,4) should be blocked because (5,4) is adjacent to enemy at (4,4).
    state.units.push(makeUnit(UnitType.LEGION, 'p2', 4, 4));
    state.units.push(makeUnit(UnitType.LEGION, 'p2', 4, 6));
    // (5,5) is in ZoC of enemy at (4,4) [adj] and (4,6) [adj]
    // (5,4) is in ZoC of enemy at (4,4) [adj]
    expect(system.isZoCBlocked(mover, { x: 5, y: 5 }, { x: 5, y: 4 })).toBe(true);
  });

  // ── exemptions ───────────────────────────────────────────────────────────

  it('Diplomat is never blocked even when surrounded by enemy ZoC', () => {
    const diplomat = makeUnit(UnitType.DIPLOMAT, 'p1', 5, 5);
    state.units.push(makeUnit(UnitType.LEGION, 'p2', 6, 5));
    // Both (5,5) and (5,4) are in enemy ZoC, but Diplomat is immune
    expect(system.isZoCBlocked(diplomat, { x: 5, y: 5 }, { x: 5, y: 4 })).toBe(false);
  });

  it('Caravan is never blocked even when surrounded by enemy ZoC', () => {
    const caravan = makeUnit(UnitType.CARAVAN, 'p1', 5, 5);
    state.units.push(makeUnit(UnitType.LEGION, 'p2', 6, 5));
    expect(system.isZoCBlocked(caravan, { x: 5, y: 5 }, { x: 5, y: 4 })).toBe(false);
  });

  it('Naval unit is never blocked by ZoC', () => {
    const trireme = makeUnit(UnitType.TRIREME, 'p1', 5, 5);
    state.units.push(makeUnit(UnitType.LEGION, 'p2', 6, 5));
    expect(system.isZoCBlocked(trireme, { x: 5, y: 5 }, { x: 5, y: 4 })).toBe(false);
  });

  // ── friendly city at destination ─────────────────────────────────────────

  it('is not blocked when destination is a friendly city (city neutralises ZoC)', () => {
    state.units.push(makeUnit(UnitType.MILITIA, 'p2', 6, 5));
    // Friendly city at the destination (5,4)
    state.cities = [makeCity('c1', 'p1', 5, 4)];
    expect(system.isZoCBlocked(mover, { x: 5, y: 5 }, { x: 5, y: 4 })).toBe(false);
  });

  it('is still blocked when destination is an enemy city (not friendly)', () => {
    state.units.push(makeUnit(UnitType.MILITIA, 'p2', 6, 5));
    // Enemy city at destination — ZoC still applies
    state.cities = [makeCity('c1', 'p2', 5, 4)];
    expect(system.isZoCBlocked(mover, { x: 5, y: 5 }, { x: 5, y: 4 })).toBe(true);
  });

  // ── railroad bypass ──────────────────────────────────────────────────────

  it('is not blocked when both from- and to-tiles have a railroad', () => {
    state.units.push(makeUnit(UnitType.MILITIA, 'p2', 6, 5));
    // Add railroad improvements to the tiles
    state.worldMap[5][5].improvements = [{ type: ImprovementType.RAILROAD, completedTurn: 1 }];
    state.worldMap[4][5].improvements = [{ type: ImprovementType.RAILROAD, completedTurn: 1 }];
    expect(system.isZoCBlocked(mover, { x: 5, y: 5 }, { x: 5, y: 4 })).toBe(false);
  });

  it('is still blocked when only from-tile has a railroad', () => {
    state.units.push(makeUnit(UnitType.MILITIA, 'p2', 6, 5));
    state.worldMap[5][5].improvements = [{ type: ImprovementType.RAILROAD, completedTurn: 1 }];
    // to-tile (5,4) has no railroad
    expect(system.isZoCBlocked(mover, { x: 5, y: 5 }, { x: 5, y: 4 })).toBe(true);
  });

  it('is still blocked when only to-tile has a railroad', () => {
    state.units.push(makeUnit(UnitType.MILITIA, 'p2', 6, 5));
    state.worldMap[4][5].improvements = [{ type: ImprovementType.RAILROAD, completedTurn: 1 }];
    expect(system.isZoCBlocked(mover, { x: 5, y: 5 }, { x: 5, y: 4 })).toBe(true);
  });

  it('railroad bypass works when a city sits on the from-tile (cities count as railroad)', () => {
    state.units.push(makeUnit(UnitType.MILITIA, 'p2', 6, 5));
    // Friendly city on from-tile acts as railroad for movement cost — should also bypass ZoC
    state.cities = [makeCity('c1', 'p1', 5, 5)];
    state.worldMap[4][5].improvements = [{ type: ImprovementType.RAILROAD, completedTurn: 1 }];
    expect(system.isZoCBlocked(mover, { x: 5, y: 5 }, { x: 5, y: 4 })).toBe(false);
  });
});

// ── Pathfinder ZoC integration ────────────────────────────────────────────────

describe('findPath with ZoC edge blocker', () => {
  it('routes around ZoC-blocked edges when isEdgeBlocked is provided', () => {
    /**
     * Layout (10×10 map, units at row 5):
     *
     *   Mover at (2,5); wants to reach (8,5).
     *   Enemy Legions at (4,5) and (5,5) form a ZoC wall at (3,5)–(6,5).
     *   Direct path along row 5 must detour north or south.
     */
    const state = makeGameState({ worldMap: makeMap(10, 10) });
    const mover = makeUnit(UnitType.MILITIA, 'p1', 2, 5);
    state.units = [
      mover,
      makeUnit(UnitType.LEGION, 'p2', 4, 5),
      makeUnit(UnitType.LEGION, 'p2', 5, 5),
    ];
    const system = makeSystem(state);

    // Without ZoC: direct path should exist
    const pathNoZoC = findPath(mover, { x: 8, y: 5 }, state);
    expect(pathNoZoC).not.toBeNull();

    // With ZoC: path should still exist (detour around ZoC wall)
    const isEdgeBlocked = (from: { x: number; y: number }, to: { x: number; y: number }) =>
      system.isZoCBlocked(mover, from, to);
    const pathWithZoC = findPath(mover, { x: 8, y: 5 }, state, isEdgeBlocked);
    expect(pathWithZoC).not.toBeNull();

    // Verify the ZoC-aware path does not use a blocked edge
    if (pathWithZoC) {
      const allPositions = [mover.position, ...pathWithZoC];
      for (let i = 0; i < allPositions.length - 1; i++) {
        const from = allPositions[i];
        const to = allPositions[i + 1];
        expect(system.isZoCBlocked(mover, from, to)).toBe(false);
      }
    }
  });

  it('returns null when ZoC completely seals off the destination', () => {
    /**
     * Mover at (1,1) wants to reach (1,3).
     * Four enemy Legions at (0,2),(1,2),(2,2),(1,0) form a ring — every tile
     * adjacent to the mover's only possible path is in ZoC and so is the
     * destination.
     *
     * Map is only 3×4 so there is no room to detour.
     */
    const state = makeGameState({ worldMap: makeMap(3, 4) });
    const mover = makeUnit(UnitType.MILITIA, 'p1', 1, 1);
    state.units = [
      mover,
      makeUnit(UnitType.LEGION, 'p2', 0, 2),
      makeUnit(UnitType.LEGION, 'p2', 1, 2),
      makeUnit(UnitType.LEGION, 'p2', 2, 2),
    ];
    const system = makeSystem(state);

    const isEdgeBlocked = (from: { x: number; y: number }, to: { x: number; y: number }) =>
      system.isZoCBlocked(mover, from, to);
    const path = findPath(mover, { x: 1, y: 3 }, state, isEdgeBlocked);
    expect(path).toBeNull();
  });

  it('Diplomat ignores ZoC and finds the direct path', () => {
    const state = makeGameState({ worldMap: makeMap(10, 10) });
    const diplomat = makeUnit(UnitType.DIPLOMAT, 'p1', 2, 5);
    state.units = [
      diplomat,
      makeUnit(UnitType.LEGION, 'p2', 4, 5),
      makeUnit(UnitType.LEGION, 'p2', 5, 5),
    ];
    const system = makeSystem(state);

    // isZoCExempt → no isEdgeBlocked callback → direct path
    const edgeBlocker = UnitMovementSystem.isZoCExempt(diplomat)
      ? undefined
      : (from: { x: number; y: number }, to: { x: number; y: number }) =>
          system.isZoCBlocked(diplomat, from, to);

    const path = findPath(diplomat, { x: 8, y: 5 }, state, edgeBlocker);
    expect(path).not.toBeNull();
    // Direct path stays on row 5
    expect(path!.some(p => p.y !== 5)).toBe(false);
  });
});
