import { GamePhase, GameState, GovernmentEffects, GovernmentType, GOVERNMENTS, Player, TechnologyType } from '../types/game';
import { TaxSystem } from './TaxSystem';

export class GovernmentSystem {
  private gameState: GameState;
  private emit: (event: string, data?: any) => void;

  constructor(
    gameState: GameState,
    emit: (event: string, data?: any) => void,
  ) {
    this.gameState = gameState;
    this.emit = emit;
  }

  // ── Revolution / government change ────────────────────────────────────────

  public startRevolution(playerId: string, cause?: string): boolean {
    const player = this.gameState.players.find((p: Player) => p.id === playerId);
    if (!player || this.gameState.gamePhase !== GamePhase.PLAYING) return false;

    // Check if already in anarchy
    if (player.government === GovernmentType.ANARCHY) return false;

    // Start anarchy period (2-5 turns based on Civilization mechanics)
    player.government = GovernmentType.ANARCHY;
    player.revolutionTurns = Math.floor(Math.random() * 4) + 2; // 2-5 turns

    this.emit('revolutionStarted', { playerId, turnsRemaining: player.revolutionTurns, cause });
    return true;
  }

  // Change government after revolution
  public changeGovernment(playerId: string, newGovernment: GovernmentType): boolean {
    const player = this.gameState.players.find((p: Player) => p.id === playerId);
    if (!player || player.government !== GovernmentType.ANARCHY) return false;

    // Check if player has required technology
    const governmentData = GOVERNMENTS[newGovernment];
    if (governmentData.requiredTechnology) {
      const hasTech = player.technologies.includes(governmentData.requiredTechnology);
      if (!hasTech) return false;
    }

    // Change government
    player.government = newGovernment;
    player.revolutionTurns = undefined;

    this.emit('governmentChanged', { playerId, newGovernment });
    return true;
  }

  // Get available governments for a player
  public getAvailableGovernments(playerId: string): GovernmentType[] {
    const player = this.gameState.players.find((p: Player) => p.id === playerId);
    if (!player) return [];

    const available: GovernmentType[] = [GovernmentType.DESPOTISM]; // Always available

    // Check technology requirements for other governments
    Object.values(GOVERNMENTS).forEach((gov: any) => {
      if (gov.type === GovernmentType.DESPOTISM || gov.type === GovernmentType.ANARCHY) return;

      if (!gov.requiredTechnology ||
        player.technologies.includes(gov.requiredTechnology)) {
        available.push(gov.type);
      }
    });

    return available;
  }

  // Get current government effects for a player
  public getGovernmentEffects(playerId: string): GovernmentEffects | null {
    const player = this.gameState.players.find((p: Player) => p.id === playerId);
    if (!player) return null;

    return GOVERNMENTS[player.government as GovernmentType].effects;
  }

  // ── Tax system ─────────────────────────────────────────────────────────────

  /**
   * Set the tax and luxury rates for a player.
   * Science rate is auto-calculated as 100 - taxRate - luxuryRate.
   * Both values are clamped to [0, 100] in steps of 10, and the sum cannot exceed 100.
   */
  public setTaxRates(playerId: string, taxRate: number, luxuryRate: number): boolean {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return false;

    // Snap to nearest 10 and clamp
    taxRate = Math.max(0, Math.min(100, Math.round(taxRate / 10) * 10));
    luxuryRate = Math.max(0, Math.min(100 - taxRate, Math.round(luxuryRate / 10) * 10));

    player.taxRate = taxRate;
    player.luxuryRate = luxuryRate;
    return true;
  }

  /** Return the current tax rates for a player. */
  public getTaxRates(playerId: string): { taxRate: number; luxuryRate: number; scienceRate: number } | null {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return null;
    return TaxSystem.getEffectiveTaxRates(player);
  }

  /** Return the full per-turn income / expense summary for a player. */
  public getPlayerTaxSummary(playerId: string) {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return null;
    return TaxSystem.calculatePlayerTaxSummary(player, this.gameState);
  }
}
