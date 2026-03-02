/**
 * Manages game settings with localStorage persistence
 */
export interface GameSettings {
    // Display Settings
    showGrid: boolean;
    unitAnimations: boolean;
    terrainQuality: 'low' | 'medium' | 'high';

    // Game Settings
    autoSave: boolean;
    turnTimer: number; // seconds
    aiSpeed: 'slow' | 'normal' | 'fast';

    // Audio Settings
    masterVolume: number;
    musicVolume: number;
    effectsVolume: number;
    musicEnabled: boolean;
    soundEffects: boolean;

    // Debug Settings
    showCoordinates: boolean;
    showVisibilityOverlay: boolean;
    showUnitPaths: boolean;
    showCityRadius: boolean;
    logGameEvents: boolean;
    showAiThinking: boolean;
    freezeAi: boolean;
    showPerformanceMetrics: boolean;
    enableCheats: boolean;
    unlimitedMovement: boolean;
    revealAllMap: boolean;
    fastProduction: boolean;
    civ2Enhancements: boolean;
    aiDevTest: boolean;
}

export class SettingsManager {
    private static instance: SettingsManager;
    private static readonly STORAGE_KEY = 'civwin-settings';
    private settings: GameSettings;
    private defaultSettings: GameSettings = {
        // Display Settings
        showGrid: false,
        unitAnimations: true,
        terrainQuality: 'medium',

        // Game Settings
        autoSave: true,
        turnTimer: 60,
        aiSpeed: 'normal',

        // Audio Settings
        masterVolume: 80,
        musicVolume: 70,
        effectsVolume: 80,
        musicEnabled: true,
        soundEffects: true,

        // Debug Settings (all disabled by default)
        showCoordinates: false,
        showVisibilityOverlay: false,
        showUnitPaths: false,
        showCityRadius: false,
        logGameEvents: false,
        showAiThinking: false,
        freezeAi: false,
        showPerformanceMetrics: false,
        enableCheats: false,
        unlimitedMovement: false,
        revealAllMap: false,
        fastProduction: false,
        civ2Enhancements: false,
        aiDevTest: false
    };

    private constructor() {
        this.settings = this.loadFromStorage();
    }

    /**
     * Get the singleton instance
     */
    static getInstance(): SettingsManager {
        if (!this.instance) {
            this.instance = new SettingsManager();
        }
        return this.instance;
    }

    /**
     * Get current settings
     */
    getSettings(): GameSettings {
        return { ...this.settings };
    }

    /**
     * Get a specific setting value
     */
    getSetting<K extends keyof GameSettings>(key: K): GameSettings[K] {
        return this.settings[key];
    }

    /**
     * Update settings (partial update supported)
     */
    updateSettings(newSettings: Partial<GameSettings>): void {
        this.settings = { ...this.settings, ...newSettings };
        this.saveToStorage();
        console.log('Settings updated:', this.settings);
    }

    /**
     * Update a single setting
     */
    setSetting<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
        this.settings[key] = value;
        this.saveToStorage();
        console.log(`Setting ${key} updated to:`, value);
    }

    /**
     * Reset all settings to defaults
     */
    resetToDefaults(): void {
        this.settings = { ...this.defaultSettings };
        this.saveToStorage();
        console.log('Settings reset to defaults');
    }

    /**
     * Get default settings
     */
    getDefaults(): GameSettings {
        return { ...this.defaultSettings };
    }

    /**
     * Load settings from localStorage
     */
    private loadFromStorage(): GameSettings {
        try {
            const stored = localStorage.getItem(SettingsManager.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as Partial<GameSettings>;
                // Merge with defaults to ensure all properties exist
                const merged = { ...this.defaultSettings, ...parsed };
                console.log('Settings loaded from localStorage:', merged);
                return merged;
            }
        } catch (error) {
            console.warn('Failed to load settings from localStorage:', error);
        }

        console.log('Using default settings');
        return { ...this.defaultSettings };
    }

    /**
     * Save settings to localStorage
     */
    private saveToStorage(): void {
        try {
            localStorage.setItem(SettingsManager.STORAGE_KEY, JSON.stringify(this.settings));
        } catch (error) {
            console.error('Failed to save settings to localStorage:', error);
        }
    }

    /**
     * Check if a setting has been changed from default
     */
    isSettingModified<K extends keyof GameSettings>(key: K): boolean {
        return this.settings[key] !== this.defaultSettings[key];
    }

    /**
     * Get all modified settings
     */
    getModifiedSettings(): Partial<GameSettings> {
        const modified: Partial<GameSettings> = {};

        for (const key in this.settings) {
            const typedKey = key as keyof GameSettings;
            if (this.isSettingModified(typedKey)) {
                (modified as any)[typedKey] = this.settings[typedKey];
            }
        }

        return modified;
    }

    /**
     * Import settings from an object (useful for loading from save files)
     */
    importSettings(settings: Partial<GameSettings>): void {
        const validatedSettings = this.validateSettings(settings);
        this.settings = { ...this.defaultSettings, ...validatedSettings };
        this.saveToStorage();
        console.log('Settings imported:', this.settings);
    }

    /**
     * Export settings as JSON string
     */
    exportSettings(): string {
        return JSON.stringify(this.settings, null, 2);
    }

    /**
     * Validate settings object to ensure all values are valid
     */
    private validateSettings(settings: Partial<GameSettings>): Partial<GameSettings> {
        const validated: Partial<GameSettings> = {};

        // Validate display settings
        if (typeof settings.showGrid === 'boolean') {
            validated.showGrid = settings.showGrid;
        }

        if (typeof settings.unitAnimations === 'boolean') {
            validated.unitAnimations = settings.unitAnimations;
        }

        if (settings.terrainQuality && ['low', 'medium', 'high'].includes(settings.terrainQuality)) {
            validated.terrainQuality = settings.terrainQuality;
        }

        // Validate game settings
        if (typeof settings.autoSave === 'boolean') {
            validated.autoSave = settings.autoSave;
        }

        if (typeof settings.turnTimer === 'number' && settings.turnTimer >= 0 && settings.turnTimer <= 600) {
            validated.turnTimer = settings.turnTimer;
        }

        if (settings.aiSpeed && ['slow', 'normal', 'fast'].includes(settings.aiSpeed)) {
            validated.aiSpeed = settings.aiSpeed;
        }

        // Validate audio settings
        if (typeof settings.masterVolume === 'number' && settings.masterVolume >= 0 && settings.masterVolume <= 100) {
            validated.masterVolume = settings.masterVolume;
        }

        if (typeof settings.musicEnabled === 'boolean') {
            validated.musicEnabled = settings.musicEnabled;
        }

        if (typeof settings.soundEffects === 'boolean') {
            validated.soundEffects = settings.soundEffects;
        }

        return validated;
    }
}
