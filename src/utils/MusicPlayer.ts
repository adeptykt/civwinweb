import { SettingsManager } from './SettingsManager';

/**
 * Mini MP3 Player for the CivWin game
 * Handles background music playback with shuffle functionality
 */
export class MusicPlayer {
  private audio: HTMLAudioElement;
  private currentTrackIndex: number = 0;
  private isShuffleEnabled: boolean = false;
  private isPlaying: boolean = false;
  private tracks: string[] = [];
  private shuffledIndices: number[] = [];
  private shufflePosition: number = 0;
  private disabledTrackIds: Set<string> = new Set();

  // UI Elements
  private playPauseBtn!: HTMLButtonElement;
  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;
  private shuffleBtn!: HTMLButtonElement;
  private volumeIcon!: HTMLSpanElement;
  private volumeSlider!: HTMLInputElement;
  private volumeDropdown!: HTMLElement;
  private volumeValue!: HTMLSpanElement;
  private currentTrackSpan!: HTMLSpanElement;
  private progressBar!: HTMLElement;
  private progressFill!: HTMLElement;
  private timeDisplay!: HTMLSpanElement;
  private speedIcon!: HTMLSpanElement;
  private speedSlider!: HTMLInputElement;
  private speedDropdown!: HTMLElement;
  private speedValue!: HTMLSpanElement;

  constructor() {
    this.audio = new Audio();
    this.initializeTracks();
    this.initializeUI();
    this.restoreSettings();
    this.setupEventListeners();
    this.loadCurrentTrack();
  }

  /**
   * Initialize the track list by scanning all MP3s in /src/audio/music/.
   * Vite resolves the glob at build time so no manual list needs to be maintained.
   */
  private initializeTracks(): void {
    const modules = import.meta.glob('/src/audio/music/*.mp3', {
      query: '?url',
      import: 'default',
      eager: true,
    }) as Record<string, string>;

    this.tracks = Object.values(modules).sort();
    this.loadDisabledTracks();
    this.generateShuffledIndices();
  }

  /**
   * Initialize UI element references
   */
  private initializeUI(): void {
    this.playPauseBtn = document.querySelector('#play-pause')!;
    this.prevBtn = document.querySelector('#prev-track')!;
    this.nextBtn = document.querySelector('#next-track')!;
    this.shuffleBtn = document.querySelector('#shuffle-toggle')!;
    this.volumeIcon = document.querySelector('#volume-icon')!;
    this.volumeSlider = document.querySelector('#volume-slider')!;
    this.volumeDropdown = document.querySelector('#volume-dropdown')!;
    this.volumeValue = document.querySelector('#volume-value')!;
    this.speedIcon = document.querySelector('#speed-icon')!;
    this.speedSlider = document.querySelector('#speed-slider')!;
    this.speedDropdown = document.querySelector('#speed-dropdown')!;
    this.speedValue = document.querySelector('#speed-value')!;
    this.currentTrackSpan = document.querySelector('#current-track')!;
    this.progressBar = document.querySelector('#progress-bar')!;
    this.progressFill = document.querySelector('#progress-fill')!;
    this.timeDisplay = document.querySelector('#time-display')!;
  }

