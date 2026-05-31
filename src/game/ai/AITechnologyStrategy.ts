import { GameState, Player } from '../../types/game';
import {
  TechnologyType,
  MILITARY_TECHS,
  ECONOMIC_TECHS,
  EXPANSION_TECHS,
  SCIENCE_TECHS,
  CIVILIZATION_TECHS,
  CONSTRUCTION_TECHS,
  canResearch,
} from '../TechnologyDefinitions';
import { getAITraits } from './AIUtils';

/** Choose what technology an AI player should research and set it on the player object. */
export function processAITechnology(gameState: GameState, playerId: string): void {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player || player.currentResearch) return;

  const aiTraits = getAITraits(gameState, playerId);
  const available = getAvailableTechnologies(player);
  if (available.length === 0) return;

  const scores = new Map<TechnologyType, number>();
  for (const tech of available) {
    let score = 1;
    if (MILITARY_TECHS.includes(tech)) {
      score += aiTraits.militarism === 'militaristic' ? 3
             : aiTraits.militarism === 'normal'       ? 1
             : -1; // civilized
    }
    if (ECONOMIC_TECHS.includes(tech)) {
      score += aiTraits.development === 'perfectionist' ? 2 : 1;
    }
    if (EXPANSION_TECHS.includes(tech)) {
      score += aiTraits.development === 'expansionist'  ?  2
             : aiTraits.development === 'perfectionist' ? -1
             : 0;
    }
    if (SCIENCE_TECHS.includes(tech)) {
      score += aiTraits.development === 'perfectionist' ? 2 : 1;
    }
    if (CIVILIZATION_TECHS.includes(tech)) {
      score += aiTraits.development === 'perfectionist' ? 2 : 1;
    }
    if (CONSTRUCTION_TECHS.includes(tech)) {
      score += 1;
    }
    if (aiTraits.aggression === 'aggressive' && MILITARY_TECHS.includes(tech)) {
      score += 1;
    }
    scores.set(tech, score);
  }

  let bestTech: TechnologyType | null = null;
  let bestScore = -1;
  for (const [tech, score] of scores) {
    if (score > bestScore) { bestScore = score; bestTech = tech; }
  }

  if (bestTech) {
    player.currentResearch = bestTech;
    player.currentResearchProgress = 0;
    console.log(
      `AI Player ${playerId} (${aiTraits.aggression}/${aiTraits.development}/${aiTraits.militarism})` +
      ` chose to research ${bestTech}`
    );
  }
}

/** Return all technologies the player can currently research. */
export function getAvailableTechnologies(player: Player): TechnologyType[] {
  return Object.values(TechnologyType).filter(tech =>
    !player.technologies.includes(tech) && canResearch(tech, player.technologies)
  );
}
