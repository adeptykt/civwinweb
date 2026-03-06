/**
 * DifficultyConfig – Civ 1-style difficulty parameters.
 *
 * All gameplay difficulty scaling lives here so every system (research, production,
 * growth, happiness, scoring) reads from a single source of truth.
 */

import type { DifficultyLevel } from '../types/game';

export type { DifficultyLevel };

export interface DifficultyParams {
  // ── Human penalties ──────────────────────────────────────────────────────
  /**
   * Number of citizens that start as "content" in a new city.
   * Citizens beyond this count are born unhappy and require temples,
   * entertainers, garrisons, or luxuries to pacify.
   *
   * Chieftain=6, Warlord=5, Prince=4, King=3, Emperor=2
   */
  contentCitizensBase: number;

  /**
   * Multiplier applied to every research cost.
   * >1 means the human must spend more science per technology.
   * Chieftain=0.75 (faster research), Emperor=1.5 (slower research)
   */
  researchCostMultiplier: number;

  /**
   * Minimum turns before barbarians may begin spawning.
   * 0 = barbarians can appear from turn 1 (Emperor).
   */
  barbarianGraceTurns: number;

  // ── AI advantages ────────────────────────────────────────────────────────
  /**
   * AI shield (production) output multiplier.
   * 2.0 ≈ "50% discount" — AI city needs half the real production turns.
   * Chieftain=1.0 (no bonus), Emperor=2.0
   */
  aiProductionMultiplier: number;

  /**
   * Fraction of the normal food-storage capacity required for AI cities to grow.
   * Lower values mean faster AI growth.
   * Chieftain=1.0 (normal speed), Emperor=0.4 (grows 2.5× faster)
   */
  aiFoodStorageMultiplier: number;

  /**
   * Extra "content" citizens added to AI cities beyond the normal happy/content pool.
   * Simulates AI happiness immunity at higher levels.
   * Chieftain=0, Emperor=4
   */
  aiHappinessBonus: number;

  // ── Scoring ──────────────────────────────────────────────────────────────
  /**
   * Multiplier applied to the AI's desired settler count.
   * Lower values mean the AI founds fewer cities and expands more slowly.
   * Chieftain=0.5 (half as many settlers), Emperor=1.2 (slightly more)
   */
  aiSettlerMultiplier: number;

  /**
   * Multiplier applied to the AI's desired military unit count.
   * Lower values mean the AI maintains a smaller standing army.
   * Chieftain=0.5, Emperor=1.2
   */
  aiMilitaryMultiplier: number;

  /**
   * Multiplier applied to the player's final score.
   * Chieftain=1×, Warlord=2×, Prince=3×, King=4×, Emperor=5×
   */
  scoreMultiplier: number;
}

export const DIFFICULTY_PARAMS: Record<DifficultyLevel, DifficultyParams> = {
  chieftain: {
    contentCitizensBase: 6,
    researchCostMultiplier: 0.75,
    barbarianGraceTurns: 50,
    aiProductionMultiplier: 1.0,
    aiFoodStorageMultiplier: 1.0,
    aiHappinessBonus: 0,
    aiSettlerMultiplier: 0.5,
    aiMilitaryMultiplier: 0.5,
    scoreMultiplier: 1,
  },
  warlord: {
    contentCitizensBase: 5,
    researchCostMultiplier: 1.0,
    barbarianGraceTurns: 30,
    aiProductionMultiplier: 1.25,
    aiFoodStorageMultiplier: 0.85,
    aiHappinessBonus: 1,
    aiSettlerMultiplier: 0.75,
    aiMilitaryMultiplier: 0.75,
    scoreMultiplier: 2,
  },
  prince: {
    contentCitizensBase: 4,
    researchCostMultiplier: 1.15,
    barbarianGraceTurns: 15,
    aiProductionMultiplier: 1.5,
    aiFoodStorageMultiplier: 0.7,
    aiHappinessBonus: 2,
    aiSettlerMultiplier: 0.9,
    aiMilitaryMultiplier: 0.9,
    scoreMultiplier: 3,
  },
  king: {
    contentCitizensBase: 3,
    researchCostMultiplier: 1.3,
    barbarianGraceTurns: 5,
    aiProductionMultiplier: 1.75,
    aiFoodStorageMultiplier: 0.55,
    aiHappinessBonus: 3,
    aiSettlerMultiplier: 1.0,
    aiMilitaryMultiplier: 1.0,
    scoreMultiplier: 4,
  },
  emperor: {
    contentCitizensBase: 2,
    researchCostMultiplier: 1.5,
    barbarianGraceTurns: 0,
    aiProductionMultiplier: 2.0,
    aiFoodStorageMultiplier: 0.4,
    aiHappinessBonus: 4,
    aiSettlerMultiplier: 1.2,
    aiMilitaryMultiplier: 1.2,
    scoreMultiplier: 5,
  },
};

export function getDifficultyParams(level: DifficultyLevel): DifficultyParams {
  return DIFFICULTY_PARAMS[level] ?? DIFFICULTY_PARAMS.chieftain;
}

export function getDifficultyDisplayName(level: DifficultyLevel): string {
  return (level.charAt(0).toUpperCase() + level.slice(1)) as string;
}
