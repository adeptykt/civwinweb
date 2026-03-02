import { GameState, Unit, City, Player, GovernmentType, GOVERNMENTS } from '../types/game';
import { getUnitStats, getUnitName } from '../game/UnitDefinitions';
import { getTechnology, getResearchCost } from '../game/TechnologyDefinitions';
import { TechnologyUI } from '../utils/TechnologyUI';
import { getDisplayedPopulation } from '../utils/CityPopulationDisplay';
import { HistoricalFactsModal } from './HistoricalFactsModal';
import { BudgetModal } from './BudgetModal';
import { TaxSystem } from '../game/TaxSystem';
import type { Game } from '../game/Game';

export class Status {
  private window: HTMLElement;
  private isVisible = true;
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private gameState: GameState | null = null;
  private selectedUnit: Unit | null = null;
  private selectedCity: City | null = null;
  private endOfTurnState = false;
  private endOfTurnBlinkInterval: number | null = null;
  private game: Game;
  private historicalFactsModal: HistoricalFactsModal;
  private unitQueueDialog: HTMLElement | null = null;
  private budgetModal: BudgetModal;

  constructor(game: Game) {
    this.game = game;
    // Get the status window
    this.window = document.getElementById('status-window')!;
    
    // Initialize the historical facts modal
    this.historicalFactsModal = new HistoricalFactsModal();

    // Initialize the budget modal
    this.budgetModal = new BudgetModal(game);

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Window dragging
    const header = this.window.querySelector('.status-header') as HTMLElement;

    header.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      const rect = this.window.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;

      document.addEventListener('mousemove', this.onWindowDrag);
      document.addEventListener('mouseup', this.onWindowDragEnd);
      e.preventDefault();
    });

    // Close button
    const closeBtn = document.getElementById('status-close')!;
    closeBtn.addEventListener('click', () => {
      this.hide();
    });

    // Year click handler - show historical facts
    const yearElement = document.getElementById('status-year');
    if (yearElement) {
      yearElement.addEventListener('click', () => {
        if (this.gameState) {
          const year = 4000 - (this.gameState.turn - 1) * 20;
          // Convert BC years to negative format for the facts database
          const factYear = year > 0 ? -year : year;
          this.historicalFactsModal.showForYear(factYear);
        }
      });
      yearElement.style.cursor = 'pointer';
    }

    // Gold display click → open budget modal
    const goldElement = document.getElementById('status-gold');
    if (goldElement) {
      goldElement.addEventListener('click', () => {
        if (this.isCurrentPlayerHuman()) this.budgetModal.open();
      });
      goldElement.style.cursor = 'pointer';
      goldElement.title = 'Click to open Tax Rate settings';
    }

    // Unit queue dialog
    const queueDisplay = this.window.querySelector('.unit-queue-display') as HTMLElement;
    if (queueDisplay) {
      queueDisplay.addEventListener('click', () => this.toggleUnitQueueDialog());
      queueDisplay.title = 'Click to see all units waiting to move';
    }
  }

  private onWindowDrag = (e: MouseEvent) => {
    if (!this.isDragging) return;

    const x = e.clientX - this.dragOffset.x;
    const y = e.clientY - this.dragOffset.y;

    // Keep window within viewport bounds
    const maxX = window.innerWidth - this.window.offsetWidth;
    const maxY = window.innerHeight - this.window.offsetHeight;

    this.window.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    this.window.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
  };

  private onWindowDragEnd = () => {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.onWindowDrag);
    document.removeEventListener('mouseup', this.onWindowDragEnd);
  };

  public updateGameState(gameState: GameState): void {
    this.gameState = gameState;
    this.updateDisplay();
  }

  public setSelectedUnit(unit: Unit | null): void {
    // Only allow unit selection for human players
    if (unit && !this.isCurrentPlayerHuman()) {
      return;
    }

    this.selectedUnit = unit;
    this.selectedCity = null; // Clear city selection when unit is selected
    this.updateDisplay();
  }

  public setSelectedCity(city: City | null): void {
    // Only allow city selection for human players
    if (city && !this.isCurrentPlayerHuman()) {
      return;
    }

    this.selectedCity = city;
    this.selectedUnit = null; // Clear unit selection when city is selected
    this.updateDisplay();
  }

  public setEndOfTurnState(isEndOfTurn: boolean): void {
    this.endOfTurnState = isEndOfTurn;

    if (isEndOfTurn) {
      // Clear unit/city selections
      this.selectedUnit = null;
      this.selectedCity = null;

      // Start blinking effect for "End of Turn"
      this.startEndOfTurnBlinking();
    } else {
      // Stop blinking effect
      this.stopEndOfTurnBlinking();
    }

    this.updateDisplay();
  }

  private startEndOfTurnBlinking(): void {
    this.stopEndOfTurnBlinking();
    this.endOfTurnBlinkInterval = window.setInterval(() => {
      this.toggleEndOfTurnBlink();
    }, 500); // Blink twice per second
  }

  private stopEndOfTurnBlinking(): void {
    if (this.endOfTurnBlinkInterval !== null) {
      clearInterval(this.endOfTurnBlinkInterval);
      this.endOfTurnBlinkInterval = null;
    }
  }

  private toggleEndOfTurnBlink(): void {
    const endOfTurnElement = document.getElementById('end-of-turn-text');
    if (endOfTurnElement) {
      endOfTurnElement.classList.toggle('blink-off');
    }
  }

  private showEndOfTurnMessage(): void {
    // Clear all unit detail fields and show end of turn message
    const civilizationElement = document.getElementById('unit-civilization');
    const unitNameElement = document.getElementById('unit-name');
    const unitMovesElement = document.getElementById('unit-moves');
    const unitHomeElement = document.getElementById('unit-home');
    const unitTerrainElement = document.getElementById('unit-terrain');
    const unitSpecialElement = document.getElementById('unit-special');
    const unitFortificationElement = document.getElementById('unit-fortification');

    // Clear standard fields
    if (civilizationElement) civilizationElement.textContent = '';
    if (unitNameElement) unitNameElement.innerHTML = '<span id="end-of-turn-text" class="end-of-turn-message">End of Turn</span>';
    if (unitMovesElement) unitMovesElement.innerHTML = '<span class="end-of-turn-continue">Press Return to continue.</span>';
    if (unitHomeElement) unitHomeElement.textContent = '';
    if (unitTerrainElement) unitTerrainElement.textContent = '';
    if (unitSpecialElement) unitSpecialElement.textContent = '';
    if (unitFortificationElement) unitFortificationElement.textContent = '';
  }

  private updateDisplay(): void {
    if (!this.gameState || !this.isVisible) return;

    // Only show information for human players
    if (this.isCurrentPlayerHuman()) {
      this.updatePopulationInfo();
      this.updateTechProgress();
      this.updateUnitDetails();
    } else {
      // Clear display for AI players
      this.showAIPlayerMessage();
    }
  }

  private updatePopulationInfo(): void {
    if (!this.gameState) return;

    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer) return;

    // Calculate total population from all cities using displayed population mapping
    const totalPopulation = this.gameState.cities
      .filter(city => city.playerId === currentPlayer.id)
      .reduce((total, city) => total + getDisplayedPopulation(city.population), 0);

    // Update population display
    const populationElement = document.getElementById('status-population');
    if (populationElement) {
      populationElement.textContent = `${totalPopulation.toLocaleString()}♀`;
    }

    // Update year display
    const yearElement = document.getElementById('status-year');
    if (yearElement) {
      const year = 4000 - (this.gameState.turn - 1) * 20; // Each turn is 20 years
      const yearText = year > 0 ? `${year} BC` : `${Math.abs(year)} AD`;
      yearElement.textContent = yearText;
    }

    // Update gold display – show treasury + per-turn net income
    const goldElement = document.getElementById('status-gold');
    if (goldElement && currentPlayer) {
      const summary = TaxSystem.calculatePlayerTaxSummary(currentPlayer, this.gameState!);
      const net = summary.netGoldIncome;
      const netStr = net >= 0 ? `+${net}` : `${net}`;
      goldElement.textContent = `${currentPlayer.gold}💰 (${netStr}/turn)`;
      goldElement.style.color = net < 0 ? '#ff8888' : '';
    }

    // Update government display
    const govElement = document.getElementById('status-government');
    if (govElement && currentPlayer) {
      const govType = currentPlayer.government as GovernmentType;
      if (govType === GovernmentType.ANARCHY) {
        const turnsLeft = (currentPlayer as any).revolutionTurns ?? 0;
        govElement.textContent = `☠️ Anarchy (${turnsLeft}t)`;
        govElement.style.color = '#ff8888';
        govElement.title = `In anarchy – ${turnsLeft} turn${turnsLeft === 1 ? '' : 's'} remaining`;
      } else {
        const govName = GOVERNMENTS[govType]?.name ?? govType;
        govElement.textContent = `🏛️ ${govName}`;
        govElement.style.color = '';
        govElement.title = `Current government: ${govName}`;
      }
    }
  }

  private updateTechProgress(): void {
    const lightbulb = document.getElementById('tech-lightbulb');
    const techName = document.getElementById('tech-name');

    if (!lightbulb || !techName) return;

    // Get current player from game state
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer) {
      // No current player - hide tech progress
      techName.textContent = 'No research';
      lightbulb.className = 'lightbulb';
      return;
    }

    if (!currentPlayer.currentResearch) {
      // No current research selected
      techName.textContent = ' ';
      lightbulb.className = 'lightbulb turns-5-plus'; // Dim lightbulb
      return;
    }

    // Get technology information
    const techInfo = getTechnology(currentPlayer.currentResearch);
    const researchCost = getResearchCost(currentPlayer.currentResearch);
    const currentProgress = currentPlayer.currentResearchProgress || 0;

    // Calculate science points needed
    const scienceNeeded = Math.max(0, researchCost - currentProgress);

    // Update display
    techName.textContent = techInfo.name;

    if (scienceNeeded === 0) {
      // Can complete research immediately
      lightbulb.className = 'lightbulb bright turns-1';
      lightbulb.title = 'Click to complete research of ' + techInfo.name;
    } else {
      lightbulb.title = 'Current research: ' + techInfo.name + '. Click for options.';

      // Set lightbulb brightness based on progress toward completion
      const progress = currentProgress / researchCost;
      lightbulb.className = 'lightbulb';

      if (progress >= 0.8) {
        lightbulb.classList.add('turns-1'); // Very close
      } else if (progress >= 0.6) {
        lightbulb.classList.add('turns-2'); // Close
      } else if (progress >= 0.4) {
        lightbulb.classList.add('turns-3'); // Moderate progress
      } else if (progress >= 0.2) {
        lightbulb.classList.add('turns-4'); // Some progress
      } else {
        lightbulb.classList.add('turns-5-plus'); // Just started
      }
    }
  }

  private updateUnitDetails(): void {
    const civilizationElement = document.getElementById('unit-civilization');
    const unitNameElement = document.getElementById('unit-name');
    const unitMovesElement = document.getElementById('unit-moves');
    const unitHomeElement = document.getElementById('unit-home');
    const unitTerrainElement = document.getElementById('unit-terrain');
    const unitSpecialElement = document.getElementById('unit-special');
    const unitFortificationElement = document.getElementById('unit-fortification');

    // Check if in end of turn state
    if (this.endOfTurnState) {
      this.showEndOfTurnMessage();
      return;
    }

    if (this.selectedCity) {
      // Viewing a city - clear unit details
      this.clearUnitDetails();
      return;
    }

    if (this.selectedUnit && this.gameState) {
      const currentPlayer = this.getCurrentPlayer();

      if (civilizationElement && currentPlayer) {
        civilizationElement.textContent = currentPlayer.name || 'Unknown';
      }

      if (unitNameElement) {
        unitNameElement.textContent = getUnitName(this.selectedUnit.type);
      }

      if (unitMovesElement) {
        unitMovesElement.textContent = `Moves: ${this.selectedUnit.movementPoints}`;
      }

      if (unitHomeElement) {
        // Find the home city by looking for cities in the same player that might support this unit
        // For now, we'll show the closest city or "None"
        const playerCities = this.gameState.cities.filter(city => city.playerId === this.selectedUnit?.playerId);
        if (playerCities.length > 0) {
          // Show the first city for now - TODO: implement proper home city tracking
          unitHomeElement.textContent = playerCities[0].name;
        } else {
          unitHomeElement.textContent = 'None';
        }
      }

      if (unitTerrainElement) {
        const tile = this.gameState.worldMap[this.selectedUnit.position.y]?.[this.selectedUnit.position.x];
        if (tile) {
          unitTerrainElement.textContent = `(${this.formatTerrainName(tile.terrain)})`;
        }
      }

      if (unitSpecialElement) {
        // TODO: Implement road system
        unitSpecialElement.textContent = '(Road)';
      }

      if (unitFortificationElement) {
        if (this.selectedUnit.fortified) {
          unitFortificationElement.textContent = '(Fortified)';
        } else if (this.selectedUnit.fortifying) {
          unitFortificationElement.textContent = '(Fortifying)';
        } else {
          unitFortificationElement.textContent = '(Irrigation)'; // Placeholder
        }
      }

      const unitQueueElement = document.getElementById('unit-queue-counter');
      if (unitQueueElement) {
        const total = this.game.getUnitQueueSize();
        const index = this.game.getUnitQueueIndex();
        unitQueueElement.textContent = total > 0 ? `Unit ${index} of ${total}` : '';
      }
    } else {
      // No unit selected - clear details
      this.clearUnitDetails();
    }
  }

  private clearUnitDetails(): void {
    this.closeUnitQueueDialog();
    const elements = [
      'unit-civilization',
      'unit-name',
      'unit-moves',
      'unit-home',
      'unit-terrain',
      'unit-special',
      'unit-fortification',
      'unit-queue-counter'
    ];

    elements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = '';
      }
    });
  }

  private toggleUnitQueueDialog(): void {
    if (this.unitQueueDialog) {
      this.closeUnitQueueDialog();
    } else {
      this.showUnitQueueDialog();
    }
  }

  private showUnitQueueDialog(): void {
    if (!this.gameState) return;

    const units = this.game.getUnitQueue();
    if (units.length === 0) return;

    const currentQueueIndex = this.game.getUnitQueueIndex() - 1; // convert to 0-based

    const dialog = document.createElement('div');
    dialog.className = 'unit-queue-dialog';

    // Header
    const header = document.createElement('div');
    header.className = 'unit-queue-dialog-header';
    header.innerHTML = `
      <span class="unit-queue-dialog-title">Units to Move (${units.length})</span>
      <button class="unit-queue-dialog-close" aria-label="Close">×</button>
    `;
    dialog.appendChild(header);

    // List
    const list = document.createElement('div');
    list.className = 'unit-queue-dialog-list';

    units.forEach((unit, index) => {
      const row = document.createElement('div');
      row.className = 'unit-queue-item' + (index === currentQueueIndex ? ' unit-queue-item-current' : '');

      const unitName = getUnitName(unit.type);

      // Home city: first city belonging to this unit's player
      const playerCities = this.gameState!.cities.filter(c => c.playerId === unit.playerId);
      const homeCity = playerCities.length > 0 ? playerCities[0].name : '—';

      // Nearest city of any player within 12 tiles
      const nearbyCity = this.findNearestCity(unit);
      const nearbyCityName = nearbyCity ? nearbyCity.name : '—';

      const movesLabel = unit.movementPoints === 1 ? '1 move' : `${unit.movementPoints} moves`;

      row.innerHTML = `
        <div class="unit-queue-item-header">
          <span class="unit-queue-item-name">${index === currentQueueIndex ? '▶ ' : ''}${unitName}</span>
          <span class="unit-queue-item-moves">${movesLabel}</span>
        </div>
        <div class="unit-queue-item-cities">
          <span class="unit-queue-item-city-label">Home:</span>
          <span class="unit-queue-item-city-value">${homeCity}</span>
          <span class="unit-queue-item-city-label">Near:</span>
          <span class="unit-queue-item-city-value">${nearbyCityName}</span>
        </div>
      `;

      if (index !== currentQueueIndex) {
        row.style.cursor = 'pointer';
        row.title = 'Click to activate this unit';
        row.addEventListener('click', () => {
          this.game.promoteUnitToFront(unit.id);
          this.closeUnitQueueDialog();
        });
      }

      list.appendChild(row);
    });

    dialog.appendChild(list);

    // Position to the right of the status window, aligned with the queue bar
    const queueDisplayEl = this.window.querySelector('.unit-queue-display') as HTMLElement;
    const anchorRect = (queueDisplayEl ?? this.window).getBoundingClientRect();
    const windowRect = this.window.getBoundingClientRect();
    const dialogWidth = 240;
    const estimatedHeight = Math.min(units.length * 60 + 36, 320);
    const left = windowRect.right + 8;
    const top = anchorRect.top - Math.max(0, (anchorRect.top + estimatedHeight) - window.innerHeight + 4);

    dialog.style.position = 'fixed';
    dialog.style.left = Math.max(0, Math.min(left, window.innerWidth - dialogWidth - 4)) + 'px';
    dialog.style.top = Math.max(0, top) + 'px';

    document.body.appendChild(dialog);
    this.unitQueueDialog = dialog;

    // Close button
    const closeBtn = dialog.querySelector('.unit-queue-dialog-close') as HTMLButtonElement;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeUnitQueueDialog();
    });

    // Close on outside click (deferred so the triggering click doesn't immediately close it)
    setTimeout(() => {
      document.addEventListener('click', this.onQueueDialogOutsideClick);
    }, 0);

    // Close on Escape
    document.addEventListener('keydown', this.onQueueDialogKeydown);
  }

  private onQueueDialogOutsideClick = (e: MouseEvent) => {
    if (!this.unitQueueDialog) return;
    const target = e.target as Node;
    // Don't close if clicking the queue display bar (toggleUnitQueueDialog handles that)
    const queueDisplay = this.window.querySelector('.unit-queue-display');
    if (queueDisplay && queueDisplay.contains(target)) return;
    if (!this.unitQueueDialog.contains(target)) {
      this.closeUnitQueueDialog();
    }
  };

  private onQueueDialogKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.closeUnitQueueDialog();
  };

  private closeUnitQueueDialog(): void {
    if (this.unitQueueDialog) {
      this.unitQueueDialog.remove();
      this.unitQueueDialog = null;
    }
    document.removeEventListener('click', this.onQueueDialogOutsideClick);
    document.removeEventListener('keydown', this.onQueueDialogKeydown);
  }

  private findNearestCity(unit: Unit): City | null {
    if (!this.gameState) return null;
    let nearest: City | null = null;
    let minDist = Infinity;
    for (const city of this.gameState.cities) {
      const dist = Math.abs(city.position.x - unit.position.x) + Math.abs(city.position.y - unit.position.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = city;
      }
    }
    return minDist <= 12 ? nearest : null;
  }

  private formatTerrainName(terrain: string): string {
    return terrain.charAt(0).toUpperCase() + terrain.slice(1);
  }

  private getCurrentPlayer(): Player | null {
    if (!this.gameState) return null;
    return this.gameState.players.find(p => p.id === this.gameState!.currentPlayer) || null;
  }

  private isCurrentPlayerHuman(): boolean {
    const currentPlayer = this.getCurrentPlayer();
    return currentPlayer ? currentPlayer.isHuman : false;
  }

  public showAIPlayerMessage(): void {
    // Clear all fields and show AI player message
    this.clearPopulationInfo();
    this.clearTechProgress();
    this.clearUnitDetails();

    // Show AI player message in the unit name field
    const unitNameElement = document.getElementById('unit-name');
    if (unitNameElement) {
      const currentPlayer = this.getCurrentPlayer();
      const playerName = currentPlayer ? currentPlayer.name : 'AI Player';
      unitNameElement.innerHTML = `<span class="ai-turn-message">${playerName} Turn</span>`;
    }
  }

  private clearPopulationInfo(): void {
    const populationElement = document.getElementById('status-population');
    const yearElement = document.getElementById('status-year');
    const goldElement = document.getElementById('status-gold');

    if (populationElement) populationElement.textContent = '';
    if (yearElement) yearElement.textContent = '';
    if (goldElement) goldElement.textContent = '';
  }

  private clearTechProgress(): void {
    const lightbulb = document.getElementById('tech-lightbulb');
    const techName = document.getElementById('tech-name');
    const techTurns = document.getElementById('tech-turns');

    if (lightbulb) {
      lightbulb.className = lightbulb.className.replace(/\bturns-\d+(-plus)?\b/g, '');
      lightbulb.classList.remove('bright');
    }
    if (techName) techName.textContent = '';
    if (techTurns) techTurns.textContent = '';
  }

  public show(): void {
    this.isVisible = true;
    this.window.classList.remove('hidden');
    this.updateDisplay();
  }

  public hide(): void {
    this.isVisible = false;
    this.window.classList.add('hidden');
  }

  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public isShowing(): boolean {
    return this.isVisible;
  }
}
