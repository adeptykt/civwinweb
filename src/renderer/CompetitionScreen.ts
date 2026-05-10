/**
 * CompetitionScreen – "Level of Competition" screen.
 *
 * Lets the player choose how many total civilizations (including themselves)
 * will play. We support 2 through 14 (all coded civs).
 *
 * Mirrors the Civ 1 layout: one portrait (player's civ) on the left,
 * parchment selection panel on the right.
 */

import { t } from '../i18n/I18nService.js';

export interface CompetitionChoice {
  totalCivs: number; // includes the human player
}

const MIN_CIVS = 2;
const MAX_CIVS = 14;

const LEADERS_URL = new URL('../assets/leaders.png', import.meta.url).href;
const PORTRAIT_SRC_X = 181;
const PORTRAIT_SRC_Y = 1;
const PORTRAIT_SRC_W = 144;
const PORTRAIT_SRC_H = 204;

export class CompetitionScreen {
  private overlay: HTMLElement;
  private selectedTotal: number = MAX_CIVS;
  private onConfirm: ((choice: CompetitionChoice) => void) | null = null;
  private onBack: (() => void) | null = null;
  private keydownHandler: (e: KeyboardEvent) => void;

  constructor() {
    this.overlay = this.buildOverlay();
    document.body.appendChild(this.overlay);
    this.keydownHandler = this.handleKeydown.bind(this);
    this.setupEventListeners();
  }

  show(): void {
    this.applyLabels();
    this.overlay.style.display = 'flex';
    document.addEventListener('keydown', this.keydownHandler);
    const canvas = this.overlay.querySelector<HTMLCanvasElement>('.cs-portrait-canvas');
    if (canvas) this.drawPortrait(canvas);
  }

  hide(): void {
    this.overlay.style.display = 'none';
    document.removeEventListener('keydown', this.keydownHandler);
  }

  isVisible(): boolean {
    return this.overlay.style.display === 'flex';
  }

  refreshI18n(): void {
    if (this.isVisible()) {
      this.applyLabels();
    }
  }

  setOnConfirm(cb: (choice: CompetitionChoice) => void): void {
    this.onConfirm = cb;
  }
  setOnBack(cb: () => void): void {
    this.onBack = cb;
  }

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'competition-screen';
    overlay.style.display = 'none';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const rows: string[] = [];
    for (let n = MAX_CIVS; n >= MIN_CIVS; n--) {
      const i = MAX_CIVS - n;
      rows.push(`
        <li class="cs-option-item${i === 0 ? ' cs-selected' : ''}"
            data-total="${n}"
            role="option"
            aria-selected="${i === 0}">
          <span class="cs-diamond" aria-hidden="true">${i === 0 ? '◆' : '◇'}</span>
          <span class="cs-option-label"></span>
        </li>`);
    }

    overlay.innerHTML = `
      <div class="cs-inner">
        <div class="cs-portrait-area">
          <div class="cs-portrait-frame">
            <canvas class="cs-portrait-canvas"></canvas>
          </div>
        </div>
        <div class="cs-panel">
          <p class="cs-panel-title"></p>
          <ul class="cs-option-list" role="listbox" aria-label="">
            ${rows.join('')}
          </ul>
          <div class="cs-btn-row">
            <button class="cs-btn" id="cs-back-btn" type="button"></button>
            <button class="cs-btn cs-btn-ok" id="cs-ok-btn" type="button"></button>
          </div>
        </div>
      </div>
    `;

    this.applyLabelsTo(overlay);
    return overlay;
  }

  private applyLabels(): void {
    this.applyLabelsTo(this.overlay);
  }

  private applyLabelsTo(root: HTMLElement): void {
    root.setAttribute('aria-label', t('competitionScreen.ariaDialog'));
    const title = root.querySelector('.cs-panel-title');
    if (title) title.textContent = t('competitionScreen.title');
    const list = root.querySelector('.cs-option-list');
    if (list) list.setAttribute('aria-label', t('competitionScreen.ariaList'));

    root.querySelectorAll<HTMLElement>('.cs-option-item').forEach(item => {
      const n = parseInt(item.dataset.total ?? String(MAX_CIVS), 10);
      const label = item.querySelector('.cs-option-label');
      if (!label) return;
      label.textContent =
        n === MAX_CIVS
          ? t('competitionScreen.optionMax', { n })
          : t('competitionScreen.option', { n });
    });

    const back = root.querySelector('#cs-back-btn') as HTMLButtonElement | null;
    if (back) back.textContent = t('competitionScreen.goBack');
    const ok = root.querySelector('#cs-ok-btn') as HTMLButtonElement | null;
    if (ok) ok.textContent = t('dialogs.ok');
  }

  private drawPortrait(canvas: HTMLCanvasElement): void {
    const displayW = canvas.clientWidth || 120;
    const displayH = Math.round(displayW * (PORTRAIT_SRC_H / PORTRAIT_SRC_W));
    canvas.width = displayW;
    canvas.height = displayH;

    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        img,
        PORTRAIT_SRC_X,
        PORTRAIT_SRC_Y,
        PORTRAIT_SRC_W,
        PORTRAIT_SRC_H,
        0,
        0,
        displayW,
        displayH,
      );
    };
    img.src = LEADERS_URL;
  }

  private setupEventListeners(): void {
    this.overlay.querySelectorAll('.cs-option-item').forEach(el => {
      el.addEventListener('click', () => this.selectItem(el as HTMLElement));
      el.addEventListener('dblclick', () => {
        this.selectItem(el as HTMLElement);
        this.confirm();
      });
    });
    this.overlay.querySelector('#cs-back-btn')?.addEventListener('click', () => this.goBack());
    this.overlay.querySelector('#cs-ok-btn')?.addEventListener('click', () => this.confirm());
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (this.overlay.style.display === 'none') return;
    const items = Array.from(this.overlay.querySelectorAll<HTMLElement>('.cs-option-item'));
    const idx = items.findIndex(el => el.classList.contains('cs-selected'));

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
