import type { CivilizationType, DifficultyLevel } from '../types/game';
import type { FinalScoreResult, VictoryOutcome } from './CivilizationScore';

export const HALL_OF_FAME_MAX_ENTRIES = 5;
const STORAGE_KEY = 'civwin-hall-of-fame';

export interface HallOfFameEntry {
  id: string;
  civilizationType: CivilizationType | string;
  leaderName: string;
  ranking: number;
  baseScore: number;
  difficulty: DifficultyLevel;
  totalCivs: number;
  outcome: VictoryOutcome;
  turn: number;
  yearLabel: string;
  recordedAt: number;
}

export interface HallOfFameAddResult {
  added: boolean;
  position: number | null;
  entries: HallOfFameEntry[];
}

function loadRaw(): HallOfFameEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as HallOfFameEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRaw(entries: HallOfFameEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Failed to save Hall of Fame:', e);
  }
}

export function getHallOfFameEntries(): HallOfFameEntry[] {
  return loadRaw()
    .sort((a, b) => b.ranking - a.ranking)
    .slice(0, HALL_OF_FAME_MAX_ENTRIES);
}

export function clearHallOfFame(): void {
  saveRaw([]);
}

export function qualifiesForHallOfFame(ranking: number, entries: HallOfFameEntry[]): boolean {
  if (entries.length < HALL_OF_FAME_MAX_ENTRIES) return true;
  const lowest = entries[entries.length - 1];
  return ranking > lowest.ranking;
}

export function addHallOfFameEntry(params: {
  civilizationType: CivilizationType | string;
  leaderName: string;
  score: FinalScoreResult;
  difficulty: DifficultyLevel;
  totalCivs: number;
}): HallOfFameAddResult {
  const entries = getHallOfFameEntries();
  const entry: HallOfFameEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    civilizationType: params.civilizationType,
    leaderName: params.leaderName,
    ranking: params.score.ranking,
    baseScore: params.score.baseScore,
    difficulty: params.difficulty,
    totalCivs: params.totalCivs,
    outcome: params.score.outcome,
    turn: params.score.turn,
    yearLabel: params.score.yearLabel,
    recordedAt: Date.now(),
  };

  if (!qualifiesForHallOfFame(entry.ranking, entries)) {
    return { added: false, position: null, entries };
  }

  const merged = [...entries, entry].sort((a, b) => b.ranking - a.ranking).slice(0, HALL_OF_FAME_MAX_ENTRIES);
  saveRaw(merged);
  const position = merged.findIndex(e => e.id === entry.id);
  return {
    added: position >= 0,
    position: position >= 0 ? position + 1 : null,
    entries: merged,
  };
}

/** Replace in-memory list for tests. */
export function setHallOfFameEntriesForTest(entries: HallOfFameEntry[]): void {
  saveRaw(entries);
}
