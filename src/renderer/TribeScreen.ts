/**
 * TribeScreen – "Pick your tribe" screen.
 *
 * Displays all 14 coded civilizations in a 2-column grid plus a "Custom"
 * option. The left side shows stacked portrait frames for the selected civ
 * (updating live as the user clicks). Selecting "Custom" clears the portrait.
 */

import type { CivilizationType } from '../game/CivilizationDefinitions.js';
import { getCivilization } from '../game/CivilizationDefinitions.js';
import { initializeSprites, getPortraitStyle, applySpriteStyle } from './LeaderSprites.js';

export type TribeChoice = 'custom' | string; // string = CivilizationType key

interface CivEntry {
  key: string;    // CivilizationType value
  label: string;  // Display adjective (e.g. "Roman")
  col: number;    // Sprite-sheet column (0-2)
  row: number;    // Sprite-sheet row    (0-4)
}

// All 14 coded civs with their display labels and sprite positions
const CIVS: CivEntry[] = [
  { key: 'babylonian', label: 'Babylonian', col: 1, row: 2 },
  { key: 'romans',     label: 'Roman',      col: 1, row: 3 },
  { key: 'egyptian',   label: 'Egyptian',   col: 1, row: 0 },
  { key: 'german',     label: 'German',     col: 2, row: 4 },
  { key: 'greeks',     label: 'Greek',      col: 0, row: 4 },
  { key: 'american',   label: 'American',   col: 1, row: 1 },
  { key: 'russian',    label: 'Russian',    col: 2, row: 2 },
  { key: 'indian',     label: 'Indian',     col: 2, row: 0 },
  { key: 'french',     label: 'French',     col: 2, row: 3 },
  { key: 'zulu',       label: 'Zulu',       col: 0, row: 1 },
  { key: 'chinese',    label: 'Chinese',    col: 0, row: 2 },
  { key: 'aztecs',     label: 'Aztec',      col: 0, row: 3 },
  { key: 'mongol',     label: 'Mongol',     col: 2, row: 1 },
  { key: 'english',    label: 'English',    col: 0, row: 0 },
];

const PORTRAIT_SCALE = 1.5; // 144 × 204 at 1.5× = 216 × 306 px
// Face cell thumbnails occupy the top 64px of the portrait block-region.
// Clip them by shifting the portrait div up by this amount.
const FACE_CLIP_PX = Math.round(64 * PORTRAIT_SCALE); // 96px at 1.5×
const PORTRAIT_VISIBLE_H = Math.round((204 - 64) * PORTRAIT_SCALE); // 210px

