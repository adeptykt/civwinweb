import { Player, GovernmentType } from '../types/game';
import { getCivilization, CivilizationType } from './CivilizationDefinitions';
import { TechnologyType } from './TechnologyDefinitions';

export enum DiplomaticStatus {
  UNCONTACTED = 'uncontacted',
  NEUTRAL = 'neutral', // Contacted, but no official treaty
  PEACE = 'peace',
  WAR = 'war'
}

export interface DiplomaticRelationship {
  player1Id: string;
  player2Id: string;
  status: DiplomaticStatus;
  hasEmbassyPlayer1: boolean; // Does Player 1 have an embassy with Player 2?
  hasEmbassyPlayer2: boolean; // Does Player 2 have an embassy with Player 1?
  peaceTreaty?: boolean;          // Active peace treaty
  peaceTreatyTurn?: number;       // Turn when peace was signed
  treatsBreached?: number;        // How many times peace was broken
  lastContactTurn?: number;       // Last time diplomacy occurred
}

export enum AIMood {
  CORDIAL = 'cordial',
  CAUTIOUS = 'cautious',
  AMIABLE = 'amiable',
  HOSTILE = 'hostile',
  AGGRESSIVE = 'aggressive',
  DEMANDING = 'demanding',
  FEARFUL = 'fearful',    // Weak AI, begging for mercy
  NEUTRAL = 'neutral'
}

/** What the AI/player is proposing in the diplomacy session */
export enum DiplomacyProposal {
  // AI→Player proposals
  DEMAND_TRIBUTE_GOLD = 'demand_tribute_gold',
  DEMAND_TRIBUTE_TECH = 'demand_tribute_tech',
  OFFER_PEACE = 'offer_peace',
  OFFER_TECH_TRADE = 'offer_tech_trade',
  DECLARE_WAR = 'declare_war',
  ASK_ALLY_VS = 'ask_ally_vs',       // Ask player to declare war on a third civ
  WITHDRAW_UNITS = 'withdraw_units', // "Withdraw your units or else!"
  // Greetings
  AI_GREET = 'ai_greet',             // AI first-contact greeting
  PLAYER_GREET = 'player_greet'      // Player opens the conversation
}

/** Context object passed when opening the diplomacy dialog */
export interface DiplomacyContact {
  initiatorId: string;   // Who is speaking first
  receiverId: string;    // Who is listening
  proposal: DiplomacyProposal;
  demandGold?: number;                     // For tribute demands
  demandTech?: TechnologyType;             // For tech tribute demands
  offeredTech?: TechnologyType;            // For tech trades
  targetCivId?: string;                    // For "ask ally to attack X"
  turn: number;
}

/** Outcome of a diplomacy session (returned from dialog) */
export interface DiplomacyOutcome {
  accepted: boolean;
  war: boolean;
  peace: boolean;
  techGiven?: TechnologyType;
  techReceived?: TechnologyType;
  goldPaid?: number;
  targetDeclaredWar?: string;   // Id of civ player agreed to attack
}

export class DiplomacyManager {
  private relationships: Map<string, DiplomaticRelationship> = new Map();
  /** Global reputation (0-100). Sneak attacks, broken treaties lower it. */
  private globalReputation: Map<string, number> = new Map();
  /** Turn-throttle: don't contact same pair more than once per N turns */
  private lastContactTurn: Map<string, number> = new Map();
  /** Minimum turns between contacts once communication is established */
  private static readonly CONTACT_COOLDOWN = 15;

  constructor() {}

  // ── Relationship helpers ───────────────────────────────────────────────────

  public getRelationshipKey(player1Id: string, player2Id: string): string {
    const ids = [player1Id, player2Id].sort();
    return `${ids[0]}-${ids[1]}`;
  }

  public getRelationship(player1Id: string, player2Id: string): DiplomaticRelationship {
    const key = this.getRelationshipKey(player1Id, player2Id);
    let rel = this.relationships.get(key);
    if (!rel) {
      rel = {
        player1Id: [player1Id, player2Id].sort()[0],
        player2Id: [player1Id, player2Id].sort()[1],
        status: DiplomaticStatus.UNCONTACTED,
        hasEmbassyPlayer1: false,
        hasEmbassyPlayer2: false
      };
      this.relationships.set(key, rel);
    }
    return rel;
  }

