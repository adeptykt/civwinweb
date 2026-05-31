import { GameState, GovernmentType, GOVERNMENTS } from '../../types/game.js';
import { getAITraits } from './AIUtils.js';

/**
 * Handles AI government decisions:
 * 1. When anarchy ends (revolutionTurns === 0), auto-select the best available government.
 * 2. Each turn, consider whether to start a revolution (upgrade from a weaker government).
 */

// ─── Anarchy ended – pick government ────────────────────────────────────────

/**
 * Called when an AI player's anarchy period has ended (revolutionTurns === 0).
 * Scores available governments based on civilisation traits and picks the best.
 */
export function chooseGovernmentAfterAnarchy(gameState: GameState, playerId: string): GovernmentType {
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) return GovernmentType.DESPOTISM;

  const traits = getAITraits(gameState, playerId);
  const available = getAvailableGovTypes(player);

  // Score each candidate (ANARCHY is never selected)
  let bestType: GovernmentType = GovernmentType.DESPOTISM;
  let bestScore = -Infinity;

  for (const govType of available) {
    if (govType === GovernmentType.ANARCHY) continue;
    const score = scoreGovernment(govType, traits);
    if (score > bestScore) {
      bestScore = score;
      bestType = govType;
    }
  }

  return bestType;
}

// ─── Revolution decision ─────────────────────────────────────────────────────

/**
 * Decide whether an AI player should start a revolution this turn.
 * Returns true if the player should revolt.
 */
export function shouldAIStartRevolution(gameState: GameState, playerId: string): boolean {
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) return false;

  // Already in anarchy – can't start another
  if (player.government === GovernmentType.ANARCHY) return false;

  const traits = getAITraits(gameState, playerId);
  const available = getAvailableGovTypes(player);

  // Score the current government
  const currentScore = scoreGovernment(player.government, traits);

  // Find the best government the player could switch to
  let bestUpgradeScore = -Infinity;
  for (const govType of available) {
    if (govType === GovernmentType.ANARCHY || govType === player.government) continue;
    const s = scoreGovernment(govType, traits);
    if (s > bestUpgradeScore) bestUpgradeScore = s;
  }

  // Only revolt if there is a clearly better option (> 2 score advantage)
  if (bestUpgradeScore - currentScore <= 2) return false;

  // Probabilistic check – don't revolt every single turn the condition is true.
  // Scale probability by how much of the game has passed (revolt more readily later).
  const gamePctComplete = Math.min(1, gameState.turn / 400);
  const revoltChance = 0.05 + gamePctComplete * 0.10; // 5 % early → 15 % late

  return Math.random() < revoltChance;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function getAvailableGovTypes(player: import('../../types/game.js').Player): GovernmentType[] {
  const available: GovernmentType[] = [GovernmentType.DESPOTISM];
  for (const gov of Object.values(GOVERNMENTS)) {
    if (gov.type === GovernmentType.DESPOTISM || gov.type === GovernmentType.ANARCHY) continue;
    if (!gov.requiredTechnology || player.technologies.includes(gov.requiredTechnology)) {
      available.push(gov.type);
    }
  }
  return available;
}

/**
 * Higher score = more desirable for the given AI traits.
 * Scores reflect how well each government aligns with the civ's play-style.
 */
function scoreGovernment(
  govType: GovernmentType,
  traits: ReturnType<typeof getAITraits>,
): number {
  let score = 0;

  switch (govType) {
    case GovernmentType.DESPOTISM:
      score = 0; // baseline – always available but weakest
      break;

    case GovernmentType.MONARCHY:
      score = 3; // solid upgrade – no production penalty
      if (traits.militarism === 'militaristic') score += 1; // martial law helps
      break;

    case GovernmentType.COMMUNISM:
      score = 5;
      if (traits.militarism === 'militaristic') score += 2; // free units are huge
      if (traits.development === 'perfectionist') score -= 1; // perfectionist prefers trade
      break;

    case GovernmentType.REPUBLIC:
      score = 6;
      if (traits.development === 'perfectionist') score += 3; // trade bonus is excellent
      if (traits.militarism === 'militaristic') score -= 2; // unit upkeep hurts warmongers
      break;

    case GovernmentType.DEMOCRACY:
      score = 8;
      if (traits.development === 'perfectionist') score += 3; // optimal for growth
      if (traits.militarism === 'militaristic') score -= 4; // heavy upkeep and unhappiness
      if (traits.aggression === 'aggressive') score -= 2; // senate restrictions are painful
      break;

    default:
      score = 0;
  }

  return score;
}