export class TribeScreen {
  private overlay: HTMLElement;
  private selectedKey: TribeChoice = 'custom';
  private onConfirm: ((choice: TribeChoice) => void) | null = null;
  private onBack: (() => void) | null = null;
  private keydownHandler: (e: KeyboardEvent) => void;
  private portraitDiv: HTMLElement | null = null;
  private leaderNameEl: HTMLElement | null = null;

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
    this.portraitDiv = this.overlay.querySelector<HTMLElement>('#ts-portrait-div');
    this.leaderNameEl = this.overlay.querySelector<HTMLElement>('#ts-leader-name');
    initializeSprites().then(() => this.drawPortraitFor(this.selectedKey));
  }

  hide(): void {
    this.overlay.style.display = 'none';
    document.removeEventListener('keydown', this.keydownHandler);
  }

  setOnConfirm(cb: (choice: TribeChoice) => void): void { this.onConfirm = cb; }
  setOnBack(cb: () => void): void { this.onBack = cb; }

  // ── DOM construction ───────────────────────────────────────────────────────

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'tribe-screen';
    overlay.style.display = 'none';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Pick your tribe');

    // Build 2-column grid: Custom first, then civs paired left/right
    const pairs: string[] = [];
    // Row 0: Custom | first civ
    pairs.push(this.itemHTML('custom', 'Custom', true));
    pairs.push(this.itemHTML(CIVS[0].key, CIVS[0].label, false));
    // Remaining civs: left col odd-indexed, right col even-indexed
    for (let i = 1; i < CIVS.length; i += 2) {
      pairs.push(this.itemHTML(CIVS[i].key, CIVS[i].label, false));
      if (i + 1 < CIVS.length) {
        pairs.push(this.itemHTML(CIVS[i + 1].key, CIVS[i + 1].label, false));
      }
    }

    overlay.innerHTML = `
      <div class="ts-inner">

        <!-- ── Left: stacked portrait frames ── -->
        <div class="ts-portrait-area">
          <div class="ts-stack-wrapper">
            <!-- shadow frames (decorative) -->
            <div class="ts-shadow-frame ts-shadow-4"></div>
            <div class="ts-shadow-frame ts-shadow-3"></div>
            <div class="ts-shadow-frame ts-shadow-2"></div>
            <div class="ts-shadow-frame ts-shadow-1"></div>
            <!-- active portrait frame -->
            <div class="ts-portrait-frame">
              <div id="ts-leader-name" class="ts-leader-name"></div>
              <div id="ts-portrait-div" class="ts-portrait-img"></div>
            </div>
          </div>
        </div>

        <!-- ── Right: tribe panel ── -->
        <div class="ts-panel">
          <p class="ts-panel-title">Pick your tribe...</p>
          <div class="ts-grid" role="listbox" aria-label="Civilizations">
            ${pairs.join('')}
          </div>
          <div class="ts-btn-row">
            <button class="ts-btn" id="ts-back-btn" type="button">Go Back</button>
            <button class="ts-btn ts-btn-ok" id="ts-ok-btn" type="button">OK</button>
          </div>
        </div>

      </div>
    `;

    return overlay;
  }

  private itemHTML(key: string, label: string, selected: boolean): string {
    return `
      <div class="ts-item${selected ? ' ts-selected' : ''}"
           data-key="${key}"
           role="option"
           aria-selected="${selected}">
        <span class="ts-diamond" aria-hidden="true">${selected ? '◆' : '◇'}</span>
        <span class="ts-item-label">${label}</span>
      </div>`;
  }

  // ── Portrait drawing ───────────────────────────────────────────────────────

  private drawPortraitFor(key: TribeChoice): void {
    const div = this.portraitDiv;
    if (!div) return;

    const w = Math.round(144 * PORTRAIT_SCALE);

    if (key === 'custom') {
      div.style.backgroundImage = 'none';
      div.style.width  = `${w}px`;
      div.style.height = `${PORTRAIT_VISIBLE_H}px`;
      if (this.leaderNameEl) this.leaderNameEl.textContent = '';
      return;
    }

    const entry = CIVS.find(c => c.key === key);
    if (!entry) return;

    // getPortraitStyle positions at the top of the portrait block region, which
    // includes face-cell thumbnails in the first 64 source px. Shift the
    // background-position y by an extra FACE_CLIP_PX so we start below them.
    const style = getPortraitStyle(entry.key as CivilizationType, PORTRAIT_SCALE);
    const posMatch = style.backgroundPosition.match(/(-?[\d.]+)px\s+(-?[\d.]+)px/);
    if (posMatch) {
      const xOff = parseFloat(posMatch[1]);
      const yOff = parseFloat(posMatch[2]) - FACE_CLIP_PX;
      style.backgroundPosition = `${xOff}px ${yOff}px`;
    }
    style.height = `${PORTRAIT_VISIBLE_H}px`;
    applySpriteStyle(div, style);
    if (this.leaderNameEl) {
      const leader = getCivilization(entry.key as CivilizationType)?.leader ?? '';
      this.leaderNameEl.textContent = leader;
    }
  }

  // ── Event handling ─────────────────────────────────────────────────────────

  private setupEventListeners(): void {
    this.overlay.querySelectorAll('.ts-item').forEach(el => {
      el.addEventListener('click', () => this.selectItem(el as HTMLElement));
      el.addEventListener('dblclick', () => { this.selectItem(el as HTMLElement); this.confirm(); });
    });
    this.overlay.querySelector('#ts-back-btn')?.addEventListener('click', () => this.goBack());
    this.overlay.querySelector('#ts-ok-btn')?.addEventListener('click', () => this.confirm());
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (this.overlay.style.display === 'none') return;
    const items = Array.from(this.overlay.querySelectorAll<HTMLElement>('.ts-item'));
    const idx   = items.findIndex(el => el.classList.contains('ts-selected'));

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        this.selectItem(items[(idx + 1) % items.length]);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
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
    this.overlay.querySelectorAll<HTMLElement>('.ts-item').forEach(el => {
      el.classList.remove('ts-selected');
      el.setAttribute('aria-selected', 'false');
      const d = el.querySelector<HTMLElement>('.ts-diamond');
      if (d) d.textContent = '◇';
    });
    item.classList.add('ts-selected');
    item.setAttribute('aria-selected', 'true');
    const d = item.querySelector<HTMLElement>('.ts-diamond');
    if (d) d.textContent = '◆';
    this.selectedKey = item.dataset.key as TribeChoice;
    this.drawPortraitFor(this.selectedKey);
  }

  private confirm(): void {
    this.hide();
    this.onConfirm?.(this.selectedKey);
  }

  private goBack(): void {
    this.hide();
    this.onBack?.();
  }
}