  public updateStatus(player1Id: string, player2Id: string, status: DiplomaticStatus): void {
    const rel = this.getRelationship(player1Id, player2Id);
    rel.status = status;
    if (status === DiplomaticStatus.PEACE) {
      rel.peaceTreaty = true;
    } else if (status === DiplomaticStatus.WAR) {
      if (rel.peaceTreaty) {
        // Breaking peace damages reputation
        rel.peaceTreaty = false;
        rel.treatsBreached = (rel.treatsBreached ?? 0) + 1;
      }
    }
  }

  public isAtWar(p1: string, p2: string): boolean {
    return this.getRelationship(p1, p2).status === DiplomaticStatus.WAR;
  }

  public isAtPeace(p1: string, p2: string): boolean {
    const s = this.getRelationship(p1, p2).status;
    return s === DiplomaticStatus.PEACE || s === DiplomaticStatus.NEUTRAL;
  }

  public hasEmbassy(ownerId: string, targetId: string): boolean {
    const rel = this.getRelationship(ownerId, targetId);
    const sorted = [ownerId, targetId].sort();
    return ownerId === sorted[0] ? rel.hasEmbassyPlayer1 : rel.hasEmbassyPlayer2;
  }

  public establishEmbassy(ownerId: string, targetId: string): void {
    const rel = this.getRelationship(ownerId, targetId);
    const sorted = [ownerId, targetId].sort();
    if (ownerId === sorted[0]) rel.hasEmbassyPlayer1 = true;
    else rel.hasEmbassyPlayer2 = true;
  }

  // ── Reputation ─────────────────────────────────────────────────────────────

  public getReputation(playerId: string): number {
    return this.globalReputation.get(playerId) ?? 100;
  }

  public modifyReputation(playerId: string, amount: number): void {
    const current = this.getReputation(playerId);
    this.globalReputation.set(playerId, Math.max(0, Math.min(100, current + amount)));
  }

  // ── Threat & personality ───────────────────────────────────────────────────

  /**
   * Determine the base threat level of an AI player (0 to 6)
   */
  public getThreatLevel(player: Player): number {
    const civ = getCivilization(player.civilizationType);
    if (!civ) return 3;
    switch (civ.id as CivilizationType) {
      case CivilizationType.BABYLONIAN: return 0;
      case CivilizationType.AMERICAN:
      case CivilizationType.AZTECS:
      case CivilizationType.INDIAN:   return 1;
      case CivilizationType.CHINESE:
      case CivilizationType.GERMAN:
      case CivilizationType.EGYPTIAN: return 2;
      case CivilizationType.ROMANS:   return 3;
      case CivilizationType.ENGLISH:
      case CivilizationType.FRENCH:
      case CivilizationType.ZULU:     return 4;
      case CivilizationType.RUSSIAN:
      case CivilizationType.GREEKS:   return 5;
      case CivilizationType.MONGOL:   return 6;
      default: return 3;
    }
  }

  /**
   * Nuclear Gandhi: if India has democracy & is in modern era, aggression flips to max.
   */
  public getEffectiveThreatLevel(player: Player, currentTurn: number): number {
    let threat = this.getThreatLevel(player);
    const civ = getCivilization(player.civilizationType);
    if (
      civ?.id === CivilizationType.INDIAN &&
      player.government === GovernmentType.DEMOCRACY &&
      currentTurn >= 150
    ) {
      threat = 6; // Nuclear Gandhi
    }
    return threat;
  }

  // ── Senate mechanics ───────────────────────────────────────────────────────

  public doesSenateForcePeace(player: Player): boolean {
    return player.government === GovernmentType.REPUBLIC || player.government === GovernmentType.DEMOCRACY;
  }

  public doesSenateBlockSneakAttack(player: Player): boolean {
    return player.government === GovernmentType.REPUBLIC || player.government === GovernmentType.DEMOCRACY;
  }

  // ── Mood calculation ───────────────────────────────────────────────────────

