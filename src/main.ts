import './style.css';
import './styles/production-selection-modal.css';
import './styles/defeat-notification-modal.css';
import './styles/technology-dialog.css';
import './styles/music-player.css';
import './styles/historical-facts-modal.css';
import './styles/tile-context-menu.css';
import './styles/budget-modal.css';
import './styles/loading-screen.css';
import './styles/government-modal.css';
import './styles/notification-dialog.css';
import './styles/diplomacy-dialog.css';
import './styles/intelligence-advisor.css';
import './styles/landing-screen.css';
import './styles/difficulty-screen.css';
import './styles/competition-screen.css';
import './styles/tribe-screen.css';
import './styles/name-prompt-screen.css';
import { Game } from './game/Game.js';
import { Renderer } from './renderer/Renderer.js';
import { GameRenderer } from './renderer/GameRenderer.js';
import { UnitSprites } from './renderer/UnitSprites.js';
import { CitySprites } from './renderer/CitySprites.js';
import { TechnologySprites } from './renderer/TechnologySprites.js';
import { CityView } from './renderer/CityView.js';
import { Minimap } from './renderer/Minimap.js';
import { Status } from './renderer/Status.js';
import { InputHandler } from './utils/InputHandler.js';
import { MusicPlayer } from './utils/MusicPlayer.js';
import { UITemplateManager } from './utils/UITemplateManager.js';
import { SettingsManager } from './utils/SettingsManager.js';
import { DebugSystem } from './utils/DebugSystem.js';
import { logger } from './utils/Logger.js';
import { SoundEffects } from './utils/SoundEffects.js';
import { TechnologyUI } from './utils/TechnologyUI.js';
import { ScienceAdvisorModal } from './renderer/ScienceAdvisorModal.js';
import { TechnologyDiscoveryModal } from './renderer/TechnologyDiscoveryModal.js';
import { GameTime } from './utils/GameTime.js';
import { DefeatNotificationModal } from './renderer/DefeatNotificationModal.js';
import { GovernmentModal } from './renderer/GovernmentModal.js';
import { NotificationDialog } from './renderer/NotificationDialog.js';
import { DiplomacyDialog } from './renderer/DiplomacyDialog.js';
import { IntelligenceAdvisorModal } from './renderer/IntelligenceAdvisorModal.js';
import { chooseGovernmentAfterAnarchy } from './game/ai/AIGovernmentStrategy.js';
import { LoadingScreen } from './renderer/LoadingScreen.js';
import { LandingScreen } from './renderer/LandingScreen.js';
import { DifficultyScreen, DifficultyLevel } from './renderer/DifficultyScreen.js';
import { CompetitionScreen } from './renderer/CompetitionScreen.js';
import { TribeScreen, TribeChoice } from './renderer/TribeScreen.js';
import { NamePromptScreen } from './renderer/NamePromptScreen.js';
import { getCivilization } from './game/CivilizationDefinitions.js';
import { MapScenario, UnitType, Unit } from './types/game.js';
import { TerrainManager } from './terrain/index.js';

class CivWinApp {
  private game: Game;
  private renderer: Renderer;
  private gameRenderer: GameRenderer;
  private minimap: Minimap;
  private status: Status;
  private cityView: CityView;
  private inputHandler: InputHandler;
  private musicPlayer: MusicPlayer;
  private settingsManager: SettingsManager;
  private scienceAdvisorModal: ScienceAdvisorModal | null = null;
  private technologyDiscoveryModal: TechnologyDiscoveryModal | null = null;
  private defeatNotificationModal: DefeatNotificationModal | null = null;
  private governmentModal: GovernmentModal | null = null;
  private diplomacyDialog: DiplomacyDialog | null = null;
  private intelligenceAdvisorModal: IntelligenceAdvisorModal | null = null;
  private isTechnologyDiscoveryInProgress = false; // Flag to prevent science advisor popup during discovery
  /** Deduplicates war-declaration dialogs when bulk-moving units: maps aiPlayerId → the in-flight confirm promise. */
  private pendingWarConfirmations = new Map<string, Promise<boolean>>();
  private canvas: HTMLCanvasElement;
  private minimapCanvas: HTMLCanvasElement;
  private currentScenario: MapScenario = 'random';
  private deathAnimationFrameHandle: number | null = null;
  private isRenderPending: boolean = false;
  private landingScreen: LandingScreen | null = null;
  private difficultyScreen: DifficultyScreen | null = null;
  private competitionScreen: CompetitionScreen | null = null;
  private tribeScreen: TribeScreen | null = null;
  private namePromptScreen: NamePromptScreen | null = null;
  private currentDifficulty: DifficultyLevel = 'chieftain';
  private currentTotalCivs: number = 8;
  private currentTribe: TribeChoice = 'custom';
  private currentTribeName: string = 'Player';
  private currentLeaderName: string = 'Player';

  /** Resolves once unit, city, and technology sprites have finished preloading. */
  private _spritesLoadedResolve!: () => void;
  private _spritesLoadedPromise!: Promise<void>;

  constructor() {
    /** Install the global console.log intercept first so all subsequent
     *  code respects the enableLogging setting from the start. */
    logger.install();

    /** Set up a promise that resolves once sprites have been preloaded. */
    this._spritesLoadedPromise = new Promise(resolve => {
      this._spritesLoadedResolve = resolve;
    });

    /** Get canvas elements */
    this.canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    if (!this.canvas) {
      throw new Error('Canvas element not found');
    }

    this.minimapCanvas = document.querySelector<HTMLCanvasElement>('#minimap-canvas')!;
    if (!this.minimapCanvas) {
      throw new Error('Minimap canvas element not found');
    }

    /** Initialize game systems */
    this.game = new Game();
    this.renderer = new Renderer(this.canvas);
    this.gameRenderer = new GameRenderer(this.renderer);
    this.minimap = new Minimap(this.minimapCanvas, this.renderer, () => this.requestRender());
    this.status = new Status(this.game);
    this.cityView = new CityView(this.game);
    this.musicPlayer = new MusicPlayer();
    this.settingsManager = SettingsManager.getInstance();
    this.inputHandler = new InputHandler(
      this.game,
      this.gameRenderer,
      this.renderer,
      this.canvas,
      () => this.requestRender(),
      () => this.minimap.toggle(),
      this.status,
      this.cityView
    );

    /** Setup game event listeners BEFORE initializing the game */
    this.setupGameEventListeners();

    /** Setup UI event listeners */
    this.setupUIEventListeners();

    /** Initialize the game (this will emit events) */
    this.initializeGame();

    /** Handle canvas resizing */
    this.handleResize();
    window.addEventListener('resize', this.handleResize.bind(this));

    /** Make input handler accessible for debugging */
    (window as any).inputHandler = this.inputHandler;
    (window as any).musicPlayer = this.musicPlayer;
    (window as any).settingsManager = this.settingsManager;
    (window as any).logger = logger;

    /** Trigger initial render */
    this.requestRender();

    /** Auto-start music player after a short delay */
    setTimeout(() => {
      this.musicPlayer.autoStart();
      // Music player will load its own volume from settings
    }, 2000);

    /** Setup event listeners for volume synchronization */
    document.addEventListener('musicVolumeChanged', () => {
      this.syncSettingsModalWithMusicPlayer();
    });

    document.addEventListener('musicTrackChanged', (event: Event) => {
      const detail = (event as CustomEvent<{ trackIndex: number }>).detail;
      if (detail && typeof detail.trackIndex === 'number') {
        this.highlightMusicMenuSelection(detail.trackIndex);
      }
    });

    document.addEventListener('musicPlaylistChanged', () => {
      this.populateMusicMenu();
    });

    // Wire up Autopilot Mode controls bar and sync initial visibility
    this.setupAiDevTestControls();
    this.updateAiDevTestBar();

    // Example usage of SettingsManager:
    // const volume = this.settingsManager.getSetting('masterVolume');
    // this.settingsManager.setSetting('showGrid', true);
    // const allSettings = this.settingsManager.getSettings();
  }

  /**
   * Initialize the game with default players and current scenario
   */
  private initializeGame(worldSize?: number): void {
    const totalCivs = this.currentTotalCivs;
    console.log(`Initializing game with ${this.currentScenario} scenario, ${totalCivs} civs${worldSize !== undefined ? ` (world size: ${worldSize})` : ''}`);
    const playerNames = [this.currentLeaderName || 'Player'];
    for (let i = 1; i < totalCivs; i++) {
      playerNames.push(`AI Player ${i}`);
    }
    // Pass the chosen civ type so the human player gets the right civ & color.
    // 'custom' means no preference — the engine picks randomly.
    const humanCivType = this.currentTribe !== 'custom' ? this.currentTribe : undefined;
    this.game.initializeGame(playerNames, this.currentScenario, worldSize, humanCivType, this.currentDifficulty);
    console.log('Game initialization completed');
  }

