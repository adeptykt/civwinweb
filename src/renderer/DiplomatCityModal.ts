import type { City, Unit } from '../types/game.js';
import { Game } from '../game/Game.js';
import { canDiplomatInciteRevolt, isCityInCivilDisorder } from '../game/CityJoinSystem.js';
import { t } from '../i18n/I18nService.js';
import { NotificationDialog } from './NotificationDialog.js';
import { getCivilization } from '../game/CivilizationDefinitions.js';

export class DiplomatCityModal {
  private overlay: HTMLElement | null = null;
  private resolveClose: (() => void) | null = null;
  private currentUnitId: string | null = null;
  private currentCityId: string | null = null;
  private pendingGame: Game | null = null;

  constructor() {
    this.overlay = document.getElementById('diplomat-city-modal');
    this.bindChrome();
  }

  show(game: Game, unit: Unit, city: City): Promise<void> {
    return new Promise((resolve) => {
      if (!this.overlay) {
        this.overlay = document.getElementById('diplomat-city-modal');
      }
      if (!this.overlay) {
        resolve();
        return;
      }

      this.resolveClose = resolve;
      this.currentUnitId = unit.id;
      this.currentCityId = city.id;
      this.pendingGame = game;

      const owner = game.getGameState().players.find(p => p.id === city.playerId);
      const civ = owner ? getCivilization(owner.civilizationType) : null;
      const civName = civ?.name ?? '—';

      const titleEl = document.getElementById('diplomat-city-title');
      const subEl = document.getElementById('diplomat-city-subtitle');
      if (titleEl) {
        titleEl.textContent = t('templates.diplomatCity.title', { city: city.name });
      }
      if (subEl) {
        subEl.textContent = t('templates.diplomatCity.subtitle', { civ: civName });
      }

      const barbarian = !!(owner as { isBarbarian?: boolean })?.isBarbarian;
      const human = game.getGameState().players.find(p => p.isHuman && !p.defeated);
      const atWar = human ? game.diplomacyManager.isAtWar(human.id, city.playerId) : false;
      const hasEmbassy = human ? game.diplomacyManager.hasEmbassy(human.id, city.playerId) : false;
      const stealable =
        human && owner && !barbarian
          ? (owner.technologies ?? []).filter(tech => !(human.technologies ?? []).includes(tech))
          : [];
      const gs = game.getGameState();
      const inciteCost = Game.diplomatInciteRevoltCost(city, gs);
      const canAffordIncite = human ? (human.gold ?? 0) >= inciteCost : false;
      const revoltCheck = human ? canDiplomatInciteRevolt(gs, city, human.id) : { ok: false as const, reason: 'invalid' };
      const inDisorder = isCityInCivilDisorder(city);
      const bribeableUnits =
        game.getGameState().units.filter(
          u =>
            u.position.x === city.position.x &&
            u.position.y === city.position.y &&
            u.playerId === city.playerId &&
            !u.aboardUnitId,
        ).length;
      const bribeCost = Game.diplomatBribeUnitsCost(bribeableUnits);
      const canAffordBribe = human ? (human.gold ?? 0) >= bribeCost : false;

      const btnEmbassy = document.getElementById('diplomat-action-embassy') as HTMLButtonElement | null;
      const btnSteal = document.getElementById('diplomat-action-steal') as HTMLButtonElement | null;
      if (btnEmbassy) {
        btnEmbassy.disabled = barbarian || atWar || hasEmbassy;
        btnEmbassy.title =
          barbarian ? t('templates.diplomatCity.hintBarbarianEmbassy')
          : atWar ? t('templates.diplomatCity.hintWarEmbassy')
          : hasEmbassy ? t('templates.diplomatCity.hintAlreadyEmbassy')
          : '';
      }
      if (btnSteal) {
        btnSteal.disabled = barbarian || stealable.length === 0;
        btnSteal.title =
          barbarian ? t('templates.diplomatCity.hintBarbarianSteal')
          : stealable.length === 0 ? t('templates.diplomatCity.hintNoTech')
          : '';
      }

      const btnIncite = document.getElementById('diplomat-action-incite') as HTMLButtonElement | null;
      if (btnIncite) {
        btnIncite.textContent = t('templates.diplomatCity.inciteRevolt', { gold: inciteCost });
        const revoltBlocked = !revoltCheck.ok;
        btnIncite.disabled = revoltBlocked || !canAffordIncite;
        const revoltHintKey = `templates.diplomatCity.hintInciteReasons.${revoltCheck.ok ? '' : revoltCheck.reason}`;
        btnIncite.title = revoltBlocked
          ? (() => {
              const msg = t(revoltHintKey);
              return msg === revoltHintKey ? revoltCheck.reason : msg;
            })()
          : !canAffordIncite
            ? t('templates.diplomatCity.hintNoGold', { gold: inciteCost })
            : inDisorder
              ? t('templates.diplomatCity.hintInciteDisorder')
              : t('templates.diplomatCity.hintInciteJoin');
      }

      const btnBribe = document.getElementById('diplomat-action-bribe') as HTMLButtonElement | null;
      if (btnBribe) {
        btnBribe.textContent = t('templates.diplomatCity.bribeUnits', { gold: bribeCost });
        btnBribe.disabled = bribeableUnits === 0 || !canAffordBribe;
        btnBribe.title =
          bribeableUnits === 0 ? t('templates.diplomatCity.hintNoUnits')
          : !canAffordBribe ? t('templates.diplomatCity.hintNoGold', { gold: bribeCost })
          : '';
      }

      this.overlay.style.display = 'flex';
      this.overlay.classList.add('active');
    });
  }

