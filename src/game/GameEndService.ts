import type { GameState, Player } from '../types/game';
import { GamePhase } from '../types/game';
import {
  calculateFinalConquestScore,
  calculateFinalRetireScore,
  calculateFinalSpaceScore,
  type FinalScoreResult,
} from './CivilizationScore';
import { addHallOfFameEntry, type HallOfFameAddResult } from './HallOfFame';
import { appendGameHistory } from './GameHistory';
import type { DiplomacyManager } from './DiplomacyManager';

export type GameEndOutcome = 'conquest' | 'retire' | 'space' | 'defeat';

export interface GameEndResult {
  outcome: GameEndOutcome;
  score: FinalScoreResult | null;
  hallOfFame: HallOfFameAddResult | null;
  canContinuePlaying: boolean;
}

function humanPlayer(gameState: GameState): Player | undefined {
  return gameState.players.find(p => p.isHuman && !p.defeated);
}

function recordInHallOfFame(
  gameState: GameState,
  human: Player,
  score: FinalScoreResult,
): HallOfFameAddResult {
  return addHallOfFameEntry({
    civilizationType: human.civilizationType,
    leaderName: human.name,
    score,
    difficulty: gameState.difficulty,
    totalCivs: gameState.totalCivs ?? gameState.players.filter(p => !p.isBarbarian).length,
  });
}

/**
 * Finalize a human victory (conquest or retire): score, HoF, phase, history.
 * Does not emit UI events — caller should emit `gameEnded`.
 */
export function finalizeHumanVictory(
  gameState: GameState,
  diplomacyManager: DiplomacyManager,
  outcome: 'conquest' | 'retire' | 'space',
  options?: { spaceSuccessPercent?: number },
): GameEndResult | null {
  const human = humanPlayer(gameState);
  if (!human) return null;

  const score =
    outcome === 'conquest'
      ? calculateFinalConquestScore(gameState, diplomacyManager)
      : outcome === 'space'
        ? calculateFinalSpaceScore(
            gameState,
            diplomacyManager,
            options?.spaceSuccessPercent ?? 100,
          )
        : calculateFinalRetireScore(gameState, diplomacyManager);
  if (!score) return null;

  gameState.score = score.ranking;
  gameState.scoringLocked = true;
  gameState.victoryOutcome = outcome;
  gameState.canContinueAfterVictory = true;
  gameState.gamePhase = GamePhase.ENDED;

  const hallOfFame = recordInHallOfFame(gameState, human, score);

  if (outcome === 'conquest') {
    appendGameHistory(gameState, 'conquest_victory', 'history.conquestVictory', {
      leader: human.name,
    });
  } else if (outcome === 'space') {
    appendGameHistory(gameState, 'space_victory', 'history.spaceVictory', {
      leader: human.name,
      success: options?.spaceSuccessPercent ?? 100,
    });
  } else {
    appendGameHistory(gameState, 'retire', 'history.retire', { leader: human.name });
  }

  void diplomacyManager;

  return {
    outcome,
    score,
    hallOfFame,
    canContinuePlaying: true,
  };
}

/** Human destroyed — no score or HoF. */
export function finalizeHumanDefeat(gameState: GameState, victorName?: string): GameEndResult {
  const human = gameState.players.find(p => p.isHuman);
  if (human) {
    appendGameHistory(gameState, 'human_defeat', 'history.humanDefeat', {
      leader: human.name,
      victor: victorName ?? '?',
    });
  }
  gameState.gamePhase = GamePhase.ENDED;
  gameState.scoringLocked = true;
  gameState.canContinueAfterVictory = false;

  return {
    outcome: 'defeat',
    score: null,
    hallOfFame: null,
    canContinuePlaying: false,
  };
}

export function continuePlayingAfterVictory(gameState: GameState): boolean {
  if (!gameState.canContinueAfterVictory) return false;
  gameState.gamePhase = GamePhase.PLAYING;
  gameState.canContinueAfterVictory = false;
  gameState.victoryAcknowledged = true;
  return true;
}
