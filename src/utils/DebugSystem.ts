import { SettingsManager } from './SettingsManager';

/**
 * Debug utilities for development and testing
 */
export class DebugSystem {
  private static instance: DebugSystem;
  private settingsManager: SettingsManager;
  
  private constructor() {
    this.settingsManager = SettingsManager.getInstance();
  }
  
  public static getInstance(): DebugSystem {
    if (!this.instance) {
      this.instance = new DebugSystem();
    }
    return this.instance;
  }
  
  /**
   * Log game events to console if debug setting is enabled
   */
  public logGameEvent(eventType: string, details: any): void {
    if (this.settingsManager.getSettings().logGameEvents) {
      console.log(`[GAME EVENT] ${eventType}:`, details);
    }
  }
  
  /**
   * Display performance metrics
   */
  public showPerformanceMetrics(): void {
    if (this.settingsManager.getSettings().showPerformanceMetrics) {
      console.log('[DEBUG] Performance metrics would be displayed here');
    }
  }
  
  /**
   * Log AI decision making
   */
  public logAiDecision(playerId: string, decision: string, reasoning: string): void {
    if (this.settingsManager.getSettings().showAiThinking) {
      console.log(`[AI DEBUG] Player ${playerId}: ${decision} - ${reasoning}`);
    }
  }
  
  /**
   * Check if cheats are enabled
   */
  public areCheatsEnabled(): boolean {
    return this.settingsManager.getSettings().enableCheats;
  }
  
  /**
   * Check if unlimited movement is enabled
   */
  public isUnlimitedMovementEnabled(): boolean {
    return this.settingsManager.getSettings().unlimitedMovement;
  }
  
  /**
   * Check if fast production is enabled
   */
  public isFastProductionEnabled(): boolean {
    return this.settingsManager.getSettings().fastProduction;
  }
  
  /**
   * Check if map should be fully revealed
   */
  public shouldRevealAllMap(): boolean {
    return this.settingsManager.getSettings().revealAllMap;
  }

  /**
   * Check if coordinates should be shown on tiles
   */
  public shouldShowCoordinates(): boolean {
    return this.settingsManager.getSettings().showCoordinates;
  }

  /**
   * Check if visibility overlay should be shown
   */
  public shouldShowVisibilityOverlay(): boolean {
    return this.settingsManager.getSettings().showVisibilityOverlay;
  }

  /**
   * Check if unit paths should be shown
   */
  public shouldShowUnitPaths(): boolean {
    return this.settingsManager.getSettings().showUnitPaths;
  }

  /**
   * Check if city work radius should be shown
   */
  public shouldShowCityRadius(): boolean {
    return this.settingsManager.getSettings().showCityRadius;
  }

  /**
   * Check if AI should be frozen
   */
  public isAiFrozen(): boolean {
    return this.settingsManager.getSettings().freezeAi;
  }

  /**
   * Check if Civ 2 enhancements are enabled
   */
  public isCiv2EnhancementsEnabled(): boolean {
    return this.settingsManager.getSettings().civ2Enhancements;
  }

  /**
   * Check if AI Dev Test (autopilot) mode is enabled
   */
  public isAiDevTestEnabled(): boolean {
    return this.settingsManager.getSettings().aiDevTest;
  }

  /**
   * Check if the "always show Contact button" dev override is enabled.
   * When true, the Contact button in the Intelligence Advisor is shown for
   * all contacted civs regardless of whether an embassy has been established.
   */
  public alwaysShowContactButton(): boolean {
    return this.settingsManager.getSettings().alwaysShowContactButton;
  }
}
