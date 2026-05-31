/**
 * Global event bus for decoupled communication between components
 */
export type EventCallback<T = any> = (data: T) => void;

export interface GameEvent {
  type: string;
  data?: any;
  timestamp: number;
}

export class EventBus {
  private listeners = new Map<string, EventCallback[]>();
  private eventHistory: GameEvent[] = [];
  private maxHistorySize = 1000;

  /**
   * Subscribe to an event
   */
  on<T = any>(eventType: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    this.listeners.get(eventType)!.push(callback);
    
    // Return unsubscribe function
    return () => this.off(eventType, callback);
  }

  /**
   * Subscribe to an event only once
   */
  once<T = any>(eventType: string, callback: EventCallback<T>): () => void {
    const unsubscribe = this.on(eventType, (data: T) => {
      callback(data);
      unsubscribe();
    });
    return unsubscribe;
  }

  /**
   * Unsubscribe from an event
   */
  off<T = any>(eventType: string, callback: EventCallback<T>): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event
   */
  emit<T = any>(eventType: string, data?: T): void {
    const event: GameEvent = {
      type: eventType,
      data,
      timestamp: Date.now()
    };

    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify listeners
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Get event history
   */
  getHistory(eventType?: string): GameEvent[] {
    if (eventType) {
      return this.eventHistory.filter(event => event.type === eventType);
    }
    return [...this.eventHistory];
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
    this.eventHistory = [];
  }

  /**
   * Get current listener count for debugging
   */
  getListenerCount(eventType?: string): number {
    if (eventType) {
      return this.listeners.get(eventType)?.length || 0;
    }
    return Array.from(this.listeners.values()).reduce((total, listeners) => total + listeners.length, 0);
  }
}

// Global event bus instance
export const eventBus = new EventBus();

// Common event types
export const GameEvents = {
  // Game state events
  GAME_STARTED: 'game:started',
  GAME_PAUSED: 'game:paused',
  GAME_RESUMED: 'game:resumed',
  GAME_ENDED: 'game:ended',
  
  // Turn events
  TURN_STARTED: 'turn:started',
  TURN_ENDED: 'turn:ended',
  PLAYER_TURN_STARTED: 'player:turn_started',
  PLAYER_TURN_ENDED: 'player:turn_ended',
  
  // Unit events
  UNIT_MOVED: 'unit:moved',
  UNIT_CREATED: 'unit:created',
  UNIT_DESTROYED: 'unit:destroyed',
  UNIT_SELECTED: 'unit:selected',
  
  // City events
  CITY_FOUNDED: 'city:founded',
  CITY_CAPTURED: 'city:captured',
  CITY_DESTROYED: 'city:destroyed',
  CITY_BUILT_UNIT: 'city:built_unit',
  CITY_BUILT_BUILDING: 'city:built_building',
  
  // Technology events
  TECH_RESEARCHED: 'tech:researched',
  TECH_RESEARCH_STARTED: 'tech:research_started',
  
  // UI events
  UI_MODE_CHANGED: 'ui:mode_changed',
  UI_DIALOG_OPENED: 'ui:dialog_opened',
  UI_DIALOG_CLOSED: 'ui:dialog_closed',
  
  // Rendering events
  RENDER_REQUESTED: 'render:requested',
  VIEWPORT_CHANGED: 'viewport:changed'
} as const;