  /**
   * Setup game event listeners
   */
  private setupGameEventListeners(): void {
    console.log('Setting up game event listeners');
    this.game.on('gameInitialized', (gameState: any) => {
      console.log('Game initialized event received', gameState);
      this.gameRenderer.invalidateConnectionCache();
      this.updateUI();
      this.requestRender();

      /** Preload unit and city sprites for all players */
      this.preloadSprites(gameState);
    });

    this.game.on('turnEnded', (gameState: any) => {
      console.log('Turn ended', gameState);
      /** Clear end of turn state when new turn begins */
      this.status.setEndOfTurnState(false);
      this.gameRenderer.markTerrainLayerDirty();
      this.updateUI();
      this.requestRender();
    });

    this.game.on('aiTurnStarted', (data: any) => {
      console.log('AI turn started', data);
      this.handleAITurnStarted(data);
    });

    this.game.on('aiTurnEnded', (data: any) => {
      console.log('AI turn ended', data);
      this.handleAITurnEnded(data);
    });

    this.game.on('humanTurnStarted', (data: any) => {
      console.log('Human turn started', data);
      this.handleHumanTurnStarted(data);
    });

    this.game.on('unitMoved', (data: any) => {
      console.log('Unit moved', data);
      this.gameRenderer.markTerrainLayerDirty();
      this.requestRender();
    });

    this.game.on('cityFounded', (city: any) => {
      console.log('City founded', city);
      this.gameRenderer.markTerrainLayerDirty();
      this.updateUI();
      this.requestRender();
    });

    this.game.on('unitSelected', (data: any) => {
      console.log('Unit selected from queue', data);
      this.handleUnitSelected(data);
    });

    this.game.on('unitDeselected', () => {
      this.handleUnitDeselected();
    });

    this.game.on('unitBlink', () => {
      this.handleUnitBlink();
    });

    this.game.on('endOfTurn', () => {
      console.log('End of turn - no more units to move');
      this.handleEndOfTurn();
    });

    this.game.on('gamePhaseChanged', (phase: any) => {
      console.log('Game phase changed', phase);
      this.updateUI();
      this.requestRender();
    });

    this.game.on('researchSelectionRequired', (data: any) => {
      console.log('Research selection required', data);
      this.handleResearchSelectionRequired(data);
    });

    this.game.on('governmentSelectionRequired', (data: any) => {
      this.handleGovernmentSelectionRequired(data);
    });

    this.game.on('revolutionStarted', (data: any) => {
      // Only notify the human player; skip entirely in AI dev mode
      const gameState = this.game.getGameState();
      const player = gameState.players.find((p: any) => p.id === data.playerId);
      if (!player || !player.isHuman) return;
      if (DebugSystem.getInstance().isAiDevTestEnabled()) return;
      const turns = data.turnsRemaining ?? '?';
      NotificationDialog.info(
        'Revolution!',
        `Your civilization has entered a period of Anarchy.\nAnarchy will last ${turns} turn${turns === 1 ? '' : 's'}.`
      );
    });

    this.game.on('governmentChanged', (data: any) => {
      const govName = data.newGovernment ?? 'Unknown';
      this.updateUI();
      // Brief notification
      const el = document.getElementById('status-message');
      if (el) {
        el.textContent = `Government changed to ${govName}`;
        setTimeout(() => { if (el.textContent?.startsWith('Government')) el.textContent = ''; }, 4000);
      }
    });

    this.game.on('playerEliminated', (data: any) => {
      console.log('Player eliminated', data);
      this.handlePlayerEliminated(data);
    });

    this.game.on('unitDefeated', (data: any) => {
      console.log('Unit defeated', data);
      this.handleUnitDefeated(data);
    });

    // Invalidate connection + terrain caches on any tile improvement change.
    this.game.on('terrainImproved', () => {
      this.gameRenderer.invalidateConnectionCache();
      this.requestRender();
    });

    // Diplomacy contact required (AI wants to talk to the human)
    this.game.on('diplomacyContactRequired', (data: any) => {
      this.handleDiplomacyContactRequired(data);
    });

    // Human player tried to move onto an AI unit tile while not at war
    this.game.on('declareWarRequired', (data: any) => {
      this.handleDeclareWarRequired(data);
    });

    // Diplomacy resolved – update UI to reflect changed relations
    this.game.on('diplomaticWarDeclared', () => {
      this.updateUI();
      this.requestRender();
    });
    this.game.on('diplomaticPeaceSigned', () => {
      this.updateUI();
      this.requestRender();
    });

    this.game.on('villageEncountered', (data: any) => {
      const { unit, result } = data;
      // Always refresh the map so the hut icon disappears
      this.gameRenderer.markTerrainLayerDirty();
      this.requestRender();

      // Only show a notification to the human player
      const gameState = this.game.getGameState();
      const player = gameState.players.find((p: any) => p.id === unit.playerId);
      if (!player?.isHuman) return;
      if (!result.message) return;

      this.updateUI();
      NotificationDialog.info('Tribal Village', result.message);
    });
  }

  // Handle research selection requirement
  private handleResearchSelectionRequired(data: { playerId: string, player: any }): void {
    console.log(`handleResearchSelectionRequired: Research selection required for player: ${data.playerId}`);

    // Skip if technology discovery is currently in progress
    if (this.isTechnologyDiscoveryInProgress) {
      console.log('handleResearchSelectionRequired: Skipping research selection - technology discovery in progress');
      return;
    }

    // AI Dev Test: silently pick first available technology — no dialog
    if (DebugSystem.getInstance().isAiDevTestEnabled()) {
      const techs = this.game.getAvailableTechnologies(data.playerId);
      if (techs.length > 0) {
        this.game.setCurrentResearch(data.playerId, techs[0]);
        this.updateUI();
      }
      return;
    }

    // Use Science Advisor modal for automatic prompts
    if (this.scienceAdvisorModal) {
      this.scienceAdvisorModal.show(this.game, data.player, (technologyType) => {
        // Set the selected technology as current research (don't immediately research it)
        const success = this.game.setCurrentResearch(data.playerId, technologyType);
        if (success) {
          console.log(`handleResearchSelectionRequired: Player ${data.playerId} set current research to: ${technologyType}`);
          // Update UI to reflect the current research change
          this.updateUI();
        }
      });
    } else {
      console.error('handleResearchSelectionRequired: Science Advisor modal not initialized, falling back to regular modal');
      TechnologyUI.openTechnologySelection(this.game, data.player, (technologyType) => {
        const success = this.game.setCurrentResearch(data.playerId, technologyType);
        if (success) {
          console.log(`handleResearchSelectionRequired: Player ${data.playerId} set current research to: ${technologyType}`);
          this.updateUI();
        }
      });
    }
  }

