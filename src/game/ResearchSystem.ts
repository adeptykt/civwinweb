import { GameState, Player } from '../types/game';
import { TechnologyType, getTechnology, canResearch, getResearchCost } from './TechnologyDefinitions';
import { getDifficultyParams } from './DifficultyConfig';

export class ResearchSystem {
  private gameState: GameState;
  private emit: (event: string, data?: any) => void;

  constructor(gameState: GameState, emit: (event: string, data?: any) => void) {
    this.gameState = gameState;
    this.emit = emit;
  }

  public getAvailableTechnologies(playerId: string): TechnologyType[] {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return [];

    return Object.values(TechnologyType).filter(techType => {
      // Don't show already known technologies
      if (player.technologies.includes(techType)) return false;

      // Check if prerequisites are met
      return canResearch(techType, player.technologies);
    });
  }

  public checkForResearchSelection(): void {
    const currentPlayer = this.gameState.players.find(p => p.id === this.gameState.currentPlayer);
    if (!currentPlayer || !currentPlayer.isHuman) {
      return;
    }

    // Only prompt after the first turn to give players time to understand the game
    if (this.gameState.turn <= 1) {
      return;
    }

    // Check if player has no current research selected
    if (!currentPlayer.currentResearch) {
      // Check if there are any technologies available to research
      const availableTechs = this.getAvailableTechnologies(currentPlayer.id);
      if (availableTechs.length > 0) {
        // Emit event to trigger the research selection modal
        this.emit('researchSelectionRequired', {
          playerId: currentPlayer.id,
          player: currentPlayer
        });
      }
    }
  }

  // Research a technology
  public researchTechnology(playerId: string, technologyType: TechnologyType): boolean {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return false;

    // Check if already researched
    if (player.technologies.includes(technologyType)) return false;

    // Validate prerequisites before awarding the technology
    if (!canResearch(technologyType, player.technologies)) return false;

    // Check if this is the current research and player has enough progress
    const cityCount = this.gameState.cities.filter(c => c.playerId === playerId).length;
    const knownTechsCount = player.technologies.length;
    const researchMultiplier = player.isHuman
      ? getDifficultyParams(this.gameState.difficulty).researchCostMultiplier
      : 1.0;
    const cost = getResearchCost(technologyType, knownTechsCount, cityCount, researchMultiplier);
    const progress = player.currentResearch === technologyType ? (player.currentResearchProgress || 0) : 0;

    if (progress < cost) return false;

    // Research the technology
    player.technologies.push(technologyType);
    player.currentResearch = undefined; // Clear current research
    player.currentResearchProgress = 0; // Reset progress

    this.emit('technologyResearched', { playerId, technologyType });
    return true;
  }

  // Set current research for a player (without immediately researching)
  public setCurrentResearch(playerId: string, technologyType: TechnologyType): boolean {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return false;

    // Check if already researched
    if (player.technologies.includes(technologyType)) return false;

    // Check if prerequisites are met
    if (!canResearch(technologyType, player.technologies)) return false;

    // Set as current research and reset progress
    player.currentResearch = technologyType;
    player.currentResearchProgress = 0; // Start fresh progress toward this technology
    return true;
  }

  // Get technology information
  public getTechnologyInfo(technologyType: TechnologyType) {
    return getTechnology(technologyType);
  }
}
