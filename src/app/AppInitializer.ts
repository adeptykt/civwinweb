/**
 * Application initializer - handles all startup logic
 */
import { ServiceContainer } from '../core/ServiceContainer';
import { EventBus } from '../core/EventBus';
import { Game } from '../game/Game';
import { Renderer } from '../renderer/Renderer';
import { GameRenderer } from '../renderer/GameRenderer';
import { InputHandler } from '../utils/InputHandler';
import { MusicPlayer } from '../utils/MusicPlayer';
import { SettingsManager } from '../utils/SettingsManager';

export interface AppConfig {
  canvasId: string;
  minimapCanvasId: string;
  enableMusic?: boolean;
  enableSounds?: boolean;
  debugMode?: boolean;
}

export class AppInitializer {
  private serviceContainer: ServiceContainer;
  private eventBus: EventBus;

  constructor(serviceContainer: ServiceContainer, eventBus: EventBus) {
    this.serviceContainer = serviceContainer;
    this.eventBus = eventBus;
  }

  /**
   * Initialize the entire application
   */
  async initialize(config: AppConfig): Promise<void> {
    try {
      // 1. Initialize core services
      await this.initializeCoreServices();
      
      // 2. Initialize canvas and rendering
      this.initializeRendering(config);
      
      // 3. Initialize game systems
      this.initializeGameSystems();
      
      // 4. Initialize input handling
      this.initializeInput();
      
      // 5. Initialize audio systems
      this.initializeAudio(config);
      
      // 6. Initialize UI systems
      await this.initializeUI();
      
      // 7. Setup global event handlers
      this.setupGlobalEventHandlers();
      
      console.log('Application initialized successfully');
      this.eventBus.emit('app:initialized');
      
    } catch (error) {
      console.error('Failed to initialize application:', error);
      throw error;
    }
  }

  private async initializeCoreServices(): Promise<void> {
    // Register core services
    this.serviceContainer.register('eventBus', () => this.eventBus);
    this.serviceContainer.register('settingsManager', () => SettingsManager.getInstance());
  }

  private initializeRendering(config: AppConfig): void {
    const canvas = document.querySelector<HTMLCanvasElement>(`#${config.canvasId}`);
    const minimapCanvas = document.querySelector<HTMLCanvasElement>(`#${config.minimapCanvasId}`);
    
    if (!canvas || !minimapCanvas) {
      throw new Error('Required canvas elements not found');
    }

    // Register rendering services
    this.serviceContainer.register('mainCanvas', () => canvas);
    this.serviceContainer.register('minimapCanvas', () => minimapCanvas);
    this.serviceContainer.register('renderer', () => new Renderer(canvas));
    this.serviceContainer.register('gameRenderer', () => 
      new GameRenderer(this.serviceContainer.get('renderer'))
    );
  }

  private initializeGameSystems(): void {
    // Register game services
    this.serviceContainer.register('game', () => new Game());
  }

  private initializeInput(): void {
    const canvas = this.serviceContainer.get<HTMLCanvasElement>('mainCanvas');
    const game = this.serviceContainer.get<Game>('game');
    const gameRenderer = this.serviceContainer.get<GameRenderer>('gameRenderer');
    const renderer = this.serviceContainer.get<Renderer>('renderer');
    
    this.serviceContainer.register('inputHandler', () => 
      new InputHandler(
        game, 
        gameRenderer, 
        renderer, 
        canvas, 
        () => {}, // requestRender callback
        () => {}, // minimapToggle callback (optional)
        undefined, // status (optional)
        undefined  // cityView (optional)
      )
    );
  }

  private initializeAudio(config: AppConfig): void {
    if (config.enableMusic) {
      this.serviceContainer.register('musicPlayer', () => new MusicPlayer());
    }
  }

  private async initializeUI(): Promise<void> {
    // Initialize UI templates and systems
    // This would load templates, setup modals, etc.
  }

  private setupGlobalEventHandlers(): void {
    // Setup application-wide event handlers
    this.eventBus.on('game:error', (error) => {
      console.error('Game error:', error);
      // Handle game errors globally
    });

    this.eventBus.on('app:exit', () => {
      this.cleanup();
    });
  }

  private cleanup(): void {
    // Cleanup resources when app shuts down
    this.serviceContainer.clear();
    this.eventBus.clear();
  }
}