  /**
   * Setup UI event listeners
   */
  private setupUIEventListeners(): void {
    this.setupMenuBar();

    const endTurnBtn = document.querySelector<HTMLButtonElement>('#end-turn-btn');
    if (endTurnBtn) {
      endTurnBtn.addEventListener('click', () => {
        this.game.endTurn();
        this.requestRender();
      });
    }

    const pauseBtn = document.querySelector<HTMLButtonElement>('#pause-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        this.game.togglePause();
        this.requestRender();
      });
    }

    // Listen for unit selection from city modal
    document.addEventListener('cityUnitSelected', (_event: any) => {
      // this.handleCityUnitSelected(event.detail.unit);
    });
  }

  /**
   * Setup menu bar functionality
   */
  private setupMenuBar(): void {
    const menuItems = document.querySelectorAll('.menu-item');

    menuItems.forEach(menuItem => {
      const menuLabel = menuItem.querySelector('.menu-label');

      if (menuLabel) {
        menuItem.addEventListener('mouseenter', () => {
          menuItems.forEach(item => item.classList.remove('active'));
          menuItem.classList.add('active');
        });
      }
    });

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#menu-bar')) {
        menuItems.forEach(item => item.classList.remove('active'));
      }
    });

    this.setupMenuActions();
  }

  // Setup individual menu actions
  private setupMenuActions(): void {
    // File menu
    this.addMenuAction('new-game', () => {
      console.log('New Game clicked');
      this.showLandingScreen();
    });

    this.addMenuAction('new-scenario', () => {
      console.log('New Scenario clicked');
      this.showScenarioModal();
    });

    this.addMenuAction('load-game', () => {
      console.log('Load Game clicked');
      // TODO: Implement load game functionality
      alert('Load Game feature coming soon!');
    });

    this.addMenuAction('save-game', () => {
      console.log('Save Game clicked');
      // TODO: Implement save game functionality
      alert('Save Game feature coming soon!');
    });

    this.addMenuAction('quit', () => {
      console.log('Quit clicked');
      if (confirm('Are you sure you want to quit?')) {
        window.close();
      }
    });

    this.addMenuAction('settings', () => {
      console.log('Settings clicked');
      this.showSettingsModal();
    });

    // Edit menu
    this.addMenuAction('undo', () => {
      console.log('Undo clicked');
      alert('Undo feature coming soon!');
    });

    this.addMenuAction('redo', () => {
      console.log('Redo clicked');
      alert('Redo feature coming soon!');
    });

    this.addMenuAction('preferences', () => {
      console.log('Preferences clicked');
      alert('Preferences feature coming soon!');
    });

    // Orders menu
    this.addMenuAction('move-unit', () => {
      // Activate goto mode – same as pressing G in-game.
      // The player then clicks a destination tile to send the unit there.
      this.inputHandler.activateGotoMode();
    });

    this.addMenuAction('attack', () => {
      console.log('Attack clicked');
      alert('Attack command coming soon!');
    });

    this.addMenuAction('fortify', () => {
      console.log('Fortify clicked');
      alert('Fortify command coming soon!');
    });

    this.addMenuAction('delete-unit', () => {
      if (!this.inputHandler) return;
      (this.inputHandler as any).handleDeleteUnit?.();
    });

    // Advisors menu
    this.addMenuAction('domestic-advisor', () => {
      console.log('Domestic Advisor clicked');
      // Open the budget / tax rate modal as the 'economic advisor'
      if (this.status) {
        (this.status as any).budgetModal?.open();
      }
    });

    this.addMenuAction('tax-rates', () => {
      if (this.status) {
        (this.status as any).budgetModal?.open();
      }
    });

    this.addMenuAction('revolution', async () => {
      if (!this.game) {
        await NotificationDialog.info('Revolution', 'Please start a game first!');
        return;
      }
      const state = this.game.getGameState();
      const player = state.players.find((p: any) => p.id === state.currentPlayer);
      if (!player) return;

      if (player.government === 'anarchy') {
        await NotificationDialog.info('Revolution', 'You are already in Anarchy!');
        return;
      }

      const available = this.game.getAvailableGovernments(player.id);
      const upgrades = available.filter((g: string) => g !== 'anarchy' && g !== player.government);
      if (upgrades.length === 0) {
        await NotificationDialog.info(
          'Revolution',
          'No other governments are available yet. Research government technologies first.'
        );
        return;
      }

      const confirmed = await NotificationDialog.confirm(
        'Start Revolution?',
        'Your civilization will enter a period of Anarchy (2-5 turns)\nbefore you can choose a new government.\n\nProceed?'
      );
      if (!confirmed) return;

      const success = this.game.startRevolution(player.id);
      if (success) {
        // The 'revolutionStarted' event handler shows the notification dialog
        this.updateUI();
      }
    });

    this.addMenuAction('foreign-advisor', () => {
      if (!this.game || !this.intelligenceAdvisorModal) {
        alert('Please start a game first!');
        return;
      }
      this.intelligenceAdvisorModal.show(this.game, (targetPlayerId: string) => {
        this.game.initiatePlayerDiplomacy(targetPlayerId);
      });
    });

    this.addMenuAction('science-advisor', () => {
      console.log('Science Advisor clicked');
      console.log('Game instance:', this.game);
      console.log('TechnologyUI:', TechnologyUI);

      if (this.game) {
        try {
          TechnologyUI.handleTechnologyShortcut(this.game);
          console.log('TechnologyUI.handleTechnologyShortcut called successfully');
        } catch (error) {
          console.error('Error calling TechnologyUI.handleTechnologyShortcut:', error);
        }
      } else {
        console.warn('No game instance available');
        alert('Please start a game first!');
      }
    });

    // World menu
    this.addMenuAction('world-map', () => {
      console.log('World Map clicked');
      this.minimap.toggle();
    });

    this.addMenuAction('demographics', () => {
      console.log('Demographics clicked');
      alert('Demographics view coming soon!');
    });

    // Civilopedia menu
    this.addMenuAction('complete-civilopedia', () => {
      console.log('Complete Civilopedia clicked');
      alert('Civilopedia coming soon!');
    });

    // City menu
    this.addMenuAction('view-city', () => {
      console.log('View City clicked');
      alert('City view coming soon!');
    });

    // Help menu
    this.addMenuAction('help-index', () => {
      console.log('Help Index clicked');
      alert('Help system coming soon!');
    });

    this.addMenuAction('game-manual', () => {
      window.open('http://dn720006.ca.archive.org/0/items/civilization-1-manual/Civilization%201%20manual.pdf', '_blank', '');
    });

    this.addMenuAction('about', () => {
      console.log('About clicked');
      alert('CivWin - A Civilization-like game built with TypeScript and HTML5 Canvas\n\nVersion 1.0\nDeveloped with Vite and modern web technologies');
    });

    this.populateMusicMenu();
  }

  // Helper method to add menu action listeners
  private addMenuAction(id: string, callback: () => void): void {
    const element = document.querySelector(`#${id}`);
    if (element) {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        callback();
        // Close all menus after action
        document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
      });
    }
  }

  private populateMusicMenu(): void {
    const menuList = document.querySelector('#music-menu-list');

    if (!menuList || !this.musicPlayer) {
      return;
    }

    menuList.innerHTML = '';

    // "Customize..." item always at the top
    const customizeItem = document.createElement('li');
    const customizeLink = document.createElement('a');
    customizeLink.href = '#';
    customizeLink.textContent = 'Customize\u2026';
    customizeLink.style.fontStyle = 'italic';
    customizeLink.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
      this.musicPlayer.openCustomizeDialog();
    });
    customizeItem.appendChild(customizeLink);
    menuList.appendChild(customizeItem);

    const separator = document.createElement('li');
    separator.className = 'separator';
    menuList.appendChild(separator);

    const tracks = this.musicPlayer.getTracks();

    if (!tracks.length) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="menu-placeholder">No tracks available</span>';
      menuList.appendChild(li);
      return;
    }

    tracks.forEach(track => {
      const listItem = document.createElement('li');
      const link = document.createElement('a');

      link.href = '#';
      link.textContent = track.name;
      link.dataset.trackIndex = track.index.toString();
      if (!track.enabled) {
        link.style.opacity = '0.4';
        link.style.textDecoration = 'line-through';
      }

      link.addEventListener('click', (event) => {
        event.preventDefault();
        this.musicPlayer.playTrackByIndex(track.index);
        this.highlightMusicMenuSelection(track.index);
        document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
      });

      listItem.appendChild(link);
      menuList.appendChild(listItem);
    });

    this.highlightMusicMenuSelection(this.musicPlayer.getActiveTrackIndex());
  }

  private highlightMusicMenuSelection(trackIndex: number): void {
    const menuList = document.querySelector('#music-menu-list');

    if (!menuList) {
      return;
    }

    const links = menuList.querySelectorAll<HTMLAnchorElement>('a[data-track-index]');

    links.forEach(link => {
      const linkIndex = parseInt(link.dataset.trackIndex || '-1', 10);
      link.classList.toggle('active', linkIndex === trackIndex);
    });
  }

  // ── Landing screen ───────────────────────────────────────────────────────

  /** Create (if needed) and display the Civ 1-style title/new-game screen. */
  showLandingScreen(): void {
    // Dev setting: skip straight to game without showing the landing dialog.
    if (this.settingsManager.getSetting('skipInitialView')) {
      this.startNewGame();
      return;
    }
    if (!this.landingScreen) {
      this.landingScreen = new LandingScreen();
      this.landingScreen.setOnAction(action => this.handleLandingAction(action));
    }
    this.landingScreen.show();
  }

  /** Create (if needed) and display the difficulty selection screen. */
  private showDifficultyScreen(): void {
    if (!this.difficultyScreen) {
      this.difficultyScreen = new DifficultyScreen();
      this.difficultyScreen.setOnConfirm(level => {
        this.currentDifficulty = level;
        console.log('Difficulty selected:', level);
        // After difficulty, move to competition screen
        this.showCompetitionScreen();
      });
      this.difficultyScreen.setOnBack(() => {
        this.showLandingScreen();
      });
    }
    this.difficultyScreen.show();
  }

  /** Create (if needed) and display the "Level of Competition" screen. */
  private showCompetitionScreen(): void {
    if (!this.competitionScreen) {
      this.competitionScreen = new CompetitionScreen();
      this.competitionScreen.setOnConfirm(choice => {
        this.currentTotalCivs = choice.totalCivs;
        console.log('Competition selected:', choice.totalCivs, 'civs');
        // After competition, move to tribe selection
        this.showTribeScreen();
      });
      this.competitionScreen.setOnBack(() => {
        this.showDifficultyScreen();
      });
    }
    this.competitionScreen.show();
  }

  /** Create (if needed) and display the "Pick your tribe" screen. */
  private showTribeScreen(): void {
    if (!this.tribeScreen) {
      this.tribeScreen = new TribeScreen();
      this.tribeScreen.setOnBack(() => {
        this.showCompetitionScreen();
      });
    }
    this.tribeScreen.setOnConfirm(choice => {
      this.currentTribe = choice;
      console.log('Tribe selected:', choice);
      if (choice === 'custom') {
        // Step 1: ask for tribe name
        this.showNamePrompt(
          { title: 'Custom Tribe', prompt: 'What is your tribe called?', placeholder: 'Enter tribe name…' },
          tribeName => {
            this.currentTribeName = tribeName;
            // Step 2: ask for leader name
            this.showNamePrompt(
              { title: tribeName, prompt: 'What shall your people call you?', placeholder: 'Enter your name…' },
              leaderName => {
                this.currentLeaderName = leaderName;
                this.startNewGame();
              },
              () => this.showTribeScreen(),
            );
          },
          () => this.showTribeScreen(),
        );
      } else {
        // Named tribe: pre-fill with historical leader name
        const civ = getCivilization(choice as any);
        const defaultLeader = civ?.leader ?? 'Player';
        this.currentTribeName = civ?.adjective ?? choice;
        this.showNamePrompt(
          { title: civ?.name ?? choice, prompt: 'What shall your people call you?', defaultValue: defaultLeader },
          leaderName => {
            this.currentLeaderName = leaderName;
            this.startNewGame();
          },
          () => this.showTribeScreen(),
        );
      }
    });
    this.tribeScreen.show();
  }

  /** Show the NamePromptScreen with the given config, confirm and back callbacks. */
  private showNamePrompt(
    config: { title: string; prompt: string; defaultValue?: string; placeholder?: string },
    onConfirm: (value: string) => void,
    onBack: () => void,
  ): void {
    if (!this.namePromptScreen) {
      this.namePromptScreen = new NamePromptScreen();
    }
    this.namePromptScreen.setOnConfirm(onConfirm);
    this.namePromptScreen.setOnBack(onBack);
    this.namePromptScreen.show(config);
  }

  /** Start a new game immediately with the parameters collected in the new-game flow. */
  private startNewGame(): void {
    // Default to a random world unless the user previously chose otherwise
    this.currentScenario = 'random';
    this.initializeGame();
    this.requestRender();
  }

  /** Route the action chosen on the landing screen to the appropriate flow. */
  private handleLandingAction(action: string): void {
    console.log('Landing screen action:', action);
    switch (action) {
      case 'new-game':
        this.showDifficultyScreen();
        break;
      case 'load-game':
        alert('Load a Saved Game – coming soon!');
        break;
      case 'play-earth':
        // Start a game with the Earth scenario immediately
        this.currentScenario = 'earth';
        this.initializeGame();
        this.requestRender();
        break;
      case 'customize-world':
        // Scenario modal doubles as the world customizer
        this.showScenarioModal();
        break;
      case 'hall-of-fame':
        alert('Hall of Fame – coming soon!');
        break;
      case 'quit':
        if (confirm('Are you sure you want to quit?')) {
          window.close();
        }
        break;
      case 'dev-skip':
        // Dev shortcut: skip all setup screens and start a random game immediately.
        this.startNewGame();
        break;
    }
  }

  // Show scenario selection modal
  private showScenarioModal(): void {
    const modal = document.querySelector('#scenario-modal') as HTMLElement;
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('active');

      // Setup modal event listeners
      this.setupScenarioModalListeners();
    }
  }

  // Hide scenario selection modal
  private hideScenarioModal(): void {
    const modal = document.querySelector('#scenario-modal') as HTMLElement;
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
  }

  // Show settings modal
  private showSettingsModal(): void {
    const modal = document.querySelector('#settings-modal') as HTMLElement;
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('active');

      // Setup modal event listeners
      this.setupSettingsModalListeners();

      // Load current settings
      this.loadCurrentSettings();

      // Sync music player volume with settings
      if (this.musicPlayer) {
        this.musicPlayer.syncVolumeWithSettings();
      }
    }
  }

  // Hide settings modal
  private hideSettingsModal(): void {
    const modal = document.querySelector('#settings-modal') as HTMLElement;
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
  }

  // Setup scenario modal event listeners
  private setupScenarioModalListeners(): void {
    console.log('Setting up scenario modal listeners');

    // Use event delegation on the modal container to avoid cloning issues
    const modal = document.querySelector('#scenario-modal');
    if (!modal) {
      console.error('Modal not found');
      return;
    }

    // Remove any existing listeners by cloning the modal (this preserves content)
    const newModal = modal.cloneNode(true);
    modal.parentNode?.replaceChild(newModal, modal);

    // Add event listener using event delegation
    newModal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      console.log('Modal click:', target.id, target.textContent);

      // Handle close and cancel buttons
      if (target.id === 'scenario-modal-close' || target.id === 'scenario-cancel') {
        console.log('Closing modal');
        this.hideScenarioModal();
        return;
      }

      // Handle start game button
      if (target.id === 'scenario-start') {
        console.log('Start Game button clicked');
        const selectedScenario = document.querySelector('input[name="scenario"]:checked') as HTMLInputElement;
        if (selectedScenario) {
          const scenarioValue = selectedScenario.value as MapScenario;
          this.currentScenario = scenarioValue;
          
          // Get world size if Civ1 scenario is selected
          let worldSize: number | undefined;
          if (scenarioValue === 'civ1') {
            const selectedWorldSize = document.querySelector('input[name="worldSize"]:checked') as HTMLInputElement;
            if (selectedWorldSize) {
              worldSize = parseInt(selectedWorldSize.value);
            }
          }
          
          console.log(`Starting new game with ${scenarioValue} scenario${worldSize !== undefined ? ` (world size: ${worldSize})` : ''}`);

          // Initialize the game with the selected scenario and world size
          this.initializeGame(worldSize);

          // Hide the modal
          this.hideScenarioModal();

          // Force a re-render
          this.requestRender();
        } else {
          console.error('No scenario selected');
        }
        return;
      }

      // Close modal when clicking on overlay background
      if (target === newModal) {
        console.log('Clicked on modal overlay, closing');
        this.hideScenarioModal();
      }
    });

    // Add change listener for scenario selection to show/hide world size
    newModal.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.name === 'scenario') {
        const worldSizeSection = document.querySelector('#world-size-section') as HTMLElement;
        if (worldSizeSection) {
          if (target.value === 'civ1') {
            worldSizeSection.style.display = 'block';
          } else {
            worldSizeSection.style.display = 'none';
          }
        }
      }
    });

    // Add keyboard handler for Enter/Space to start game
    const keydownHandler = (event: KeyboardEvent) => {
      if (newModal && (newModal as HTMLElement).style.display === 'flex') {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          const selectedScenario = document.querySelector('input[name="scenario"]:checked') as HTMLInputElement;
          if (selectedScenario) {
            const scenarioValue = selectedScenario.value as MapScenario;
            this.currentScenario = scenarioValue;
            
            // Get world size if Civ1 scenario is selected
            let worldSize: number | undefined;
            if (scenarioValue === 'civ1') {
              const selectedWorldSize = document.querySelector('input[name="worldSize"]:checked') as HTMLInputElement;
              if (selectedWorldSize) {
                worldSize = parseInt(selectedWorldSize.value);
              }
            }
            
            console.log(`Starting new game with ${scenarioValue} scenario${worldSize !== undefined ? ` (world size: ${worldSize})` : ''}`);

            // Initialize the game with the selected scenario and world size
            this.initializeGame(worldSize);

            // Hide the modal
            this.hideScenarioModal();

            // Force a re-render
            this.requestRender();

            document.removeEventListener('keydown', keydownHandler);
          }
        }
      }
    };
    document.addEventListener('keydown', keydownHandler);
  }

  // Setup settings modal event listeners
  private setupSettingsModalListeners(): void {
    console.log('Setting up settings modal listeners');

    const modal = document.querySelector('#settings-modal');
    if (!modal) {
      console.error('Settings modal not found');
      return;
    }

    // Remove any existing listeners by cloning the modal
    const newModal = modal.cloneNode(true);
    modal.parentNode?.replaceChild(newModal, modal);

    // Add event listener using event delegation
    newModal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      console.log('Settings modal click:', target.id, target.textContent);

      // Handle tab switching
      if (target.classList.contains('tab-button')) {
        const tabName = target.getAttribute('data-tab');
        if (tabName) {
          this.switchSettingsTab(tabName, newModal as HTMLElement);
        }
        return;
      }

      // Handle close and cancel buttons
      if (target.id === 'settings-modal-close' || target.id === 'settings-cancel') {
        console.log('Closing settings modal');
        this.hideSettingsModal();
        return;
      }

      // Handle apply button
      if (target.id === 'settings-apply') {
        console.log('Apply settings button clicked');
        this.applySettings();
        this.hideSettingsModal();
        return;
      }

      // Handle reset button
      if (target.id === 'settings-reset') {
        console.log('Reset settings button clicked');
        this.resetSettingsToDefaults();
        return;
      }

      // Close modal when clicking on overlay background
      if (target === newModal) {
        console.log('Clicked on settings modal overlay, closing');
        this.hideSettingsModal();
      }
    });

    // Add keyboard handler for Enter/Space to apply settings
    const keydownHandler = (event: KeyboardEvent) => {
      if (newModal && (newModal as HTMLElement).style.display === 'flex') {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.applySettings();
          this.hideSettingsModal();
          document.removeEventListener('keydown', keydownHandler);
        }
      }
    };
    document.addEventListener('keydown', keydownHandler);

    // Handle range input updates
    newModal.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.type === 'range') {
        const valueSpan = (newModal as HTMLElement).querySelector('.volume-value');
        if (valueSpan && target.id === 'master-volume') {
          valueSpan.textContent = `${target.value}%`;

          // Update the master volume setting in real-time
          const newVolume = parseInt(target.value);
          this.settingsManager.updateSettings({ masterVolume: newVolume });

          // Update music volume immediately
          if (this.musicPlayer) {
            this.musicPlayer.setVolume(newVolume / 100);
          }

          // Play a test sound to demonstrate the new volume level
          SoundEffects.playVolumeTestSound();
        }

        // Live label for difficulty slider
        if (target.id === 'dev-difficulty') {
          const levels = ['Chieftain', 'Warlord', 'Prince', 'King', 'Emperor'];
          const labelEl = (newModal as HTMLElement).querySelector('#dev-difficulty-label');
          if (labelEl) labelEl.textContent = levels[parseInt(target.value)] ?? '';
        }
      }
    });

    // Add volume slider event listeners for live feedback
    this.setupVolumeSliderListeners(newModal);
  }

  /**
   * Setup volume slider listeners for live feedback
   */
  private setupVolumeSliderListeners(modal: Node): void {
    const modalElement = modal as HTMLElement;
    const masterVolumeSlider = modalElement.querySelector('#master-volume') as HTMLInputElement;
    const musicVolumeSlider = modalElement.querySelector('#music-volume') as HTMLInputElement;
    const effectsVolumeSlider = modalElement.querySelector('#effects-volume') as HTMLInputElement;

    const volumeValues = modalElement.querySelectorAll('.volume-value');

    // Master volume slider
    if (masterVolumeSlider) {
      masterVolumeSlider.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        if (volumeValues[0]) {
          volumeValues[0].textContent = `${value}%`;
        }
      });
    }

    // Music volume slider
    if (musicVolumeSlider) {
      musicVolumeSlider.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        if (volumeValues[1]) {
          volumeValues[1].textContent = `${value}%`;
        }

        // Live sync with music player without triggering settings save
        if (this.musicPlayer) {
          this.musicPlayer.updateVolumeUI(parseInt(value));
        }
      });
    }

    // Effects volume slider
    if (effectsVolumeSlider) {
      effectsVolumeSlider.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        if (volumeValues[2]) {
          volumeValues[2].textContent = `${value}%`;
        }

        // Play test sound with new volume
        SoundEffects.playInvalidActionSound();
      });
    }
  }

  // Load current settings into the modal
  private loadCurrentSettings(): void {
    const settings = this.settingsManager.getSettings();

    // Load settings into form elements
    this.setCheckboxValue('show-grid', settings.showGrid);
    this.setCheckboxValue('unit-animations', settings.unitAnimations);
    this.setSelectValue('terrain-quality', settings.terrainQuality);
    this.setCheckboxValue('auto-save', settings.autoSave);
    this.setInputValue('turn-timer', settings.turnTimer.toString());
    this.setCheckboxValue('require-end-of-turn', settings.requireEndOfTurn);
    this.setSelectValue('ai-speed', settings.aiSpeed);
    this.setInputValue('master-volume', settings.masterVolume.toString());
    this.setInputValue('music-volume', settings.musicVolume.toString());
    this.setInputValue('effects-volume', settings.effectsVolume.toString());
    this.setCheckboxValue('music-enabled', settings.musicEnabled);
    this.setCheckboxValue('sound-effects', settings.soundEffects);

    // Load debug settings
    this.setCheckboxValue('enable-logging', settings.enableLogging);
    this.setCheckboxValue('show-coordinates', settings.showCoordinates);
    this.setCheckboxValue('show-visibility-overlay', settings.showVisibilityOverlay);
    this.setCheckboxValue('show-unit-paths', settings.showUnitPaths);
    this.setCheckboxValue('show-city-radius', settings.showCityRadius);
    this.setCheckboxValue('enable-cheats', settings.enableCheats);
    this.setCheckboxValue('unlimited-movement', settings.unlimitedMovement);
    this.setCheckboxValue('reveal-all-map', settings.revealAllMap);
    this.setCheckboxValue('fast-production', settings.fastProduction);
    this.setCheckboxValue('civ2-enhancements', settings.civ2Enhancements);
    this.setSelectValue('unit-set', settings.unitSet);
    this.setCheckboxValue('any-tile-improvement', settings.anyTileImprovement);
    this.setCheckboxValue('always-show-contact-button', settings.alwaysShowContactButton);
    this.setCheckboxValue('ai-dev-test', settings.aiDevTest);
    this.setCheckboxValue('skip-initial-view', settings.skipInitialView);

    // Load current game difficulty (stored in gameState, not SettingsManager)
    if (this.game) {
      const diffLevels = ['chieftain', 'warlord', 'prince', 'king', 'emperor'];
      const diffLabels = ['Chieftain', 'Warlord', 'Prince', 'King', 'Emperor'];
      const idx = diffLevels.indexOf(this.game.getDifficulty());
      const sliderIdx = idx >= 0 ? idx : 0;
      this.setInputValue('dev-difficulty', sliderIdx.toString());
      const labelEl = document.getElementById('dev-difficulty-label');
      if (labelEl) labelEl.textContent = diffLabels[sliderIdx];
    }

    // Update volume displays
    const volumeValues = document.querySelectorAll('.volume-value');
    if (volumeValues.length >= 1) {
      volumeValues[0].textContent = `${settings.masterVolume}%`;
    }
    if (volumeValues.length >= 2) {
      volumeValues[1].textContent = `${settings.musicVolume}%`;
    }
    if (volumeValues.length >= 3) {
      volumeValues[2].textContent = `${settings.effectsVolume}%`;
    }
  }

  // Apply settings from the modal
  private applySettings(): void {
    const newSettings = {
      showGrid: this.getCheckboxValue('show-grid'),
      unitAnimations: this.getCheckboxValue('unit-animations'),
      terrainQuality: this.getSelectValue('terrain-quality') as 'low' | 'medium' | 'high',
      autoSave: this.getCheckboxValue('auto-save'),
      turnTimer: parseInt(this.getInputValue('turn-timer') || '60'),
      requireEndOfTurn: this.getCheckboxValue('require-end-of-turn'),
      aiSpeed: this.getSelectValue('ai-speed') as 'slow' | 'normal' | 'fast',
      masterVolume: parseInt(this.getInputValue('master-volume') || '80'),
      musicVolume: parseInt(this.getInputValue('music-volume') || '70'),
      effectsVolume: parseInt(this.getInputValue('effects-volume') || '80'),
      musicEnabled: this.getCheckboxValue('music-enabled'),
      soundEffects: this.getCheckboxValue('sound-effects'),

      // Debug settings
      enableLogging: this.getCheckboxValue('enable-logging'),
      showCoordinates: this.getCheckboxValue('show-coordinates'),
      showVisibilityOverlay: this.getCheckboxValue('show-visibility-overlay'),
      showUnitPaths: this.getCheckboxValue('show-unit-paths'),
      showCityRadius: this.getCheckboxValue('show-city-radius'),
      enableCheats: this.getCheckboxValue('enable-cheats'),
      unlimitedMovement: this.getCheckboxValue('unlimited-movement'),
      revealAllMap: this.getCheckboxValue('reveal-all-map'),
      fastProduction: this.getCheckboxValue('fast-production'),
      civ2Enhancements: this.getCheckboxValue('civ2-enhancements'),
      unitSet: this.getSelectValue('unit-set') as 'classic' | 'v2' | 'v3',
      anyTileImprovement: this.getCheckboxValue('any-tile-improvement'),
      alwaysShowContactButton: this.getCheckboxValue('always-show-contact-button'),
      aiDevTest: this.getCheckboxValue('ai-dev-test'),
      skipInitialView: this.getCheckboxValue('skip-initial-view')
    };

    console.log('Applying settings:', newSettings);

    // Update settings through the manager
    this.settingsManager.updateSettings(newSettings);

    // Sync Autopilot Mode bar visibility
    this.updateAiDevTestBar();

    // Apply difficulty change immediately if a game is running
    const diffLevels: import('./types/game').DifficultyLevel[] = ['chieftain', 'warlord', 'prince', 'king', 'emperor'];
    const diffIdx = parseInt(this.getInputValue('dev-difficulty') || '0');
    const selectedDifficulty = diffLevels[diffIdx] ?? 'chieftain';
    if (this.game) {
      this.game.setDifficulty(selectedDifficulty);
      this.updateUI();
    }

    // Apply music volume immediately
    if (this.musicPlayer) {
      this.musicPlayer.setVolume(newSettings.musicVolume / 100);
    }

    // Play a test sound to demonstrate the new effects volume level
    SoundEffects.playVolumeTestSound();

    // Note: Sound effects volume is automatically applied when SoundEffects.playSound() is called
    // since it reads from SettingsManager each time

    // Force a re-render to apply visual changes
    this.requestRender();

    console.log('Settings applied successfully');
  }

  // Reset settings to defaults
  private resetSettingsToDefaults(): void {
    console.log('Resetting settings to defaults');

    // Reset through the settings manager
    this.settingsManager.resetToDefaults();

    // Reload settings in the modal
    this.loadCurrentSettings();
  }

  // Helper methods for form elements
  private setCheckboxValue(id: string, value: boolean): void {
    const element = document.querySelector(`#${id}`) as HTMLInputElement;
    if (element) {
      element.checked = value;
    }
  }

  private getCheckboxValue(id: string): boolean {
    const element = document.querySelector(`#${id}`) as HTMLInputElement;
    return element ? element.checked : false;
  }

  private setSelectValue(id: string, value: string): void {
    const element = document.querySelector(`#${id}`) as HTMLSelectElement;
    if (element) {
      element.value = value;
    }
  }

  private getSelectValue(id: string): string {
    const element = document.querySelector(`#${id}`) as HTMLSelectElement;
    return element ? element.value : '';
  }

  private setInputValue(id: string, value: string): void {
    const element = document.querySelector(`#${id}`) as HTMLInputElement;
    if (element) {
      element.value = value;
    }
  }

  private getInputValue(id: string): string {
    const element = document.querySelector(`#${id}`) as HTMLInputElement;
    return element ? element.value : '';
  }

  /**
   * Update the visibility and button state of the Autopilot Mode controls bar
   */
  public updateAiDevTestBar(): void {
    const bar = document.getElementById('ai-devtest-controls');
    if (!bar) return;
    const enabled = DebugSystem.getInstance().isAiDevTestEnabled();
    bar.style.display = enabled ? 'flex' : 'none';
    if (enabled) {
      const paused = this.game?.isAiDevTestPaused?.() ?? false;
      const pauseBtn = document.getElementById('ai-devtest-pause');
      const playBtn = document.getElementById('ai-devtest-play');
      if (pauseBtn) pauseBtn.style.display = paused ? 'none' : '';
      if (playBtn) playBtn.style.display = paused ? '' : 'none';

      // Sync difficulty selector with current game difficulty
      const diffSelect = document.getElementById('ai-devtest-difficulty') as HTMLSelectElement | null;
      if (diffSelect && this.game) {
        diffSelect.value = this.game.getDifficulty();
      }
    }
  }

  /**
   * Wire up the Autopilot Mode controls bar buttons (called once during init)
   */
  private setupAiDevTestControls(): void {
    document.getElementById('ai-devtest-difficulty')?.addEventListener('change', (e) => {
      const level = (e.target as HTMLSelectElement).value as import('./types/game').DifficultyLevel;
      if (this.game) {
        this.game.setDifficulty(level);
        this.updateUI();
        console.log('Difficulty changed to:', level);
      }
    });

    document.getElementById('ai-devtest-stop')?.addEventListener('click', () => {
      this.settingsManager.setSetting('aiDevTest', false);
      this.setCheckboxValue('ai-dev-test', false);
      this.game?.pauseAiDevTest();
      this.updateAiDevTestBar();
    });

    document.getElementById('ai-devtest-pause')?.addEventListener('click', () => {
      this.game?.pauseAiDevTest();
      this.updateAiDevTestBar();
    });

    document.getElementById('ai-devtest-play')?.addEventListener('click', () => {
      this.game?.resumeAiDevTest();
      this.updateAiDevTestBar();
    });
  }

  /**
   * Get the settings manager instance
   */
  public getSettingsManager(): SettingsManager {
    return this.settingsManager;
  }

  /**
   * Test sound effects with current volume settings
   */
  public testSoundEffects(): void {
    SoundEffects.playInvalidActionSound();
  }

  /**
   * Initialize the Science Advisor modal
   */
  public initializeScienceAdvisorModal(): void {
    console.log('Initializing Science Advisor modal...');
    try {
      this.scienceAdvisorModal = new ScienceAdvisorModal();
      console.log('Science Advisor modal initialized successfully');
    } catch (error) {
      console.error('Error initializing Science Advisor modal:', error);
      this.scienceAdvisorModal = null;
    }
  }

  /**
   * Initialize the Technology Discovery modal
   */
  public initializeTechnologyDiscoveryModal(): void {
    console.log('Initializing Technology Discovery modal...');
    try {
      this.technologyDiscoveryModal = new TechnologyDiscoveryModal();
      console.log('Technology Discovery modal initialized successfully');
    } catch (error) {
      console.error('Error initializing Technology Discovery modal:', error);
      this.technologyDiscoveryModal = null;
    }
  }

  /**
   * Initialize the Defeat Notification modal
   */
  public initializeDefeatNotificationModal(): void {
    console.log('Initializing Defeat Notification modal...');
    try {
      this.defeatNotificationModal = new DefeatNotificationModal();
      console.log('Defeat Notification modal initialized successfully');
    } catch (error) {
      console.error('Error initializing Defeat Notification modal:', error);
      this.defeatNotificationModal = null;
    }
  }

  /**
   * Initialize the Government selection modal
   */
  public initializeGovernmentModal(): void {
    try {
      this.governmentModal = new GovernmentModal();
    } catch (error) {
      console.error('Error initializing Government modal:', error);
      this.governmentModal = null;
    }
  }

  /**
   * Initialize the Diplomacy dialog
   */
  public initializeDiplomacyDialog(): void {
    try {
      this.diplomacyDialog = new DiplomacyDialog();
    } catch (error) {
      console.error('Error initializing Diplomacy dialog:', error);
      this.diplomacyDialog = null;
    }
  }

  /**
   * Initialize the Intelligence Advisor modal
   */
  public initializeIntelligenceAdvisorModal(): void {
    try {
      this.intelligenceAdvisorModal = new IntelligenceAdvisorModal();
    } catch (error) {
      console.error('Error initializing Intelligence Advisor modal:', error);
      this.intelligenceAdvisorModal = null;
    }
  }

  /**
   * Handle a diplomacy contact (AI wants to talk to the human player).
   */
  /**
   * Human unit tried to move onto a tile occupied by an AI they are not at war with.
   * Show a confirmation dialog; if confirmed, declare war and execute the attack.
   */
  private async handleDeclareWarRequired(data: {
    unitId: string;
    targetPosition: { x: number; y: number };
    aiPlayerId: string;
    aiCivName: string;
  }): Promise<void> {
    const { unitId, targetPosition, aiPlayerId, aiCivName } = data;

    // If a dialog is already open for this AI player (e.g. bulk-move sent several units at once),
    // share the same confirmation promise so the player only sees one prompt.
    let confirmPromise = this.pendingWarConfirmations.get(aiPlayerId);
    if (!confirmPromise) {
      const aiDevTest = SettingsManager.getInstance().getSetting('aiDevTest');
      if (aiDevTest) {
        confirmPromise = Promise.resolve(true);
      } else {
        confirmPromise = NotificationDialog.confirm(
          'Declare War?',
          `Moving onto this tile will declare war on the ${aiCivName}!\n\nDo you wish to proceed?`,
          'Continue'
        );
      }
      this.pendingWarConfirmations.set(aiPlayerId, confirmPromise);
      // Clean up after the dialog resolves (regardless of outcome)
      confirmPromise.finally(() => this.pendingWarConfirmations.delete(aiPlayerId));
    }

    const confirmed = await confirmPromise;
    if (confirmed) {
      this.game.confirmDeclareWarAndAttack(unitId, targetPosition, aiPlayerId);
      this.updateUI();
      this.requestRender();
    }
    // If not confirmed: unit stays put, movement points are intact.
  }

  private handleDiplomacyContactRequired(data: { contact: any }): void {
    if (!this.diplomacyDialog) return;
    // Skip in AI dev test mode
    if (DebugSystem.getInstance().isAiDevTestEnabled()) {
      this.game.applyDiplomacyOutcome(data.contact, { accepted: false, war: false, peace: false });
      return;
    }

    const gameState = this.game.getGameState();
    const contact = data.contact;
    const humanPlayer = gameState.players.find((p: any) => p.isHuman && !p.defeated);
    // If the human has been eliminated, silently reject the contact — no dialog.
    if (!humanPlayer) {
      this.game.applyDiplomacyOutcome(data.contact, { accepted: false, war: false, peace: false });
      return;
    }
    const aiPlayerId = contact.initiatorId === humanPlayer?.id
      ? contact.receiverId
      : contact.initiatorId;
    const aiPlayer = gameState.players.find((p: any) => p.id === aiPlayerId);

    if (!humanPlayer || !aiPlayer) return;
    // Barbarians never appear in the diplomacy dialog.
    if ((aiPlayer as any).isBarbarian) return;

    this.diplomacyDialog.show(contact, aiPlayer, humanPlayer, this.game).then((outcome) => {
      this.game.applyDiplomacyOutcome(contact, outcome);
      this.updateUI();
      this.requestRender();
    });
  }

  /**
   * Handle government selection required event (anarchy ended for human player).
   */
  private handleGovernmentSelectionRequired(data: { playerId: string; player: any; mandatory?: boolean }): void {
    if (DebugSystem.getInstance().isAiDevTestEnabled()) {
      const gameState = this.game.getGameState();
      const chosenGov = chooseGovernmentAfterAnarchy(gameState, data.playerId);
      this.game.changeGovernment(data.playerId, chosenGov);
      this.updateUI();
      return;
    }

    if (!this.governmentModal) {
      console.error('GovernmentModal not initialized');
      return;
    }

    const player = this.game.getGameState().players.find((p: any) => p.id === data.playerId);
    if (!player) return;

    this.governmentModal.show(this.game, player, data.mandatory ?? false, (chosenGov) => {
      console.log(`Player ${data.playerId} chose government: ${chosenGov}`);
      this.updateUI();
    });
  }

  /**
   * Process game events that occurred during the turn
   */
  private processGameEvents(gameState: any): void {
    if (!gameState.events || gameState.events.length === 0) return;

    gameState.events.forEach((event: any) => {
      switch (event.type) {
        case 'technologyCompleted':
          this.handleTechnologyCompleted(event);
          break;
        // Add other event types as needed
      }
    });

    // Clear events after processing.
    // Must mutate the array in place (splice) rather than reassigning (= []) because
    // getGameState() returns a shallow copy – reassignment only updates the copy's
    // reference and never clears this.gameState.events.
    if (Array.isArray(gameState.events)) {
      gameState.events.splice(0);
    }
  }

  /**
   * Handle technology completion event
   */
  private handleTechnologyCompleted(event: any): void {
    console.log('Technology completed:', event.technologyType, 'for player:', event.playerId);
    // Note: the technology has already been awarded in TurnManager.updatePlayerResources.
    // This handler is for UI notification only.

    // Show discovery modal if this is a human player and NOT in AI dev mode
    if (event.player && event.player.isHuman && this.technologyDiscoveryModal &&
        !DebugSystem.getInstance().isAiDevTestEnabled()) {
      // Set flag to prevent automatic research selection during discovery
      this.isTechnologyDiscoveryInProgress = true;

      this.technologyDiscoveryModal.show(event.technologyType, () => {
        // Clear the flag when discovery modal is done
        this.isTechnologyDiscoveryInProgress = false;

        // After discovery modal closes, check if we need to prompt for new research
        const currentPlayer = this.game.getGameState().players.find(p => p.id === event.playerId);
        if (currentPlayer && currentPlayer.isHuman && !currentPlayer.currentResearch) {
          // Prompt for new research selection
          this.promptForNewResearch(currentPlayer);
        }
      });
    }
  }

  /**
   * Prompt player to select new research
   */
  private promptForNewResearch(player: any): void {
    // AI Dev Test: silently pick first available technology — no dialog
    if (DebugSystem.getInstance().isAiDevTestEnabled()) {
      const techs = this.game.getAvailableTechnologies(player.id);
      if (techs.length > 0) {
        this.game.setCurrentResearch(player.id, techs[0]);
        this.updateUI();
      }
      return;
    }

    // Use Science Advisor modal for research selection
    if (this.scienceAdvisorModal) {
      this.scienceAdvisorModal.show(this.game, player, (technologyType) => {
        // Set the selected technology as current research
        const success = this.game.setCurrentResearch(player.id, technologyType);
        if (success) {
          console.log(`Player ${player.id} set current research to: ${technologyType}`);
          this.updateUI();
        }
      });
    }
  }

  // Preload unit and city sprites for better performance
  private async preloadSprites(gameState: any): Promise<void> {
    try {
      // Extract player colors from game state
      const playerColors = gameState.players.map((player: any) => player.color);

      // Define unit types that have custom sprites
      const unitTypesWithSprites = [UnitType.SETTLERS];

      // Preload unit sprites for all player colors and unit types
      await UnitSprites.preloadSprites(unitTypesWithSprites, playerColors, 48);

      // Preload city sprites for all player colors
      await CitySprites.preloadSprites(playerColors, 48);

      // Preload technology sprites for the UI
      await TechnologySprites.preloadSprites(48);

      console.log('Unit, city, and technology sprites preloaded successfully');
    } catch (error) {
      console.warn('Failed to preload sprites:', error);
    } finally {
      // Always resolve so the loading screen is never stuck waiting.
      this._spritesLoadedResolve();
    }
  }

  /**
   * Returns a promise that resolves once unit, city, and technology sprites
   * have finished preloading (or failed).  Safe to await before first render.
   */
  public waitForSprites(): Promise<void> {
    return this._spritesLoadedPromise;
  }

  /**
   * Handle unit selection - center camera on the selected unit
   */
  private handleUnitSelected(data: any): void {
    if (data && data.unit && data.unit.position) {
      const pos = data.unit.position;
      // When centerIfNeeded is set (e.g. promoted from queue dialog), only pan
      // the camera if the unit is not already visible in the current viewport.
      const shouldCenter = !data.centerIfNeeded || !this.isUnitPositionVisible(pos.x, pos.y);
      if (shouldCenter) {
        this.inputHandler.centerView(pos.x, pos.y);
      }

      // Tell the renderer which unit is selected so it can highlight it
      this.gameRenderer.selectUnit(data.unit);

      // Tell the status panel which unit is selected
      this.status.setSelectedUnit(data.unit);

      // Request a render to show the selection highlight
      this.requestRender();
    }
  }

  /**
   * Handle unit blinking - toggle the blink state in renderer
   */
  private handleUnitBlink(): void {
    this.gameRenderer.toggleUnitBlink();
    this.requestRender();
  }

  /**
   * Handle defeated units by starting the pixel fade animation
   */
  private handleUnitDefeated(data: { unit?: Unit } | null): void {
    if (!data || !data.unit) {
      return;
    }

    const unitSnapshot: Unit = {
      ...data.unit,
      position: { ...data.unit.position }
    };

    const gameState = this.game.getGameState();
    this.gameRenderer.startUnitDeathAnimation(unitSnapshot, gameState);
    // Only drive the animation loop when an animation was actually queued
    // (off-screen / shrouded kills are skipped inside startUnitDeathAnimation).
    if (this.gameRenderer.hasActiveUnitDeathAnimations()) {
      this.ensureDeathAnimationLoop();
    }
  }

  /**
   * Ensure we keep rendering frames while defeat animations are active
   */
  private ensureDeathAnimationLoop(): void {
    if (this.deathAnimationFrameHandle !== null) {
      return;
    }

    const step = () => {
      this.render();

      if (this.gameRenderer.hasActiveUnitDeathAnimations()) {
        this.deathAnimationFrameHandle = requestAnimationFrame(step);
      } else {
        this.deathAnimationFrameHandle = null;
      }
    };

    this.deathAnimationFrameHandle = requestAnimationFrame(step);
  }

  /**
   * Handle unit deselection - clear selection highlight
   */
  private handleUnitDeselected(): void {
    console.log('Unit deselected - clearing selection highlight');
    this.gameRenderer.clearSelections();

    // Clear the selected unit from the status panel
    this.status.setSelectedUnit(null);

    this.requestRender();
  }

  /**
   * Update UI elements with current game state
   */
  private updateUI(): void {
    const gameState = this.game.getGameState();

    // Process game events first
    this.processGameEvents(gameState);

    // Update turn counter
    const turnCounter = document.querySelector('#turn-counter');
    if (turnCounter) {
      turnCounter.textContent = `Turn: ${gameState.turn}`;
    }

    // Update score
    const scoreElement = document.querySelector('#score');
    if (scoreElement) {
      scoreElement.textContent = `Score: ${gameState.score}`;
    }

    // Update year (calculate based on turn, starting from 4000 BC)
    const yearElement = document.querySelector('#year');
    if (yearElement) {
      const year = GameTime.calculateYear(gameState.turn);
      const yearText = year > 0 ? `${year} BC` : `${Math.abs(year)} AD`;
      yearElement.textContent = yearText;
    }

    // Update difficulty display
    const diffElement = document.querySelector('#difficulty-display');
    if (diffElement && this.game) {
      const level = this.game.getDifficulty();
      diffElement.textContent = level.charAt(0).toUpperCase() + level.slice(1);
    }

    // Update current player info (remove this section as we moved it to status bar)
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (currentPlayer) {
      // Add player info to status bar if needed
      // For now, we'll keep the basic info in the status bar
    }
  }

  // Check if a world position is visible in the current viewport
  private isUnitPositionVisible(worldX: number, worldY: number): boolean {
    const visibleRange = this.renderer.getVisibleTileRange();
    const gameState = this.game.getGameState();
    const mapWidth = gameState.worldMap[0]?.length || 80;

    // Handle horizontal wrapping for X coordinate
    const normalizedX = ((worldX % mapWidth) + mapWidth) % mapWidth;

    // Check if X is within visible range (considering wrapping)
    let xVisible = false;
    if (visibleRange.startX >= 0 && visibleRange.endX <= mapWidth) {
      // Normal case - no wrapping in visible range
      xVisible = normalizedX >= visibleRange.startX && normalizedX <= visibleRange.endX;
    } else {
      // Visible range wraps around the map edge
      const wrappedStartX = ((visibleRange.startX % mapWidth) + mapWidth) % mapWidth;
      const wrappedEndX = ((visibleRange.endX % mapWidth) + mapWidth) % mapWidth;

      if (wrappedStartX <= wrappedEndX) {
        xVisible = normalizedX >= wrappedStartX && normalizedX <= wrappedEndX;
      } else {
        // Range crosses the wrap boundary
        xVisible = normalizedX >= wrappedStartX || normalizedX <= wrappedEndX;
      }
    }

    // Check if Y is within visible range (no wrapping for Y)
    const yVisible = worldY >= visibleRange.startY && worldY <= visibleRange.endY;

    return xVisible && yVisible;
  }

  // Handle canvas resizing
  private handleResize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height);
    // Canvas dimensions changed – the cached terrain layer must be rebuilt.
    this.gameRenderer.markTerrainLayerDirty();
    this.requestRender();
  }

  // Handle AI turn start
  private handleAITurnStarted(data: { playerId: string, playerName: string }): void {
    console.log(`AI Player ${data.playerName} (${data.playerId}) turn started`);
    // Update the status window to show AI turn message
    this.status.showAIPlayerMessage();
    this.requestRender();
  }

  // Handle AI turn end
  private handleAITurnEnded(data: { playerId: string, playerName: string }): void {
    console.log(`AI Player ${data.playerName} (${data.playerId}) turn ended`);

    // Update game state in status window to reflect the new current player
    this.status.updateGameState(this.game.getGameState());

    this.updateUI();
    this.requestRender();
  }

  // Handle human turn start
  private handleHumanTurnStarted(data: { playerId: string }): void {
    console.log(`Human player turn started: ${data.playerId}`);

    // Update game state in status window to ensure it knows we're now in human turn
    this.status.updateGameState(this.game.getGameState());

    // Clear end of turn state if it was set
    this.status.setEndOfTurnState(false);

    this.updateUI();
    this.requestRender();
  }

  /**
   * Handle end of turn when no units are available to move
   */
  private handleEndOfTurn(): void {
    console.log('No more units available to move - setting end of turn state');
    this.status.setEndOfTurnState(true);
    this.requestRender();
  }

  /**
   * Handle player elimination event
   */
  private handlePlayerEliminated(data: any): void {
    console.log('Player eliminated:', data);

    // Suppress popup in AI dev mode
    if (DebugSystem.getInstance().isAiDevTestEnabled()) return;

    if (!this.defeatNotificationModal) {
      console.error('Defeat notification modal not available');
      return;
    }

    // Get the defeated player's civilization name
    const gameState = this.game.getGameState();
    const defeatedPlayer = gameState.players.find((p: any) => p.id === data.playerId);
    const defeatedCivName = defeatedPlayer ? this.getCivilizationDisplayName(defeatedPlayer.civilizationType) : 'Unknown';

    // Find the most dominant remaining player as the "victor"
    // For simplicity, we'll use the current player as the victor
    const currentPlayer = gameState.players.find((p: any) => p.id === gameState.currentPlayer);
    const victorCivName = currentPlayer ? this.getCivilizationDisplayName(currentPlayer.civilizationType) : 'Unknown';

    // Show the defeat notification with acknowledgment callback
    this.defeatNotificationModal.show(defeatedCivName, victorCivName, () => {
      // Mark defeat as acknowledged in the game
      this.game.acknowledgePlayerDefeat(data.playerId);
    });
  }

  /**
   * Get display name for a civilization type
   */
  private getCivilizationDisplayName(civilizationType: string): string {
    const civMap: { [key: string]: string } = {
      'romans': 'Romans',
      'american': 'Americans',
      'aztecs': 'Aztecs',
      'babylonian': 'Babylonians',
      'chinese': 'Chinese',
      'egyptian': 'Egyptians',
      'english': 'English',
      'french': 'French',
      'german': 'Germans',
      'greeks': 'Greeks',
      'indian': 'Indians',
      'mongol': 'Mongols',
      'russian': 'Russians',
      'zulu': 'Zulus'
    };

    return civMap[civilizationType] || civilizationType;
  }

  // Request a render on the next frame – coalesces rapid calls into a single RAF.
  public requestRender(): void {
    if (this.isRenderPending) return;
    this.isRenderPending = true;
    requestAnimationFrame(() => {
      this.isRenderPending = false;
      this.render();
    });
  }

  public async start(): Promise<void> {
    // Wait for terrain images before rendering so tiles never appear blank.
    // Falls back after 5 s so a slow/offline load still shows the game.
    await TerrainManager.waitForImages();
    TerrainManager.clearSpriteCache(); // discard any blank sprites cached during init
    // The GameRenderer keeps its own offscreen terrain layer. Clearing the sprite
    // cache alone is not enough – we must also mark that layer dirty so it is
    // rebuilt from the now-loaded images on the next render pass.
    this.gameRenderer.markTerrainLayerDirty();
    this.requestRender();
  }

  // Render the game (only when needed)
  private render(): void {
    const gameState = this.game.getGameState();
    const showGrid = this.settingsManager.getSetting('showGrid');

    console.debug('Rendering game state:', {
      worldMapSize: `${gameState.worldMap.length}x${gameState.worldMap[0]?.length || 0}`,
      turn: gameState.turn,
      canvasSize: `${this.canvas.width}x${this.canvas.height}`,
      showGrid
    });

    this.gameRenderer.render(gameState, showGrid, this.game);
    this.minimap.updateGameState(gameState);
    this.status.updateGameState(gameState);

    // If terrain images are still loading, schedule a follow-up render so tiles
    // don't stay blank until the user happens to scroll or interact.
    if (!TerrainManager.areAllImagesLoaded()) {
      setTimeout(() => {
        // Discard any blank sprites AND force the offscreen terrain layer to
        // rebuild – without this, the fast-path just re-blits the blank canvas.
        TerrainManager.clearSpriteCache();
        this.gameRenderer.markTerrainLayerDirty();
        this.requestRender();
      }, 100);
    }
  }

  /**
   * Sync the settings modal music volume slider with the music player's current volume
   */
  private syncSettingsModalWithMusicPlayer(): void {
    if (!this.musicPlayer) return;

    const settingsModal = document.querySelector('#settings-modal') as HTMLElement;
    if (!settingsModal || settingsModal.style.display === 'none') return;

    const musicVolumeSlider = settingsModal.querySelector('#music-volume') as HTMLInputElement;
    const volumeValues = settingsModal.querySelectorAll('.volume-value');

    if (musicVolumeSlider && volumeValues[1]) {
      const currentVolume = Math.round(this.musicPlayer.getVolume() * 100);
      musicVolumeSlider.value = currentVolume.toString();
      volumeValues[1].textContent = `${currentVolume}%`;
    }
  }

  /**
   * Switch settings tab
   */
  private switchSettingsTab(tabName: string, modal: HTMLElement): void {
    // Remove active class from all tab buttons
    const tabButtons = modal.querySelectorAll('.tab-button');
    tabButtons.forEach(button => button.classList.remove('active'));

    // Add active class to clicked tab button
    const activeButton = modal.querySelector(`[data-tab="${tabName}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
    }

    // Hide all tab panels
    const tabPanels = modal.querySelectorAll('.tab-panel');
    tabPanels.forEach(panel => panel.classList.remove('active'));

    // Show the selected tab panel
    const activePanel = modal.querySelector(`#${tabName}-tab`);
    if (activePanel) {
      activePanel.classList.add('active');
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const loadingScreen = new LoadingScreen();

  try {
    // ── Step 1: load HTML template partials ────────────────────────────────
    loadingScreen.setStatus('Loading templates');
    loadingScreen.setProgress(0.1);
    const templateManager = UITemplateManager.getInstance();
    await templateManager.loadAllTemplates();

    // ── Step 2: initialize core UI and game systems ────────────────────────
    loadingScreen.setStatus('Initializing systems');
    loadingScreen.setProgress(0.25);
    console.log('Initializing TechnologyUI after templates are loaded...');
    TechnologyUI.initialize();

    const app = new CivWinApp();
    app.initializeScienceAdvisorModal();
    app.initializeTechnologyDiscoveryModal();
    app.initializeDefeatNotificationModal();
    app.initializeGovernmentModal();
    app.initializeDiplomacyDialog();
    app.initializeIntelligenceAdvisorModal();

    // ── Step 3: wait for terrain tile images ───────────────────────────────
    loadingScreen.setStatus('Loading terrain');
    loadingScreen.setProgress(0.45);
    await app.start();
    loadingScreen.setProgress(0.65);

    // ── Step 4: wait for unit, city, and technology sprites ────────────────
    loadingScreen.setStatus('Loading sprites');
    loadingScreen.setProgress(0.75);
    await app.waitForSprites();

    // ── Done ───────────────────────────────────────────────────────────────
    loadingScreen.setStatus('Ready');
    loadingScreen.setProgress(1.0);

    // Make app globally accessible for debugging
    (window as any).civWinApp = app;
    (window as any).testSoundEffects = () => app.testSoundEffects();

    await loadingScreen.hide();

    // ── Step 5: show the title / landing screen ────────────────────────────
    app.showLandingScreen();
  } catch (error) {
    console.error('Failed to initialize application:', error);
    await loadingScreen.hide();
    // Show user-friendly error message
    document.body.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #1a1a1a; color: white; font-family: Arial, sans-serif;">
        <div style="text-align: center; max-width: 500px; padding: 20px;">
          <h1>🚧 Loading Error</h1>
          <p>Failed to load game templates. Please refresh the page to try again.</p>
          <p style="font-size: 12px; color: #888; margin-top: 20px;">Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
          <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #0078d4; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Refresh Page
          </button>
        </div>
      </div>
    `;
  }
});
