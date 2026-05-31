import type { Game } from '../game/Game';
import { TaxSystem } from '../game/TaxSystem';

/**
 * BudgetModal – Civilization 1 style tax rate slider dialog.
 *
 * The player adjusts Tax (gold) and Luxury (happiness) rates in 10% steps.
 * Science rate is automatically set to 100% − Tax − Luxury.
 * The modal shows a live preview of estimated gold/science/luxury income.
 */
export class BudgetModal {
  private modal: HTMLElement;
  private game: Game;

  constructor(game: Game) {
    this.game = game;
    this.modal = document.getElementById('budget-modal')!;
    if (!this.modal) {
      console.warn('BudgetModal: #budget-modal element not found in DOM');
      return;
    }
    this.setupEventListeners();
  }

  public open(): void {
    if (!this.modal) return;
    this.syncSlidersFromPlayer();
    this.updateDisplay();
    this.modal.style.display = 'flex';
  }

  public close(): void {
    if (!this.modal) return;
    this.modal.style.display = 'none';
  }

  public isOpen(): boolean {
    return this.modal?.style.display === 'flex';
  }

  // ── Setup ────────────────────────────────────────────────────────────────

  private setupEventListeners(): void {
    const taxSlider = document.getElementById('budget-tax-slider') as HTMLInputElement | null;
    const luxSlider = document.getElementById('budget-luxury-slider') as HTMLInputElement | null;
    const okBtn = document.getElementById('budget-ok');
    const closeBtn = document.getElementById('budget-close');

    taxSlider?.addEventListener('input', () => this.onSliderChange('tax'));
    luxSlider?.addEventListener('input', () => this.onSliderChange('luxury'));

    okBtn?.addEventListener('click', () => this.close());
    closeBtn?.addEventListener('click', () => this.close());

    // Close on backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) this.close();
    });
  }

  // ── Slider interaction ────────────────────────────────────────────────────

  /**
   * Enforce the invariant: taxRate + luxuryRate ≤ 100.
   * Whenever one slider moves, clamp the other if needed, then apply to game.
   */
  private onSliderChange(changed: 'tax' | 'luxury'): void {
    const taxSlider = document.getElementById('budget-tax-slider') as HTMLInputElement;
    const luxSlider = document.getElementById('budget-luxury-slider') as HTMLInputElement;
    if (!taxSlider || !luxSlider) return;

    let tax = parseInt(taxSlider.value, 10);
    let lux = parseInt(luxSlider.value, 10);

    // Snap to nearest 10
    tax = Math.round(tax / 10) * 10;
    lux = Math.round(lux / 10) * 10;

    // Enforce sum ≤ 100
    if (changed === 'tax') {
      lux = Math.min(lux, 100 - tax);
    } else {
      tax = Math.min(tax, 100 - lux);
    }

    taxSlider.value = tax.toString();
    luxSlider.value = lux.toString();

    // Persist to game state
    const gs = this.game.getGameState();
    const player = gs.players.find(p => p.isHuman && p.id === gs.currentPlayer);
    if (player) {
      this.game.setTaxRates(player.id, tax, lux);
    }

    this.updateDisplay();
  }

  // ── Read rates from player and push to sliders ───────────────────────────

  private syncSlidersFromPlayer(): void {
    const gs = this.game.getGameState();
    const player = gs.players.find(p => p.isHuman && p.id === gs.currentPlayer);
    if (!player) return;

    const taxRate = player.taxRate ?? 40;
    const luxuryRate = player.luxuryRate ?? 10;

    const taxSlider = document.getElementById('budget-tax-slider') as HTMLInputElement | null;
    const luxSlider = document.getElementById('budget-luxury-slider') as HTMLInputElement | null;
    if (taxSlider) taxSlider.value = taxRate.toString();
    if (luxSlider) luxSlider.value = luxuryRate.toString();
  }

  // ── Display update ────────────────────────────────────────────────────────

  private updateDisplay(): void {
    const gs = this.game.getGameState();
    const player = gs.players.find(p => p.isHuman && p.id === gs.currentPlayer);
    if (!player) return;

    const taxRate = player.taxRate ?? 40;
    const luxRate = player.luxuryRate ?? 10;
    const sciRate = Math.max(0, 100 - taxRate - luxRate);

    // Rate labels
    this.setText('budget-tax-value', `${taxRate}%`);
    this.setText('budget-luxury-value', `${luxRate}%`);
    this.setText('budget-science-value', `${sciRate}%`);

    // Science bar width
    const sciBar = document.getElementById('budget-science-bar');
    if (sciBar) sciBar.style.width = `${sciRate}%`;

    // Income preview
    const summary = TaxSystem.calculatePlayerTaxSummary(player, gs);

    this.setText('budget-gold-preview', `+${summary.goldIncome} 🪙`);
    this.setText('budget-luxury-preview', `+${summary.luxuryIncome} 💎`);
    this.setText('budget-science-preview', `+${summary.scienceIncome} 💡`);

    const maint = summary.maintenanceCost + summary.unitSupportCost;
    this.setText('budget-maintenance-preview', `−${maint} 🪙`);

    const net = summary.netGoldIncome;
    const netEl = document.getElementById('budget-net-preview');
    if (netEl) {
      netEl.textContent = `${net >= 0 ? '+' : ''}${net} 🪙/turn`;
      netEl.style.color = net >= 0 ? '#4caf50' : '#f44336';
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private setText(id: string, text: string): void {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
}
