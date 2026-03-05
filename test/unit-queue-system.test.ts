/**
 * UnitQueueSystem unit tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

// DebugSystem is a singleton — stub to a known value
vi.mock('../src/utils/DebugSystem', () => ({
  DebugSystem: {
    getInstance: vi.fn(() => ({
      isCiv2EnhancementsEnabled: vi.fn(() => false),
      logGameEvent: vi.fn(),
      isAiDevTestEnabled: vi.fn(() => false),
    })),
  },
}));

import { UnitQueueSystem } from '../src/game/UnitQueueSystem';
import { SettingsManager } from '../src/utils/SettingsManager';
import type { GameState, Player, Unit } from '../src/types/game';
import { GamePhase, GovernmentType, UnitType } from '../src/types/game';

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

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: `u-${Math.random().toString(36).slice(2)}`,
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
    buildingRoad: false,
    buildingMine: false,
    automating: false,
    ...overrides,
  };
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    turn: 1,
    currentPlayer: 'p1',
    currentPlayerIsHuman: true,
    players: [makePlayer()],
    worldMap: [],
    units: [],
    cities: [],
    gamePhase: GamePhase.PLAYING,
    score: 0,
    difficulty: 'chieftain',
    ...overrides,
  } as GameState;
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('UnitQueueSystem', () => {
  let gameState: GameState;
  let emitFn: ReturnType<typeof vi.fn>;
  let endTurnFn: ReturnType<typeof vi.fn>;
  let getCurrentPlayerFn: ReturnType<typeof vi.fn>;
  let system: UnitQueueSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    gameState = makeGameState();
    emitFn = vi.fn();
    endTurnFn = vi.fn();
    getCurrentPlayerFn = vi.fn(() => makePlayer({ id: 'p1', isHuman: true }));
    system = new UnitQueueSystem(gameState, emitFn, endTurnFn, getCurrentPlayerFn);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── buildUnitQueue ─────────────────────────────────────────────────────────

  describe('buildUnitQueue', () => {
    it('includes active units for the current player', () => {
      const u1 = makeUnit({ id: 'u1', playerId: 'p1' });
      const u2 = makeUnit({ id: 'u2', playerId: 'p1' });
      gameState.units.push(u1, u2);

      system.buildUnitQueue();

      expect(system.getUnitQueue().map(u => u.id)).toEqual(['u1', 'u2']);
    });

    it('excludes units with no movement points', () => {
      const u1 = makeUnit({ id: 'u1', movementPoints: 0 });
      gameState.units.push(u1);

      system.buildUnitQueue();

      expect(system.getUnitQueueSize()).toBe(0);
    });

    it('excludes fortified units', () => {
      const u1 = makeUnit({ id: 'u1', fortified: true });
      gameState.units.push(u1);

      system.buildUnitQueue();

      expect(system.getUnitQueueSize()).toBe(0);
    });

    it('excludes sleeping units', () => {
      const u1 = makeUnit({ id: 'u1', sleeping: true });
      gameState.units.push(u1);

      system.buildUnitQueue();

      expect(system.getUnitQueueSize()).toBe(0);
    });

    it('excludes units that are building a road', () => {
      const u1 = makeUnit({ id: 'u1', buildingRoad: true });
      gameState.units.push(u1);

      system.buildUnitQueue();

      expect(system.getUnitQueueSize()).toBe(0);
    });

    it('excludes units that are building a mine', () => {
      const u1 = makeUnit({ id: 'u1', buildingMine: true });
      gameState.units.push(u1);

      system.buildUnitQueue();

      expect(system.getUnitQueueSize()).toBe(0);
    });

    it('excludes units with an active goto destination', () => {
      const u1 = makeUnit({ id: 'u1' });
      u1.gotoDestination = { x: 5, y: 5 };
      gameState.units.push(u1);

      system.buildUnitQueue();

      expect(system.getUnitQueueSize()).toBe(0);
    });

    it('excludes automating settler units', () => {
      const u1 = makeUnit({ id: 'u1', automating: true });
      gameState.units.push(u1);

      system.buildUnitQueue();

      expect(system.getUnitQueueSize()).toBe(0);
    });

    it('excludes units belonging to other players', () => {
      const enemy = makeUnit({ id: 'enemy', playerId: 'p2' });
      gameState.units.push(enemy);

      system.buildUnitQueue();

      expect(system.getUnitQueueSize()).toBe(0);
    });

    it('resets currentUnitIndex to 0', () => {
      const u1 = makeUnit({ id: 'u1' });
      const u2 = makeUnit({ id: 'u2' });
      gameState.units.push(u1, u2);
      system.buildUnitQueue();
      system.selectNextUnit(); // move index to 1

      // Rebuild — index should reset to 0
      system.buildUnitQueue();
      expect(system.getUnitQueueIndex()).toBe(1); // 1-based, index 0
    });

    it('emits endOfTurn when no units are eligible', () => {
      system.buildUnitQueue();

      expect(emitFn).toHaveBeenCalledWith('endOfTurn');
    });

    it('does not emit endOfTurn when queue has units', () => {
      gameState.units.push(makeUnit({ id: 'u1' }));
      system.buildUnitQueue();

      expect(emitFn).not.toHaveBeenCalledWith('endOfTurn');
    });

    it('excludes fortifying units', () => {
      const u1 = makeUnit({ id: 'u1', fortifying: true } as any);
      gameState.units.push(u1);

      system.buildUnitQueue();

      expect(system.getUnitQueueSize()).toBe(0);
    });
  });

  // ── selectNextUnit ─────────────────────────────────────────────────────────

  describe('selectNextUnit', () => {
    it('cycles to the next unit and emits unitSelected', () => {
      const u1 = makeUnit({ id: 'u1' });
      const u2 = makeUnit({ id: 'u2' });
      gameState.units.push(u1, u2);
      system.buildUnitQueue();
      emitFn.mockClear();

      system.selectNextUnit();

      const call = emitFn.mock.calls.find(([e]) => e === 'unitSelected');
      expect(call).toBeDefined();
      expect(call![1].unit.id).toBe('u2');
    });

    it('wraps from the last unit back to the first', () => {
      const u1 = makeUnit({ id: 'u1' });
      const u2 = makeUnit({ id: 'u2' });
      gameState.units.push(u1, u2);
      system.buildUnitQueue();
      system.selectNextUnit(); // index → 1
      emitFn.mockClear();

      system.selectNextUnit(); // wraps → 0

      const call = emitFn.mock.calls.find(([e]) => e === 'unitSelected');
      expect(call![1].unit.id).toBe('u1');
    });

    it('calls clearCurrentUnit (emits unitDeselected) when queue is empty', () => {
      system.selectNextUnit();

      expect(emitFn).toHaveBeenCalledWith('unitDeselected');
    });

    it('skips a fortified unit and selects the next eligible one', () => {
      const u1 = makeUnit({ id: 'u1' });
      const u2 = makeUnit({ id: 'u2', fortified: true }); // manually inserted into queue
      const u3 = makeUnit({ id: 'u3' });
      // Directly push into queue to test skip logic (bypassing buildUnitQueue filter)
      (system as any).unitQueue = [u1, u2, u3];
      (system as any).currentUnitIndex = 0;
      emitFn.mockClear();

      system.selectNextUnit();

      const call = emitFn.mock.calls.find(([e]) => e === 'unitSelected');
      expect(call![1].unit.id).toBe('u3');
    });
  });

  // ── selectPreviousUnit ─────────────────────────────────────────────────────

  describe('selectPreviousUnit', () => {
    it('moves to the previous unit', () => {
      const u1 = makeUnit({ id: 'u1' });
      const u2 = makeUnit({ id: 'u2' });
      gameState.units.push(u1, u2);
      system.buildUnitQueue();
      system.selectNextUnit(); // now at u2
      emitFn.mockClear();

      system.selectPreviousUnit();

      const call = emitFn.mock.calls.find(([e]) => e === 'unitSelected');
      expect(call![1].unit.id).toBe('u1');
    });

    it('wraps from the first unit to the last', () => {
      const u1 = makeUnit({ id: 'u1' });
      const u2 = makeUnit({ id: 'u2' });
      gameState.units.push(u1, u2);
      system.buildUnitQueue(); // at index 0 = u1
      emitFn.mockClear();

      system.selectPreviousUnit(); // should wrap to u2

      const call = emitFn.mock.calls.find(([e]) => e === 'unitSelected');
      expect(call![1].unit.id).toBe('u2');
    });

    it('emits unitDeselected when queue is empty', () => {
      system.selectPreviousUnit();
      expect(emitFn).toHaveBeenCalledWith('unitDeselected');
    });
  });

  // ── getCurrentUnit ─────────────────────────────────────────────────────────

  describe('getCurrentUnit', () => {
    it('returns null when the queue is empty', () => {
      expect(system.getCurrentUnit()).toBeNull();
    });

    it('returns the unit at the current index', () => {
      const u1 = makeUnit({ id: 'u1' });
      const u2 = makeUnit({ id: 'u2' });
      gameState.units.push(u1, u2);
      system.buildUnitQueue();
      system.selectNextUnit(); // move to u2

      expect(system.getCurrentUnit()!.id).toBe('u2');
    });
  });

  // ── Queue accessors ────────────────────────────────────────────────────────

  describe('getUnitQueueSize / getUnitQueueIndex / getUnitQueue', () => {
    it('getUnitQueueSize returns the number of queued units', () => {
      gameState.units.push(makeUnit({ id: 'u1' }), makeUnit({ id: 'u2' }));
      system.buildUnitQueue();
      expect(system.getUnitQueueSize()).toBe(2);
    });

    it('getUnitQueueIndex returns 0 when queue is empty', () => {
      expect(system.getUnitQueueIndex()).toBe(0);
    });

    it('getUnitQueueIndex returns 1-based position', () => {
      gameState.units.push(makeUnit({ id: 'u1' }), makeUnit({ id: 'u2' }));
      system.buildUnitQueue();
      expect(system.getUnitQueueIndex()).toBe(1); // first unit = position 1
      system.selectNextUnit();
      expect(system.getUnitQueueIndex()).toBe(2); // second unit = position 2
    });

    it('getUnitQueue returns a shallow copy of the queue', () => {
      const u1 = makeUnit({ id: 'u1' });
      gameState.units.push(u1);
      system.buildUnitQueue();

      const copy = system.getUnitQueue();
      expect(copy).toHaveLength(1);
      expect(copy[0]).toBe(u1);
      // Mutating the copy should not affect the internal queue
      copy.pop();
      expect(system.getUnitQueueSize()).toBe(1);
    });
  });

  // ── removeUnitFromQueue ────────────────────────────────────────────────────

  describe('removeUnitFromQueue', () => {
    it('does nothing for a unit not in the queue', () => {
      gameState.units.push(makeUnit({ id: 'u1' }));
      system.buildUnitQueue();

      system.removeUnitFromQueue('not-in-queue');

      expect(system.getUnitQueueSize()).toBe(1);
    });

    it('removes the specified unit', () => {
      const u1 = makeUnit({ id: 'u1' });
      const u2 = makeUnit({ id: 'u2' });
      gameState.units.push(u1, u2);
      system.buildUnitQueue();

      system.removeUnitFromQueue('u1');

      expect(system.getUnitQueue().map(u => u.id)).toEqual(['u2']);
    });

    it('selects current unit when queue still has entries', () => {
      const u1 = makeUnit({ id: 'u1' });
      const u2 = makeUnit({ id: 'u2' });
      gameState.units.push(u1, u2);
      system.buildUnitQueue();
      emitFn.mockClear();

      system.removeUnitFromQueue('u1');

      const call = emitFn.mock.calls.find(([e]) => e === 'unitSelected');
      expect(call).toBeDefined();
    });

    it('auto-advances turn for a human player when all units are exhausted', () => {
      const u1 = makeUnit({ id: 'u1' });
      gameState.units.push(u1);
      system.buildUnitQueue(); // initialUnitQueueSize = 1

      system.removeUnitFromQueue('u1');

      expect(endTurnFn).toHaveBeenCalledTimes(1);
    });

    it('emits endOfTurn instead of calling endTurn when requireEndOfTurn setting is on', () => {
      const getSetting = vi.fn((key: string) => key === 'requireEndOfTurn');
      (SettingsManager.getInstance as any).mockReturnValueOnce({ getSetting });

      const u1 = makeUnit({ id: 'u1' });
      gameState.units.push(u1);
      system.buildUnitQueue();

      system.removeUnitFromQueue('u1');

      expect(endTurnFn).not.toHaveBeenCalled();
      expect(emitFn).toHaveBeenCalledWith('endOfTurn');
    });

    it('does not auto-advance for an AI player', () => {
      getCurrentPlayerFn.mockReturnValue(makePlayer({ id: 'p1', isHuman: false }));
      const u1 = makeUnit({ id: 'u1' });
      gameState.units.push(u1);
      system.buildUnitQueue();

      system.removeUnitFromQueue('u1');

      expect(endTurnFn).not.toHaveBeenCalled();
    });

    it('does not auto-advance when the turn started with no units (initialUnitQueueSize=0)', () => {
      // Build with no units first so initialUnitQueueSize = 0
      system.buildUnitQueue();

      // Manually inject a unit into the queue to test the edge case
      const u1 = makeUnit({ id: 'u1' });
      (system as any).unitQueue = [u1];

      system.removeUnitFromQueue('u1');

      expect(endTurnFn).not.toHaveBeenCalled();
    });

    it('sets the autoAdvanceTriggered flag when auto-advancing', () => {
      const u1 = makeUnit({ id: 'u1' });
      gameState.units.push(u1);
      system.buildUnitQueue();

      system.removeUnitFromQueue('u1');

      expect(system.wasAutoAdvanceTriggered()).toBe(true);
    });
  });

  // ── wasAutoAdvanceTriggered ────────────────────────────────────────────────

  describe('wasAutoAdvanceTriggered', () => {
    it('returns false by default', () => {
      expect(system.wasAutoAdvanceTriggered()).toBe(false);
    });

    it('returns true after auto-advance, then resets to false', () => {
      const u1 = makeUnit({ id: 'u1' });
      gameState.units.push(u1);
      system.buildUnitQueue();
      system.removeUnitFromQueue('u1'); // triggers auto-advance

      expect(system.wasAutoAdvanceTriggered()).toBe(true);
      // Second call resets the flag
      expect(system.wasAutoAdvanceTriggered()).toBe(false);
    });
  });

  // ── activateUnit ───────────────────────────────────────────────────────────

  describe('activateUnit', () => {
    it('returns false for a non-existent unit', () => {
      expect(system.activateUnit('no-such-unit')).toBe(false);
    });

    it('returns false for a unit with no movement points', () => {
      const u1 = makeUnit({ id: 'u1', movementPoints: 0 });
      gameState.units.push(u1);

      expect(system.activateUnit('u1')).toBe(false);
    });

    it('clears all idle flags on the unit', () => {
      const u1 = makeUnit({ id: 'u1', sleeping: true, fortified: true, automating: true });
      gameState.units.push(u1);

      system.activateUnit('u1');

      expect(u1.sleeping).toBe(false);
      expect(u1.fortified).toBe(false);
      expect(u1.automating).toBe(false);
    });

    it('inserts unit at the front of the queue when not already present', () => {
      const u1 = makeUnit({ id: 'u1' });
      const u2 = makeUnit({ id: 'u2' });
      gameState.units.push(u1, u2);
      system.buildUnitQueue(); // u1, u2 in queue

      const u3 = makeUnit({ id: 'u3' }); // not in the queue
      gameState.units.push(u3);

      system.activateUnit('u3');

      expect(system.getUnitQueue()[0].id).toBe('u3');
      expect(system.getCurrentUnit()!.id).toBe('u3');
    });

    it('promotes an already-queued unit to the front', () => {
      const u1 = makeUnit({ id: 'u1' });
      const u2 = makeUnit({ id: 'u2' });
      gameState.units.push(u1, u2);
      system.buildUnitQueue(); // u1 at index 0

      system.activateUnit('u2');

      expect(system.getUnitQueue()[0].id).toBe('u2');
    });

    it('emits unitSelected with centerIfNeeded=true', () => {
      const u1 = makeUnit({ id: 'u1' });
      gameState.units.push(u1);
      emitFn.mockClear();

      system.activateUnit('u1');

      const call = emitFn.mock.calls.find(([e]) => e === 'unitSelected');
      expect(call![1].centerIfNeeded).toBe(true);
    });

    it('returns true on success', () => {
      const u1 = makeUnit({ id: 'u1' });
      gameState.units.push(u1);

      expect(system.activateUnit('u1')).toBe(true);
    });
  });

  // ── promoteUnitToFront ─────────────────────────────────────────────────────

  describe('promoteUnitToFront', () => {
    it('moves a unit from the back to the front', () => {
      const u1 = makeUnit({ id: 'u1' });
      const u2 = makeUnit({ id: 'u2' });
      const u3 = makeUnit({ id: 'u3' });
      gameState.units.push(u1, u2, u3);
      system.buildUnitQueue(); // [u1, u2, u3], index=0

      system.promoteUnitToFront('u3');

      expect(system.getUnitQueue().map(u => u.id)).toEqual(['u3', 'u1', 'u2']);
      expect(system.getCurrentUnit()!.id).toBe('u3');
    });

    it('does nothing when unit is already at the front', () => {
      const u1 = makeUnit({ id: 'u1' });
      const u2 = makeUnit({ id: 'u2' });
      gameState.units.push(u1, u2);
      system.buildUnitQueue();
      emitFn.mockClear();

      system.promoteUnitToFront('u1'); // already at front

      expect(emitFn).not.toHaveBeenCalled();
    });

    it('does nothing when unit is not in the queue', () => {
      const u1 = makeUnit({ id: 'u1' });
      gameState.units.push(u1);
      system.buildUnitQueue();
      emitFn.mockClear();

      system.promoteUnitToFront('not-in-queue');

      expect(emitFn).not.toHaveBeenCalled();
    });

    it('emits unitSelected with centerIfNeeded=true', () => {
      const u1 = makeUnit({ id: 'u1' });
      const u2 = makeUnit({ id: 'u2' });
      gameState.units.push(u1, u2);
      system.buildUnitQueue();
      emitFn.mockClear();

      system.promoteUnitToFront('u2');

      const call = emitFn.mock.calls.find(([e]) => e === 'unitSelected');
      expect(call![1].centerIfNeeded).toBe(true);
    });
  });

  // ── filterQueueByPlayer ────────────────────────────────────────────────────

  describe('filterQueueByPlayer', () => {
    it('removes all units belonging to the specified player', () => {
      const u1 = makeUnit({ id: 'u1', playerId: 'p1' });
      const u2 = makeUnit({ id: 'u2', playerId: 'p2' });
      const u3 = makeUnit({ id: 'u3', playerId: 'p1' });
      (system as any).unitQueue = [u1, u2, u3];

      system.filterQueueByPlayer('p1');

      expect(system.getUnitQueue().map(u => u.id)).toEqual(['u2']);
    });

    it('keeps units from other players intact', () => {
      const u1 = makeUnit({ id: 'u1', playerId: 'p2' });
      (system as any).unitQueue = [u1];

      system.filterQueueByPlayer('p1');

      expect(system.getUnitQueueSize()).toBe(1);
    });
  });

  // ── ensureUnitInQueueAndSelect ─────────────────────────────────────────────

  describe('ensureUnitInQueueAndSelect', () => {
    it('adds a unit that is not yet in the queue', () => {
      const u1 = makeUnit({ id: 'u1' });

      system.ensureUnitInQueueAndSelect(u1);

      expect(system.getUnitQueueSize()).toBe(1);
      expect(system.getCurrentUnit()!.id).toBe('u1');
    });

    it('does not duplicate a unit already in the queue', () => {
      const u1 = makeUnit({ id: 'u1' });
      const u2 = makeUnit({ id: 'u2' });
      (system as any).unitQueue = [u1, u2];

      system.ensureUnitInQueueAndSelect(u1);

      expect(system.getUnitQueueSize()).toBe(2);
    });

    it('emits unitSelected', () => {
      const u1 = makeUnit({ id: 'u1' });
      emitFn.mockClear();

      system.ensureUnitInQueueAndSelect(u1);

      expect(emitFn).toHaveBeenCalledWith('unitSelected', expect.objectContaining({ unit: u1 }));
    });
  });

  // ── clearCurrentUnit ───────────────────────────────────────────────────────

  describe('clearCurrentUnit', () => {
    it('emits unitDeselected', () => {
      system.clearCurrentUnit();
      expect(emitFn).toHaveBeenCalledWith('unitDeselected');
    });

    it('emits endOfTurn when the queue is empty', () => {
      system.clearCurrentUnit();
      expect(emitFn).toHaveBeenCalledWith('endOfTurn');
    });

    it('does not emit endOfTurn when the queue still has units', () => {
      const u1 = makeUnit({ id: 'u1' });
      (system as any).unitQueue = [u1];
      emitFn.mockClear();

      system.clearCurrentUnit();

      expect(emitFn).not.toHaveBeenCalledWith('endOfTurn');
    });
  });
});
