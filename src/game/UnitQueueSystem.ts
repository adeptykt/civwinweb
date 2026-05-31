import { GameState, Unit, Player } from '../types/game';
import { SettingsManager } from '../utils/SettingsManager';

/**
 * Manages the per-turn unit activation queue: filtering which units can move,
 * cycling through them, blink animation, auto-advance, and related UI events.
 */
export class UnitQueueSystem {
  private gameState: GameState;
  private emit: (event: string, data?: any) => void;
  private endTurnCallback: () => void;
  private getCurrentPlayerCallback: () => Player | null;

  private unitQueue: Unit[] = [];
  private currentUnitIndex: number = 0;
  private initialUnitQueueSize: number = 0;
  private autoAdvanceTriggered: boolean = false;
  private blinkIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    gameState: GameState,
    emit: (event: string, data?: any) => void,
    endTurn: () => void,
    getCurrentPlayer: () => Player | null,
  ) {
    this.gameState = gameState;
    this.emit = emit;
    this.endTurnCallback = endTurn;
    this.getCurrentPlayerCallback = getCurrentPlayer;
  }

  // ── Queue building ────────────────────────────────────────────────────────

  /** Build the queue of units that can move for the current player. */
  public buildUnitQueue(): void {
    const currentPlayer = this.gameState.currentPlayer;

    this.unitQueue = this.gameState.units.filter(unit =>
      unit.playerId === currentPlayer &&
      unit.movementPoints > 0 &&
      !unit.fortified &&
      unit.fortifying !== true &&
      unit.sleeping !== true &&
      unit.buildingRoad !== true &&
      unit.buildingMine !== true &&
      unit.buildingIrrigation !== true &&
      !unit.gotoDestination &&
      !unit.automating
    );

    this.currentUnitIndex = 0;
    this.initialUnitQueueSize = this.unitQueue.length;

    console.log(`Built unit queue for player ${currentPlayer}:`, this.unitQueue.length, 'units');

    if (this.unitQueue.length === 0) {
      console.log('No units available to move - emitting endOfTurn event');
      this.emit('endOfTurn');
    }
  }

  // ── Unit selection cycling ────────────────────────────────────────────────

  /** Advance to the next unit in the queue, skipping busy units. */
  public selectNextUnit(): void {
    if (this.unitQueue.length === 0) {
      this.clearCurrentUnit();
      return;
    }

    const startIndex = this.currentUnitIndex;

    do {
      this.currentUnitIndex++;
      if (this.currentUnitIndex >= this.unitQueue.length) {
        this.currentUnitIndex = 0;
      }

      const currentUnit = this.unitQueue[this.currentUnitIndex];

      if (
        currentUnit.movementPoints > 0 &&
        !currentUnit.fortified &&
        currentUnit.fortifying !== true &&
        currentUnit.buildingRoad !== true &&
        currentUnit.buildingMine !== true &&
        currentUnit.buildingIrrigation !== true
      ) {
        this.setCurrentUnit(currentUnit);
        return;
      }

      if (this.currentUnitIndex === startIndex) {
        this.setCurrentUnit(currentUnit);
        return;
      }
    } while (this.currentUnitIndex !== startIndex);
  }

  /** Select the unit currently at currentUnitIndex (used after queue mutations). */
  public selectCurrentUnit(): void {
    if (this.unitQueue.length === 0) {
      this.clearCurrentUnit();
      return;
    }

    if (this.currentUnitIndex >= this.unitQueue.length) {
      this.currentUnitIndex = 0;
    }

    const currentUnit = this.unitQueue[this.currentUnitIndex];
    this.setCurrentUnit(currentUnit);
  }

  /** Re-emit the current unit as active (restarts blinking/selection state). */
  public reselectCurrentUnit(): void {
    this.selectCurrentUnit();
  }

  /** Step backward through the queue. */
  public selectPreviousUnit(): void {
    if (this.unitQueue.length === 0) {
      this.clearCurrentUnit();
      return;
    }

    this.currentUnitIndex--;
    if (this.currentUnitIndex < 0) {
      this.currentUnitIndex = this.unitQueue.length - 1;
    }

    const currentUnit = this.unitQueue[this.currentUnitIndex];
    this.setCurrentUnit(currentUnit);
  }

  // ── Internal selection helpers ────────────────────────────────────────────

  private setCurrentUnit(unit: Unit): void {
    if (
      !unit.fortified &&
      unit.fortifying !== true &&
      unit.buildingRoad !== true &&
      unit.buildingMine !== true &&
      unit.buildingIrrigation !== true
    ) {
      this.startUnitBlinking();
    }
    this.emit('unitSelected', {
      unit,
      unitIndex: this.currentUnitIndex,
      totalUnits: this.unitQueue.length,
    });
  }

  public clearCurrentUnit(): void {
    this.stopUnitBlinking();
    this.emit('unitDeselected');

    if (this.unitQueue.length === 0) {
      this.emit('endOfTurn');
    }
  }

  private startUnitBlinking(): void {
    this.stopUnitBlinking();
    this.blinkIntervalId = setInterval(() => {
      this.emit('unitBlink');
    }, 600);
  }

  private stopUnitBlinking(): void {
    if (this.blinkIntervalId !== null) {
      clearInterval(this.blinkIntervalId);
      this.blinkIntervalId = null;
    }
  }

  // ── Queue accessors ───────────────────────────────────────────────────────

  public getCurrentUnit(): Unit | null {
    if (this.unitQueue.length === 0 || this.currentUnitIndex >= this.unitQueue.length) {
      return null;
    }
    return this.unitQueue[this.currentUnitIndex];
  }

  public getUnitQueueSize(): number {
    return this.unitQueue.length;
  }

  /** Returns the 1-based position of the current unit in the queue (0 when empty). */
  public getUnitQueueIndex(): number {
    return this.unitQueue.length > 0 ? this.currentUnitIndex + 1 : 0;
  }

  public getUnitQueue(): Unit[] {
    return [...this.unitQueue];
  }

  // ── Queue mutations ───────────────────────────────────────────────────────

  /**
   * Move a queued unit to the front, making it the active unit.
   * Emits 'unitSelected'; the app centers the view only if the unit is off-screen.
   */
  public promoteUnitToFront(unitId: string): void {
    const idx = this.unitQueue.findIndex(u => u.id === unitId);
    if (idx === -1 || idx === this.currentUnitIndex) return;

    const [unit] = this.unitQueue.splice(idx, 1);
    this.unitQueue.unshift(unit);
    this.currentUnitIndex = 0;

    this.stopUnitBlinking();
    if (
      !unit.fortified &&
      unit.fortifying !== true &&
      unit.buildingRoad !== true &&
      unit.buildingMine !== true &&
      unit.buildingIrrigation !== true
    ) {
      this.startUnitBlinking();
    }

    this.emit('unitSelected', {
      unit,
      unitIndex: 0,
      totalUnits: this.unitQueue.length,
    });
  }

  /**
   * Wake a sleeping/fortified/automating unit (if needed) and place it at the
   * front of the active queue, making it the unit the player moves next.
   * Does nothing if the unit has no movement points remaining this turn.
   * Returns true if the unit was successfully activated.
   */
  public activateUnit(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    if (unit.movementPoints <= 0) return false;

    unit.sleeping = false;
    unit.fortified = false;
    unit.fortifying = false;
    unit.fortificationTurns = 0;
    unit.buildingRoad = false;
    unit.buildingMine = false;
    unit.buildingIrrigation = false;
    unit.irrigationBuildingTurns = 0;
    unit.automating = false;
    delete unit.gotoDestination;

    const idx = this.unitQueue.findIndex(u => u.id === unitId);
    if (idx === -1) {
      this.unitQueue.unshift(unit);
    } else if (idx !== 0) {
      this.unitQueue.splice(idx, 1);
      this.unitQueue.unshift(unit);
    }
    this.currentUnitIndex = 0;

    this.stopUnitBlinking();
    this.startUnitBlinking();

    this.emit('unitSelected', {
      unit,
      unitIndex: 0,
      totalUnits: this.unitQueue.length,
    });

    return true;
  }

  /** Remove a unit from the queue; auto-advances the turn when all human units are exhausted. */
  public removeUnitFromQueue(unitId: string): void {
    const unitIndex = this.unitQueue.findIndex(unit => unit.id === unitId);
    if (unitIndex === -1) return;

    this.unitQueue.splice(unitIndex, 1);

    if (this.currentUnitIndex >= unitIndex) {
      this.currentUnitIndex = Math.max(0, this.currentUnitIndex - 1);
    }

    if (this.unitQueue.length === 0) {
      this.clearCurrentUnit();

      const player = this.getCurrentPlayerCallback();
      if (player && player.isHuman) {
        if (this.initialUnitQueueSize > 0) {
          const requireEndOfTurn = SettingsManager.getInstance().getSetting('requireEndOfTurn');
          if (requireEndOfTurn) {
            console.log('All units moved - waiting for manual End Turn (requireEndOfTurn is on)');
            this.emit('endOfTurn');
          } else {
            console.log('All units exhausted movement - auto-advancing turn');
            this.autoAdvanceTriggered = true;
            this.endTurnCallback();
          }
        } else {
          console.log('No units to move this turn - waiting for manual advancement');
        }
      }
    } else {
      this.selectCurrentUnit();
    }
  }

  /** Returns true (once) if auto-advance was just triggered; resets the flag. */
  public wasAutoAdvanceTriggered(): boolean {
    const wasTriggered = this.autoAdvanceTriggered;
    this.autoAdvanceTriggered = false;
    return wasTriggered;
  }

  /** Remove all units belonging to a player from the queue (e.g. after elimination). */
  public filterQueueByPlayer(playerId: string): void {
    this.unitQueue = this.unitQueue.filter(u => u.playerId !== playerId);
  }

  /**
   * Add a unit to the queue if not already present, then make it the active
   * unit. Used when a woken/re-activated unit should be re-inserted.
   */
  public ensureUnitInQueueAndSelect(unit: Unit): void {
    if (!this.unitQueue.find(u => u.id === unit.id)) {
      this.unitQueue.push(unit);
    }
    const idx = this.unitQueue.findIndex(u => u.id === unit.id);
    if (idx >= 0) {
      this.currentUnitIndex = idx;
      this.setCurrentUnit(unit);
    }
  }
}
