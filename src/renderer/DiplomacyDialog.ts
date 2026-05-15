import type { Game } from '../game/Game.js';
import type { Player, GameState } from '../types/game.js';
import { GovernmentType } from '../types/game.js';
import {
  DiplomacyManager,
  DiplomacyContact,
  DiplomacyOutcome,
  DiplomacyProposal,
  DiplomaticStatus,
  AIMood,
} from '../game/DiplomacyManager.js';
import { getCivilization, CivilizationType } from '../game/CivilizationDefinitions.js';
import { TechnologyType, getTechnology } from '../game/TechnologyDefinitions.js';
import { getPortraitStyle, getOfficialStyle, applySpriteStyle, initializeSprites, getFaceStyle } from './LeaderSprites.js';
import { GameTime } from '../utils/GameTime.js';
import { t } from '../i18n/I18nService.js';

interface ResponseOption {
  id: string;
  icon: string;
  text: string;
  description?: string;
  cssClass?: string;
  action: () => void;
}

/**
 * Win95-style Diplomacy Dialog.
 *
 * Shows the leader portrait, mood banner, and the AI's opening speech.
 * The human player can choose from a set of response options that vary
 * based on the AI's proposal and the current game state.
 *
 * Usage:
 *   const result = await diplomacyDialog.show(contact, aiPlayer, humanPlayer, game);
 */
export class DiplomacyDialog {
  private dialog: HTMLElement | null = null;
  private currentResolve: ((outcome: DiplomacyOutcome) => void) | null = null;
  private selectedTech: TechnologyType | null = null;
  private selectedCivId: string | null = null;
  private openTimestamp: number = 0;
  private dialogKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private faceCellAnimInterval: number | null = null;

  /**
   * Per-mood animation sequence: face-cell row, column cycle order, and speed.
   * Faster/shorter intervals = more agitated leader; slower = calm/relaxed.
   * Columns cycle through the 4 face variants in the row to simulate speaking.
   */
  private static readonly FACE_ANIM: Record<AIMood, { row: number; cols: number[]; intervalMs: number }> = {
    [AIMood.AMIABLE]:    { row: 0, cols: [0, 1, 2, 1],    intervalMs: 650 },
    [AIMood.CAUTIOUS]:   { row: 0, cols: [2, 3, 2, 1],    intervalMs: 700 },
    [AIMood.NEUTRAL]:    { row: 0, cols: [3, 2, 3],        intervalMs: 800 },
    [AIMood.HOSTILE]:    { row: 2, cols: [0, 1, 2, 1],    intervalMs: 420 },
    [AIMood.DEMANDING]:  { row: 2, cols: [1, 2, 3, 2],    intervalMs: 380 },
    [AIMood.AGGRESSIVE]: { row: 3, cols: [0, 1, 0, 2],    intervalMs: 320 },
    [AIMood.FEARFUL]:    { row: 3, cols: [3, 2, 3, 1],    intervalMs: 500 },
  };

  constructor() {
    this.bindStaticElements();
  }

