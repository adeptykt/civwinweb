import { GovernmentType, GOVERNMENTS } from '../types/game.js';
import type { GovernmentEffects, GovernmentRestrictions, Player } from '../types/game.js';
import type { Game } from '../game/Game.js';

/**
 * Modal that lets the human player choose a new form of government
 * after their anarchy period ends (or when triggered manually via "Revolution").
 */
export class GovernmentModal {
  private modal: HTMLElement | null = null;
  private selectedGovernment: GovernmentType | null = null;
  private game: Game | null = null;
  private player: Player | null = null;
  private mandatory = false;
  private onGovernmentSelected: ((gov: GovernmentType) => void) | null = null;

  constructor() {
    this.initializeModal();
  }

  private initializeModal(): void {
    this.modal = document.getElementById('government-modal');
    if (!this.modal) {
      console.error('GovernmentModal: #government-modal element not found');
      return;
    }

    document.getElementById('gov-close')?.addEventListener('click', () => this.hide());
    document.getElementById('gov-cancel')?.addEventListener('click', () => this.hide());
    document.getElementById('gov-select')?.addEventListener('click', () => this.confirmSelection());

    // Close on backdrop click (only if not mandatory)
    this.modal.addEventListener('click', (e) => {
      if (!this.mandatory && e.target === this.modal) this.hide();
    });

    // Keyboard: Enter confirms, Escape cancels (unless mandatory)
    document.addEventListener('keydown', (e) => {
      if (this.modal?.style.display !== 'flex') return;
      if (e.key === 'Enter') { e.preventDefault(); this.confirmSelection(); }
      if (e.key === 'Escape' && !this.mandatory) { e.preventDefault(); this.hide(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); this.navigateList(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.navigateList(-1); }
    });
  }

  /**
   * Show the government selection modal.
   * @param mandatory – When true, hides Cancel and blocks ESC/backdrop dismiss.
   *                    Used when anarchy period ends and player MUST choose.
   */
  public show(
    game: Game,
    player: Player,
    mandatory = false,
    onSelected?: (gov: GovernmentType) => void,
  ): void {
    if (!this.modal) {
      console.error('GovernmentModal: cannot show – modal element missing');
      return;
    }

    this.game = game;
    this.player = player;
    this.mandatory = mandatory;
    this.onGovernmentSelected = onSelected ?? null;
    this.selectedGovernment = null;

    // Update prompt text
    const promptEl = document.getElementById('gov-prompt-text');
    if (promptEl) {
      promptEl.textContent = mandatory
        ? 'The period of Anarchy is over. Choose a new form of government:'
        : 'You may overthrow your current government. Choose a new form:';
    }

    // Show/hide Cancel button
    const cancelBtn = document.getElementById('gov-cancel') as HTMLButtonElement | null;
    if (cancelBtn) cancelBtn.style.display = mandatory ? 'none' : '';

    this.loadGovernments();
    this.clearDetails();

    this.modal.style.display = 'flex';
    this.modal.classList.add('active');
  }

  public hide(): void {
    if (!this.modal) return;
    this.modal.style.display = 'none';
    this.modal.classList.remove('active');
    this.selectedGovernment = null;
    this.game = null;
    this.player = null;
    this.mandatory = false;
    this.onGovernmentSelected = null;
  }

  public isVisible(): boolean {
    return this.modal?.style.display === 'flex';
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private loadGovernments(): void {
    const listEl = document.getElementById('gov-list');
    if (!listEl || !this.game || !this.player) return;

    const available = this.game.getAvailableGovernments(this.player.id);
    // Exclude anarchy and the current government (no point switching to same)
    const choices = available.filter(
      (g) => g !== GovernmentType.ANARCHY && g !== this.player!.government,
    );

    listEl.innerHTML = '';
    choices.forEach((govType) => {
      const gov = GOVERNMENTS[govType];
      const item = document.createElement('div');
      item.className = 'gov-item';
      item.dataset.govType = govType;
      item.innerHTML = `
        <div class="gov-name">${gov.name}</div>
        <div class="gov-brief">${this.buildBrief(gov.effects)}</div>
      `;
      item.addEventListener('click', () => this.selectGovernment(govType));
      item.addEventListener('dblclick', () => {
        this.selectGovernment(govType);
        this.confirmSelection();
      });
      listEl.appendChild(item);
    });
  }

  private buildBrief(effects: GovernmentEffects): string {
    const parts: string[] = [];
    if (effects.tradeBonus) parts.push('+Trade');
    if (!effects.productionPenalty) parts.push('No prod. penalty');
    if (effects.corruptionType === 'none') parts.push('No corruption');
    if (effects.corruptionType === 'flat') parts.push('Flat corruption');
    if (effects.unhappinessFromMilitary > 0)
      parts.push(`−${effects.unhappinessFromMilitary} happiness/unit`);
    return parts.join(' · ') || 'Standard government';
  }

  private selectGovernment(govType: GovernmentType): void {
    const listEl = document.getElementById('gov-list');
    listEl?.querySelectorAll('.gov-item').forEach((el) => el.classList.remove('selected'));
    listEl?.querySelector(`[data-gov-type="${govType}"]`)?.classList.add('selected');

    this.selectedGovernment = govType;
    this.updateDetails(govType);

    const selectBtn = document.getElementById('gov-select') as HTMLButtonElement | null;
    if (selectBtn) selectBtn.disabled = false;
  }

  private navigateList(direction: 1 | -1): void {
    const listEl = document.getElementById('gov-list');
    if (!listEl) return;
    const items = Array.from(listEl.querySelectorAll<HTMLElement>('.gov-item'));
    if (!items.length) return;
    const cur = items.findIndex((el) => el.classList.contains('selected'));
    const next = cur === -1
      ? (direction > 0 ? 0 : items.length - 1)
      : (cur + direction + items.length) % items.length;
    const govType = items[next]?.dataset.govType as GovernmentType | undefined;
    if (govType) {
      this.selectGovernment(govType);
      items[next].scrollIntoView({ block: 'nearest' });
    }
  }

  private updateDetails(govType: GovernmentType): void {
    const gov = GOVERNMENTS[govType];
    const nameEl = document.getElementById('gov-detail-name');
    const descEl = document.getElementById('gov-detail-desc');
    const effectsEl = document.getElementById('gov-detail-effects');

    if (nameEl) nameEl.textContent = gov.name;
    if (descEl) descEl.textContent = gov.description;
    if (effectsEl) effectsEl.innerHTML = this.buildEffectsHTML(gov.effects, gov.restrictions);
  }

  private buildEffectsHTML(effects: GovernmentEffects, restrictions: GovernmentRestrictions): string {
    const li = (text: string) => `<li>${text}</li>`;
    const lines: string[] = [];

    // Production
    lines.push(effects.productionPenalty
      ? li('⚠️ Production tiles ≥ 3 reduced by 1')
      : li('✅ No production penalty'));

    // Corruption
    lines.push({
      none: li('✅ No corruption'),
      flat: li('📊 Flat (equal) corruption in all cities'),
      distance: li('📍 Corruption increases with distance from capital'),
    }[effects.corruptionType]);

    // Trade
    if (effects.tradeBonus) lines.push(li('✅ +1 trade on tiles that already produce trade'));

    // Military upkeep
    lines.push(effects.militarySupport.costPerUnit > 0
      ? li(`💰 Each excess military unit costs ${effects.militarySupport.costPerUnit} gold/turn`)
      : li('✅ No gold cost for military units'));

    // Settler upkeep
    if (effects.settlerSupport > 0)
      lines.push(li(`💰 Each settler costs ${effects.settlerSupport} gold/turn`));

    // Happiness
    if (effects.unhappinessFromMilitary > 0)
      lines.push(li(`😠 ${effects.unhappinessFromMilitary} unhappy citizen(s) per military unit away from home`));

    // Martial law
    if (effects.martialLawAvailable)
      lines.push(li('⚔️ Martial law available – military units appease unrest'));

    // Research / tax
    if (!effects.taxCollection) lines.push(li('⚠️ No tax collection during anarchy'));
    if (!effects.scientificResearch) lines.push(li('⚠️ No scientific research during anarchy'));

    // Senate
    if (restrictions.senateOverride) lines.push(li('🏛️ Senate can override war and peace decisions'));
    if (restrictions.peaceOffers) lines.push(li('🕊️ Senate automatically accepts all peace offers'));
    if (restrictions.revolutionRisk) lines.push(li('⚠️ Risk of revolt if cities remain in disorder'));

    return `<ul class="gov-effects-list">${lines.join('')}</ul>`;
  }

  private clearDetails(): void {
    const nameEl = document.getElementById('gov-detail-name');
    const descEl = document.getElementById('gov-detail-desc');
    const effectsEl = document.getElementById('gov-detail-effects');
    const selectBtn = document.getElementById('gov-select') as HTMLButtonElement | null;

    if (nameEl) nameEl.textContent = 'Select a government form';
    if (descEl) descEl.textContent = '';
    if (effectsEl) effectsEl.innerHTML = '';
    if (selectBtn) selectBtn.disabled = true;
  }

  private confirmSelection(): void {
    if (!this.selectedGovernment || !this.game || !this.player) return;

    const success = this.game.changeGovernment(this.player.id, this.selectedGovernment);
    if (success) {
      this.onGovernmentSelected?.(this.selectedGovernment);
      this.hide();
    }
  }
}
