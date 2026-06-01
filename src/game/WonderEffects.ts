import type { City, GameState, Player } from '../types/game';
import { BuildingType, GovernmentType, WonderType } from '../types/game';
import { TechnologyType, canResearch } from './TechnologyDefinitions';
import { VisibilitySystem } from './VisibilitySystem';

/** Whether any city in the game has completed this wonder. */
export function isWonderBuiltGlobally(gameState: GameState, wonderId: string): boolean {
  for (const city of gameState.cities) {
    if (cityHasWonder(city, wonderId)) return true;
  }
  return false;
}

/** Whether the given player owns this wonder in any city. */
export function playerOwnsWonder(gameState: GameState, playerId: string, wonderId: string): boolean {
  return gameState.cities
    .filter(c => c.playerId === playerId)
    .some(c => cityHasWonder(c, wonderId));
}

export function cityHasWonder(city: City, wonderId: string): boolean {
  if (city.wonders?.some(w => w.type === wonderId)) return true;
  const key = `wonder_${wonderId}`;
  return city.buildings?.some(b => String(b.type) === key) ?? false;
}

export function cityHasShakespearesTheatre(city: City): boolean {
  return cityHasWonder(city, WonderType.SHAKESPEARES_THEATRE);
}

/** Pyramids: only one turn of anarchy when changing government. */
export function getRevolutionTurnsForPlayer(gameState: GameState, playerId: string): number {
  return playerOwnsWonder(gameState, playerId, WonderType.PYRAMIDS) ? 1 : Math.floor(Math.random() * 4) + 2;
}

/** Lighthouse / Magellan: +1 naval movement. */
export function getNavalMovementBonus(gameState: GameState, playerId: string): number {
  let bonus = 0;
  if (playerOwnsWonder(gameState, playerId, WonderType.LIGHTHOUSE)) bonus += 1;
  if (playerOwnsWonder(gameState, playerId, WonderType.MAGELLANS_EXPEDITION)) bonus += 1;
  return bonus;
}

/** Oracle doubles temple happyFaces in all cities of the owner. */
export function getTempleHappyFacesMultiplier(gameState: GameState, playerId: string): number {
  return playerOwnsWonder(gameState, playerId, WonderType.ORACLE) ? 2 : 1;
}

/** Michelangelo: cathedral happyFaces +50%. */
export function getCathedralHappyFacesMultiplier(gameState: GameState, playerId: string): number {
  return playerOwnsWonder(gameState, playerId, WonderType.MICHELANGELOS_CHAPEL) ? 1.5 : 1;
}

/** Isaac Newton: library/university science multipliers 1.5 → ~1.83. */
export function getLibraryUniversityScienceMultiplier(gameState: GameState, playerId: string): number {
  return playerOwnsWonder(gameState, playerId, WonderType.ISAAC_NEWTONS_COLLEGE) ? 1.83 / 1.5 : 1;
}

/** Copernicus in this city: ×2 science; SETI owner: ×1.5 empire-wide. */
export function getCityScienceMultiplier(
  gameState: GameState,
  playerId: string,
  city: City,
): number {
  let mult = 1;
  if (cityHasWonder(city, WonderType.COPERNICUS_OBSERVATORY)) mult *= 2;
  if (playerOwnsWonder(gameState, playerId, WonderType.SETI_PROGRAM)) mult *= 1.5;
  return mult;
}

/** Hanging Gardens / Cure for Cancer: content → happy globally. */
export function getGlobalContentToHappyBonus(gameState: GameState, playerId: string): number {
  let bonus = 0;
  if (playerOwnsWonder(gameState, playerId, WonderType.HANGING_GARDENS)) bonus += 1;
  if (playerOwnsWonder(gameState, playerId, WonderType.CURE_FOR_CANCER)) bonus += 1;
  return bonus;
}

/** J.S. Bach: up to 2 unhappy → content per city (simplified: all cities). */
export function getBachUnhappyToContent(gameState: GameState, playerId: string): number {
  return playerOwnsWonder(gameState, playerId, WonderType.JS_BACHS_CATHEDRAL) ? 2 : 0;
}

/** Women's Suffrage: away-unit penalty capped (Republic 0, Democracy 1). */
export function getEffectiveAwayUnitPenalty(player: Player, gameState: GameState): number {
  const base = player.government === GovernmentType.REPUBLIC
    ? 1
    : player.government === GovernmentType.DEMOCRACY
      ? 2
      : 0;
  if (base === 0) return 0;
  if (!playerOwnsWonder(gameState, player.id, WonderType.WOMENS_SUFFRAGE)) return base;
  if (player.government === GovernmentType.REPUBLIC) return 0;
  if (player.government === GovernmentType.DEMOCRACY) return 1;
  return base;
}

export function playerCanBuildSpaceship(gameState: GameState, playerId: string): boolean {
  return playerOwnsWonder(gameState, playerId, WonderType.APOLLO_PROGRAM);
}

function pickRandomUnknownTech(player: Player, gameState: GameState): TechnologyType | null {
  const known = new Set(player.technologies);
  const pool = Object.values(TechnologyType).filter(
    t => t !== TechnologyType.FUTURE_TECH && !known.has(t) && canResearch(t, player.technologies),
  );
  if (pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const anyUnknown = Object.values(TechnologyType).filter(
    t => t !== TechnologyType.FUTURE_TECH && !known.has(t),
  );
  if (anyUnknown.length === 0) return null;
  return anyUnknown[Math.floor(Math.random() * anyUnknown.length)];
}

function grantFreeTechnology(
  gameState: GameState,
  player: Player,
  emit?: (event: string, data?: unknown) => void,
): boolean {
  const tech = pickRandomUnknownTech(player, gameState);
  if (!tech) return false;
  player.technologies.push(tech);
  gameState.events = gameState.events ?? [];
  gameState.events.push({
    type: 'technologyCompleted',
    playerId: player.id,
    technologyType: tech,
    player,
  });
  emit?.('technologyResearched', { playerId: player.id, technologyType: tech, free: true });
  return true;
}

/** One-time and visibility effects when a wonder is completed. */
export function applyOnWonderBuilt(
  gameState: GameState,
  city: City,
  wonderId: string,
  emit?: (event: string, data?: unknown) => void,
): void {
  const player = gameState.players.find(p => p.id === city.playerId);
  if (!player) return;

  switch (wonderId) {
    case WonderType.DARWINS_VOYAGE:
      grantFreeTechnology(gameState, player, emit);
      grantFreeTechnology(gameState, player, emit);
      break;
    case WonderType.GREAT_LIBRARY:
      grantFreeTechnology(gameState, player, emit);
      break;
    case WonderType.APOLLO_PROGRAM:
      VisibilitySystem.revealAllCitiesForPlayer(gameState, player.id);
      emit?.('apolloReveal', { playerId: player.id });
      break;
    default:
      break;
  }
}