  private bindChrome(): void {
    document.getElementById('diplomat-city-close')?.addEventListener('click', () => this.dismiss());
    document.getElementById('diplomat-action-cancel')?.addEventListener('click', () => this.dismiss());

    const wire = (
      id: string,
      action: 'embassy' | 'investigate' | 'steal_tech' | 'sabotage' | 'incite_revolt' | 'bribe_units',
    ) => {
      document.getElementById(id)?.addEventListener('click', () => {
        void this.runAction(action);
      });
    };
    wire('diplomat-action-embassy', 'embassy');
    wire('diplomat-action-investigate', 'investigate');
    wire('diplomat-action-steal', 'steal_tech');
    wire('diplomat-action-sabotage', 'sabotage');
    wire('diplomat-action-incite', 'incite_revolt');
    wire('diplomat-action-bribe', 'bribe_units');
  }

  private async runAction(
    action: 'embassy' | 'investigate' | 'steal_tech' | 'sabotage' | 'incite_revolt' | 'bribe_units',
  ): Promise<void> {
    const game = this.pendingGame;
    const unitId = this.currentUnitId;
    const cityId = this.currentCityId;
    if (!game || !unitId || !cityId) return;

    if (action === 'investigate') {
      const city = game.getGameState().cities.find(c => c.id === cityId);
      if (city) {
        const report = game.getDiplomatInvestigateReport(city);
        await NotificationDialog.info(
          t('templates.diplomatCity.investigateTitle'),
          report.replace(/\n/g, '\\n'),
        );
      }
    }

    const result = game.applyDiplomatCityAction(action, unitId, cityId);
    if (!result.ok) {
      const key = `templates.diplomatCity.errors.${result.error}`;
      const msg = t(key);
      await NotificationDialog.info(t('templates.diplomatCity.errorTitle'), msg === key ? result.error : msg);
      return;
    }

    if (action === 'embassy') {
      const city = game.getGameState().cities.find(c => c.id === cityId);
      const o = city ? game.getGameState().players.find(p => p.id === city.playerId) : null;
      const c = o ? getCivilization(o.civilizationType) : null;
      await NotificationDialog.info(
        t('templates.diplomatCity.embassyTitle'),
        t('templates.diplomatCity.embassyDone', { civ: c?.name ?? '—' }),
      );
    }

    if (action === 'incite_revolt') {
      const city = game.getGameState().cities.find(c => c.id === cityId);
      if (city) {
        await NotificationDialog.info(
          t('templates.diplomatCity.revoltTitle'),
          t('templates.diplomatCity.revoltDone', { city: city.name }),
        );
      }
    }

    this.dismiss();
  }

  private dismiss(): void {
    if (this.overlay) {
      this.overlay.style.display = 'none';
      this.overlay.classList.remove('active');
    }
    this.currentUnitId = null;
    this.currentCityId = null;
    this.pendingGame = null;
    if (this.resolveClose) {
      this.resolveClose();
      this.resolveClose = null;
    }
  }
}
