import { t } from '../i18n/I18nService.js';
import type { FinalScoreResult } from '../game/CivilizationScore.js';
import type { HallOfFameAddResult } from '../game/HallOfFame.js';

export interface VictoryModalData {
  civilizationName: string;
  score: FinalScoreResult;
  hallOfFame: HallOfFameAddResult;
  isRetire?: boolean;
  isSpace?: boolean;
}

export interface VictoryModalCallbacks {
  onExit?: () => void;
  onContinue?: () => void;
  onViewHallOfFame?: () => void;
  onViewHistory?: () => void;
}

export class VictoryNotificationModal {
  private modal: HTMLElement | null = null;
  private messageText: HTMLElement | null = null;
  private breakdownEl: HTMLElement | null = null;
  private hofNoteEl: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private continueBtn: HTMLElement | null = null;
  private isVisible = false;
  private callbacks: VictoryModalCallbacks = {};

  constructor() {
    this.initializeModal();
  }

  private initializeModal(): void {
    this.modal = document.getElementById('victory-notification-modal');
    this.messageText = document.getElementById('victory-message-text');
    this.breakdownEl = document.getElementById('victory-score-breakdown');
    this.hofNoteEl = document.getElementById('victory-hof-note');
    this.titleEl = this.modal?.querySelector('.victory-notification-title span') ?? null;
    this.continueBtn = document.getElementById('victory-continue-btn');

    if (!this.modal || !this.messageText || !this.breakdownEl) {
      console.error('Victory notification modal elements not found');
      return;
    }

    document.getElementById('victory-notification-close')?.addEventListener('click', () => this.exit());
    document.getElementById('victory-exit-btn')?.addEventListener('click', () => this.exit());
    document.getElementById('victory-continue-btn')?.addEventListener('click', () => {
      this.callbacks.onContinue?.();
      this.hide();
    });
    document.getElementById('victory-hof-btn')?.addEventListener('click', () => {
      this.callbacks.onViewHallOfFame?.();
    });
    document.getElementById('victory-history-btn')?.addEventListener('click', () => {
      this.callbacks.onViewHistory?.();
    });

    this.modal.addEventListener('click', (event) => {
      if (event.target === this.modal) this.exit();
    });

    document.addEventListener('keydown', (event) => {
      if (!this.isVisible) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        this.exit();
      }
    });
  }

  public show(data: VictoryModalData, callbacks?: VictoryModalCallbacks): void {
    if (!this.modal || !this.messageText || !this.breakdownEl) return;

    this.callbacks = callbacks ?? {};

    if (this.titleEl) {
      this.titleEl.textContent = data.isSpace
        ? t('templates.victory.spaceTitle')
        : data.isRetire
          ? t('templates.victory.retireTitle')
          : t('templates.victory.title');
    }

    const messageKey = data.isSpace
      ? 'templates.victory.spaceMessage'
      : data.isRetire
        ? 'templates.victory.retireMessage'
        : 'templates.victory.message';
    this.messageText.textContent = t(messageKey, {
      civ: data.civilizationName,
      year: data.score.yearLabel,
    });

    const s = data.score;
    this.breakdownEl.innerHTML = [
      this.line('templates.victory.happy', { n: s.happyCitizens, pts: s.happyCitizens * 2 }),
      this.line('templates.victory.content', { n: s.contentCitizens, pts: s.contentCitizens }),
      this.line('templates.victory.wonders', { n: s.wonders, pts: s.wonders * 20 }),
      this.line('templates.victory.peace', { n: s.peaceTurns, pts: s.peaceTurns * 3 }),
      this.line('templates.victory.futuristic', { n: s.futuristicAdvances, pts: s.futuristicAdvances * 10 }),
      s.conquestBonus > 0
        ? this.line('templates.victory.conquestBonus', { pts: s.conquestBonus })
        : '',
      `<div class="score-line score-total"><span>${t('templates.victory.baseScore')}</span><span>${s.baseScore}</span></div>`,
      `<div class="score-line"><span>${t('templates.victory.rankingFormula', {
        diff: s.difficultyMultiplier,
        comp: s.competitionFactor,
      })}</span><span>${s.ranking}</span></div>`,
    ].filter(Boolean).join('');

    if (this.hofNoteEl) {
      if (data.hallOfFame.added && data.hallOfFame.position) {
        this.hofNoteEl.textContent = t('templates.victory.hofQualified', {
          pos: data.hallOfFame.position,
        });
      } else {
        this.hofNoteEl.textContent = t('templates.victory.hofNotQualified');
      }
      this.hofNoteEl.style.display = 'block';
    }

    if (this.continueBtn) {
      this.continueBtn.style.display = this.callbacks.onContinue ? 'inline-block' : 'none';
    }

    this.modal.style.display = 'flex';
    this.isVisible = true;
  }

  private line(key: string, params: Record<string, string | number>): string {
    const label = t(key, params);
    const pts = params.pts as number;
    const sign = pts >= 0 ? '+' : '';
    return `<div class="score-line"><span>${label}</span><span>${sign}${pts}</span></div>`;
  }

  private exit(): void {
    this.callbacks.onExit?.();
    this.hide();
  }

  public hide(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
      this.isVisible = false;
      this.callbacks = {};
    }
  }

  public isOpen(): boolean {
    return this.isVisible;
  }
}
