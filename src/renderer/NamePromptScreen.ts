/**
 * NamePromptScreen – Single text-input prompt screen used in the new game flow.
 *
 * Used twice:
 *   1. "What is your tribe called?" (Custom only)
 *   2. "What shall your people call you?" (pre-filled with historical leader name)
 */

export interface NamePromptConfig {
  title: string;
  prompt: string;
  defaultValue?: string;
  placeholder?: string;
}

export class NamePromptScreen {
  private overlay: HTMLElement;
  private inputEl: HTMLInputElement | null = null;
  private onConfirm: ((value: string) => void) | null = null;
  private onBack: (() => void) | null = null;
  private keydownHandler: (e: KeyboardEvent) => void;

  constructor() {
    this.overlay = this.buildOverlay();
    document.body.appendChild(this.overlay);
    this.keydownHandler = this.handleKeydown.bind(this);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  show(config: NamePromptConfig): void {
    const titleEl = this.overlay.querySelector<HTMLElement>('.np-title');
    const promptEl = this.overlay.querySelector<HTMLElement>('.np-prompt');
    this.inputEl = this.overlay.querySelector<HTMLInputElement>('#np-input');

    if (titleEl)  titleEl.textContent  = config.title;
    if (promptEl) promptEl.textContent = config.prompt;
    if (this.inputEl) {
      this.inputEl.value       = config.defaultValue  ?? '';
      this.inputEl.placeholder = config.placeholder   ?? '';
    }

    this.overlay.style.display = 'flex';
    document.addEventListener('keydown', this.keydownHandler);

    // Focus and select existing text so user can immediately type
    requestAnimationFrame(() => {
      this.inputEl?.focus();
      this.inputEl?.select();
    });
  }

  hide(): void {
    this.overlay.style.display = 'none';
    document.removeEventListener('keydown', this.keydownHandler);
  }

  setOnConfirm(cb: (value: string) => void): void { this.onConfirm = cb; }
  setOnBack(cb: () => void): void { this.onBack = cb; }

  // ── DOM construction ───────────────────────────────────────────────────────

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
            <button class="np-btn" id="np-back-btn"  type="button">Go Back</button>
            <button class="np-btn np-btn-ok" id="np-ok-btn" type="button">OK</button>
          </div>
        </div>
      </div>
    `;

    overlay.querySelector('#np-back-btn')?.addEventListener('click', () => this.goBack());
    overlay.querySelector('#np-ok-btn')?.addEventListener('click',   () => this.confirm());

    return overlay;
  }

  // ── Event handling ─────────────────────────────────────────────────────────

  private handleKeydown(e: KeyboardEvent): void {
    if (this.overlay.style.display === 'none') return;
    if (e.key === 'Enter')  { e.preventDefault(); this.confirm(); }
    if (e.key === 'Escape') { e.preventDefault(); this.goBack();  }
  }

  private confirm(): void {
    const value = (this.inputEl?.value ?? '').trim();
    if (!value) { this.inputEl?.focus(); return; }
    this.hide();
    this.onConfirm?.(value);
  }

  private goBack(): void {
    this.hide();
    this.onBack?.();
  }
}
