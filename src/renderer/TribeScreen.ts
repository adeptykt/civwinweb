/**
 * TribeScreen – "Pick your tribe" screen.
 *
 * Displays all 14 coded civilizations in a 2-column grid plus a "Custom"
 * option. The left side shows stacked portrait frames for the selected civ
 * (updating live as the user clicks). Selecting "Custom" clears the portrait.
 */

import type { CivilizationType } from '../game/CivilizationDefinitions.js';
import { getCivilization } from '../game/CivilizationDefinitions.js';
import { t } from '../i18n/I18nService.js';
import { initializeSprites, getPortraitStyle, applySpriteStyle } from './LeaderSprites.js';

export type TribeChoice = 'custom' | string; // string = CivilizationType key

interface CivEntry {
  key: CivilizationType;
  col: number;
  row: number;
}

const CIV_GRID: CivEntry[] = [
  { key: 'babylonian', col: 1, row: 2 },
  { key: 'romans', col: 1, row: 3 },
  { key: 'egyptian', col: 1, row: 0 },
  { key: 'german', col: 2, row: 4 },
  { key: 'greeks', col: 0, row: 4 },
  { key: 'american', col: 1, row: 1 },
  { key: 'russian', col: 2, row: 2 },
  { key: 'indian', col: 2, row: 0 },
  { key: 'french', col: 2, row: 3 },
  { key: 'zulu', col: 0, row: 1 },
  { key: 'chinese', col: 0, row: 2 },
  { key: 'aztecs', col: 0, row: 3 },
  { key: 'mongol', col: 2, row: 1 },
  { key: 'english', col: 0, row: 0 },
];

const PORTRAIT_SCALE = 1.5;
const FACE_CLIP_PX = Math.round(64 * PORTRAIT_SCALE);
const PORTRAIT_VISIBLE_H = Math.round((204 - 64) * PORTRAIT_SCALE);

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

  show(): void {
    this.applyLabels();
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

  isVisible(): boolean {
    return this.overlay.style.display === 'flex';
  }

  refreshI18n(): void {
    if (this.isVisible()) {
      this.applyLabels();
    }
  }

  setOnConfirm(cb: (choice: TribeChoice) => void): void {
    this.onConfirm = cb;
  }
  setOnBack(cb: () => void): void {
    this.onBack = cb;
  }

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'tribe-screen';
    overlay.style.display = 'none';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const pairs: string[] = [];
    pairs.push(this.itemHTML('custom', true));
    pairs.push(this.itemHTML(CIV_GRID[0].key, false));
    for (let i = 1; i < CIV_GRID.length; i += 2) {
      pairs.push(this.itemHTML(CIV_GRID[i].key, false));
      if (i + 1 < CIV_GRID.length) {
        pairs.push(this.itemHTML(CIV_GRID[i + 1].key, false));
      }
    }

    overlay.innerHTML = `
      <div class="ts-inner">
        <div class="ts-portrait-area">
          <div class="ts-stack-wrapper">
            <div class="ts-shadow-frame ts-shadow-4"></div>
            <div class="ts-shadow-frame ts-shadow-3"></div>
            <div class="ts-shadow-frame ts-shadow-2"></div>
            <div class="ts-shadow-frame ts-shadow-1"></div>
            <div class="ts-portrait-frame">
              <div id="ts-leader-name" class="ts-leader-name"></div>
              <div id="ts-portrait-div" class="ts-portrait-img"></div>
            </div>
          </div>
        </div>
        <div class="ts-panel">
          <p class="ts-panel-title"></p>
          <div class="ts-grid" role="listbox" aria-label="">
            ${pairs.join('')}
          </div>
          <div class="ts-btn-row">
            <button class="ts-btn" id="ts-back-btn" type="button"></button>
            <button class="ts-btn ts-btn-ok" id="ts-ok-btn" type="button"></button>
          </div>
        </div>
      </div>
    `;

    this.applyLabelsTo(overlay);
    return overlay;
  }

  private itemHTML(key: string, selected: boolean): string {
    return `
      <div class="ts-item${selected ? ' ts-selected' : ''}"
           data-key="${key}"
           role="option"
           aria-selected="${selected}">
        <span class="ts-diamond" aria-hidden="true">${selected ? '◆' : '◇'}</span>
        <span class="ts-item-label"></span>
      </div>`;
  }

  private applyLabels(): void {
    this.applyLabelsTo(this.overlay);
  }

  private applyLabelsTo(root: HTMLElement): void {
    root.setAttribute('aria-label', t('tribeScreen.ariaDialog'));
    const title = root.querySelector('.ts-panel-title');
    if (title) title.textContent = t('tribeScreen.title');
    const grid = root.querySelector('.ts-grid');
    if (grid) grid.setAttribute('aria-label', t('tribeScreen.ariaGrid'));

    root.querySelectorAll<HTMLElement>('.ts-item').forEach(item => {
      const key = item.dataset.key;
      const labelEl = item.querySelector('.ts-item-label');
      if (!labelEl || !key) return;
      if (key === 'custom') {
        labelEl.textContent = t('tribeScreen.custom');
      } else {
        labelEl.textContent = getCivilization(key as CivilizationType).adjective;
      }
    });

    const back = root.querySelector('#ts-back-btn') as HTMLButtonElement | null;
    if (back) back.textContent = t('tribeScreen.goBack');
    const ok = root.querySelector('#ts-ok-btn') as HTMLButtonElement | null;
    if (ok) ok.textContent = t('dialogs.ok');
  }

  private drawPortraitFor(key: TribeChoice): void {
    const div = this.portraitDiv;
    if (!div) return;

    const w = Math.round(144 * PORTRAIT_SCALE);

    if (key === 'custom') {
      div.style.backgroundImage = 'none';
      div.style.width = `${w}px`;
      div.style.height = `${PORTRAIT_VISIBLE_H}px`;
      if (this.leaderNameEl) this.leaderNameEl.textContent = '';
      return;
    }

    const entry = CIV_GRID.find(c => c.key === key);
    if (!entry) return;

    const style = getPortraitStyle(entry.key, PORTRAIT_SCALE);
    const posMatch = style.backgroundPosition.match(/(-?[\d.]+)px\s+(-?[\d.]+)px/);
    if (posMatch) {
      const xOff = parseFloat(posMatch[1]);
      const yOff = parseFloat(posMatch[2]) - FACE_CLIP_PX;
      style.backgroundPosition = `${xOff}px ${yOff}px`;
    }
    style.height = `${PORTRAIT_VISIBLE_H}px`;
    applySpriteStyle(div, style);
    if (this.leaderNameEl) {
      const leader = getCivilization(entry.key)?.leader ?? '';
      this.leaderNameEl.textContent = leader;
    }
  }

  private setupEventListeners(): void {
    this.overlay.querySelectorAll('.ts-item').forEach(el => {
      el.addEventListener('click', () => this.selectItem(el as HTMLElement));
      el.addEventListener('dblclick', () => {
        this.selectItem(el as HTMLElement);
        this.confirm();
      });
    });
    this.overlay.querySelector('#ts-back-btn')?.addEventListener('click', () => this.goBack());
    this.overlay.querySelector('#ts-ok-btn')?.addEventListener('click', () => this.confirm());
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (this.overlay.style.display === 'none') return;
    const items = Array.from(this.overlay.querySelectorAll<HTMLElement>('.ts-item'));
    const idx = items.findIndex(el => el.classList.contains('ts-selected'));

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
