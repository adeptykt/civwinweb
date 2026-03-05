/**
 * Manages the core game state and provides controlled access to it
 */
import { GameState, GamePhase, Player } from '../types/game';

export class GameStateManager {
  private gameState: GameState;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    this.gameState = {
      turn: 1,
      currentPlayer: '',
      currentPlayerIsHuman: false,
      players: [],
      worldMap: [],
      units: [],
      cities: [],
      gamePhase: GamePhase.SETUP,
      score: 0,
      difficulty: 'chieftain'
    };
  }

  // Getters for read-only access
  getGameState(): Readonly<GameState> {
    return this.gameState;
  }

  getCurrentPlayer(): Player | undefined {
    return this.gameState.players.find(p => p.id === this.gameState.currentPlayer);
  }

  // Event system
  addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  removeEventListener(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(...args));
    }
  }

  // Controlled state mutations
  updateGameState(updates: Partial<GameState>): void {
    this.gameState = { ...this.gameState, ...updates };
    this.emit('stateChanged', this.gameState);
  }

  setCurrentPlayer(playerId: string): void {
    this.gameState.currentPlayer = playerId;
    this.emit('playerChanged', playerId);
  }

  incrementTurn(): void {
    this.gameState.turn++;
    this.emit('turnChanged', this.gameState.turn);
  }
}