  /**
   * Calculate AI mood towards the human player.
   * Considers personality, power balance, reputation, and broken treaties.
   */
  public calculateAIMood(
    aiPlayer: Player,
    humanPlayer: Player,
    isAIStronger: boolean,
    currentTurn: number,
  ): AIMood {
    const civ = getCivilization(aiPlayer.civilizationType);
    const aggLevel = civ?.aiTraits.aggression ?? 'normal';
    const threatLevel = this.getEffectiveThreatLevel(aiPlayer, currentTurn);
    const rel = this.getRelationship(aiPlayer.id, humanPlayer.id);
    const treachery = rel.treatsBreached ?? 0;
    const humanReputation = this.getReputation(humanPlayer.id);

    // Reputation penalty: if human has broken treaties before, mood is harsher
    const repPenalty = humanReputation < 50 ? 1 : 0;

    // AI city count as proxy for "weak / on extinction path"
    // (In the absence of city counts here, use gold as proxy)
    const aiIsWeak = aiPlayer.gold < 20;

    if (aiIsWeak) return AIMood.FEARFUL;

    if (isAIStronger) {
      const effective = threatLevel + treachery + repPenalty;
      if (effective >= 5) return AIMood.AGGRESSIVE;
      if (effective >= 3) return AIMood.DEMANDING;
      return AIMood.HOSTILE;
    }

    // AI is weaker
    if (aggLevel === 'friendly') return AIMood.AMIABLE;
    if (aggLevel === 'aggressive') return threatLevel >= 5 ? AIMood.HOSTILE : AIMood.CAUTIOUS;
    return AIMood.CAUTIOUS;
  }

  // ── AI contact decision ────────────────────────────────────────────────────

  /**
   * Decide if the AI should initiate diplomacy this turn, and what they propose.
   * Returns null if no contact should happen.
   */
  public buildAIContact(
    aiPlayer: Player,
    humanPlayer: Player,
    isAIStronger: boolean,
    currentTurn: number,
    humanTechs: TechnologyType[],
    aiTechs: TechnologyType[],
    hasAdjacentUnits: boolean,
  ): DiplomacyContact | null {
    const key = this.getRelationshipKey(aiPlayer.id, humanPlayer.id);
    const rel = this.getRelationship(aiPlayer.id, humanPlayer.id);
    const alreadyContacted = rel.status !== DiplomaticStatus.UNCONTACTED;

    // Civ1 rule: AI only contacts the player when their units are adjacent
    // (first meeting) or when communication has already been established.
    if (!hasAdjacentUnits && !alreadyContacted) return null;

    // Always greet on first contact, regardless of mood or tech state.
    if (!alreadyContacted) {
      this.lastContactTurn.set(key, currentTurn);
      rel.status = DiplomaticStatus.NEUTRAL;
      return {
        initiatorId: aiPlayer.id,
        receiverId: humanPlayer.id,
        proposal: DiplomacyProposal.AI_GREET,
        turn: currentTurn,
      };
    }

    const last = this.lastContactTurn.get(key) ?? -999;
    if (currentTurn - last < DiplomacyManager.CONTACT_COOLDOWN) return null;

    const mood = this.calculateAIMood(aiPlayer, humanPlayer, isAIStronger, currentTurn);
    const atWar = rel.status === DiplomaticStatus.WAR;
    const threatLevel = this.getEffectiveThreatLevel(aiPlayer, currentTurn);

    // Techs human has that AI wants
    const techsHumanHasAIDoes = humanTechs.filter(t => !aiTechs.includes(t));
    // Techs AI can trade (AI has, human doesn't)
    const techsAICanOffer = aiTechs.filter(t => !humanTechs.includes(t));

    let proposal: DiplomacyProposal;
    let demandGold: number | undefined;
    let demandTech: TechnologyType | undefined;
    let offeredTech: TechnologyType | undefined;

    if (atWar) {
      // At war: AI might offer peace if weak, or do nothing (combat continues)
      if (mood === AIMood.FEARFUL) {
        proposal = DiplomacyProposal.OFFER_PEACE;
      } else {
        return null; // AI continues war, no dialog
      }
    } else if (mood === AIMood.AGGRESSIVE || mood === AIMood.DEMANDING) {
      // Demand tribute
      if (techsHumanHasAIDoes.length > 0 && Math.random() < 0.5) {
        proposal = DiplomacyProposal.DEMAND_TRIBUTE_TECH;
        demandTech = techsHumanHasAIDoes[Math.floor(Math.random() * techsHumanHasAIDoes.length)];
      } else {
        proposal = DiplomacyProposal.DEMAND_TRIBUTE_GOLD;
        // Demand 50–200 gold based on threat level
        demandGold = (2 + threatLevel) * 25 + Math.floor(Math.random() * 50);
      }
    } else if ((mood === AIMood.CAUTIOUS || mood === AIMood.AMIABLE) && techsAICanOffer.length > 0 && techsHumanHasAIDoes.length > 0) {
      // Offer tech trade
      proposal = DiplomacyProposal.OFFER_TECH_TRADE;
      offeredTech = techsAICanOffer[Math.floor(Math.random() * techsAICanOffer.length)];
    } else if (mood === AIMood.AMIABLE && rel.status === DiplomaticStatus.NEUTRAL) {
      // Friendly greeting / propose peace
      proposal = DiplomacyProposal.OFFER_PEACE;
    } else {
      return null; // No interesting contact this turn
    }

    this.lastContactTurn.set(key, currentTurn);

    return {
      initiatorId: aiPlayer.id,
      receiverId: humanPlayer.id,
      proposal,
      demandGold,
      demandTech,
      offeredTech,
      turn: currentTurn,
    };
  }

