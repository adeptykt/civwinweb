import type { GameHistoryEntry, GameState } from '../types/game';
import { formatGameYear } from './CivilizationScore';

export type GameHistoryEventType =
  | 'game_start'
  | 'city_founded'
  | 'wonder_built'
  | 'player_eliminated'
  | 'conquest_victory'
  | 'retire'
  | 'human_defeat';

export type { GameHistoryEntry };

export function ensureGameHistory(gameState: GameState): GameHistoryEntry[] {
  if (!gameState.gameHistory) {
    gameState.gameHistory = [];
  }
  return gameState.gameHistory;
}

export function appendGameHistory(
  gameState: GameState,
  type: GameHistoryEventType,
  messageKey: string,
  params?: Record<string, string | number>,
): void {
  const list = ensureGameHistory(gameState);
  list.push({
    turn: gameState.turn,
    yearLabel: formatGameYear(gameState.turn),
    type,
    messageKey,
    params,
  });
}

export function logGameStart(gameState: GameState, leaderName: string): void {
  appendGameHistory(gameState, 'game_start', 'history.gameStart', { leader: leaderName });
}
