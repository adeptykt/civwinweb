/**
 * DifficultyScreen – Civ 1-style difficulty selection screen.
 *
 * Shows 5 leader portraits on the left and a parchment panel on the
 * right with Chieftain → Emperor radio options, "Go Back" and "OK" buttons.
 */

export type DifficultyLevel = 'chieftain' | 'warlord' | 'prince' | 'king' | 'emperor';

export const DIFFICULTY_LEVELS: { level: DifficultyLevel; label: string }[] = [
  { level: 'chieftain', label: 'Chieftain (easiest)' },
  { level: 'warlord',   label: 'Warlord'             },
  { level: 'prince',    label: 'Prince'               },
  { level: 'king',      label: 'King'                 },
  { level: 'emperor',   label: 'Emperor (toughest)'   },
];

/** sprite-sheet coordinates for 5 portrait civs (raw leaders.png) */
const PORTRAIT_CIVS: { key: string; col: number; row: number }[] = [
  { key: 'english', col: 0, row: 0 },
  { key: 'zulu',    col: 0, row: 1 },
  { key: 'chinese', col: 0, row: 2 },
  { key: 'aztecs',  col: 0, row: 3 },
  { key: 'greek',   col: 0, row: 4 },
];

const COL_X = [0, 325, 650] as const;
const ROW_Y = [0, 205, 410, 615, 820] as const;
const SRC_PORTRAIT_X = 181; // within-block x offset where the portrait starts
const SRC_PORTRAIT_W = 144;
const SRC_PORTRAIT_H = 204;

const LEADERS_URL = new URL('../assets/leaders.png', import.meta.url).href;

export class DifficultyScreen {
  private overlay: HTMLElement;
  private selectedLevel: DifficultyLevel = 'chieftain';
  private onConfirm: ((level: DifficultyLevel) => void) | null = null;
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
    // Draw portraits now that the canvas elements exist in the DOM
    this.overlay.querySelectorAll<HTMLCanvasElement>('.ds-portrait-canvas').forEach(canvas => {
      this.drawPortrait(canvas);
    });
  }

  hide(): void {
    this.overlay.style.display = 'none';
    document.removeEventListener('keydown', this.keydownHandler);
  }

  setOnConfirm(cb: (level: DifficultyLevel) => void): void { this.onConfirm = cb; }
  setOnBack(cb: () => void): void { this.onBack = cb; }

  // ── DOM construction ───────────────────────────────────────────────────────

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'difficulty-screen';
    overlay.style.display = 'none';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Difficulty Level');

    overlay.innerHTML = `
      <div class="ds-inner">

        <!-- ── Left: 5 leader portraits ── -->
        <div class="ds-portraits">
          <div class="ds-portrait-col ds-col-left">
            ${[0, 1, 2].map(i => `
              <div class="ds-portrait-frame">
                <canvas class="ds-portrait-canvas"
                        data-civ="${PORTRAIT_CIVS[i].key}"
                        data-col="${PORTRAIT_CIVS[i].col}"
                        data-row="${PORTRAIT_CIVS[i].row}"></canvas>
              </div>
            `).join('')}
          </div>
          <div class="ds-portrait-col ds-col-right">
            ${[3, 4].map(i => `
              <div class="ds-portrait-frame">
                <canvas class="ds-portrait-canvas"
                        data-civ="${PORTRAIT_CIVS[i].key}"
                        data-col="${PORTRAIT_CIVS[i].col}"
                        data-row="${PORTRAIT_CIVS[i].row}"></canvas>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- ── Right: difficulty panel ── -->
        <div class="ds-panel">
          <p class="ds-panel-title">Difficulty Level...</p>
          <ul class="ds-level-list" role="listbox" aria-label="Difficulty levels">
            ${DIFFICULTY_LEVELS.map((d, i) => `
              <li class="ds-level-item${i === 0 ? ' ds-selected' : ''}"
                  data-level="${d.level}"
                  role="option"
                  aria-selected="${i === 0}">
                <span class="ds-diamond" aria-hidden="true">${i === 0 ? '◆' : '◇'}</span>
                <span class="ds-level-label">${d.label}</span>
              </li>
            `).join('')}
          </ul>
          <div class="ds-btn-row">
            <button class="ds-btn" id="ds-back-btn" type="button">Go Back</button>
            <button class="ds-btn ds-btn-ok" id="ds-ok-btn" type="button">OK</button>
          </div>
        </div>

      </div>
    `;

    return overlay;
  }

  // ── Portrait drawing ───────────────────────────────────────────────────────

  private drawPortrait(canvas: HTMLCanvasElement): void {
    const col = parseInt(canvas.dataset.col ?? '0', 10) as 0 | 1 | 2;
    const row = parseInt(canvas.dataset.row ?? '0', 10) as 0 | 1 | 2 | 3 | 4;

    // Display size is driven by CSS; read the rendered size after layout
    const displayW = canvas.clientWidth || 120;
    const displayH = Math.round(displayW * (SRC_PORTRAIT_H / SRC_PORTRAIT_W));
    canvas.width  = displayW;
    canvas.height = displayH;

    const srcX = COL_X[col] + SRC_PORTRAIT_X;
    const srcY = ROW_Y[row] + 1; // +1 skips 1-px magenta top border

    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, srcX, srcY, SRC_PORTRAIT_W, SRC_PORTRAIT_H,
                         0, 0, displayW, displayH);
    };
    img.src = LEADERS_URL;
  }

  // ── Event handling ─────────────────────────────────────────────────────────

  private setupEventListeners(): void {
    this.overlay.querySelectorAll('.ds-level-item').forEach(el => {
      el.addEventListener('click', () => this.selectLevel(el as HTMLElement));
      el.addEventListener('dblclick', () => { this.selectLevel(el as HTMLElement); this.confirm(); });
    });

    this.overlay.querySelector('#ds-back-btn')?.addEventListener('click', () => this.goBack());
    this.overlay.querySelector('#ds-ok-btn')?.addEventListener('click', () => this.confirm());
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (this.overlay.style.display === 'none') return;
    const items = Array.from(this.overlay.querySelectorAll<HTMLElement>('.ds-level-item'));
    const idx   = items.findIndex(el => el.classList.contains('ds-selected'));

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectLevel(items[(idx + 1) % items.length]);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectLevel(items[(idx - 1 + items.length) % items.length]);
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

  private selectLevel(item: HTMLElement): void {
    this.overlay.querySelectorAll<HTMLElement>('.ds-level-item').forEach(el => {
      el.classList.remove('ds-selected');
      el.setAttribute('aria-selected', 'false');
      const d = el.querySelector<HTMLElement>('.ds-diamond');
      if (d) d.textContent = '◇';
    });
    item.classList.add('ds-selected');
    item.setAttribute('aria-selected', 'true');
    const d = item.querySelector<HTMLElement>('.ds-diamond');
    if (d) d.textContent = '◆';
    this.selectedLevel = item.dataset.level as DifficultyLevel;
  }

  private confirm(): void {
    this.hide();
    this.onConfirm?.(this.selectedLevel);
  }

  private goBack(): void {
    this.hide();
    this.onBack?.();
  }
}
