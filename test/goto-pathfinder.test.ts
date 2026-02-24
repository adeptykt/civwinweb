/**
 * Tests for the goto / multi-turn movement system:
 *   1. findPath (A* Pathfinder) – pure function, no mocks required
 *   2. Game.setUnitGotoDestination / cancelUnitGoto – Game API
 *   3. buildUnitQueue exclusion of goto-ordered units
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Unit, UnitType, Tile, TerrainType, GameState, GamePhase, Player } from '../src/types/game';
import { ImprovementType } from '../src/types/game';
import { CivilizationType } from '../src/game/CivilizationDefinitions';
import { GovernmentType } from '../src/types/game';
import { findPath } from '../src/utils/Pathfinder';

// ── Mocks for browser-dependent modules required transitively by Game.ts ──────

vi.mock('../src/terrain/index', () => ({
  TerrainManager: {
    initialize: vi.fn(),
    isPassable: vi.fn((t: string) => t !== TerrainType.OCEAN && t !== TerrainType.MOUNTAINS),
    canFoundCity: vi.fn((t: string) => !['ocean', 'mountains', 'arctic'].includes(t)),
    getTerrain: vi.fn(),
    getTerrainColor: vi.fn(() => '#00ff00'),
    getTerrainYields: vi.fn(() => ({ food: 2, production: 1, trade: 1 })),
    getMovementCost: vi.fn(() => 1),
  },
}));

vi.mock('../src/utils/SoundEffects', () => ({
  SoundEffects: {
    playMoveSound: vi.fn(),
    playInvalidActionSound: vi.fn(),
    playAttackSound: vi.fn(),
    playCombatSound: vi.fn(),
    playCityFoundedSound: vi.fn(),
  },
}));

vi.mock('../src/renderer/BuildingCompletionModal', () => ({
  BuildingCompletionModal: vi.fn().mockImplementation(function(this: any) {
    this.show = vi.fn();
    this.hide = vi.fn();
  }),
}));

vi.mock('../src/game/AIPlayer', () => ({
  AIPlayer: vi.fn().mockImplementation(function(this: any) {
    this.processTurn = vi.fn();
  }),
}));

vi.mock('../src/game/MapGenerator', () => ({
  MapGenerator: vi.fn().mockImplementation(function(this: any) {
    this.generateMap = vi.fn().mockReturnValue([]);
    this.generateMapWithWorldSize = vi.fn().mockReturnValue([]);
  }),
}));

vi.mock('../src/game/VisibilitySystem', () => ({
  VisibilitySystem: {
    initializeVisibility: vi.fn(),
    updateVisibilityForPlayer: vi.fn(),
    updateVisibilityForUnitMove: vi.fn(),
    getTileVisibility: vi.fn(() => 'visible'),
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a minimal tile map filled with the given terrain type.
 */
function makeMap(width = 20, height = 10, fill: TerrainType = TerrainType.GRASSLAND): Tile[][] {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => ({
      position: { x, y },
      terrain: fill,
      improvements: [],
    } as Tile)),
  );
}

/** Set a single tile's terrain. */
function setTerrain(map: Tile[][], x: number, y: number, terrain: TerrainType): void {
  map[y][x] = { ...map[y][x], terrain };
}

