import type { Game } from '../game/Game.js';
import type { Player } from '../types/game.js';
import { t } from '../i18n/I18nService.js';
import {
  buildDemographicsReport,
  buildMilitaryReport,
  buildTopCitiesReport,
} from '../game/AdvisorReports.js';
import { buildTradeReport } from '../game/AdvisorTradeReport.js';
import { getUnitDisplayName } from '../utils/DisplayNames.js';

export type AdvisorReportKind = 'military' | 'trade' | 'demographics' | 'topCities';

export class AdvisorReportModal {
  private modal: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private summaryEl: HTMLElement | null = null;
  private tableWrap: HTMLElement | null = null;

  constructor() {
    this.modal = document.getElementById('advisor-report-modal');
    this.titleEl = document.getElementById('advisor-report-title');
    this.summaryEl = document.getElementById('advisor-report-summary');
    this.tableWrap = document.getElementById('advisor-report-table-wrap');

    document.getElementById('advisor-report-close')?.addEventListener('click', () => this.hide());
    document.getElementById('advisor-report-ok')?.addEventListener('click', () => this.hide());
    this.modal?.addEventListener('click', e => {
      if (e.target === this.modal) this.hide();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.isVisible()) this.hide();
    });
  }

  public show(game: Game, kind: AdvisorReportKind): void {
    if (!this.modal || !this.titleEl || !this.summaryEl || !this.tableWrap) return;

    const gs = game.getGameState();
    const human = gs.players.find((p: Player) => p.isHuman && !p.defeated);
    if (!human) return;

    const titleKeys: Record<AdvisorReportKind, string> = {
      military: 'templates.advisors.militaryTitle',
      trade: 'templates.advisors.tradeTitle',
      demographics: 'templates.advisors.demographicsTitle',
      topCities: 'templates.advisors.topCitiesTitle',
    };
    this.titleEl.textContent = t(titleKeys[kind]);

    switch (kind) {
      case 'military':
        this.renderMilitary(game, human);
        break;
      case 'trade':
        this.renderTrade(game, human);
        break;
      case 'demographics':
        this.renderDemographics(game);
        break;
      case 'topCities':
        this.renderTopCities(game);
        break;
    }

    this.modal.style.display = 'flex';
  }

  public hide(): void {
    if (this.modal) this.modal.style.display = 'none';
  }

  public isVisible(): boolean {
    return this.modal?.style.display === 'flex';
  }

  private renderMilitary(game: Game, human: Player): void {
    const gs = game.getGameState();
    const dm = game.getDiplomacyManager();
    const report = buildMilitaryReport(
      gs,
      human,
      otherId => {
        const other = gs.players.find(p => p.id === otherId);
        if (other && (other as Player & { isBarbarian?: boolean }).isBarbarian) return true;
        return dm.isAtWar(human.id, otherId);
      },
      otherId => dm.isAtWar(human.id, otherId),
    );

    this.summaryEl!.innerHTML = [
      `<p>${t('templates.advisors.militarySummary', {
        yours: report.totalMilitary,
        enemies: report.enemyMilitary,
      })}</p>`,
      report.atWarWith.length
        ? `<p>${t('templates.advisors.atWarWith', { list: report.atWarWith.join(', ') })}</p>`
        : `<p>${t('templates.advisors.atPeace')}</p>`,
    ].join('');

    const cityRows = report.cities
      .map(
        c =>
          `<tr><td>${escapeHtml(c.cityName)}</td><td>${c.garrison}</td><td>${c.threatsNearby}</td></tr>`,
      )
      .join('');

    const threatRows = report.threats.length
      ? report.threats
          .map(
            th =>
              `<tr><td>${escapeHtml(getUnitDisplayName(th.unitLabel as any))}</td><td>${escapeHtml(th.ownerName)}</td><td>${escapeHtml(th.nearCity)}</td><td>${th.distance}</td></tr>`,
          )
          .join('')
      : `<tr><td colspan="4">${t('templates.advisors.noThreats')}</td></tr>`;

    this.tableWrap!.innerHTML = `
      <h4>${t('templates.advisors.garrisonsHeader')}</h4>
      <table class="advisor-table">
        <thead><tr>
          <th>${t('templates.advisors.colCity')}</th>
          <th>${t('templates.advisors.colGarrison')}</th>
          <th>${t('templates.advisors.colThreats')}</th>
        </tr></thead>
        <tbody>${cityRows}</tbody>
      </table>
      <h4>${t('templates.advisors.threatsHeader')}</h4>
      <table class="advisor-table">
        <thead><tr>
          <th>${t('templates.advisors.colUnit')}</th>
          <th>${t('templates.advisors.colOwner')}</th>
          <th>${t('templates.advisors.colNearCity')}</th>
          <th>${t('templates.advisors.colDistance')}</th>
        </tr></thead>
        <tbody>${threatRows}</tbody>
      </table>`;
  }

  private renderTrade(game: Game, human: Player): void {
    const report = buildTradeReport(game.getGameState(), human);
    this.summaryEl!.innerHTML = `<p>${t('templates.advisors.tradeSummary', {
      gold: report.totals.gold,
      science: report.totals.science,
      luxury: report.totals.luxury,
      maintenance: report.totals.maintenance,
      net: report.totals.netGold,
    })}</p>`;

    const rows = report.cities
      .map(
        c =>
          `<tr><td>${escapeHtml(c.cityName)}</td><td>${c.rawTrade}</td><td>${c.corruption}</td><td>${c.gold}</td><td>${c.science}</td><td>${c.luxury}</td></tr>`,
      )
      .join('');

    this.tableWrap!.innerHTML = `
      <table class="advisor-table">
        <thead><tr>
          <th>${t('templates.advisors.colCity')}</th>
          <th>${t('templates.advisors.colTrade')}</th>
          <th>${t('templates.advisors.colCorruption')}</th>
          <th>${t('templates.advisors.colGold')}</th>
          <th>${t('templates.advisors.colScience')}</th>
          <th>${t('templates.advisors.colLuxury')}</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="6">${t('templates.advisors.noCities')}</td></tr>`}</tbody>
      </table>`;
  }

  private renderDemographics(game: Game): void {
    const rows = buildDemographicsReport(game.getGameState());
    const humanRow = rows.find(r => r.isHuman);
    this.summaryEl!.innerHTML = humanRow
      ? `<p>${t('templates.advisors.demographicsSummary', {
          pop: humanRow.population,
          cities: humanRow.cities,
          happy: humanRow.happy,
          unhappy: humanRow.unhappy,
        })}</p>`
      : '';

    const body = rows
      .map(
        r =>
          `<tr class="${r.isHuman ? 'advisor-row-human' : ''}"><td>${escapeHtml(r.civName)}</td><td>${escapeHtml(r.leader)}</td><td>${r.cities}</td><td>${r.population}</td><td>${r.happy}</td><td>${r.content}</td><td>${r.unhappy}</td><td>${r.militaryUnits}</td><td>${r.technologies}</td></tr>`,
      )
      .join('');

    this.tableWrap!.innerHTML = `
      <table class="advisor-table">
        <thead><tr>
          <th>${t('templates.advisors.colCiv')}</th>
          <th>${t('templates.advisors.colLeader')}</th>
          <th>${t('templates.advisors.colCities')}</th>
          <th>${t('templates.advisors.colPopulation')}</th>
          <th>${t('templates.advisors.colHappy')}</th>
          <th>${t('templates.advisors.colContent')}</th>
          <th>${t('templates.advisors.colUnhappy')}</th>
          <th>${t('templates.advisors.colMilitary')}</th>
          <th>${t('templates.advisors.colTechs')}</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>`;
  }

  private renderTopCities(game: Game): void {
    const rows = buildTopCitiesReport(game.getGameState());
    this.summaryEl!.innerHTML = `<p>${t('templates.advisors.topCitiesIntro')}</p>`;

    const body = rows
      .map(
        r =>
          `<tr><td>${r.rank}</td><td>${escapeHtml(r.cityName)}</td><td>${escapeHtml(r.ownerName)}</td><td>${r.population}</td><td>${r.score}</td></tr>`,
      )
      .join('');

    this.tableWrap!.innerHTML = `
      <table class="advisor-table">
        <thead><tr>
          <th>#</th>
          <th>${t('templates.advisors.colCity')}</th>
          <th>${t('templates.advisors.colOwner')}</th>
          <th>${t('templates.advisors.colPopulation')}</th>
          <th>${t('templates.advisors.colRating')}</th>
        </tr></thead>
        <tbody>${body || `<tr><td colspan="5">${t('templates.advisors.noCities')}</td></tr>`}</tbody>
      </table>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
