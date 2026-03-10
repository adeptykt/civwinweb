import type { Game } from '../game/Game.js';
import type { Player } from '../types/game.js';
import { DiplomaticStatus } from '../game/DiplomacyManager.js';
import { getCivilization } from '../game/CivilizationDefinitions.js';
import { DebugSystem } from '../utils/DebugSystem.js';
import { GameTime } from '../utils/GameTime.js';

/**
 * Intelligence Advisor Modal
 *
 * Displays an intelligence report showing all civilizations the human player
 * has made contact with (DiplomaticStatus !== UNCONTACTED) along with their
 * current diplomatic status and an optional "Contact" button that opens the
 * full diplomacy dialog.
 *
 * The "Contact" button is shown when the human has an embassy with that civ,
 * OR when the dev setting "alwaysShowContactButton" is enabled.
 */
export class IntelligenceAdvisorModal {
  private modal: HTMLElement | null = null;
  private game: Game | null = null;
  /** Callback invoked when the player clicks "Contact" for a civ. */
  private onContact: ((targetPlayerId: string) => void) | null = null;

  constructor() {
    this.bindElements();
  }

  private bindElements(): void {
    this.modal = document.getElementById('intelligence-advisor-modal');
    if (!this.modal) return;

    document.getElementById('intel-close')?.addEventListener('click', () => this.hide());

    // Close when clicking outside dialog
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.hide();
    });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.isVisible()) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
      }
    });
  }

  /**
   * Show the intelligence report.
   *
   * @param game          The current Game instance.
   * @param onContact     Callback fired when the player presses "Contact" for a civ.
   */
  public show(game: Game, onContact: (targetPlayerId: string) => void): void {
    if (!this.modal) return;

    this.game = game;
    this.onContact = onContact;

    this.render();

    this.modal.style.display = 'flex';
  }

  public hide(): void {
    if (!this.modal) return;
    this.modal.style.display = 'none';
    this.game = null;
    this.onContact = null;
  }

  public isVisible(): boolean {
    return this.modal?.style.display === 'flex';
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private render(): void {
    if (!this.game) return;

    const gameState = this.game.getGameState();
    const humanPlayer = gameState.players.find((p: Player) => p.isHuman && !p.defeated);
    if (!humanPlayer) return;

    const civ = getCivilization(humanPlayer.civilizationType);
    const year = GameTime.calculateYear(gameState.turn);
    const yearStr = year > 0 ? `${year} BC` : `${Math.abs(year)} AD`;

    // Title subtitle
    const civNameEl = document.getElementById('intel-civ-name');
    const leaderYearEl = document.getElementById('intel-leader-year');
    if (civNameEl) civNameEl.textContent = civ ? `Empire of the ${civ.peoples}` : '';
    if (leaderYearEl) leaderYearEl.textContent = civ ? `${civ.leader}: ${yearStr}` : yearStr;

    // Footer
    const footerLeft = document.getElementById('intel-footer-left');
    const footerRight = document.getElementById('intel-footer-right');
    if (footerLeft) footerLeft.textContent = civ ? `${civ.peoples}: ${civ.leader}` : '';
    if (footerRight && civ) {
      const gov = (humanPlayer.government as string) || 'Despotism';
      const govDisplay = gov.charAt(0).toUpperCase() + gov.slice(1).replace(/_/g, ' ');
      footerRight.textContent = `${govDisplay}, ${yearStr}`;
    }

    // Build civ rows
    const body = document.getElementById('intel-body');
    if (!body) return;
    body.innerHTML = '';

    const diplomacyMgr = this.game.diplomacyManager;
    const alwaysShowContact = DebugSystem.getInstance().alwaysShowContactButton();

    // Other (non-human, non-defeated) players
    const otherPlayers = gameState.players.filter(
      (p: Player) => p.id !== humanPlayer.id && !p.defeated && !(p as any).isBarbarian
    );

    if (otherPlayers.length === 0) {
      const row = document.createElement('div');
      row.className = 'intel-civ-row';
      row.innerHTML = '<span class="intel-status-unknown">No other civilizations exist.</span>';
      body.appendChild(row);
      return;
    }

    for (const player of otherPlayers) {
      const rel = diplomacyMgr.getRelationship(humanPlayer.id, player.id);
      const contacted = rel.status !== DiplomaticStatus.UNCONTACTED;
      const otherCiv = getCivilization(player.civilizationType);

      const row = document.createElement('div');
      row.className = 'intel-civ-row';

      // Left: civ name + status text
      const infoDiv = document.createElement('div');
      infoDiv.className = 'intel-civ-info';

      if (!contacted && !alwaysShowContact) {
        // Never met and no dev override — show "No embassy established"
        infoDiv.innerHTML = `<span class="intel-status-uncontacted">No embassy established.</span>`;
      } else if (!contacted && alwaysShowContact) {
        // Dev override: show civ name even though never formally contacted
        const civName = otherCiv ? `${otherCiv.peoples}: ${otherCiv.leader}` : player.name;
        infoDiv.innerHTML =
          `<span class="intel-civ-label">${civName}</span> ` +
          `<span class="intel-status-uncontacted">(Uncontacted)</span>`;
      } else {
        const civName = otherCiv ? `${otherCiv.peoples}: ${otherCiv.leader}` : player.name;
        const { labelClass, labelText } = this.statusLabel(rel.status);
        infoDiv.innerHTML =
          `<span class="intel-civ-label">${civName}</span> ` +
          `<span class="${labelClass}">${labelText}</span>`;
      }

      row.appendChild(infoDiv);

      // Right: Contact button (visible when embassy established, OR dev override is active)
      const hasEmbassy = diplomacyMgr.hasEmbassy(humanPlayer.id, player.id);
      if (hasEmbassy || alwaysShowContact) {
        const btn = document.createElement('button');
        btn.className = 'intel-contact-btn';
        btn.textContent = 'Contact';
        btn.title = hasEmbassy
          ? 'Open diplomacy dialog'
          : '[Dev] Embassy override active — contact anyway';
        btn.addEventListener('click', () => {
          const cb = this.onContact;
          this.hide();
          cb?.(player.id);
        });
        row.appendChild(btn);
      }

      body.appendChild(row);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private statusLabel(status: DiplomaticStatus): { labelClass: string; labelText: string } {
    switch (status) {
      case DiplomaticStatus.PEACE:
        return { labelClass: 'intel-status-peace',   labelText: '(Peace)' };
      case DiplomaticStatus.WAR:
        return { labelClass: 'intel-status-war',     labelText: '(At War)' };
      case DiplomaticStatus.NEUTRAL:
        return { labelClass: 'intel-status-neutral', labelText: '(Neutral)' };
      default:
        return { labelClass: 'intel-status-unknown', labelText: '(Unknown)' };
    }
  }
}
