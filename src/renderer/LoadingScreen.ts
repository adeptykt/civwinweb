/**
 * LoadingScreen – displayed while game assets (terrain images, sprites, templates)
 * are being loaded before the first render.  Shows a Civ-themed progress bar and
 * live status messages, then fades out when everything is ready.
 */
export class LoadingScreen {
  private overlay: HTMLElement;
  private progressFill: HTMLElement;
  private statusEl: HTMLElement;
  private progressPct: HTMLElement;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'loading-screen';
    this.overlay.setAttribute('role', 'status');
    this.overlay.setAttribute('aria-live', 'polite');
    this.overlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-logo">
          <div class="loading-title">CivWin</div>
          <div class="loading-subtitle">A Civilization Game</div>
        </div>
        <div class="loading-progress-container">
          <div class="loading-progress-track">
            <div class="loading-progress-fill" id="ls-progress-fill"></div>
          </div>
          <span class="loading-progress-pct" id="ls-progress-pct">0%</span>
        </div>
        <div class="loading-status" id="ls-status">Initializing</div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.progressFill = this.overlay.querySelector('#ls-progress-fill')!;
    this.statusEl     = this.overlay.querySelector('#ls-status')!;
    this.progressPct  = this.overlay.querySelector('#ls-progress-pct')!;
  }

  /** Update the progress bar.  `value` is clamped to 0–1. */
  setProgress(value: number): void {
    const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
    this.progressFill.style.width = `${pct}%`;
    this.progressPct.textContent  = `${pct}%`;
  }

  /** Update the status message shown below the progress bar. */
  setStatus(message: string): void {
    this.statusEl.textContent = message;
  }

  /**
   * Fade out and remove the loading screen from the DOM.
   * Returns a Promise that resolves once the element has been removed.
   */
  hide(): Promise<void> {
    return new Promise(resolve => {
      const cleanup = () => {
        this.overlay.remove();
        resolve();
      };

      // CSS transition duration is 0.5 s – use a 700 ms safety fallback.
      const fallback = setTimeout(cleanup, 700);

      this.overlay.addEventListener('transitionend', () => {
        clearTimeout(fallback);
        cleanup();
      }, { once: true });

      this.overlay.classList.add('loading-hidden');
    });
  }
}
