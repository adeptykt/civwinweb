import { Position } from '../../types/game';
import type { DiplomacyManager } from '../DiplomacyManager';

/**
 * Interface used by AI strategy modules to interact with the game engine
 * without creating a circular import with Game.ts.
 */
export interface GameInterface {
  moveUnit(unitId: string, newPosition: Position): boolean;
  foundCity(unitId: string): boolean;
  buildRoad(unitId: string): boolean;
  buildIrrigation(unitId: string): boolean;
  buildMine(unitId: string): boolean;
  fortifyUnit(unitId: string): boolean;
  wakeUnit(unitId: string): boolean;
  getDiplomacyManager(): DiplomacyManager;
}
