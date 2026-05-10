import { GameState } from '../types/game';
import { getWonderStats } from '../game/WonderDefinitions';
import { getCivilization } from '../game/CivilizationDefinitions';

interface BuiltWonderEntry {
  wonderId: string;
  wonderName: string;
  spritePath: string;
  cityName: string;
  civPeoples: string;
  playerColor: string;
}

export class WondersOfTheWorldDialog {
  private overlay: HTMLElement | null = null;

  /** Build a flat list of all wonders built in the current game. */
  private collectWonders(gameState: GameState): BuiltWonderEntry[] {
    const entries: BuiltWonderEntry[] = [];

    for (const city of gameState.cities) {
      const player = gameState.players.find(p => p.id === city.playerId);
      const peoples = player ? getCivilization(player.civilizationType).peoples : 'Unknown';
      const playerColor = player ? player.color : '#00cccc';

      for (const building of city.buildings) {
        const raw = building.type as string;
        if (!raw.startsWith('wonder_')) continue;
        const wonderId = raw.replace('wonder_', '');
        const def = getWonderStats(wonderId);
        if (!def) continue;

        entries.push({
          wonderId,
          wonderName: def.name,
          spritePath: def.spritePath || '',
          cityName: city.name,
          civPeoples: peoples,
          playerColor,
        });
      }
    }

    return entries;
  }

  public show(gameState: GameState): void {
    this.remove();

    const wonders = this.collectWonders(gameState);

    // ── Overlay ────────────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.className = 'wotw-overlay';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) this.remove();
    });
    document.addEventListener('keydown', this.onKeydown);

    // ── Dialog box ─────────────────────────────────────────────────────────
    const dialog = document.createElement('div');
    dialog.className = 'wotw-dialog';

    // Title
    const title = document.createElement('div');
    title.className = 'wotw-title';
    title.textContent = 'The Wonders of the World';
    dialog.appendChild(title);

    // Content area
    const content = document.createElement('div');
    content.className = 'wotw-content';

    if (wonders.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'wotw-empty';
      empty.textContent = 'No wonders have been built yet.';
      content.appendChild(empty);
    } else {
      for (const entry of wonders) {
        const row = document.createElement('div');
        row.className = 'wotw-row';
        row.style.borderColor = entry.playerColor;

        // Sprite
        const img = document.createElement('img');
        img.className = 'wotw-sprite';
        img.alt = entry.wonderName;
        img.src = entry.spritePath;
        img.onerror = () => { img.style.display = 'none'; };
        row.appendChild(img);

        // Label
        const label = document.createElement('span');
        label.className = 'wotw-label';
        label.textContent = `${entry.wonderName} of ${entry.cityName}. (${entry.civPeoples})`;
        row.appendChild(label);

        content.appendChild(row);
      }
    }

    dialog.appendChild(content);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'wotw-close-btn';
    closeBtn.textContent = 'OK';
    closeBtn.addEventListener('click', () => this.remove());
    dialog.appendChild(closeBtn);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  private onKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.remove();
    }
  };

  public remove(): void {
    document.removeEventListener('keydown', this.onKeydown);
    this.overlay?.remove();
    this.overlay = null;
  }

  public isOpen(): boolean {
    return this.overlay !== null;
  }
}
