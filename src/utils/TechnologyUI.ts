import { TechnologySelectionModal } from '../renderer/TechnologySelectionModal.js';
import type { Game } from '../game/Game.js';
import type { Player } from '../types/game.js';
import { TechnologyType } from '../game/TechnologyDefinitions.js';

/**
 * Utility class for managing technology-related UI interactions
 */
export class TechnologyUI {
  private static technologyModal: TechnologySelectionModal | null = null;

  /**
   * Initialize the technology UI system
   */
  public static initialize(): void {
    console.log('TechnologyUI: Initializing...');
    if (!this.technologyModal) {
      try {
        this.technologyModal = new TechnologySelectionModal();
        console.log('TechnologyUI: Modal created successfully');
      } catch (error) {
        console.error('TechnologyUI: Error creating modal:', error);
        this.technologyModal = null;
      }
    } else {
      console.log('TechnologyUI: Modal already exists');
    }
  }

  /**
   * Open the technology selection modal for a player
   * @param game - The game instance
   * @param player - The player who is selecting technology
   * @param onTechnologySelected - Callback when a technology is selected
   */
  public static openTechnologySelection(
    game: Game, 
    player: Player, 
    onTechnologySelected?: (technology: TechnologyType) => void
  ): void {
    console.log('TechnologyUI: openTechnologySelection called');
    console.log('TechnologyUI: Modal instance:', this.technologyModal);
    
    if (!this.technologyModal) {
      console.log('TechnologyUI: Modal not initialized, initializing now');
      this.initialize();
      
      // If still not available after initialization, there's a problem
      if (!this.technologyModal) {
        console.error('TechnologyUI: Failed to initialize modal - template may not be loaded');
        alert('Technology modal not available. Please refresh the page.');
        return;
      }
    }

    console.log('TechnologyUI: Showing modal');
    this.technologyModal.show(game, player, (technology: TechnologyType) => {
      console.log('TechnologyUI: Technology selected:', technology);
      
      // Set the technology as current research (don't complete it immediately)
      const success = game.setCurrentResearch(player.id, technology);
      
      if (success) {
        console.log(`Player ${player.name} is now researching ${technology}`);
        
        // Call the custom callback if provided
        if (onTechnologySelected) {
          onTechnologySelected(technology);
        }
      } else {
        console.error(`Failed to set current research to ${technology} for player ${player.name}`);
      }
    });
  }

  /**
   * Check if the technology selection modal is currently open
   */
  public static isTechnologyModalOpen(): boolean {
    return this.technologyModal?.isVisible() || false;
  }

  /**
   * Close the technology selection modal
   */
  public static closeTechnologyModal(): void {
    if (this.technologyModal) {
      this.technologyModal.hide();
    }
  }

  /**
   * Example function showing how to integrate with keyboard shortcuts
   * Call this from your input handler when 'T' key is pressed
   */
  public static handleTechnologyShortcut(game: Game): void {
    console.log('TechnologyUI: handleTechnologyShortcut called');
    
    // Get the current human player
    const gameState = game.getGameState();
    console.log('TechnologyUI: Game state:', gameState);
    
    const currentPlayer = gameState.players.find(p => 
      p.id === gameState.currentPlayer && p.isHuman
    );
    console.log('TechnologyUI: Current player:', currentPlayer);

    if (currentPlayer) {
      // Check if player has any available technologies
      const availableTech = game.getAvailableTechnologies(currentPlayer.id);
      console.log('TechnologyUI: Available technologies:', availableTech);
      
      if (availableTech.length > 0) {
        console.log('TechnologyUI: Opening technology selection modal');
        this.openTechnologySelection(game, currentPlayer, (technology) => {
          // Custom callback - research is already set by openTechnologySelection
          console.log(`Current research set to: ${technology}`);
          
          // Example: Trigger a UI update or sound effect
          // this.showTechnologySelectedAnimation(technology);
          // this.playTechnologySound();
        });
      } else {
        console.log('No technologies available for research');
        alert('No technologies available for research');
      }
    } else {
      console.log('Technology selection not available for AI players or no current player');
      alert('Technology selection not available');
    }
  }
  /**
   * Test function for debugging - shows modal directly
   */
  public static testShowModal(): void {
    console.log('TechnologyUI: testShowModal called');
    if (!this.technologyModal) {
      this.initialize();
    }
    
    if (this.technologyModal) {
      (this.technologyModal as any).testShow();
    } else {
      console.error('TechnologyUI: Could not create modal for test');
    }
  }
}

// Make test function globally available for debugging
(window as any).testTechModal = () => TechnologyUI.testShowModal();
