/**
 * NamePromptScreen – Single text-input prompt screen used in the new game flow.
 *
 * Used for custom tribe / leader names and for the leader name on a preset civ.
 */

import type { CivilizationType } from '../game/CivilizationDefinitions.js';
import { getCivilization } from '../game/CivilizationDefinitions.js';
import { t } from '../i18n/I18nService.js';

export type NamePromptModel =
  | { kind: 'customTribe' }
  | { kind: 'customLeader'; tribeName: string }
  | { kind: 'presetCiv'; civKey: CivilizationType; defaultLeader: string };

export class NamePromptScreen {
  private overlay: HTMLElement;
  private inputEl: HTMLInputElement | null = null;
  private onConfirm: ((value: string) => void) | null = null;
  private onBack: (() => void) | null = null;
  private keydownHandler: (e: KeyboardEvent) => void;
  private model: NamePromptModel | null = null;

  constructor() {
    this.overlay = this.buildOverlay();
    document.body.appendChild(this.overlay);
    this.keydownHandler = this.handleKeydown.bind(this);
  }

  show(model: NamePromptModel): void {
    this.model = model;
    this.inputEl = this.overlay.querySelector<HTMLInputElement>('#np-input');
    this.applyContent(true);
    this.overlay.style.display = 'flex';
    document.addEventListener('keydown', this.keydownHandler);

    requestAnimationFrame(() => {
      this.inputEl?.focus();
      this.inputEl?.select();
    });
  }

  hide(): void {
    this.overlay.style.display = 'none';
    document.removeEventListener('keydown', this.keydownHandler);
  }

  isVisible(): boolean {
    return this.overlay.style.display === 'flex';
  }

  refreshI18n(): void {
    if (!this.isVisible() || !this.model) return;
    const preserved = this.inputEl?.value ?? '';
    this.applyContent(false);
    if (this.inputEl) this.inputEl.value = preserved;
  }

  setOnConfirm(cb: (value: string) => void): void {
    this.onConfirm = cb;
  }
  setOnBack(cb: () => void): void {
    this.onBack = cb;
  }

  private applyContent(initial: boolean): void {
    const titleEl = this.overlay.querySelector<HTMLElement>('.np-title');
    const promptEl = this.overlay.querySelector<HTMLElement>('.np-prompt');
    if (!this.model || !titleEl || !promptEl || !this.inputEl) return;

    switch (this.model.kind) {
      case 'customTribe':
        titleEl.textContent = t('newGameFlow.customTribeTitle');
        promptEl.textContent = t('newGameFlow.tribeNamePrompt');
        this.inputEl.placeholder = t('newGameFlow.tribeNamePlaceholder');
        if (initial) this.inputEl.value = '';
        break;
      case 'customLeader':
        titleEl.textContent = this.model.tribeName;
        promptEl.textContent = t('newGameFlow.leaderPrompt');
        this.inputEl.placeholder = t('newGameFlow.leaderPlaceholder');
        if (initial) this.inputEl.value = '';
        break;
      case 'presetCiv': {
        const civ = getCivilization(this.model.civKey);
        titleEl.textContent = civ.name;
        promptEl.textContent = t('newGameFlow.leaderPrompt');
        this.inputEl.placeholder = '';
        if (initial) this.inputEl.value = this.model.defaultLeader;
        break;
      }
    }

    this.overlay.setAttribute('aria-label', t('namePromptScreen.ariaDialog'));
    const back = this.overlay.querySelector('#np-back-btn') as HTMLButtonElement | null;
    if (back) back.textContent = t('namePromptScreen.goBack');
    const ok = this.overlay.querySelector('#np-ok-btn') as HTMLButtonElement | null;
    if (ok) ok.textContent = t('dialogs.ok');
  }

  private buildOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'name-prompt-screen';
    overlay.style.display = 'none';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="np-inner">
        <div class="np-panel">
          <p class="np-title"></p>
          <p class="np-prompt"></p>
          <input id="np-input" class="np-input" type="text" autocomplete="off" spellcheck="false" maxlength="40" />
          <div class="np-btn-row">
            <button class="np-btn" id="np-back-btn"  type="button"></button>
            <button class="np-btn np-btn-ok" id="np-ok-btn" type="button"></button>
          </div>
        </div>
      </div>
    `;

    overlay.querySelector('#np-back-btn')?.addEventListener('click', () => this.goBack());
    overlay.querySelector('#np-ok-btn')?.addEventListener('click', () => this.confirm());

    return overlay;
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (this.overlay.style.display === 'none') return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.confirm();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.goBack();
    }
  }

  private confirm(): void {
    const value = (this.inputEl?.value ?? '').trim();
    if (!value) {
      this.inputEl?.focus();
      return;
    }
    this.hide();
    this.onConfirm?.(value);
  }

  private goBack(): void {
    this.hide();
    this.onBack?.();
  }
}
