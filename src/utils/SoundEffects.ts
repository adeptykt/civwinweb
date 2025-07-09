import { SettingsManager } from './SettingsManager';

/**
 * Simple sound effects utility for game events
 */
export class SoundEffects {
  private static volumeTestTimeout: number | null = null;

  /**
   * Get the current master volume from settings
   */
  private static getMasterVolume(): number {
    const settingsManager = SettingsManager.getInstance();
    return settingsManager.getSetting('masterVolume') / 100; // Convert from 0-100 to 0-1
  }

  /**
   * Get the current effects volume from settings
   */
  private static getEffectsVolume(): number {
    const settingsManager = SettingsManager.getInstance();
    return settingsManager.getSetting('effectsVolume') / 100; // Convert from 0-100 to 0-1
  }

  /**
   * Check if sound effects are enabled
   */
  private static areSoundEffectsEnabled(): boolean {
    const settingsManager = SettingsManager.getInstance();
    return settingsManager.getSetting('soundEffects');
  }

  /**
   * Play a sound effect
   * @param soundPath Path to the sound file
   * @param baseVolume Base volume level (0-1), will be multiplied by master volume
   */
  public static playSound(soundPath: string, baseVolume: number = 0.5): void {
    // Check if sound effects are enabled
    if (!this.areSoundEffectsEnabled()) {
      return;
    }

    try {
      const audio = new Audio(soundPath);
      const masterVolume = this.getMasterVolume();
      const effectsVolume = this.getEffectsVolume();
      // Multiply base volume by master volume and effects volume settings
      const finalVolume = Math.max(0, Math.min(1, baseVolume * masterVolume * effectsVolume));
      audio.volume = finalVolume;
      
      audio.play().catch(error => {
        console.warn('Failed to play sound:', soundPath, error);
      });
    } catch (error) {
      console.warn('Failed to create audio for:', soundPath, error);
    }
  }

  /**
   * Play the city building sound effect
   */
  public static playCityFoundingSound(): void {
    this.playSound('/src/audio/BLDCITY.WAV', 0.6);
  }

  /**
   * Play negative feedback sound (invalid action)
   */
  public static playInvalidActionSound(): void {
    this.playSound('/src/audio/NEG1.WAV', 0.4);
  }

  /**
   * Play a unit movement sound (placeholder for future expansion)
   */
  public static playUnitMoveSound(): void {
    // TODO: Add unit movement sound when available
  }

  /**
   * Play a combat sound (placeholder for future expansion) 
   */
  public static playCombatSound(): void {
    // TODO: Add combat sound when available
  }

  /**
   * Play sound when player's unit wins combat
   */
  public static playPlayerVictorySound(): void {
    this.playSound('/src/audio/THEY_DIE.WAV', 0.6);
  }

  /**
   * Play sound when player's unit loses combat and dies
   */
  public static playPlayerDefeatSound(): void {
    this.playSound('/src/audio/WE_DIE.WAV', 0.6);
  }

  /**
   * Play sound when a city is captured (deprecated - use playCivilizationFanfare instead)
   */
  public static playCityCaptureSound(): void {
    // Use the city founding sound for city capture as well
    this.playSound('/src/audio/BLDCITY.WAV', 0.7);
  }

  /**
   * Play civilization-specific fanfare for city capture
   * @param civilizationType The civilization type of the capturing player
   */
  public static playCivilizationFanfare(civilizationType: string): void {
    const fanfareMap: { [key: string]: string } = {
      'american': 'american.WAV',
      'aztecs': 'aztec.WAV',
      'babylonian': 'babylon.WAV',
      'chinese': 'chinese.WAV',
      'egyptian': 'egyptian.WAV',
      'english': 'english.WAV',
      'french': 'french.WAV',
      'german': 'german.WAV',
      'greeks': 'greek.WAV',
      'indian': 'indian.WAV',
      'mongol': 'mongol.WAV',
      'romans': 'roman.WAV',
      'russian': 'russian.WAV',
      'zulu': 'zulu.WAV'
    };

    const fanfareFile = fanfareMap[civilizationType.toLowerCase()];
    if (fanfareFile) {
      this.playSound(`/src/audio/civ1fanfare/${fanfareFile}`, 0.8);
    } else {
      // Fallback to a default fanfare if civilization not found
      this.playSound('/src/audio/civ1fanfare/roman.WAV', 0.8);
    }
  }

  /**
   * Play a test sound to demonstrate the current volume level
   * Uses DRUMA0.WAV or DRUMB0.WAV randomly
   * Debounced to prevent too frequent playback when dragging sliders
   */
  public static playVolumeTestSound(): void {
    // Clear any existing timeout
    if (this.volumeTestTimeout !== null) {
      clearTimeout(this.volumeTestTimeout);
    }
    
    // Set a new timeout to debounce the sound playback
    this.volumeTestTimeout = setTimeout(() => {
      // Choose randomly between the two drum sounds
      const drumSounds = ['/src/audio/DRUMA0.WAV', '/src/audio/DRUMB0.WAV'];
      const randomSound = drumSounds[Math.floor(Math.random() * drumSounds.length)];
      
      // Play at a moderate volume level to test the volume setting
      this.playSound(randomSound, 0.7);
      
      this.volumeTestTimeout = null;
    }, 150); // 150ms debounce delay
  }
}
