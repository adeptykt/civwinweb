/**
 * CompetitionScreen – "Level of Competition" screen.
 *
 * Lets the player choose how many total civilizations (including themselves)
 * will play. We support 2 through 14 (all coded civs).
 *
 * Mirrors the Civ 1 layout: one portrait (player's civ) on the left,
 * parchment selection panel on the right.
 */

export interface CompetitionChoice {
  totalCivs: number; // includes the human player
}

// Total civs coded in the game (excluding commented-out Japanese)
const MIN_CIVS = 2;
const MAX_CIVS = 14;

function buildOptions(): { totalCivs: number; label: string }[] {
  const options: { totalCivs: number; label: string }[] = [];
  for (let n = MAX_CIVS; n >= MIN_CIVS; n--) {
    const ai = n - 1;
    const suffix = n === MAX_CIVS ? ' (all civilizations)' : '';
    options.push({ totalCivs: n, label: `${n} Civilizations${suffix}` });
  }
  return options;
}

const OPTIONS = buildOptions();

const LEADERS_URL = new URL('../assets/leaders.png', import.meta.url).href;
// English leader: col 0, row 0 in the sprite sheet
const PORTRAIT_SRC_X  = 181; // within-block x
const PORTRAIT_SRC_Y  = 1;   // skip 1-px magenta border
const PORTRAIT_SRC_W  = 144;
const PORTRAIT_SRC_H  = 204;

export class CompetitionScreen {
  private overlay: HTMLElement;
  private selectedTotal: number = MAX_CIVS; // default: all civs
  private onConfirm: ((choice: CompetitionChoice) => void) | null = null;
  private onBack: (() => void) | null = null;
  private keydownHandler: (e: KeyboardEvent) => void;

  constructor() {
    this.overlay = this.buildOverlay();
    document.body.appendChild(this.overlay);
    this.keydownHandler = this.handleKeydown.bind(this);
    this.setupEventListeners();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  show(): void {
    this.overlay.style.display = 'flex';
    document.addEventListener('keydown', this.keydownHandler);
    const canvas = this.overlay.querySelector<HTMLCanvasElement>('.cs-portrait-canvas');
    if (canvas) this.drawPortrait(canvas);
  }

  hide(): void {
    this.overlay.style.display = 'none';
    document.removeEventListener('keydown', this.keydownHandler);
  }

  setOnConfirm(cb: (choice: CompetitionChoice) => void): void { this.onConfirm = cb; }
  setOnBack(cb: () => void): void { this.onBack = cb; }

  // ── DOM construction ───────────────────────────────────────────────────────

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'competition-screen';
    overlay.style.display = 'none';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Level of Competition');

    overlay.innerHTML = `
      <div class="cs-inner">

        <!-- ── Left: single portrait ── -->
        <div class="cs-portrait-area">
          <div class="cs-portrait-frame">
            <canvas class="cs-portrait-canvas"></canvas>
          </div>
        </div>

        <!-- ── Right: competition panel ── -->
        <div class="cs-panel">
          <p class="cs-panel-title">Level of Competition..</p>
          <ul class="cs-option-list" role="listbox" aria-label="Number of civilizations">
            ${OPTIONS.map((opt, i) => `
              <li class="cs-option-item${i === 0 ? ' cs-selected' : ''}"
                  data-total="${opt.totalCivs}"
                  role="option"
                  aria-selected="${i === 0}">
                <span class="cs-diamond" aria-hidden="true">${i === 0 ? '◆' : '◇'}</span>
                <span class="cs-option-label">${opt.label}</span>
              </li>
            `).join('')}
          </ul>
          <div class="cs-btn-row">
            <button class="cs-btn" id="cs-back-btn" type="button">Go Back</button>
            <button class="cs-btn cs-btn-ok" id="cs-ok-btn" type="button">OK</button>
          </div>
        </div>

      </div>
    `;

    return overlay;
  }

  // ── Portrait drawing ───────────────────────────────────────────────────────

  private drawPortrait(canvas: HTMLCanvasElement): void {
    const displayW = canvas.clientWidth || 120;
    const displayH = Math.round(displayW * (PORTRAIT_SRC_H / PORTRAIT_SRC_W));
    canvas.width  = displayW;
    canvas.height = displayH;

    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        img,
        PORTRAIT_SRC_X, PORTRAIT_SRC_Y, PORTRAIT_SRC_W, PORTRAIT_SRC_H,
        0, 0, displayW, displayH
      );
    };
    img.src = LEADERS_URL;
  }

  // ── Event handling ─────────────────────────────────────────────────────────

  private setupEventListeners(): void {
    this.overlay.querySelectorAll('.cs-option-item').forEach(el => {
      el.addEventListener('click', () => this.selectItem(el as HTMLElement));
      el.addEventListener('dblclick', () => { this.selectItem(el as HTMLElement); this.confirm(); });
    });
    this.overlay.querySelector('#cs-back-btn')?.addEventListener('click', () => this.goBack());
    this.overlay.querySelector('#cs-ok-btn')?.addEventListener('click',  () => this.confirm());
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (this.overlay.style.display === 'none') return;
    const items = Array.from(this.overlay.querySelectorAll<HTMLElement>('.cs-option-item'));
    const idx   = items.findIndex(el => el.classList.contains('cs-selected'));

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectItem(items[(idx + 1) % items.length]);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectItem(items[(idx - 1 + items.length) % items.length]);
        break;
      case 'Enter':
        e.preventDefault();
        this.confirm();
        break;
      case 'Escape':
        e.preventDefault();
        this.goBack();
        break;
    }
  }

  private selectItem(item: HTMLElement): void {
    this.overlay.querySelectorAll<HTMLElement>('.cs-option-item').forEach(el => {
      el.classList.remove('cs-selected');
      el.setAttribute('aria-selected', 'false');
      const d = el.querySelector<HTMLElement>('.cs-diamond');
      if (d) d.textContent = '◇';
    });
    item.classList.add('cs-selected');
    item.setAttribute('aria-selected', 'true');
    const d = item.querySelector<HTMLElement>('.cs-diamond');
    if (d) d.textContent = '◆';
    this.selectedTotal = parseInt(item.dataset.total ?? String(MAX_CIVS), 10);
  }

  private confirm(): void {
    this.hide();
    this.onConfirm?.({ totalCivs: this.selectedTotal });
  }

  private goBack(): void {
    this.hide();
    this.onBack?.();
  }
}