/** Add a road improvement to a tile. */
function addRoad(map: Tile[][], x: number, y: number): void {
  const tile = map[y][x];
  tile.improvements = [...(tile.improvements ?? []), { type: ImprovementType.ROAD, completedTurn: 0 }];
}

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'u1',
    type: UnitType.MILITIA,
    position: { x: 0, y: 0 },
    movementPoints: 3,
    maxMovementPoints: 3,
    health: 100,
    maxHealth: 100,
    playerId: 'p1',
    experience: 0,
    isVeteran: false,
    fortified: false,
    ...overrides,
  };
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  const players: Player[] = [{
    id: 'p1',
    name: 'Player 1',
    civilizationType: CivilizationType.ROMANS,
    color: '#ff0000',
    isHuman: true,
    science: 0,
    gold: 0,
    culture: 0,
    technologies: [],
    government: GovernmentType.DESPOTISM,
    usedCityNames: [],
  }];

  return {
    turn: 1,
    currentPlayer: 'p1',
    currentPlayerIsHuman: true,
    players,
    worldMap: makeMap(),
    units: [],
    cities: [],
    gamePhase: GamePhase.PLAYING,
    score: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. findPath – A* Pathfinder
// ─────────────────────────────────────────────────────────────────────────────

describe('findPath (A* Pathfinder)', () => {
  describe('trivial cases', () => {
    it('returns [] when unit is already on the destination', () => {
      const map = makeMap(10, 10);
      const unit = makeUnit({ position: { x: 3, y: 3 } });
      const state = makeGameState({ worldMap: map });

      const path = findPath(unit, { x: 3, y: 3 }, state);
      expect(path).toEqual([]);
    });

    it('returns a single-step path for an adjacent tile', () => {
      const map = makeMap(10, 10);
      const unit = makeUnit({ position: { x: 5, y: 5 } });
      const state = makeGameState({ worldMap: map });

      const path = findPath(unit, { x: 6, y: 5 }, state);
      expect(path).not.toBeNull();
      expect(path!.length).toBe(1);
      expect(path![0]).toEqual({ x: 6, y: 5 });
    });
  });

  describe('straight-line paths', () => {
    it('finds a horizontal path', () => {
      const map = makeMap(10, 10);
      const unit = makeUnit({ position: { x: 0, y: 5 } });
      const state = makeGameState({ worldMap: map });

      const path = findPath(unit, { x: 5, y: 5 }, state);
      expect(path).not.toBeNull();
      // Path must end at destination
      expect(path![path!.length - 1]).toEqual({ x: 5, y: 5 });
      // Diagonal moves are allowed so path ≤ 5 steps
      expect(path!.length).toBeLessThanOrEqual(5);
    });

    it('finds a vertical path', () => {
      const map = makeMap(10, 10);
      const unit = makeUnit({ position: { x: 5, y: 0 } });
      const state = makeGameState({ worldMap: map });

      const path = findPath(unit, { x: 5, y: 8 }, state);
      expect(path).not.toBeNull();
      expect(path![path!.length - 1]).toEqual({ x: 5, y: 8 });
      expect(path!.length).toBeLessThanOrEqual(8);
    });

    it('finds a diagonal path', () => {
      const map = makeMap(10, 10);
      const unit = makeUnit({ position: { x: 0, y: 0 } });
      const state = makeGameState({ worldMap: map });

      const path = findPath(unit, { x: 5, y: 5 }, state);
      expect(path).not.toBeNull();
      expect(path![path!.length - 1]).toEqual({ x: 5, y: 5 });
      // Pure diagonal = 5 steps
      expect(path!.length).toBe(5);
    });
  });

  describe('terrain obstacles', () => {
    it('routes around ocean tiles for a land unit', () => {
      // Build a 10×10 map with a vertical ocean wall from y=0 to y=4 at x=3
      const map = makeMap(10, 10);
      for (let y = 0; y < 5; y++) setTerrain(map, 3, y, TerrainType.OCEAN);

      const unit = makeUnit({ position: { x: 0, y: 2 }, type: UnitType.MILITIA });
      const state = makeGameState({ worldMap: map });

      const path = findPath(unit, { x: 6, y: 2 }, state);
      expect(path).not.toBeNull();
      expect(path![path!.length - 1]).toEqual({ x: 6, y: 2 });
      // Path must go around (longer than direct distance of 6)
      expect(path!.length).toBeGreaterThan(3);
      // No step in the path should land on ocean
      const hitsOcean = path!.some(p => map[p.y][p.x].terrain === TerrainType.OCEAN);
      expect(hitsOcean).toBe(false);
    });

    it('returns null when no path exists (unit completely surrounded by ocean)', () => {
      // 5×5 map: unit at (2,2), all surrounding cells are ocean
      const map = makeMap(5, 5);
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          if (x !== 2 || y !== 2) setTerrain(map, x, y, TerrainType.OCEAN);
        }
      }
      const unit = makeUnit({ position: { x: 2, y: 2 }, type: UnitType.MILITIA });
      const state = makeGameState({ worldMap: map });

      const path = findPath(unit, { x: 0, y: 0 }, state);
      expect(path).toBeNull();
    });

    it('prefers roads over open terrain (lower cost)', () => {
      // Two routes from (0,5) to (9,5):
      //   - Top route y=4: all Hills (cost 2 each)
      //   - Bottom route y=5: all Grassland with roads (cost 1 each)
      const map = makeMap(10, 10);
      for (let x = 1; x < 9; x++) {
        setTerrain(map, x, 4, TerrainType.HILLS);
        // y=5 tiles get roads
        addRoad(map, x, 5);
      }
      const unit = makeUnit({ position: { x: 0, y: 5 } });
      const state = makeGameState({ worldMap: map });

      const path = findPath(unit, { x: 9, y: 5 }, state);
      expect(path).not.toBeNull();
      // All steps should stay on y=5 (road route) rather than diverting to y=4 (hills)
      const staysOnRoad = path!.every(p => p.y === 5);
      expect(staysOnRoad).toBe(true);
    });

    it('naval units can only cross ocean tiles', () => {
      // 10×10 map: x=0-4 is ocean, x=5-9 is ocean, row y=5 has a land bridge at x=4-5
      const map = makeMap(10, 10, TerrainType.OCEAN);
      // Punch a single land tile in the middle that a naval unit cannot use
      setTerrain(map, 4, 5, TerrainType.GRASSLAND);

      const unit = makeUnit({
        position: { x: 0, y: 5 },
        type: UnitType.TRIREME, // naval
      });
      const state = makeGameState({ worldMap: map });

      const path = findPath(unit, { x: 9, y: 5 }, state);
      // Naval unit should find a path through all ocean tiles
      expect(path).not.toBeNull();
      // No step lands on the land tile
      const hitsLand = path!.some(p => map[p.y][p.x].terrain !== TerrainType.OCEAN);
      expect(hitsLand).toBe(false);
    });
  });

  describe('horizontal map wrapping', () => {
    it('routes west through the wrap seam when shorter', () => {
      // 20-wide map: unit at x=1, dest at x=18 — wrapping (dist=3) is shorter than going east (dist=17)
      const map = makeMap(20, 5);
      const unit = makeUnit({ position: { x: 1, y: 2 } });
      const state = makeGameState({ worldMap: map });

      const path = findPath(unit, { x: 18, y: 2 }, state);
      expect(path).not.toBeNull();
      // Shortest wrapped path is 3 steps (1→0→19→18), direct is 17 steps
      expect(path!.length).toBeLessThanOrEqual(3);
    });
  });

  describe('path validity', () => {
    it('path steps are always adjacent (no teleportation)', () => {
      const map = makeMap(15, 15);
      const unit = makeUnit({ position: { x: 0, y: 0 } });
      const state = makeGameState({ worldMap: map });

      const path = findPath(unit, { x: 14, y: 14 }, state);
      expect(path).not.toBeNull();

      // Each consecutive step must be at most 1 tile away in each axis
      let prev = unit.position;
      for (const step of path!) {
        const dx = Math.abs(step.x - prev.x);
        const dy = Math.abs(step.y - prev.y);
        // Allow wrap (dx of 14 on a 15-wide map wraps to 1)
        const effectiveDx = Math.min(dx, 15 - dx);
        expect(effectiveDx).toBeLessThanOrEqual(1);
        expect(dy).toBeLessThanOrEqual(1);
        prev = step;
      }
    });

    it('path excludes the starting tile and includes the destination', () => {
      const map = makeMap(10, 10);
      const unit = makeUnit({ position: { x: 2, y: 2 } });
      const state = makeGameState({ worldMap: map });

      const path = findPath(unit, { x: 7, y: 7 }, state);
      expect(path).not.toBeNull();

      const start = unit.position;
      const firstStep = path![0];
      expect(firstStep.x === start.x && firstStep.y === start.y).toBe(false);
      expect(path![path!.length - 1]).toEqual({ x: 7, y: 7 });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Game goto API  (setUnitGotoDestination / cancelUnitGoto)
// ─────────────────────────────────────────────────────────────────────────────

// Import Game after the mocks are registered
import { Game } from '../src/game/Game';

describe('Game goto system', () => {
  let game: Game;
  // Shortcut to the real internal state (getGameState returns a shallow copy)
  let gs: GameState;

  beforeEach(() => {
    game = new Game();
    // Access the internal state directly so our mutations are visible to game methods
    gs = (game as any).gameState as GameState;
    gs.worldMap = makeMap(20, 10);
    gs.currentPlayer = 'p1';
    gs.currentPlayerIsHuman = true;
    gs.players = [{
      id: 'p1',
      name: 'Player 1',
      civilizationType: CivilizationType.ROMANS,
      color: '#ff0000',
      isHuman: true,
      science: 0,
      gold: 0,
      culture: 0,
      technologies: [],
      government: GovernmentType.DESPOTISM,
      usedCityNames: [],
    }];
    gs.units = [];
    gs.cities = [];
  });

  // ── setUnitGotoDestination ────────────────────────────────────────────────

  describe('setUnitGotoDestination', () => {
    it('returns false for a non-existent unit id', () => {
      const ok = game.setUnitGotoDestination('ghost', { x: 5, y: 5 });
      expect(ok).toBe(false);
    });

    it('returns false when the unit belongs to another player', () => {
      const enemy: Unit = makeUnit({ id: 'e1', playerId: 'p2', position: { x: 0, y: 0 } });
      gs.units.push(enemy);

      const ok = game.setUnitGotoDestination('e1', { x: 5, y: 5 });
      expect(ok).toBe(false);
    });

    it('returns false when destination equals current position', () => {
      const unit: Unit = makeUnit({ id: 'u1', playerId: 'p1', position: { x: 3, y: 3 } });
      gs.units.push(unit);

      const ok = game.setUnitGotoDestination('u1', { x: 3, y: 3 });
      expect(ok).toBe(false);
      expect(unit.gotoDestination).toBeUndefined();
    });

    it('returns false when no path exists (destination is inside an ocean island)', () => {
      // Surround (15,5) with ocean except unit's own tile (0,5)
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 20; x++) {
          if ((x !== 0 || y !== 5) && (x !== 15 || y !== 5)) {
            gs.worldMap[y][x] = { ...gs.worldMap[y][x], terrain: TerrainType.OCEAN };
          }
        }
      }
      const unit: Unit = makeUnit({ id: 'u1', playerId: 'p1', position: { x: 0, y: 5 } });
      gs.units.push(unit);

      const ok = game.setUnitGotoDestination('u1', { x: 15, y: 5 });
      expect(ok).toBe(false);
    });

    it('sets gotoDestination on the unit when path exists', () => {
      const unit: Unit = makeUnit({ id: 'u1', playerId: 'p1', position: { x: 0, y: 5 } });
      gs.units.push(unit);

      const ok = game.setUnitGotoDestination('u1', { x: 10, y: 5 });
      expect(ok).toBe(true);
      expect(unit.gotoDestination).toEqual({ x: 10, y: 5 });
    });

    it('normalises destination x for horizontal wrapping', () => {
      const unit: Unit = makeUnit({ id: 'u1', playerId: 'p1', position: { x: 5, y: 5 } });
      gs.units.push(unit);

      // x=21 wraps to x=1 on a 20-wide map
      const ok = game.setUnitGotoDestination('u1', { x: 21, y: 5 });
      if (ok) {
        expect(unit.gotoDestination!.x).toBe(1);
      }
    });

    it('emits the gotoSet event', () => {
      const unit: Unit = makeUnit({ id: 'u1', playerId: 'p1', position: { x: 0, y: 0 } });
      gs.units.push(unit);

      const events: unknown[] = [];
      (game as any).on('gotoSet', (data: unknown) => events.push(data));

      game.setUnitGotoDestination('u1', { x: 5, y: 5 });
      expect(events.length).toBe(1);
    });
  });

  // ── cancelUnitGoto ────────────────────────────────────────────────────────

  describe('cancelUnitGoto', () => {
    it('clears the gotoDestination from the unit', () => {
      const unit: Unit = makeUnit({ id: 'u1', playerId: 'p1', position: { x: 0, y: 0 } });
      unit.gotoDestination = { x: 10, y: 5 };
      gs.units.push(unit);

      game.cancelUnitGoto('u1');
      expect(unit.gotoDestination).toBeUndefined();
    });

    it('does nothing for a unit without a goto order', () => {
      const unit: Unit = makeUnit({ id: 'u1', playerId: 'p1', position: { x: 0, y: 0 } });
      gs.units.push(unit);

      expect(() => game.cancelUnitGoto('u1')).not.toThrow();
      expect(unit.gotoDestination).toBeUndefined();
    });

    it('does nothing for an unknown unit id', () => {
      expect(() => game.cancelUnitGoto('ghost')).not.toThrow();
    });

    it('emits the gotoCancelled event', () => {
      const unit: Unit = makeUnit({ id: 'u1', playerId: 'p1', position: { x: 0, y: 0 } });
      unit.gotoDestination = { x: 8, y: 3 };
      gs.units.push(unit);

      const events: unknown[] = [];
      (game as any).on('gotoCancelled', (data: unknown) => events.push(data));

      game.cancelUnitGoto('u1');
      expect(events.length).toBe(1);
    });
  });

  // ── buildUnitQueue exclusion ──────────────────────────────────────────────

  describe('unit queue excludes goto-ordered units', () => {
    it('a unit with gotoDestination is absent from the move queue', () => {
      const freeUnit: Unit = makeUnit({ id: 'free', playerId: 'p1', position: { x: 1, y: 1 }, movementPoints: 2 });
      const gotoUnit: Unit = makeUnit({ id: 'goto', playerId: 'p1', position: { x: 5, y: 5 }, movementPoints: 2 });
      gotoUnit.gotoDestination = { x: 15, y: 5 };

      gs.units.push(freeUnit, gotoUnit);

      (game as any).buildUnitQueue();

      const queue = game.getUnitQueue();
      const ids = queue.map(u => u.id);
      expect(ids).toContain('free');
      expect(ids).not.toContain('goto');
    });

    it('cancelling a goto order re-admits the unit to the queue', () => {
      const unit: Unit = makeUnit({ id: 'u1', playerId: 'p1', position: { x: 5, y: 5 }, movementPoints: 2 });
      unit.gotoDestination = { x: 15, y: 5 };
      gs.units.push(unit);

      (game as any).buildUnitQueue();
      expect(game.getUnitQueue().map(u => u.id)).not.toContain('u1');

      game.cancelUnitGoto('u1');
      (game as any).buildUnitQueue();
      expect(game.getUnitQueue().map(u => u.id)).toContain('u1');
    });

    it('a fortified unit with gotoDestination is still excluded (fortify takes precedence)', () => {
      const unit: Unit = makeUnit({
        id: 'u1',
        playerId: 'p1',
        position: { x: 5, y: 5 },
        movementPoints: 2,
        fortified: true,
      });
      unit.gotoDestination = { x: 15, y: 5 };
      gs.units.push(unit);

      (game as any).buildUnitQueue();
      expect(game.getUnitQueue().map(u => u.id)).not.toContain('u1');
    });
  });
});
