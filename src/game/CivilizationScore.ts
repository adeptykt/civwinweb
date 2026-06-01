import type { City, DifficultyLevel, GameState, Player } from '../types/game';
import { TechnologyType } from './TechnologyDefinitions';
import { countPlayerPollutionTiles } from './PollutionSystem';
import { getDifficultyParams } from './DifficultyConfig';
import { GameTime } from '../utils/GameTime';
import type { DiplomacyManager } from './DiplomacyManager';

export type VictoryOutcome = 'conquest' | 'retire' | 'space';

export interface ScoreBreakdown {
  happyCitizens: number;
  contentCitizens: number;
  wonders: number;
  peaceTurns: number;
  futuristicAdvances: number;
  pollutionTiles: number;
  conquestBonus: number;
  baseScore: number;
  difficultyMultiplier: number;
  competitionFactor: number;
  ranking: number;
}

export interface FinalScoreResult extends ScoreBreakdown {
  outcome: VictoryOutcome;
  turn: number;
  year: number;
  yearLabel: string;
}

function humanPlayer(gameState: GameState): Player | undefined {
  return gameState.players.find(p => p.isHuman && !p.defeated);
}

function humanCities(gameState: GameState, playerId: string): City[] {
  return gameState.cities.filter(c => c.playerId === playerId);
}

/**
 * Count distinct wonders owned across a player's cities.
 * Wonders may live in `city.wonders` and/or `city.buildings` as `wonder_*` (TurnManager).
 */
export function countPlayerWonders(cities: City[]): number {
  const wonderIds = new Set<string>();
  for (const city of cities) {
    for (const w of city.wonders ?? []) {
      wonderIds.add(String(w.type));
    }
    for (const b of city.buildings ?? []) {
      const raw = String(b.type);
      if (raw.startsWith('wonder_')) {
        wonderIds.add(raw.slice('wonder_'.length));
      }
    }
  }
  return wonderIds.size;
}

function countFuturisticAdvances(player: Player): number {
  return player.technologies.filter(t => t === TechnologyType.FUTURE_TECH).length;
}

/** Civ I–style date bonus for early conquest (BC years score higher). */
export function conquestDateBonus(turn: number): number {
  const year = GameTime.calculateYear(turn);
  if (year > 0) {
    return Math.min(500, Math.floor(year / 4));
  }
  const adYear = year === 0 ? 1 : Math.abs(year);
  return Math.max(0, 500 - adYear * 2);
}

export function formatGameYear(turn: number): string {
  const year = GameTime.calculateYear(turn);
  if (year > 0) return `${year} BC`;
  if (year === 0) return '1 AD';
  return `${Math.abs(year)} AD`;
}

export function calculateBaseScore(
  gameState: GameState,
  player: Player,
  options?: { conquestBonus?: number },
): Omit<ScoreBreakdown, 'difficultyMultiplier' | 'competitionFactor' | 'ranking'> {
  const cities = humanCities(gameState, player.id);
  let happy = 0;
  let content = 0;
  for (const city of cities) {
    happy += city.happyCitizens ?? 0;
    content += city.contentCitizens ?? 0;
  }

  const wonders = countPlayerWonders(cities);
  const peaceTurns = gameState.cumulativePeaceTurns ?? 0;
  const futuristicAdvances = countFuturisticAdvances(player);
  const pollutionTiles = countPlayerPollutionTiles(gameState, player.id);

  const conquestBonus = options?.conquestBonus ?? 0;
  const baseScore =
    happy * 2 +
    content * 1 +
    wonders * 20 +
    peaceTurns * 3 +
    futuristicAdvances * 10 +
    pollutionTiles * -10 +
    conquestBonus;

  return {
    happyCitizens: happy,
    contentCitizens: content,
    wonders,
    peaceTurns,
    futuristicAdvances,
    pollutionTiles,
    conquestBonus,
    baseScore,
  };
}

export function calculateRanking(
  baseScore: number,
  difficulty: DifficultyLevel,
  totalCivs: number,
): Pick<ScoreBreakdown, 'difficultyMultiplier' | 'competitionFactor' | 'ranking'> {
  const difficultyMultiplier = getDifficultyParams(difficulty).scoreMultiplier;
  const competitionFactor = Math.max(2, totalCivs);
  const ranking = Math.round(baseScore * difficultyMultiplier * competitionFactor);
  return { difficultyMultiplier, competitionFactor, ranking };
}

export function calculateLiveScore(gameState: GameState): number {
  const human = humanPlayer(gameState);
  if (!human) return gameState.score;
  const base = calculateBaseScore(gameState, human);
  const { ranking } = calculateRanking(
    base.baseScore,
    gameState.difficulty,
    gameState.totalCivs ?? gameState.players.filter(p => !p.isBarbarian).length,
  );
  return ranking;
}

export function calculateFinalRetireScore(
  gameState: GameState,
  diplomacyManager: DiplomacyManager,
): FinalScoreResult | null {
  const human = humanPlayer(gameState);
  if (!human) return null;

  const basePart = calculateBaseScore(gameState, human);
  const mult = calculateRanking(
    basePart.baseScore,
    gameState.difficulty,
    gameState.totalCivs ?? gameState.players.filter(p => !p.isBarbarian).length,
  );

  void diplomacyManager;

  return {
    outcome: 'retire',
    turn: gameState.turn,
    year: GameTime.calculateYear(gameState.turn),
    yearLabel: formatGameYear(gameState.turn),
    ...basePart,
    ...mult,
  };
}

export function calculateFinalConquestScore(
  gameState: GameState,
  diplomacyManager: DiplomacyManager,
): FinalScoreResult | null {
  const human = humanPlayer(gameState);
  if (!human) return null;

  const dateBonus = conquestDateBonus(gameState.turn);
  const conquestBonus = 1000 + dateBonus;
  const basePart = calculateBaseScore(gameState, human, { conquestBonus });
  const mult = calculateRanking(
    basePart.baseScore,
    gameState.difficulty,
    gameState.totalCivs ?? gameState.players.filter(p => !p.isBarbarian).length,
  );

  void diplomacyManager;

  return {
    outcome: 'conquest',
    turn: gameState.turn,
    year: GameTime.calculateYear(gameState.turn),
    yearLabel: formatGameYear(gameState.turn),
    ...basePart,
    ...mult,
  };
}

export function calculateFinalSpaceScore(
  gameState: GameState,
  diplomacyManager: DiplomacyManager,
  successPercent: number,
): FinalScoreResult | null {
  const human = humanPlayer(gameState);
  if (!human) return null;

  const colonistBonus = 50 + Math.floor(10000 * (successPercent / 100));
  const basePart = calculateBaseScore(gameState, human, { conquestBonus: colonistBonus });
  const mult = calculateRanking(
    basePart.baseScore,
    gameState.difficulty,
    gameState.totalCivs ?? gameState.players.filter(p => !p.isBarbarian).length,
  );

  void diplomacyManager;

  return {
    outcome: 'space',
    turn: gameState.turn,
    year: GameTime.calculateYear(gameState.turn),
    yearLabel: formatGameYear(gameState.turn),
    ...basePart,
    ...mult,
  };
}

export function isWorldAtPeace(
  gameState: GameState,
  diplomacyManager: DiplomacyManager,
): boolean {
  const civs = gameState.players.filter(p => !p.defeated && !(p as Player & { isBarbarian?: boolean }).isBarbarian);
  for (let i = 0; i < civs.length; i++) {
    for (let j = i + 1; j < civs.length; j++) {
      if (diplomacyManager.isAtWar(civs[i].id, civs[j].id)) return false;
    }
  }
  return civs.length >= 2;
}