  // ── Apply outcomes ─────────────────────────────────────────────────────────

  /**
   * Apply the result of a diplomacy dialog to game state.
   */
  public applyOutcome(
    contact: DiplomacyContact,
    outcome: DiplomacyOutcome,
  ): void {
    const { initiatorId, receiverId } = contact;

    if (outcome.war) {
      this.updateStatus(initiatorId, receiverId, DiplomaticStatus.WAR);
      // Breaking peace damages human reputation
      if (contact.initiatorId !== initiatorId) {
        this.modifyReputation(receiverId, -20);
      }
    } else if (outcome.peace) {
      const rel = this.getRelationship(initiatorId, receiverId);
      rel.status = DiplomaticStatus.PEACE;
      rel.peaceTreaty = true;
    }
  }

  // ── Dialogue text helpers ──────────────────────────────────────────────────

  /** Produce the leader's opening line based on mood and proposal. */
  public getLeaderSpeech(
    aiPlayer: Player,
    mood: AIMood,
    proposal: DiplomacyProposal,
    demandGold?: number,
    demandTech?: string,
    offeredTech?: string,
    targetCivName?: string,
  ): string {
    const civ = getCivilization(aiPlayer.civilizationType);
    const leader = civ?.leader ?? 'The Leader';

    switch (proposal) {
      case DiplomacyProposal.DEMAND_TRIBUTE_GOLD:
        if (mood === AIMood.AGGRESSIVE)
          return `Your empire is beneath mine. Pay ${demandGold} gold as tribute, or face total annihilation!`;
        return `We require ${demandGold} gold from your treasury to maintain... goodwill between our peoples.`;
      case DiplomacyProposal.DEMAND_TRIBUTE_TECH:
        if (mood === AIMood.AGGRESSIVE)
          return `You possess knowledge of ${demandTech ?? 'a technology'} that belongs to us. Hand it over — or declare war!`;
        return `In the interest of shared prosperity, we would ask you to share your knowledge of ${demandTech ?? 'technology'} with us.`;
      case DiplomacyProposal.OFFER_PEACE:
        if (mood === AIMood.FEARFUL)
          return `${leader} approaches humbly. Our people beg for peace! We shall offer anything to end this war.`;
        return `The time has come for our civilizations to lay down arms and forge a lasting peace.`;
      case DiplomacyProposal.OFFER_TECH_TRADE:
        return `We offer knowledge of ${offeredTech ?? 'a technology'} in exchange for whatever wisdom your scholars possess. Shall we trade?`;
      case DiplomacyProposal.DECLARE_WAR:
        if (mood === AIMood.AGGRESSIVE)
          return `${leader} slams a fist on the table. Your time is up! The ${civ?.name ?? 'our civilization'} hereby declares WAR upon your pathetic empire. Prepare to be crushed!`;
        if (mood === AIMood.DEMANDING)
          return `${leader} rises slowly. You have tested our patience for the last time. The ${civ?.name ?? 'our civilization'} is now at WAR with your people.`;
        return `${leader} delivers the message coldly. The ${civ?.name ?? 'our civilization'} considers your civilization an enemy. We are at WAR.`;
      case DiplomacyProposal.WITHDRAW_UNITS:
        return `Your military forces approach our borders uninvited. Withdraw them immediately, or we shall consider it an act of war!`;
      case DiplomacyProposal.ASK_ALLY_VS:
        return `Our mutual interests would be served by crushing the ${targetCivName ?? 'enemy'}. Join us in declaring war upon them, and we shall reward your loyalty handsomely.`;
      case DiplomacyProposal.AI_GREET:
        if (mood === AIMood.AMIABLE)
          return `Greetings! I am ${leader} of the ${civ?.name ?? 'unknown civilization'}. Our scouts report your people nearby. We hope for a long and prosperous friendship!`;
        if (mood === AIMood.HOSTILE || mood === AIMood.AGGRESSIVE)
          return `${leader} scowls as your envoy approaches. So... your kind finally shows itself. State your business — and make it quick.`;
        if (mood === AIMood.CAUTIOUS)
          return `${leader} studies you carefully. Our peoples have not met before. Speak — what do you seek from the ${civ?.name ?? 'unknown civilization'}?`;
        return `${leader} raises a hand in greeting. We have discovered one another at last. What say you — shall we be friends or enemies?`;
      case DiplomacyProposal.PLAYER_GREET:
        if (mood === AIMood.AMIABLE)
          return `Greetings from ${civ?.name ?? 'our civilization'}! We look forward to a prosperous relationship between our peoples.`;
        if (mood === AIMood.HOSTILE)
          return `${leader} eyes you with suspicion. What brings your emissary to our palace?`;
        return `${leader} receives your envoy. State your purpose.`;
      default:
        return `${leader} awaits your response.`;
    }
  }