  /**
   * Setup event listeners for player controls and audio events
   */
  private setupEventListeners(): void {
    // Control button listeners
    this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    this.prevBtn.addEventListener('click', () => this.previousTrack());
    this.nextBtn.addEventListener('click', () => this.nextTrack());
    this.shuffleBtn.addEventListener('click', () => this.toggleShuffle());

    // Volume control listeners
    this.volumeSlider.addEventListener('input', () => this.updateVolume());
    this.volumeIcon.addEventListener('click', () => this.toggleVolumeDropdown());
    this.volumeIcon.addEventListener('mouseenter', () => this.showVolumeDropdown());
    this.volumeIcon.addEventListener('mouseleave', () => this.hideVolumeDropdown());
    this.volumeDropdown.addEventListener('mouseenter', () => this.showVolumeDropdown());
    this.volumeDropdown.addEventListener('mouseleave', () => this.hideVolumeDropdown());

    // Playback speed control listeners
    this.speedSlider.addEventListener('input', () => this.updatePlaybackSpeed());
    this.speedIcon.addEventListener('click', () => this.toggleSpeedDropdown());
    this.speedIcon.addEventListener('mouseenter', () => this.showSpeedDropdown());
    this.speedIcon.addEventListener('mouseleave', () => this.hideSpeedDropdown());
    this.speedDropdown.addEventListener('mouseenter', () => this.showSpeedDropdown());
    this.speedDropdown.addEventListener('mouseleave', () => this.hideSpeedDropdown());

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.volumeIcon.contains(e.target as Node) && !this.volumeDropdown.contains(e.target as Node)) {
        this.hideVolumeDropdown();
      }
      if (!this.speedIcon.contains(e.target as Node) && !this.speedDropdown.contains(e.target as Node)) {
        this.hideSpeedDropdown();
      }
    });

    // Progress bar interaction
    this.progressBar.addEventListener('click', (e) => this.seekToPosition(e));

    // Audio event listeners
    this.audio.addEventListener('loadedmetadata', () => this.updateTimeDisplay());
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('ended', () => this.nextTrack());
    this.audio.addEventListener('error', (e) => this.handleAudioError(e));
    this.audio.addEventListener('canplay', () => this.handleCanPlay());
    
    // Load volume from settings and apply it
    this.loadVolumeFromSettings();
  }

  /**
   * Generate shuffled indices for shuffle mode
   */
  private generateShuffledIndices(): void {
    this.shuffledIndices = this.getEnabledIndices();
    for (let i = this.shuffledIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffledIndices[i], this.shuffledIndices[j]] = [this.shuffledIndices[j], this.shuffledIndices[i]];
    }
    this.shufflePosition = 0;
  }

  /**
   * Get the current track index (considering shuffle mode)
   */
  private getCurrentTrackIndex(): number {
    return this.isShuffleEnabled ? this.shuffledIndices[this.shufflePosition] : this.currentTrackIndex;
  }

  /**
   * Load the current track
   */
  private loadCurrentTrack(): void {
    const trackIndex = this.getCurrentTrackIndex();
    const trackPath = this.tracks[trackIndex];

    this.audio.src = trackPath;
    const displayName = this.formatTrackName(trackPath);
    this.updateTrackDisplay(displayName);
    this.dispatchTrackChange(trackIndex, displayName);
  }

  /**
   * Update the track name display
   */
  private updateTrackDisplay(displayName: string): void {
    this.currentTrackSpan.textContent = displayName;
  }

  /**
   * Format a human-friendly track title from the file path
   */
  private formatTrackName(trackPath: string): string {
    const fileName = decodeURIComponent(trackPath.split('/').pop() || '');
    const withoutExt = fileName.replace(/\.mp3$/i, '');
    const withoutPrefix = withoutExt.replace(/^civwinweb[-_\s]*/i, '');
    const words = withoutPrefix
      .replace(/[-_]+/g, ' ')
      .split(' ')
      .filter(Boolean);

    if (!words.length) {
      return 'Unknown Track';
    }

    return words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Notify listeners that the current track changed
   */
  private dispatchTrackChange(trackIndex: number, displayName: string): void {
    const event = new CustomEvent('musicTrackChanged', {
      detail: { trackIndex, displayName }
    });

    document.dispatchEvent(event);
  }

  /**
   * Get a list of all tracks with display names
   */
  public getTracks(): { index: number; name: string; path: string; enabled: boolean }[] {
    return this.tracks
      .map((path, index) => ({
        index,
        name: this.formatTrackName(path),
        path,
        enabled: this.isTrackEnabled(path)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Play a specific track from the list
   */
  public playTrackByIndex(trackIndex: number): void {
    if (trackIndex < 0 || trackIndex >= this.tracks.length) {
      return;
    }

    // Direct selection disables shuffle so the chosen song plays immediately
    this.isShuffleEnabled = false;
    this.shuffleBtn.classList.remove('active');
    this.shuffleBtn.title = 'Shuffle: OFF';

    this.currentTrackIndex = trackIndex;
    this.shufflePosition = this.shuffledIndices.indexOf(trackIndex);
    if (this.shufflePosition === -1) {
      this.shufflePosition = trackIndex % this.shuffledIndices.length;
    }

    this.loadCurrentTrack();
    this.play();
  }

  /**
   * Get a stable, build-independent identifier for a track (just the filename).
   */
  private getTrackId(path: string): string {
    return decodeURIComponent(path.split('/').pop() || path);
  }

  /**
   * Return indices of all currently-enabled tracks.
   */
  private getEnabledIndices(): number[] {
    return this.tracks
      .map((path, i) => ({ path, i }))
      .filter(({ path }) => this.isTrackEnabled(path))
      .map(({ i }) => i);
  }

  public isTrackEnabled(path: string): boolean {
    return !this.disabledTrackIds.has(this.getTrackId(path));
  }

  public setTrackEnabled(path: string, enabled: boolean): void {
    const id = this.getTrackId(path);
    if (enabled) {
      this.disabledTrackIds.delete(id);
    } else {
      this.disabledTrackIds.add(id);
    }
    this.saveDisabledTracks();
    this.generateShuffledIndices();
    // If the current track was just disabled, advance to the next enabled one.
    if (!enabled && this.currentTrackIndex !== -1 &&
        this.getTrackId(this.tracks[this.currentTrackIndex]) === id) {
      this.nextTrack();
    }
  }

  private loadDisabledTracks(): void {
    try {
      const raw = localStorage.getItem('civwin-music-disabled');
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        this.disabledTrackIds = new Set(ids);
      }
    } catch {
      this.disabledTrackIds = new Set();
    }
  }

  private saveDisabledTracks(): void {
    localStorage.setItem('civwin-music-disabled', JSON.stringify([...this.disabledTrackIds]));
  }

  /**
   * Open the playlist customization dialog.
   */
  public openCustomizeDialog(): void {
    // Remove any existing dialog
    document.getElementById('music-customize-overlay')?.remove();

    const allTracks = this.tracks
      .map((path, index) => ({ index, name: this.formatTrackName(path), path }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const overlay = document.createElement('div');
    overlay.id = 'music-customize-overlay';
    overlay.className = 'music-customize-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'music-customize-dialog';

    dialog.innerHTML = `
      <div class="music-customize-header">
        <span>Customize Playlist</span>
        <button class="music-customize-close" title="Close">✕</button>
      </div>
      <div class="music-customize-toolbar">
        <button class="music-customize-all">Select All</button>
        <button class="music-customize-none">Deselect All</button>
      </div>
      <ul class="music-customize-list"></ul>
      <div class="music-customize-footer">
        <button class="music-customize-done">Done</button>
      </div>
    `;

    // Dedicated audio element for previewing – separate from main playback.
    const previewAudio = new Audio();
    previewAudio.volume = this.audio.volume;
    let previewTimer: ReturnType<typeof setTimeout> | null = null;
    let activePreviewBtn: HTMLButtonElement | null = null;
    let wasPlayingBeforePreview = false;

    const stopPreview = () => {
      previewAudio.pause();
      previewAudio.src = '';
      previewAudio.load(); // abort any in-flight media fetch so loadedmetadata can't fire late
      if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
      if (activePreviewBtn) {
        activePreviewBtn.textContent = '▶';
        activePreviewBtn.title = 'Preview';
        activePreviewBtn.classList.remove('previewing');
        activePreviewBtn = null;
      }
    };

    const startPreview = (path: string, btn: HTMLButtonElement) => {
      if (activePreviewBtn === btn) { stopPreview(); return; } // toggle off
      stopPreview();
      // Pause the main player and remember whether it was playing.
      wasPlayingBeforePreview = this.isPlaying;
      if (this.isPlaying) { this.pause(); }
      activePreviewBtn = btn;
      btn.textContent = '■';
      btn.title = 'Stop preview';
      btn.classList.add('previewing');
      previewAudio.src = path;
      // Seek into the track a little for a more interesting snippet
      previewAudio.addEventListener('loadedmetadata', () => {
        if (activePreviewBtn !== btn) return; // preview was cancelled before metadata arrived
        const startAt = Math.min(30, (previewAudio.duration || 0) * 0.2);
        previewAudio.currentTime = startAt;
        previewAudio.play().catch(() => {});
        previewTimer = setTimeout(stopPreview, 12000);
      }, { once: true });
      previewAudio.addEventListener('error', stopPreview, { once: true });
    };

    const list = dialog.querySelector('.music-customize-list')!;
    allTracks.forEach(track => {
      const li = document.createElement('li');

      // Preview button
      const previewBtn = document.createElement('button');
      previewBtn.className = 'music-preview-btn';
      previewBtn.textContent = '▶';
      previewBtn.title = 'Preview';
      previewBtn.type = 'button';
      previewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startPreview(track.path, previewBtn);
      });

      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.isTrackEnabled(track.path);
      checkbox.dataset.path = track.path;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(track.name));

      li.appendChild(previewBtn);
      li.appendChild(label);
      list.appendChild(li);
    });

    const close = () => {
      stopPreview();
      if (wasPlayingBeforePreview) {
        wasPlayingBeforePreview = false;
        this.play();
      }
      overlay.remove();
    };

    dialog.querySelector('.music-customize-close')!.addEventListener('click', close);
    dialog.querySelector('.music-customize-done')!.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    dialog.querySelector('.music-customize-all')!.addEventListener('click', () => {
      dialog.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(cb => { cb.checked = true; });
    });
    dialog.querySelector('.music-customize-none')!.addEventListener('click', () => {
      dialog.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(cb => { cb.checked = false; });
    });

    // Apply changes when Done is clicked (also triggers on close-button)
    const applyChanges = () => {
      const checkboxes = dialog.querySelectorAll<HTMLInputElement>('input[type=checkbox][data-path]');
      // Guard: keep at least one track enabled
      const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
      checkboxes.forEach(cb => {
        const path = cb.dataset.path!;
        const shouldEnable = anyChecked ? cb.checked : true;
        const id = this.getTrackId(path);
        if (shouldEnable) {
          this.disabledTrackIds.delete(id);
        } else {
          this.disabledTrackIds.add(id);
        }
      });
      this.saveDisabledTracks();
      this.generateShuffledIndices();
      // Advance if current track is now disabled
      if (this.tracks[this.currentTrackIndex] &&
          !this.isTrackEnabled(this.tracks[this.currentTrackIndex])) {
        this.nextTrack();
      }
      // Notify main app to rebuild the music menu
      document.dispatchEvent(new CustomEvent('musicPlaylistChanged'));
    };

    dialog.querySelector('.music-customize-done')!.addEventListener('click', applyChanges);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  /**
   * Get the currently active track index
   */
  public getActiveTrackIndex(): number {
    return this.getCurrentTrackIndex();
  }

  /**
   * Toggle play/pause
   */
  public togglePlayPause(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Play the current track
   */
  public play(): void {
    this.audio.play().then(() => {
      this.isPlaying = true;
      this.playPauseBtn.textContent = '⏸';
      this.playPauseBtn.title = 'Pause';
      this.saveSettings();
    }).catch(error => {
      console.error('Error playing audio:', error);
    });
  }

  /**
   * Pause the current track
   */
  public pause(): void {
    this.audio.pause();
    this.isPlaying = false;
    this.playPauseBtn.textContent = '▶';
    this.playPauseBtn.title = 'Play';
    this.saveSettings();
  }

  /**
   * Go to the next track
   */
  public nextTrack(): void {
    if (this.isShuffleEnabled) {
      this.shufflePosition = (this.shufflePosition + 1) % this.shuffledIndices.length;
      if (this.shufflePosition === 0) {
        this.generateShuffledIndices(); // Re-shuffle when we complete a cycle
      }
    } else {
      const enabled = this.getEnabledIndices();
      if (!enabled.length) return;
      const pos = enabled.indexOf(this.currentTrackIndex);
      this.currentTrackIndex = enabled[(pos + 1) % enabled.length];
    }
    
    this.loadCurrentTrack();
    if (this.isPlaying) {
      this.play();
    }
  }

  /**
   * Go to the previous track
   */
  public previousTrack(): void {
    if (this.isShuffleEnabled) {
      this.shufflePosition = this.shufflePosition === 0 ? this.shuffledIndices.length - 1 : this.shufflePosition - 1;
    } else {
      const enabled = this.getEnabledIndices();
      if (!enabled.length) return;
      const pos = enabled.indexOf(this.currentTrackIndex);
      this.currentTrackIndex = enabled[pos === 0 ? enabled.length - 1 : pos - 1];
    }
    
    this.loadCurrentTrack();
    if (this.isPlaying) {
      this.play();
    }
  }

  /**
   * Toggle shuffle mode
   */
  public toggleShuffle(): void {
    this.isShuffleEnabled = !this.isShuffleEnabled;
    
    if (this.isShuffleEnabled) {
      this.shuffleBtn.classList.add('active');
      this.shuffleBtn.title = 'Shuffle: ON';
      this.generateShuffledIndices();
      // Find current track in shuffled indices
      const currentTrack = this.getCurrentTrackIndex();
      this.shufflePosition = this.shuffledIndices.indexOf(this.currentTrackIndex);
    } else {
      this.shuffleBtn.classList.remove('active');
      this.shuffleBtn.title = 'Shuffle: OFF';
      // Set current track index to the actual track that's playing
      this.currentTrackIndex = this.getCurrentTrackIndex();
    }
    
    this.saveSettings();
    console.log(`Shuffle ${this.isShuffleEnabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Seek to a specific position in the track
   */
  private seekToPosition(event: MouseEvent): void {
    const rect = this.progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * this.audio.duration;
    
    if (!isNaN(newTime)) {
      this.audio.currentTime = newTime;
    }
  }

  /**
   * Update the progress bar
   */
  private updateProgress(): void {
    if (this.audio.duration) {
      const percentage = (this.audio.currentTime / this.audio.duration) * 100;
      this.progressFill.style.width = `${percentage}%`;
      this.updateTimeDisplay();
    }
  }

  /**
   * Update the time display
   */
  private updateTimeDisplay(): void {
    const currentTime = this.formatTime(this.audio.currentTime || 0);
    const duration = this.formatTime(this.audio.duration || 0);
    this.timeDisplay.textContent = `${currentTime} / ${duration}`;
  }

  /**
   * Format time in MM:SS format
   */
  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Handle audio loading errors
   */
  private handleAudioError(event: Event): void {
    console.error('Audio error:', event);
    this.currentTrackSpan.textContent = 'Error loading track';
    this.isPlaying = false;
    this.playPauseBtn.textContent = '▶';
  }

  /**
   * Handle when audio can start playing
   */
  private handleCanPlay(): void {
    this.updateTimeDisplay();
  }

  /**
   * Restore settings from localStorage
   */
  private restoreSettings(): void {
    // Restore volume setting
    const savedVolume = localStorage.getItem('civwin-music-volume');
    if (savedVolume !== null) {
      const volume = parseInt(savedVolume);
      if (volume >= 0 && volume <= 100) {
        this.volumeSlider.value = volume.toString();
        this.audio.volume = volume / 100;
        this.volumeValue.textContent = `${volume}%`;
      }
    }

    // Restore shuffle setting
    const savedShuffle = localStorage.getItem('civwin-music-shuffle');
    if (savedShuffle === 'true') {
      this.isShuffleEnabled = true;
      this.shuffleBtn.classList.add('active');
      this.shuffleBtn.title = 'Shuffle: ON';
    }

    // Restore playback speed
    this.loadPlaybackSpeedFromSettings();

    // Update volume icon to match restored volume
    this.updateVolumeIcon();
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    // Save volume setting
    localStorage.setItem('civwin-music-volume', this.volumeSlider.value);
    
    // Save shuffle setting
    localStorage.setItem('civwin-music-shuffle', this.isShuffleEnabled.toString());
    
    // Save play state (for next session auto-resume)
    localStorage.setItem('civwin-music-playing', this.isPlaying.toString());

    // Save playback speed
    localStorage.setItem('civwin-music-speed', this.speedSlider.value);
  }

  /**
   * Check if music should auto-resume based on previous session
   */
  private shouldAutoResume(): boolean {
    const savedPlayState = localStorage.getItem('civwin-music-playing');
    return savedPlayState === 'true';
  }

  /**
   * Load volume from settings and apply it
   */
  private loadVolumeFromSettings(): void {
    const settingsManager = SettingsManager.getInstance();
    const musicVolume = settingsManager.getSetting('musicVolume');
    
    // Set the slider value
    this.volumeSlider.value = musicVolume.toString();
    
    // Apply the volume to the audio element
    this.audio.volume = musicVolume / 100;
    
    // Update the volume display
    this.volumeValue.textContent = `${musicVolume}%`;
    
    // Update the icon
    this.updateVolumeIcon();
  }

  /**
   * Load playback speed from settings (default 1.0x)
   */
  private loadPlaybackSpeedFromSettings(): void {
    const savedSpeed = localStorage.getItem('civwin-music-speed');
    const speedValue = savedSpeed ? parseInt(savedSpeed, 10) : 100;
    const clamped = Math.min(150, Math.max(50, isNaN(speedValue) ? 100 : speedValue));

    this.speedSlider.value = clamped.toString();
    const rate = clamped / 100;
    this.audio.playbackRate = rate;
    this.speedValue.textContent = `${rate.toFixed(2)}x`;
    this.updateSpeedIcon(rate);
  }

  /**
   * Sync the current volume setting with the settings manager
   */
  public syncVolumeWithSettings(): void {
    const settingsManager = SettingsManager.getInstance();
    const musicVolume = settingsManager.getSetting('musicVolume');
    
    // Only update if different from current volume
    const currentVolume = Math.round(this.audio.volume * 100);
    if (currentVolume !== musicVolume) {
      this.volumeSlider.value = musicVolume.toString();
      this.audio.volume = musicVolume / 100;
      this.volumeValue.textContent = `${musicVolume}%`;
      this.updateVolumeIcon();
    }
  }

  /**
   * Update volume based on slider value
   */
  private updateVolume(): void {
    const volume = parseInt(this.volumeSlider.value) / 100;
    this.audio.volume = volume;
    this.volumeValue.textContent = `${this.volumeSlider.value}%`;
    this.updateVolumeIcon();
    
    // Save the volume to settings
    const settingsManager = SettingsManager.getInstance();
    settingsManager.updateSettings({ musicVolume: parseInt(this.volumeSlider.value) });
    
    // Notify main app to sync settings modal if open
    this.notifyVolumeChange();
  }

  /**
   * Update playback speed based on slider value
   */
  private updatePlaybackSpeed(): void {
    const speedPercent = parseInt(this.speedSlider.value, 10);
    const rate = speedPercent / 100;

    this.audio.playbackRate = rate;
    this.speedValue.textContent = `${rate.toFixed(2)}x`;
    this.updateSpeedIcon(rate);

    // Persist setting
    localStorage.setItem('civwin-music-speed', speedPercent.toString());
  }

  /**
   * Notify about volume change (for settings modal sync)
   */
  private notifyVolumeChange(): void {
    // Dispatch a custom event that the main app can listen to
    const event = new CustomEvent('musicVolumeChanged', {
      detail: { volume: parseInt(this.volumeSlider.value) }
    });
    document.dispatchEvent(event);
  }

  /**
   * Update the music player UI to match a given volume without saving to settings
   */
  public updateVolumeUI(volume: number): void {
    // Update the slider value
    this.volumeSlider.value = volume.toString();
    
    // Update the audio volume
    this.audio.volume = volume / 100;
    
    // Update the volume display
    this.volumeValue.textContent = `${volume}%`;
    
    // Update the icon
    this.updateVolumeIcon();
  }

  /**
   * Update the volume icon based on current volume level
   */
  private updateVolumeIcon(): void {
    const volume = this.audio.volume;
    
    if (volume === 0) {
      this.volumeIcon.textContent = '🔇';
      this.volumeIcon.title = 'Unmute';
    } else if (volume < 0.3) {
      this.volumeIcon.textContent = '🔈';
      this.volumeIcon.title = 'Low Volume';
    } else if (volume < 0.8) {
      this.volumeIcon.textContent = '🔉';
      this.volumeIcon.title = 'Medium Volume';
    } else {
      this.volumeIcon.textContent = '🔊';
      this.volumeIcon.title = 'High Volume';
    }
  }

  /**
   * Toggle mute on/off
   */
  private toggleMute(): void {
    if (this.audio.volume > 0) {
      // Store current volume and mute
      this.volumeSlider.dataset.previousVolume = this.volumeSlider.value;
      this.audio.volume = 0;
      this.volumeSlider.value = '0';
      this.volumeValue.textContent = '0%';
    } else {
      // Restore previous volume or set to 50% if no previous volume
      const previousVolume = this.volumeSlider.dataset.previousVolume || '50';
      this.volumeSlider.value = previousVolume;
      this.audio.volume = parseInt(previousVolume) / 100;
      this.volumeValue.textContent = `${previousVolume}%`;
    }
    this.updateVolumeIcon();
  }

  /**
   * Show the volume dropdown
   */
  private showVolumeDropdown(): void {
    this.volumeDropdown.classList.add('show');
  }

  /**
   * Hide the volume dropdown
   */
  private hideVolumeDropdown(): void {
    this.volumeDropdown.classList.remove('show');
  }

  /**
   * Toggle the volume dropdown visibility
   */
  private toggleVolumeDropdown(): void {
    this.volumeDropdown.classList.toggle('show');
  }

  /**
   * Show the speed dropdown
   */
  private showSpeedDropdown(): void {
    this.speedDropdown.classList.add('show');
  }

  /**
   * Hide the speed dropdown
   */
  private hideSpeedDropdown(): void {
    this.speedDropdown.classList.remove('show');
  }

  /**
   * Toggle the speed dropdown visibility
   */
  private toggleSpeedDropdown(): void {
    this.speedDropdown.classList.toggle('show');
  }

  /**
   * Get the current volume (0-1)
   */
  public getVolume(): number {
    return this.audio.volume;
  }

  /**
   * Set the volume (0-1)
   */
  public setVolume(volume: number): void {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Set playback speed programmatically (0.5x - 1.5x)
   */
  public setPlaybackRate(rate: number): void {
    const clamped = Math.min(1.5, Math.max(0.5, rate));
    this.audio.playbackRate = clamped;
    const percent = Math.round(clamped * 100);
    this.speedSlider.value = percent.toString();
    this.speedValue.textContent = `${clamped.toFixed(2)}x`;
    this.updateSpeedIcon(clamped);
    localStorage.setItem('civwin-music-speed', this.speedSlider.value);
  }

  /**
   * Update speed icon text to reflect current rate
   */
  private updateSpeedIcon(rate: number): void {
    this.speedIcon.textContent = `${rate.toFixed(2)}x`;
    this.speedIcon.title = `Playback speed: ${rate.toFixed(2)}x`;
  }

  /**
   * Check if currently playing
   */
  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Auto-start playing the first track (respects previous session state)
   */
  public autoStart(): void {
    setTimeout(() => {
      if (this.shouldAutoResume()) {
        this.play();
      }
    }, 1000); // Delay to ensure everything is loaded
  }
}
