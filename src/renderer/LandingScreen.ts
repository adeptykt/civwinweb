/**
 * LandingScreen – Civ 1-style title / "New Game" splash shown at startup
 * and whenever the user chooses File → New Game.
 *
 * The screen renders entirely programmatically (no HTML template required)
 * and fires a typed callback when the player confirms their choice.
 */

import { t } from '../i18n/I18nService.js';

export type LandingAction =
  | 'new-game'
  | 'load-game'
  | 'play-earth'
  | 'customize-world'
  | 'hall-of-fame'
  | 'settings'
  | 'quit'
  | 'dev-skip';

const MENU_ITEMS: { action: LandingAction; labelKey: string; dev?: boolean }[] = [
  { action: 'new-game', labelKey: 'landing.startNewGame' },
  { action: 'load-game', labelKey: 'landing.loadSavedGame' },
  { action: 'play-earth', labelKey: 'landing.playEarth' },
  { action: 'customize-world', labelKey: 'landing.customizeWorld' },
  { action: 'hall-of-fame', labelKey: 'landing.hallOfFame' },
  { action: 'settings', labelKey: 'landing.settings' },
  { action: 'quit', labelKey: 'landing.quit' },
  { action: 'dev-skip', labelKey: 'landing.devSkip', dev: true },
];

export class LandingScreen {
  private overlay: HTMLElement;
  private selectedAction: LandingAction = 'new-game';
  private onAction: ((action: LandingAction) => void) | null = null;
  private keydownHandler: (e: KeyboardEvent) => void;

  constructor() {
    this.overlay = this.buildOverlay();
    document.body.appendChild(this.overlay);

    this.keydownHandler = this.handleKeydown.bind(this);
    this.setupEventListeners();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  show(): void {
    this.applyMenuLabels();
    this.overlay.style.display = 'flex';
    document.addEventListener('keydown', this.keydownHandler);
  }

  hide(): void {
    this.overlay.style.display = 'none';
    document.removeEventListener('keydown', this.keydownHandler);
  }

  /** True while the title screen is visible (not only display:none in DOM). */
  isVisible(): boolean {
    return this.overlay.style.display === 'flex';
  }

  /** Refresh menu strings after locale change. */
  refreshI18n(): void {
    if (this.isVisible()) {
      this.applyMenuLabels();
    }
  }

  /** Register the callback that receives the confirmed action. */
  setOnAction(callback: (action: LandingAction) => void): void {
    this.onAction = callback;
  }

  // ── DOM construction ──────────────────────────────────────────────────────

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'landing-screen';
    overlay.style.display = 'none';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="ls-inner">

        <!-- ── Title area ── -->
        <div class="ls-title-area">
          <div class="ls-subtitle-row">
            <span class="ls-subtitle-line"></span>
            <span class="ls-subtitle-text">Evonsdesigns</span>
            <span class="ls-subtitle-line"></span>
          </div>
          <h1 class="ls-civ-title">CIVILIZATION</h1>
        </div>

        <!-- ── Dialog box ── -->
        <div class="ls-dialog" role="listbox" aria-label="">
          <ul class="ls-menu-list">
            ${MENU_ITEMS.map((item, i) => `
              <li class="ls-menu-item${i === 0 ? ' ls-selected' : ''}${item.dev ? ' ls-menu-item--dev' : ''}"
                  data-action="${item.action}"
                  role="option"
                  aria-selected="${i === 0}">
                <span class="ls-diamond" aria-hidden="true">${i === 0 ? '◆' : '◇'}</span>
                <span class="ls-item-label"></span>
              </li>
            `).join('')}
          </ul>
          <div class="ls-ok-row">
            <button class="ls-ok-btn" id="ls-ok-btn" type="button"></button>
          </div>
        </div>

      </div>
    `;

    this.applyMenuLabelsTo(overlay);
    return overlay;
  }

  private applyMenuLabels(): void {
    this.applyMenuLabelsTo(this.overlay);
  }

  private applyMenuLabelsTo(root: HTMLElement): void {
    root.setAttribute('aria-label', t('landing.titleAria'));
    const dialog = root.querySelector('.ls-dialog') as HTMLElement | null;
    if (dialog) {
      dialog.setAttribute('aria-label', t('landing.optionsAria'));
    }
    for (const item of MENU_ITEMS) {
      const row = root.querySelector(`[data-action="${item.action}"]`);
      const label = row?.querySelector('.ls-item-label');
      if (label) {
        label.textContent = t(item.labelKey);
      }
    }
    const okBtn = root.querySelector('#ls-ok-btn') as HTMLButtonElement | null;
    if (okBtn) {
      okBtn.textContent = t('dialogs.ok');
    }
  }

  // ── Event handling ────────────────────────────────────────────────────────

  private setupEventListeners(): void {
    // Click on a menu item → select it
    this.overlay.querySelectorAll('.ls-menu-item').forEach(el => {
      el.addEventListener('click', () => {
        this.selectItem(el as HTMLElement);
      });
      // Double-click → select + confirm
      el.addEventListener('dblclick', () => {
        this.selectItem(el as HTMLElement);
        this.confirm();
      });
    });

    // OK button
    const okBtn = this.overlay.querySelector<HTMLButtonElement>('#ls-ok-btn');
    okBtn?.addEventListener('click', () => this.confirm());
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (this.overlay.style.display === 'none') return;

    const items = Array.from(
      this.overlay.querySelectorAll<HTMLElement>('.ls-menu-item')
    );
    const currentIndex = items.findIndex(el => el.classList.contains('ls-selected'));

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectItem(items[(currentIndex + 1) % items.length]);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectItem(items[(currentIndex - 1 + items.length) % items.length]);
        break;
      case 'Enter':
        e.preventDefault();
        this.confirm();
        break;
      case 'Escape':
      case '/':
        // Close the dialog and return to a game already in progress (no action fired)
        this.hide();
        break;
    }
  }

  private selectItem(item: HTMLElement): void {
    // Deselect all
    this.overlay.querySelectorAll<HTMLElement>('.ls-menu-item').forEach(el => {
      el.classList.remove('ls-selected');
      el.setAttribute('aria-selected', 'false');
      const diamond = el.querySelector<HTMLElement>('.ls-diamond');
      if (diamond) diamond.textContent = '◇';
    });

    // Select the target
    item.classList.add('ls-selected');
    item.setAttribute('aria-selected', 'true');
    const diamond = item.querySelector<HTMLElement>('.ls-diamond');
    if (diamond) diamond.textContent = '◆';

    this.selectedAction = item.getAttribute('data-action') as LandingAction;
  }

  private confirm(): void {
    if (!this.onAction) return;
    // Settings opens as an overlay; keep the title screen underneath.
    if (this.selectedAction === 'settings') {
      this.onAction('settings');
      return;
    }
    this.hide();
    this.onAction(this.selectedAction);
  }
}
