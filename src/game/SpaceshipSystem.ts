import type { GameState, SpaceshipProgress } from '../types/game';
import { UnitType } from '../types/game';
import { playerCanBuildSpaceship } from './WonderEffects';

export type SpaceshipPart = 'structure' | 'component' | 'module';

export function ensureSpaceship(gameState: GameState, playerId: string): SpaceshipProgress {
  if (!gameState.spaceships) gameState.spaceships = {};
  if (!gameState.spaceships[playerId]) {
    gameState.spaceships[playerId] = {
      structure: false,
      component: false,
      module: false,
    };
  }
  return gameState.spaceships[playerId];
}

export function partFromUnitType(unitType: string): SpaceshipPart | null {
  switch (unitType) {
    case UnitType.SS_STRUCTURE:
      return 'structure';
    case UnitType.SS_COMPONENT:
      return 'component';
    case UnitType.SS_MODULE:
      return 'module';
    default:
      return null;
  }
}

export function completeSpaceshipPart(
  gameState: GameState,
  playerId: string,
  part: SpaceshipPart,
): SpaceshipProgress | null {
  if (!playerCanBuildSpaceship(gameState, playerId)) return null;
  const ship = ensureSpaceship(gameState, playerId);
  ship[part] = true;
  return ship;
}

export function isSpaceshipComplete(ship: SpaceshipProgress): boolean {
  return ship.structure && ship.component && ship.module;
}

export function canLaunchSpaceship(gameState: GameState, playerId: string): boolean {
  const ship = gameState.spaceships?.[playerId];
  if (!ship || ship.launched) return false;
  return playerCanBuildSpaceship(gameState, playerId) && isSpaceshipComplete(ship);
}

/** Civ I mission success % (MVP: 100% when all three parts are built). */
export function computeMissionSuccessPercent(ship: SpaceshipProgress): number {
  if (!isSpaceshipComplete(ship)) return 0;
  return 100;
}

/** Space colonists bonus: 50 + 10,000 × (success% / 100). */
export function spaceColonistsBonus(successPercent: number): number {
  return 50 + Math.floor(10000 * (successPercent / 100));
}
