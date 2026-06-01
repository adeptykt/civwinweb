/**
 * Civ I leader personalities (docs/ai.txt) — threat, expansion, and military bias per civilization.
 */
import { CivilizationType, type AITraits } from '../CivilizationDefinitions';

/** Base threat 0–6 (Mongols highest, Babylonians lowest). */
export const CIV_THREAT_LEVEL: Record<string, number> = {
  [CivilizationType.BABYLONIAN]: 0,
  [CivilizationType.AMERICAN]: 1,
  [CivilizationType.AZTECS]: 1,
  [CivilizationType.INDIAN]: 1,
  [CivilizationType.CHINESE]: 2,
  [CivilizationType.GERMAN]: 2,
  [CivilizationType.EGYPTIAN]: 2,
  [CivilizationType.ROMANS]: 3,
  [CivilizationType.ENGLISH]: 4,
  [CivilizationType.FRENCH]: 4,
  [CivilizationType.ZULU]: 4,
  [CivilizationType.RUSSIAN]: 5,
  [CivilizationType.GREEKS]: 5,
  [CivilizationType.MONGOL]: 6,
  [CivilizationType.BARBARIANS]: 6,
};

export function getCivThreatLevel(civilizationType: string): number {
  return CIV_THREAT_LEVEL[civilizationType] ?? 3;
}

/** Settler desire multiplier from development style (applied on top of difficulty). */
export function getPersonalitySettlerMultiplier(traits: AITraits): number {
  switch (traits.development) {
    case 'expansionist':
      return 1.35;
    case 'perfectionist':
      return 0.65;
    default:
      return 1.0;
  }
}

/** Military desire multiplier from militarism + aggression. */
export function getPersonalityMilitaryMultiplier(traits: AITraits): number {
  let m = 1.0;
  switch (traits.militarism) {
    case 'militaristic':
      m *= 1.3;
      break;
    case 'civilized':
      m *= 0.75;
      break;
  }
  switch (traits.aggression) {
    case 'aggressive':
      m *= 1.15;
      break;
    case 'friendly':
      m *= 0.85;
      break;
  }
  return m;
}

/**
 * Composite aggressiveness for combat radius / production (traits + civ threat).
 * Rough range −2 … +4 (Mongols ~4, Babylonians ~−1).
 */
export function getPersonalityAggressivenessScore(
  traits: AITraits,
  civilizationType: string,
): number {
  let score = 0;
  switch (traits.aggression) {
    case 'friendly':
      score -= 2;
      break;
    case 'aggressive':
      score += 2;
      break;
  }
  switch (traits.development) {
    case 'perfectionist':
      score -= 1;
      break;
    case 'expansionist':
      score += 1;
      break;
  }
  switch (traits.militarism) {
    case 'civilized':
      score -= 1;
      break;
    case 'militaristic':
      score += 2;
      break;
  }
  const threat = getCivThreatLevel(civilizationType);
  score += (threat - 3) * 0.5;
  return Math.round(score * 10) / 10;
}

/** Tech research weight bonus by category (added to AITechnologyStrategy scores). */
export function getTechCategoryBonus(
  traits: AITraits,
  category: 'military' | 'economic' | 'expansion' | 'science' | 'civilization',
): number {
  switch (category) {
    case 'military':
      if (traits.militarism === 'militaristic') return 3;
      if (traits.militarism === 'civilized') return -1;
      return 1;
    case 'economic':
    case 'science':
    case 'civilization':
      return traits.development === 'perfectionist' ? 2 : 1;
    case 'expansion':
      if (traits.development === 'expansionist') return 2;
      if (traits.development === 'perfectionist') return -1;
      return 0;
    default:
      return 0;
  }
}