  private bindStaticElements(): void {
    this.dialog = document.getElementById('diplomacy-dialog');
    if (!this.dialog) return;

    document.getElementById('diplo-close')?.addEventListener('click', () => {
      this.dismiss();
    });

    document.getElementById('diplo-tech-cancel')?.addEventListener('click', () => {
      this.hideTechPanel();
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Show the dialog and wait for the player's choice.
   * Returns a Promise<DiplomacyOutcome> that resolves when the player responds.
   */
  public async show(
    contact: DiplomacyContact,
    aiPlayer: Player,
    humanPlayer: Player,
    game: Game,
  ): Promise<DiplomacyOutcome> {
    // Ensure sprite backgrounds are keyed out
    await initializeSprites();

    return new Promise<DiplomacyOutcome>((resolve) => {
      this.currentResolve = resolve;
      this.selectedTech = null;

      const diplomacyMgr = game.diplomacyManager;
      const gameState = game.getGameState();

      const isAIStronger = this.computeIsAIStronger(aiPlayer, humanPlayer, gameState);
      const mood = diplomacyMgr.calculateAIMood(
        aiPlayer, humanPlayer, isAIStronger, gameState.turn
      );

      this.populate(contact, aiPlayer, humanPlayer, mood, game, gameState, isAIStronger);
      this.showDialog();
    });
  }

  // ── Populate ───────────────────────────────────────────────────────────────

  private populate(
    contact: DiplomacyContact,
    aiPlayer: Player,
    humanPlayer: Player,
    mood: AIMood,
    game: Game,
    gameState: GameState,
    isAIStronger: boolean,
  ): void {
    if (!this.dialog) return;

    const diplomacyMgr = game.diplomacyManager;
    const civ = getCivilization(aiPlayer.civilizationType);
    const emoji = diplomacyMgr.getCivEmoji(aiPlayer.civilizationType);

    // Title bar
    const titleEl = document.getElementById('diplo-title');
    if (titleEl) {
      titleEl.textContent = t('templates.diplomacy.audienceTitle', {
        emoji,
        leader: civ?.leader ?? t('templates.diplomacy.leaderFallback'),
      });
    }

    // Portrait — large leader portrait, clipped to show face/upper body
    const portraitEl      = document.getElementById('diplo-portrait');
    const leaderPortEl    = document.getElementById('diplo-leader-portrait') as HTMLElement | null;

    if (portraitEl) {
      portraitEl.className = `diplo-scene mood-${mood}`;
    }
    if (leaderPortEl) {
      // Larger portrait for the scene background format
      applySpriteStyle(leaderPortEl, getPortraitStyle(aiPlayer.civilizationType, 1.8));
    }

    // Start the mood-driven face-cell speaking animation
    this.startFaceAnimation(aiPlayer.civilizationType, mood);

    // Scale the official figures to match the scene
    const officialScale = 260 / 101; // Block height is ~101, so scale is ~2.57
    for (let i = 0; i < 4; i++) {
        const offEl = document.getElementById(`diplo-official-${i}`) as HTMLElement | null;
        if (offEl) {
            applySpriteStyle(offEl, getOfficialStyle(aiPlayer.government, i, officialScale));
        }
    }

    // Leader + civ name
    const civNameEl = document.getElementById('diplo-civ-name');
    const leaderNameEl = document.getElementById('diplo-leader-name');
    if (civNameEl) civNameEl.textContent = civ?.name ?? '';
    if (leaderNameEl) {
      leaderNameEl.textContent = this.getLeaderTitle(aiPlayer, gameState);
      leaderNameEl.style.color = aiPlayer.color ?? '#aaddff';
    }

    // Mood banner
    const moodBanner = document.getElementById('diplo-mood-banner');
    if (moodBanner) {
      moodBanner.textContent = diplomacyMgr.getMoodDescription(mood);
      moodBanner.className = `diplo-mood-banner mood-${mood}`;
    }

    // Speech
    const targetPlayer = contact.targetCivId
      ? gameState.players.find(p => p.id === contact.targetCivId)
      : undefined;
    const targetCivName = targetPlayer
      ? (getCivilization(targetPlayer.civilizationType)?.name ?? targetPlayer.name)
      : undefined;

    const speech = diplomacyMgr.getLeaderSpeech(
      aiPlayer,
      mood,
      contact.proposal,
      contact.demandGold,
      contact.demandTech ? this.formatTechName(contact.demandTech) : undefined,
      contact.offeredTech ? this.formatTechName(contact.offeredTech) : undefined,
      targetCivName,
    );
    const speechEl = document.getElementById('diplo-speech-box');
    if (speechEl) speechEl.textContent = speech;

    // Status bar (hide initially)
    this.hideStatusBar();

    // Tech panel (hide initially)
    this.hideTechPanel();

    // Build response options
    this.buildResponseOptions(contact, aiPlayer, humanPlayer, mood, game, gameState, isAIStronger);
  }

  // ── Response options ───────────────────────────────────────────────────────

  private buildResponseOptions(
    contact: DiplomacyContact,
    aiPlayer: Player,
    humanPlayer: Player,
    mood: AIMood,
    game: Game,
    gameState: GameState,
    isAIStronger: boolean,
  ): void {
    const list = document.getElementById('diplo-response-list');
    if (!list) return;
    list.innerHTML = '';

    const options = this.computeOptions(contact, aiPlayer, humanPlayer, mood, game, gameState, isAIStronger);
    for (const opt of options) {
      const btn = this.createResponseButton(opt);
      list.appendChild(btn);
    }
  }

  private computeOptions(
    contact: DiplomacyContact,
    aiPlayer: Player,
    humanPlayer: Player,
    mood: AIMood,
    game: Game,
    gameState: GameState,
    isAIStronger: boolean,
  ): ResponseOption[] {
    const opts: ResponseOption[] = [];
    const diplomacyMgr = game.diplomacyManager;
    const rel = diplomacyMgr.getRelationship(aiPlayer.id, humanPlayer.id);
    const atWar = rel.status === DiplomaticStatus.WAR;
    const atPeace = rel.status === DiplomaticStatus.PEACE;
    const humanTechs = humanPlayer.technologies ?? [];
    const aiTechs = aiPlayer.technologies ?? [];
    const techsAIHasThatHumanDoes = aiTechs.filter((t: TechnologyType) => !humanTechs.includes(t));
    const techsHumanHasThatAIDoes = humanTechs.filter((t: TechnologyType) => !aiTechs.includes(t));
    const senateForcePeace = diplomacyMgr.doesSenateForcePeace(humanPlayer);

    switch (contact.proposal) {

      case DiplomacyProposal.DEMAND_TRIBUTE_GOLD:
        // Accept the demand
        if (humanPlayer.gold >= (contact.demandGold ?? 0)) {
          opts.push({
            id: 'accept-gold',
            icon: '💰',
            text: t('diplomacyDialog.ui.payGold', { gold: contact.demandGold ?? 0 }),
            description: t('diplomacyDialog.ui.payGoldDesc'),
            cssClass: 'response-tribute',
            action: () => {
              this.resolve({
                accepted: true, war: false, peace: !atWar,
                goldPaid: contact.demandGold,
              });
            },
          });
        }
        // Refuse
        opts.push({
          id: 'refuse-gold',
          icon: '👊',
          text: t('diplomacyDialog.ui.refuseDemand'),
          description: t('diplomacyDialog.ui.refuseDemandDesc'),
          cssClass: senateForcePeace ? 'response-tribute' : 'response-war',
          action: () => {
            // Aggressive/demanding leaders almost always declare war
            const willDeclareWar =
              mood === AIMood.AGGRESSIVE ||
              (mood === AIMood.DEMANDING && Math.random() < 0.8) ||
              (mood === AIMood.HOSTILE && Math.random() < 0.5);
            const leaderName =
              getCivilization(aiPlayer.civilizationType)?.leader ?? t('diplomacyDialog.leaderFallback');
            this.showStatusBar(
              willDeclareWar
                ? t('diplomacyDialog.ui.statusWarDeclared', { leader: leaderName })
                : t('diplomacyDialog.ui.statusDispleasedWithdraws', { leader: leaderName }),
              willDeclareWar ? 'outcome-war' : 'outcome-info',
            );
            setTimeout(() => this.resolve({ accepted: false, war: willDeclareWar, peace: false }), 1600);
          },
        });
        break;

      case DiplomacyProposal.DEMAND_TRIBUTE_TECH:
        if (contact.demandTech && humanTechs.includes(contact.demandTech)) {
          opts.push({
            id: 'give-tech',
            icon: '📜',
            text: t('diplomacyDialog.ui.giveTech', { tech: this.formatTechName(contact.demandTech) }),
            description: t('diplomacyDialog.ui.giveTechDesc'),
            cssClass: 'response-tribute',
            action: () => {
              this.showOutcomeAndContinue(
                t('diplomacyDialog.ui.outcomeHandedTech', {
                  tech: this.formatTechName(contact.demandTech!),
                }),
                'outcome-trade',
                { accepted: true, war: false, peace: !atWar, techGiven: contact.demandTech },
              );
            },
          });
        }
        opts.push({
          id: 'refuse-tech',
          icon: '🚫',
          text: t('diplomacyDialog.ui.refuseSecrets'),
          description: t('diplomacyDialog.ui.refuseSecretsDesc'),
          cssClass: 'response-war',
          action: () => {
            const willDeclareWar =
              mood === AIMood.AGGRESSIVE ||
              (mood === AIMood.DEMANDING && Math.random() < 0.85);
            const leaderName =
              getCivilization(aiPlayer.civilizationType)?.leader ?? t('diplomacyDialog.leaderFallback');
            this.showStatusBar(
              willDeclareWar
                ? t('diplomacyDialog.ui.statusWarDeclared', { leader: leaderName })
                : t('diplomacyDialog.ui.statusDemandRescinded'),
              willDeclareWar ? 'outcome-war' : 'outcome-info',
            );
            setTimeout(() => this.resolve({ accepted: false, war: willDeclareWar, peace: false }), 1600);
          },
        });
        break;

      case DiplomacyProposal.OFFER_PEACE:
        if (!senateForcePeace) {
          opts.push({
            id: 'accept-peace',
            icon: '🕊️',
            text: t('diplomacyDialog.ui.acceptPeace'),
            description: t('diplomacyDialog.ui.acceptPeaceDesc'),
            cssClass: 'response-peace',
            action: () => {
              this.showStatusBar(t('diplomacyDialog.ui.statusPeaceSigned'), 'outcome-peace');
              setTimeout(() => this.resolve({ accepted: true, war: false, peace: true }), 1400);
            },
          });
          opts.push({
            id: 'reject-peace',
            icon: '⚔️',
            text: t('diplomacyDialog.ui.rejectPeace'),
            description: t('diplomacyDialog.ui.rejectPeaceDesc'),
            cssClass: 'response-war',
            action: () => {
              this.resolve({ accepted: false, war: true, peace: false });
            },
          });
        } else {
          // Senate forces acceptance
          opts.push({
            id: 'senate-peace',
            icon: '🏛️',
            text: t('diplomacyDialog.ui.senatePeace'),
            description: t('diplomacyDialog.ui.senatePeaceDesc'),
            cssClass: 'response-peace',
            action: () => {
              this.showStatusBar(t('diplomacyDialog.ui.statusSenatePeace'), 'outcome-peace');
              setTimeout(() => this.resolve({ accepted: true, war: false, peace: true }), 1800);
            },
          });
        }
        break;

      case DiplomacyProposal.OFFER_TECH_TRADE:
        if (contact.offeredTech) {
          // Accept trade (they pick a tech from us)
          if (techsHumanHasThatAIDoes.length > 0) {
            opts.push({
              id: 'accept-trade',
              icon: '🔬',
              text: t('diplomacyDialog.ui.acceptTrade', {
                tech: this.formatTechName(contact.offeredTech),
              }),
              description: t('diplomacyDialog.ui.acceptTradeDesc'),
              cssClass: 'response-trade',
              action: () => {
                // They take a random tech from human
                const taken = techsHumanHasThatAIDoes[
                  Math.floor(Math.random() * techsHumanHasThatAIDoes.length)
                ];
                this.showOutcomeAndContinue(
                  t('diplomacyDialog.ui.outcomeTechExchanged', {
                    received: this.formatTechName(contact.offeredTech!),
                    given: this.formatTechName(taken),
                  }),
                  'outcome-trade',
                  { accepted: true, war: false, peace: false, techReceived: contact.offeredTech, techGiven: taken },
                );
              },
            });
          }
          // Refuse trade
          opts.push({
            id: 'refuse-trade',
            icon: '🤐',
            text: t('diplomacyDialog.ui.declineTrade'),
            description: t('diplomacyDialog.ui.declineTradeDesc'),
            action: () => {
              this.resolve({ accepted: false, war: false, peace: false });
            },
          });
        }
        break;

      case DiplomacyProposal.DECLARE_WAR:
        // Acknowledgement only — the player cannot prevent the war
        opts.push({
          id: 'acknowledge-war',
          icon: '⚔️',
          text: t('diplomacyDialog.ui.acknowledgeWar'),
          description: t('diplomacyDialog.ui.acknowledgeWarDesc'),
          cssClass: 'response-war',
          action: () => {
            this.resolve({ accepted: false, war: true, peace: false });
          },
        });
        break;

      case DiplomacyProposal.WITHDRAW_UNITS:
        opts.push({
          id: 'agree-withdraw',
          icon: '🏳️',
          text: t('diplomacyDialog.ui.agreeWithdraw'),
          description: t('diplomacyDialog.ui.agreeWithdrawDesc'),
          cssClass: 'response-peace',
          action: () => {
            this.showStatusBar(t('diplomacyDialog.ui.statusWithdraw'), 'outcome-info');
            setTimeout(() => this.resolve({ accepted: true, war: false, peace: false }), 1200);
          },
        });
        opts.push({
          id: 'refuse-withdraw',
          icon: '⚔️',
          text: t('diplomacyDialog.ui.refuseWithdraw'),
          description: t('diplomacyDialog.ui.refuseWithdrawDesc'),
          cssClass: 'response-war',
          action: () => {
            const leaderName =
              getCivilization(aiPlayer.civilizationType)?.leader ?? t('diplomacyDialog.leaderFallback');
            this.showStatusBar(t('diplomacyDialog.ui.statusWarDeclared', { leader: leaderName }), 'outcome-war');
            setTimeout(() => this.resolve({ accepted: false, war: true, peace: false }), 1600);
          },
        });
        break;

      case DiplomacyProposal.ASK_ALLY_VS:
        {
          const targetCiv = contact.targetCivId
            ? getCivilization(gameState.players.find(p => p.id === contact.targetCivId)?.civilizationType as any)
            : null;
          const targetLabel = targetCiv?.name ?? t('diplomacyDialog.targetCiv');
          opts.push({
            id: 'agree-ally',
            icon: '🤝',
            text: t('diplomacyDialog.ui.declareWarOn', { civ: targetLabel }),
            description: t('diplomacyDialog.ui.declareWarOnDesc'),
            cssClass: 'response-war',
            action: () => {
              this.showStatusBar(
                t('diplomacyDialog.ui.statusYouDeclaredWar', {
                  civ: targetCiv?.name ?? t('diplomacyDialog.enemy'),
                }),
                'outcome-war',
              );
              setTimeout(() => this.resolve({
                accepted: true, war: false, peace: false,
                targetDeclaredWar: contact.targetCivId,
              }), 1600);
            },
          });
          opts.push({
            id: 'refuse-ally',
            icon: '🚫',
            text: t('diplomacyDialog.ui.declineAlliance'),
            description: t('diplomacyDialog.ui.declineAllianceDesc'),
            action: () => {
              this.resolve({ accepted: false, war: false, peace: false });
            },
          });
        }
        break;

      case DiplomacyProposal.PLAYER_GREET:
      default:
        // Player-initiated or greeting: offer all diplomatic options
        break;
    }

    // ── Universal options (always available when player-initiated or after greeting) ──

    if (
      contact.proposal === DiplomacyProposal.AI_GREET ||
      contact.proposal === DiplomacyProposal.PLAYER_GREET ||
      opts.length === 0
    ) {
      // Propose peace (if not already at peace)
      if (!atPeace && !atWar && !senateForcePeace) {
        opts.push({
          id: 'propose-peace',
          icon: '🕊️',
          text: t('diplomacyDialog.ui.proposePeace'),
          description: t('diplomacyDialog.ui.proposePeaceDesc'),
          cssClass: 'response-peace',
          action: () => {
            const willAccept = isAIStronger
              ? mood === AIMood.FEARFUL || mood === AIMood.AMIABLE
              : mood !== AIMood.AGGRESSIVE;
            const leaderName =
              getCivilization(aiPlayer.civilizationType)?.leader ?? t('diplomacyDialog.leaderFallback');
            this.showStatusBar(
              willAccept
                ? t('diplomacyDialog.ui.statusPeaceAccepted', { leader: leaderName })
                : t('diplomacyDialog.ui.statusPeaceRefused', { leader: leaderName }),
              willAccept ? 'outcome-peace' : 'outcome-war',
            );
            setTimeout(() => this.resolve({ accepted: willAccept, war: !willAccept, peace: willAccept }), 1600);
          },
        });
      }

      // Offer tech trade
      if (techsAIHasThatHumanDoes.length > 0 && techsHumanHasThatAIDoes.length > 0 && mood !== AIMood.AGGRESSIVE) {
        opts.push({
          id: 'propose-trade',
          icon: '🔬',
          text: t('diplomacyDialog.ui.proposeTechTrade'),
          description: t('diplomacyDialog.ui.proposeTechTradeDesc'),
          cssClass: 'response-trade',
          action: () => {
            this.showTechSelectPanel(
              t('diplomacyDialog.ui.panelSelectTechReceive'),
              techsAIHasThatHumanDoes,
              (chosen) => {
                const taken = techsHumanHasThatAIDoes[
                  Math.floor(Math.random() * techsHumanHasThatAIDoes.length)
                ];
                this.showOutcomeAndContinue(
                  t('diplomacyDialog.ui.outcomeExchangedPick', {
                    received: this.formatTechName(chosen),
                    given: this.formatTechName(taken),
                  }),
                  'outcome-trade',
                  { accepted: true, war: false, peace: false, techReceived: chosen, techGiven: taken },
                );
              }
            );
          },
        });
      }

      // Gift tech (goodwill)
      if (techsHumanHasThatAIDoes.length > 0) {
        opts.push({
          id: 'gift-tech',
          icon: '🎁',
          text: t('diplomacyDialog.ui.giftTech'),
          description: t('diplomacyDialog.ui.giftTechDesc'),
          cssClass: 'response-trade',
          action: () => {
            this.showTechSelectPanel(
              t('diplomacyDialog.ui.panelSelectTechGift'),
              techsHumanHasThatAIDoes,
              (chosen) => {
                diplomacyMgr.modifyReputation(humanPlayer.id, 5);
                const leaderGift =
                  getCivilization(aiPlayer.civilizationType)?.leader ?? t('diplomacyDialog.leaderFallback');
                this.showOutcomeAndContinue(
                  t('diplomacyDialog.ui.outcomeGiftTech', {
                    tech: this.formatTechName(chosen),
                    leader: leaderGift,
                  }),
                  'outcome-trade',
                  { accepted: true, war: false, peace: false, techGiven: chosen },
                );
              }
            );
          },
        });
      }

      // Propose joint war against another civ
      const jointWarTargets = gameState.players.filter(
        p => !p.defeated && p.id !== humanPlayer.id && p.id !== aiPlayer.id,
      );
      if (jointWarTargets.length > 0 && !diplomacyMgr.isAtWar(humanPlayer.id, aiPlayer.id)) {
        opts.push({
          id: 'propose-joint-war',
          icon: '⚔️',
          text: t('diplomacyDialog.ui.proposeJointWar'),
          description: t('diplomacyDialog.ui.proposeJointWarDesc'),
          cssClass: 'response-war',
          action: () => {
            this.showCivSelectPanel(
              t('diplomacyDialog.ui.panelSelectCivWar'),
              jointWarTargets,
              (target) => {
                const alreadyAtWarWithTarget = diplomacyMgr.isAtWar(aiPlayer.id, target.id);
                const atPeaceWithTarget = diplomacyMgr.isAtPeace(aiPlayer.id, target.id);
                const threat = diplomacyMgr.getEffectiveThreatLevel(aiPlayer, gameState.turn);

                // Base acceptance probability
                let prob = 0.25 + threat * 0.05;

                // Already at war with that civ → very willing
                if (alreadyAtWarWithTarget) prob += 0.40;
                // At peace / neutral with target → more reluctant
                else if (atPeaceWithTarget) prob -= 0.15;

                // Mood towards the human player
                if (mood === AIMood.AMIABLE)                                    prob += 0.25;
                else if (mood === AIMood.FEARFUL)                               prob += 0.10;
                else if (mood === AIMood.HOSTILE || mood === AIMood.DEMANDING)  prob -= 0.15;
                else if (mood === AIMood.AGGRESSIVE)                            prob -= 0.25;

                // Wary of proposing war against a much stronger civ
                if (target.gold > aiPlayer.gold * 1.5) prob -= 0.15;

                const willJoin = Math.random() < Math.max(0.05, Math.min(0.95, prob));
                const targetCiv = getCivilization(target.civilizationType);
                const aiCivLeader =
                  getCivilization(aiPlayer.civilizationType)?.leader ?? t('diplomacyDialog.ui.leaderFallbackShort');
                const enemyName = targetCiv?.name ?? t('diplomacyDialog.enemy');

                if (willJoin) {
                  this.showOutcomeAndContinue(
                    t('diplomacyDialog.ui.outcomeJointWarYes', { leader: aiCivLeader, civ: enemyName }),
                    'outcome-war',
                    { accepted: true, war: false, peace: false, targetDeclaredWar: target.id },
                  );
                } else {
                  this.showOutcomeAndContinue(
                    t('diplomacyDialog.ui.outcomeJointWarNo', { leader: aiCivLeader, civ: enemyName }),
                    'outcome-info',
                    { accepted: false, war: false, peace: false },
                  );
                }
              },
            );
          },
        });
      }

      // Ask them to attack another civ
      const otherEnemies = gameState.players.filter(
        p => !p.defeated && p.id !== humanPlayer.id && p.id !== aiPlayer.id &&
          diplomacyMgr.isAtWar(humanPlayer.id, p.id)
      );
      if (otherEnemies.length > 0 && mood === AIMood.AMIABLE) {
        const target = otherEnemies[0];
        const targetCiv = getCivilization(target.civilizationType);
        const attackCivName = targetCiv?.name ?? t('diplomacyDialog.enemy');
        opts.push({
          id: 'ask-attack',
          icon: '🗡️',
          text: t('diplomacyDialog.ui.askAttack', { civ: attackCivName }),
          description: t('diplomacyDialog.ui.askAttackDesc'),
          cssClass: 'response-war',
          action: () => {
            const willAccept = Math.random() < 0.4; // Moderate chance
            this.showStatusBar(
              willAccept
                ? t('diplomacyDialog.ui.statusAttackAgree', { civ: attackCivName })
                : t('diplomacyDialog.ui.statusAttackDecline'),
              willAccept ? 'outcome-war' : 'outcome-info',
            );
            setTimeout(() => this.resolve({
              accepted: willAccept, war: false, peace: false,
              targetDeclaredWar: willAccept ? target.id : undefined,
            }), 1600);
          },
        });
      }

      // Declare war
      if (!atWar && !senateForcePeace) {
        opts.push({
          id: 'declare-war',
          icon: '⚔️',
          text: t('diplomacyDialog.ui.declareWar'),
          description: t('diplomacyDialog.ui.declareWarDesc'),
          cssClass: 'response-war',
          action: () => {
            const aiCivName =
              getCivilization(aiPlayer.civilizationType)?.name ?? t('diplomacyDialog.enemy');
            this.showStatusBar(t('diplomacyDialog.ui.statusWarDeclaredOn', { civ: aiCivName }), 'outcome-war');
            diplomacyMgr.modifyReputation(humanPlayer.id, -25); // Sneak attack hurts rep

            const speechEl = document.getElementById('diplo-speech-box');
            if (speechEl) {
              speechEl.textContent = diplomacyMgr.getWarDeclarationResponse(aiPlayer, mood);
            }

            const newMood = mood === AIMood.FEARFUL ? AIMood.FEARFUL : AIMood.AGGRESSIVE;
            const moodBanner = document.getElementById('diplo-mood-banner');
            if (moodBanner) {
              moodBanner.textContent = diplomacyMgr.getMoodDescription(newMood);
              moodBanner.className = `diplo-mood-banner mood-${newMood}`;
            }
            const portraitEl = document.getElementById('diplo-portrait');
            if (portraitEl) {
              portraitEl.className = `diplo-scene mood-${newMood}`;
            }
            this.startFaceAnimation(aiPlayer.civilizationType, newMood);

            const list = document.getElementById('diplo-response-list');
            if (list) {
              list.innerHTML = '';
              const continueBtn = this.createResponseButton({
                id: 'dismiss-war',
                icon: '🔚',
                text: t('diplomacyDialog.ui.continue'),
                description: t('diplomacyDialog.ui.continueWarDesc'),
                action: () => {
                  this.resolve({ accepted: false, war: true, peace: false });
                }
              });
              list.appendChild(continueBtn);

              const btnEl = list.firstElementChild as HTMLElement;
              if (btnEl) btnEl.focus();
            }
          },
        });
      }
    }

    // Always: dismiss / leave
    opts.push({
      id: 'dismiss',
      icon: '👋',
      text: t('diplomacyDialog.ui.farewell'),
      description: t('diplomacyDialog.ui.farewellDesc'),
      action: () => {
        this.resolve({ accepted: false, war: false, peace: false });
      },
    });

    return opts;
  }

  // ── Tech selection sub-panel ───────────────────────────────────────────────

  private showTechSelectPanel(
    title: string,
    techs: TechnologyType[],
    onConfirm: (tech: TechnologyType) => void,
  ): void {
    const panel = document.getElementById('diplo-tech-select-panel');
    const titleEl = document.getElementById('diplo-tech-select-title');
    const listEl = document.getElementById('diplo-tech-list');
    const confirmBtn = document.getElementById('diplo-tech-confirm') as HTMLButtonElement | null;

    if (!panel || !titleEl || !listEl || !confirmBtn) return;

    titleEl.textContent = title;
    listEl.innerHTML = '';
    this.selectedTech = null;
    confirmBtn.disabled = true;

    for (const tech of techs) {
      const item = document.createElement('div');
      item.className = 'diplo-tech-item';
      item.textContent = this.formatTechName(tech);
      item.dataset.tech = tech;
      item.addEventListener('click', () => {
        listEl.querySelectorAll('.diplo-tech-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        this.selectedTech = tech;
        confirmBtn.disabled = false;
      });
      listEl.appendChild(item);
    }

    confirmBtn.onclick = () => {
      if (!this.selectedTech) return;
      const chosen = this.selectedTech;
      this.hideTechPanel();
      onConfirm(chosen);
    };

    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
  }

  private hideTechPanel(): void {
    const panel = document.getElementById('diplo-tech-select-panel');
    if (panel) panel.style.display = 'none';
    this.selectedTech = null;
    this.selectedCivId = null;
    const confirmBtn = document.getElementById('diplo-tech-confirm') as HTMLButtonElement | null;
    if (confirmBtn) confirmBtn.disabled = true;
  }

  /**
   * Show the civ-selection sub-panel (reuses the same HTML as the tech panel).
   * Lets the player pick from a list of Player objects instead of technologies.
   */
  private showCivSelectPanel(
    title: string,
    players: Player[],
    onConfirm: (player: Player) => void,
  ): void {
    const panel     = document.getElementById('diplo-tech-select-panel');
    const titleEl   = document.getElementById('diplo-tech-select-title');
    const listEl    = document.getElementById('diplo-tech-list');
    const confirmBtn = document.getElementById('diplo-tech-confirm') as HTMLButtonElement | null;

    if (!panel || !titleEl || !listEl || !confirmBtn) return;

    titleEl.textContent = title;
    listEl.innerHTML = '';
    this.selectedCivId = null;
    this.selectedTech = null;
    confirmBtn.disabled = true;

    for (const player of players) {
      const civ = getCivilization(player.civilizationType);
      const item = document.createElement('div');
      item.className = 'diplo-tech-item';
      item.textContent = civ?.name ?? player.name;
      item.dataset.civId = player.id;
      item.addEventListener('click', () => {
        listEl.querySelectorAll('.diplo-tech-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        this.selectedCivId = player.id;
        confirmBtn.disabled = false;
      });
      listEl.appendChild(item);
    }

    confirmBtn.onclick = () => {
      if (!this.selectedCivId) return;
      const chosen = players.find(p => p.id === this.selectedCivId);
      if (!chosen) return;
      this.hideTechPanel();
      onConfirm(chosen);
    };

    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
  }

  // ── Status bar ─────────────────────────────────────────────────────────────

  private showStatusBar(message: string, cssClass: string): void {
    const bar = document.getElementById('diplo-status-bar');
    if (!bar) return;
    bar.textContent = message;
    bar.className = `diplo-status-bar ${cssClass}`;
    bar.style.display = 'block';
  }

  private hideStatusBar(): void {
    const bar = document.getElementById('diplo-status-bar');
    if (bar) bar.style.display = 'none';
  }

  /**
   * Show an outcome message in the status bar, then replace all response
   * buttons with a single "Bid them farewell" button that resolves the dialog.
   * Use this for actions that complete in-dialog (tech trades, gifts, etc.) so
   * the player can continue the conversation or consciously close it.
   */
  private showOutcomeAndContinue(message: string, cssClass: string, outcome: DiplomacyOutcome): void {
    this.showStatusBar(message, cssClass);
    const list = document.getElementById('diplo-response-list');
    if (!list) {
      this.resolve(outcome);
      return;
    }
    list.innerHTML = '';
    const btn = this.createResponseButton({
      id: 'continue-after-outcome',
      icon: '👋',
      text: t('diplomacyDialog.ui.farewellAfterOutcome'),
      description: t('diplomacyDialog.ui.farewellAfterOutcomeDesc'),
      action: () => this.resolve(outcome),
    });
    list.appendChild(btn);
    (list.firstElementChild as HTMLElement | null)?.focus();
  }

  // ── DOM helpers ────────────────────────────────────────────────────────────

  private createResponseButton(opt: ResponseOption): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = `diplo-response-btn ${opt.cssClass ?? ''}`.trim();
    btn.id = `diplo-response-${opt.id}`;

    const iconEl = document.createElement('span');
    iconEl.className = 'diplo-response-icon';
    iconEl.textContent = opt.icon;

    const textWrap = document.createElement('span');
    textWrap.className = 'diplo-response-text';
    textWrap.textContent = opt.text;

    if (opt.description) {
      const descEl = document.createElement('span');
      descEl.className = 'diplo-response-desc';
      descEl.textContent = opt.description;
      textWrap.appendChild(descEl);
    }

    btn.appendChild(iconEl);
    btn.appendChild(textWrap);
    btn.addEventListener('click', opt.action);
    return btn;
  }

  private attachKeyboardHandler(): void {
    this.detachKeyboardHandler();
    this.dialogKeydownHandler = (e: KeyboardEvent) => {
      if (!this.dialog || this.dialog.style.display === 'none') return;

      // Swallow the event completely so nothing outside the dialog ever sees it
      e.stopImmediatePropagation();
      e.preventDefault();

      // Escape always dismisses the dialog, even within the 500 ms lockout window
      if (e.key === 'Escape') {
        this.dismiss();
        return;
      }

      // 500 ms lockout after opening to prevent accidental confirmation
      const elapsed = Date.now() - this.openTimestamp;
      if (elapsed < 500) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        const focused = document.activeElement as HTMLButtonElement | null;
        if (focused?.classList.contains('diplo-response-btn') && !focused.disabled) {
          focused.click();
        }
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const buttons = Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            '#diplo-response-list .diplo-response-btn:not([disabled])'
          )
        );
        if (buttons.length === 0) return;
        const currentIdx = buttons.indexOf(document.activeElement as HTMLButtonElement);
        let nextIdx: number;
        if (e.key === 'ArrowDown') {
          nextIdx = currentIdx < 0 ? 0 : Math.min(currentIdx + 1, buttons.length - 1);
        } else {
          nextIdx = currentIdx < 0 ? buttons.length - 1 : Math.max(currentIdx - 1, 0);
        }
        buttons[nextIdx]?.focus();
      }
    };
    document.addEventListener('keydown', this.dialogKeydownHandler, true);
  }

  private detachKeyboardHandler(): void {
    if (this.dialogKeydownHandler) {
      document.removeEventListener('keydown', this.dialogKeydownHandler, true);
      this.dialogKeydownHandler = null;
    }
  }

  private showDialog(): void {
    if (!this.dialog) return;
    this.openTimestamp = Date.now();
    this.dialog.style.display = 'flex';
    this.attachKeyboardHandler();
    // Focus the first response button after the DOM has settled
    setTimeout(() => {
      const firstBtn = this.dialog?.querySelector<HTMLButtonElement>(
        '#diplo-response-list .diplo-response-btn:not([disabled])'
      );
      firstBtn?.focus();
    }, 50);
  }

  private hideDialog(): void {
    if (!this.dialog) return;
    this.stopFaceAnimation();
    this.dialog.style.display = 'none';
    this.detachKeyboardHandler();
  }

  /**
   * Start cycling face cells for the given civ + mood.
   * Cycles through the mood's row of face cells at mood-appropriate speed,
   * creating a "speaking" animation effect.
   */
  private startFaceAnimation(civType: Player['civilizationType'], mood: AIMood): void {
    this.stopFaceAnimation();
    const faceEl = document.getElementById('diplo-face-cell') as HTMLElement | null;
    if (!faceEl) return;

    const anim = DiplomacyDialog.FACE_ANIM[mood];
    const scale = 1.5; // 59×1.5≈89px wide × 49×1.5≈74px tall — compact inset expression panel
    let frameIdx = 0;

    const tick = () => {
      const col = anim.cols[frameIdx % anim.cols.length];
      applySpriteStyle(faceEl, getFaceStyle(civType, anim.row, col, scale));
      frameIdx++;
    };

    tick(); // show first frame immediately without waiting for first interval
    this.faceCellAnimInterval = window.setInterval(tick, anim.intervalMs);
  }

  private stopFaceAnimation(): void {
    if (this.faceCellAnimInterval !== null) {
      window.clearInterval(this.faceCellAnimInterval);
      this.faceCellAnimInterval = null;
    }
  }

  private dismiss(): void {
    this.resolve({ accepted: false, war: false, peace: false });
  }

  private resolve(outcome: DiplomacyOutcome): void {
    this.hideDialog();
    this.hideTechPanel();
    this.hideStatusBar();
    if (this.currentResolve) {
      const cb = this.currentResolve;
      this.currentResolve = null;
      cb(outcome);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private computeIsAIStronger(aiPlayer: Player, humanPlayer: Player, gameState: GameState): boolean {
    const aiCities = gameState.cities.filter(c => c.playerId === aiPlayer.id).length;
    const humanCities = gameState.cities.filter(c => c.playerId === humanPlayer.id).length;
    const aiUnits = gameState.units.filter(u => u.playerId === aiPlayer.id).length;
    const humanUnits = gameState.units.filter(u => u.playerId === humanPlayer.id).length;
    const aiScore = aiCities * 3 + aiUnits + (aiPlayer.gold ?? 0) / 50;
    const humanScore = humanCities * 3 + humanUnits + (humanPlayer.gold ?? 0) / 50;
    return aiScore > humanScore * 1.1;
  }

  /**
   * Returns the leader's name with a government-appropriate title.
   *   Despotism  → "[name] the Warlord"
   *   Anarchy    → "[name] the Revolutionary"
   *   Monarchy   → "King/Queen [name]"
   *   Communism  → "Chairman [name]"
   *   Republic   → "Consul [name]" (ancient/BC) or "President [name]" (modern/AD)
   *   Democracy  → "President [name]" (American) or "Prime Minister [name]"
   */
  private getLeaderTitle(aiPlayer: Player, gameState: GameState): string {
    const civ = getCivilization(aiPlayer.civilizationType);
    const name = civ?.leader ?? '';

    // Determine if the leader is historically female for the Monarchy title
    const femaleLeaders = new Set(['elizabeth i', 'cleopatra']);
    const isFemale = femaleLeaders.has(name.toLowerCase());

    switch (aiPlayer.government) {
      case GovernmentType.DESPOTISM:
        return t('diplomacyDialog.ui.titleWarlord', { name });

      case GovernmentType.ANARCHY:
        return t('diplomacyDialog.ui.titleRevolutionary', { name });

      case GovernmentType.MONARCHY:
        return isFemale
          ? t('diplomacyDialog.ui.titleQueen', { name })
          : t('diplomacyDialog.ui.titleKing', { name });

      case GovernmentType.COMMUNISM:
        return t('diplomacyDialog.ui.titleChairman', { name });

      case GovernmentType.REPUBLIC: {
        // GameTime.calculateYear returns positive for BC, negative for AD
        const year = GameTime.calculateYear(gameState.turn);
        return year > 0
          ? t('diplomacyDialog.ui.titleConsul', { name })
          : t('diplomacyDialog.ui.titlePresident', { name });
      }

      case GovernmentType.DEMOCRACY: {
        const isAmerican = (aiPlayer.civilizationType as string) === CivilizationType.AMERICAN;
        return isAmerican
          ? t('diplomacyDialog.ui.titlePresident', { name })
          : t('diplomacyDialog.ui.titlePrimeMinister', { name });
      }

      default:
        return name;
    }
  }

  private formatTechName(tech: TechnologyType): string {
    return getTechnology(tech).name;
  }
}
