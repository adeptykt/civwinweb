import { GameState, Unit, UnitType, UnitCategory } from '../types/game';
import type { City } from '../types/game';
import { getUnitStats } from './UnitDefinitions';
import { handleSettlerAI } from './ai/AISettlerStrategy';
import { handleMilitaryAI, handleDefaultUnitAI, reevaluateFortifiedUnit } from './ai/AICombatStrategy';
import { handleNavalAI, shouldEmbark, shouldEmbarkSettler, handleEmbarkation } from './ai/AINavalStrategy';
import { processAICities, reevaluateCityProduction as _reevaluateCityProduction } from './ai/AIProductionStrategy';
import { processAITechnology } from './ai/AITechnologyStrategy';

// Re-export GameInterface for callers that used to import it from AIPlayer
export type { GameInterface } from './ai/AITypes';

export class AIPlayer {

  /** Execute a full AI turn for the given player. */
  public static async executeTurn(
    gameState: GameState,
    playerId: string,
    game: import('./ai/AITypes').GameInterface,
  ): Promise<void> {
    console.log(`AI Player ${playerId} starting turn`);

    for (const unit of gameState.units.filter(u => u.playerId === playerId)) {
      if (unit.movementPoints > 0 && !unit.fortified && unit.fortifying !== true && unit.sleeping !== true) {
        AIPlayer.processAIUnit(unit, gameState, game);
      } else if (unit.fortified && gameState.turn % 3 === 0) {
        reevaluateFortifiedUnit(unit, gameState, game);
      }
    }

    processAICities(gameState, playerId);
    processAITechnology(gameState, playerId);

    console.log(`AI Player ${playerId} completed turn`);
  }

  /** Force re-evaluation of production for a specific city. */
  public static reevaluateCityProduction(city: City, gameState: GameState): void {
    _reevaluateCityProduction(city, gameState);
  }

  // ─── Private dispatch ────────────────────────────────────────────────────────

  private static processAIUnit(
    unit: Unit,
    gameState: GameState,
    game: import('./ai/AITypes').GameInterface,
  ): void {
    // Naval units — dedicated handler
    const unitStats = getUnitStats(unit.type);
    if (unitStats?.category === UnitCategory.NAVAL) {
      handleNavalAI(unit, gameState, game);
      return;
    }

    switch (unit.type) {
      case UnitType.SETTLERS:
        // If the civ is island-locked and a carry-capable ship is nearby,
        // board it rather than wandering — the settler needs overseas expansion.
        if (shouldEmbarkSettler(unit, gameState)) {
          handleEmbarkation(unit, gameState, game);
        } else {
          handleSettlerAI(unit, gameState, game);
        }
        break;
      case UnitType.MILITIA:
      case UnitType.WARRIOR:
      case UnitType.PHALANX:
      case UnitType.LEGION:
      case UnitType.KNIGHTS:
      case UnitType.MUSKETEERS:
      case UnitType.RIFLEMEN:
      case UnitType.ARTILLERY:
      case UnitType.ARMOR:
      case UnitType.MECH_INF:
      case UnitType.CAVALRY:
      case UnitType.CHARIOT:
      case UnitType.CATAPULT:
      case UnitType.CANNON:
        // Check if this land unit should board a transport
        if (shouldEmbark(unit, gameState)) {
          handleEmbarkation(unit, gameState, game);
        } else {
          handleMilitaryAI(unit, gameState, game);
        }
        break;
      default:
        handleDefaultUnitAI(unit, gameState, game);
        break;
    }
  }
}