  /** Get mood description text shown in the dialog. */
  public getMoodDescription(mood: AIMood): string {
    switch (mood) {
      case AIMood.AMIABLE:   return '😊 The leader is in good spirits and welcomes your presence.';
      case AIMood.CORDIAL:   return '🤝 The leader is cordial and open to discussion.';
      case AIMood.CAUTIOUS:  return '😐 The leader is cautious but willing to talk.';
      case AIMood.NEUTRAL:   return '😶 The leader is impassive and hard to read.';
      case AIMood.HOSTILE:   return '😤 The leader is visibly irritated by your arrival.';
      case AIMood.DEMANDING: return '😠 The leader leans forward aggressively, making demands.';
      case AIMood.AGGRESSIVE: return '👿 The leader is furious and barely restraining open hostility!';
      case AIMood.FEARFUL:   return '😨 The leader is pale and trembling, clearly frightened of your power.';
    }
  }

  /** Get the flag/color swatch emoji for a civ */
  public getCivEmoji(civId: string): string {
    const emojiMap: Record<string, string> = {
      [CivilizationType.ROMANS]:     '🦅',
      [CivilizationType.AMERICAN]:   '🦅',
      [CivilizationType.AZTECS]:     '🐍',
      [CivilizationType.BABYLONIAN]: '🏛️',
      [CivilizationType.CHINESE]:    '🐉',
      [CivilizationType.EGYPTIAN]:   '🔺',
      [CivilizationType.ENGLISH]:    '👑',
      [CivilizationType.FRENCH]:     '⚜️',
      [CivilizationType.GERMAN]:     '⚙️',
      [CivilizationType.GREEKS]:     '🏺',
      [CivilizationType.INDIAN]:     '🪷',
      [CivilizationType.MONGOL]:     '🐎',
      [CivilizationType.RUSSIAN]:    '🐻',
      [CivilizationType.ZULU]:       '🛡️',
    };
    return emojiMap[civId] ?? '👤';
  }
}
