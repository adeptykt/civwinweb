import { GameState, City, UnitType, BuildingType, WonderType, UnitCategory } from '../../types/game';
import { CivilizationType } from '../CivilizationDefinitions';
import { getAITraits, getAggressivenessScore, getDistance, isMilitaryUnit, isCityCoastal } from './AIUtils';
import { countCityDefenders, calculateDesiredDefenders, getBestMilitaryUnit } from './AICombatStrategy';
import { shouldBuildNavalUnits, hasEnoughNavalUnits, getBestNavalUnit } from './AINavalStrategy';
import { TaxSystem } from '../TaxSystem';
import { BUILDING_DEFINITIONS, canBuildBuilding } from '../BuildingDefinitions';
import { WonderDefinitions } from '../WonderDefinitions';
import { getUnitStats } from '../UnitDefinitions';

// ─────────────────────────────────────────────────────────────
// Wonder preference tables — which wonders each civilization
// actively tries to build, in rough priority order.
// ─────────────────────────────────────────────────────────────
const CIV_WONDER_PREFERENCES: Partial<Record<CivilizationType, string[]>> = {
  [CivilizationType.BABYLONIAN]: [WonderType.GREAT_LIBRARY, WonderType.ORACLE, WonderType.HANGING_GARDENS, WonderType.COPERNICUS_OBSERVATORY, WonderType.ISAAC_NEWTONS_COLLEGE],
  [CivilizationType.EGYPTIAN]:   [WonderType.PYRAMIDS, WonderType.HANGING_GARDENS, WonderType.COLOSSUS, WonderType.GREAT_WALL, WonderType.ORACLE],
  [CivilizationType.CHINESE]:    [WonderType.GREAT_LIBRARY, WonderType.ORACLE, WonderType.GREAT_WALL, WonderType.COPERNICUS_OBSERVATORY, WonderType.DARWINS_VOYAGE],
  [CivilizationType.INDIAN]:     [WonderType.HANGING_GARDENS, WonderType.ORACLE, WonderType.GREAT_LIBRARY, WonderType.MICHELANGELOS_CHAPEL, WonderType.SHAKESPEARES_THEATRE],
  [CivilizationType.GERMAN]:     [WonderType.GREAT_LIBRARY, WonderType.COPERNICUS_OBSERVATORY, WonderType.ISAAC_NEWTONS_COLLEGE, WonderType.DARWINS_VOYAGE],
  [CivilizationType.FRENCH]:     [WonderType.ORACLE, WonderType.COLOSSUS, WonderType.MICHELANGELOS_CHAPEL, WonderType.SHAKESPEARES_THEATRE, WonderType.JS_BACHS_CATHEDRAL],
  [CivilizationType.ENGLISH]:    [WonderType.LIGHTHOUSE, WonderType.COLOSSUS, WonderType.MAGELLANS_EXPEDITION, WonderType.COPERNICUS_OBSERVATORY, WonderType.ISAAC_NEWTONS_COLLEGE],
  [CivilizationType.AMERICAN]:   [WonderType.COLOSSUS, WonderType.LIGHTHOUSE, WonderType.DARWINS_VOYAGE, WonderType.SETI_PROGRAM, WonderType.APOLLO_PROGRAM],
  [CivilizationType.ROMANS]:     [WonderType.GREAT_WALL, WonderType.COLOSSUS, WonderType.PYRAMIDS, WonderType.ORACLE],
  [CivilizationType.GREEKS]:     [WonderType.COLOSSUS, WonderType.GREAT_LIBRARY, WonderType.ORACLE, WonderType.LIGHTHOUSE],
  [CivilizationType.MONGOL]:     [WonderType.GREAT_WALL, WonderType.PYRAMIDS],
  [CivilizationType.RUSSIAN]:    [WonderType.GREAT_WALL, WonderType.COLOSSUS, WonderType.HOOVER_DAM, WonderType.UNITED_NATIONS],
  [CivilizationType.AZTECS]:     [WonderType.GREAT_WALL, WonderType.PYRAMIDS, WonderType.ORACLE],
  [CivilizationType.ZULU]:       [WonderType.GREAT_WALL, WonderType.PYRAMIDS],
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function cityHasBuilding(city: City, type: BuildingType): boolean {
  return city.buildings.some(b => b.type === type);
}

function getBuiltWonderIds(gameState: GameState): string[] {
  const ids: string[] = [];
  for (const c of gameState.cities) {
    for (const b of c.buildings) {
      if ((b.type as string).startsWith('wonder_')) {
        const id = (b.type as string).replace('wonder_', '');
        if (!ids.includes(id)) ids.push(id);
      }
    }
  }
  return ids;
}

/**
 * Return the most important building this city should construct next,
 * or null if nothing is needed right now.
 */
function getNextPriorityBuilding(
  city: City,
  player: { technologies: string[]; id: string },
  aiTraits: { militarism: string; development: string },
): BuildingType | null {
  const has  = (t: BuildingType) => cityHasBuilding(city, t);
  const can  = (t: BuildingType) => canBuildBuilding(t, player.technologies as any[], city.buildings.map(b => b.type as BuildingType));
  const isMil = aiTraits.militarism === 'militaristic';
  const isCiv = aiTraits.militarism === 'civilized';
  const isPerfect = aiTraits.development === 'perfectionist';

  // ── Tier 1: Foundation — growth & happiness ──────────────────
  if (!has(BuildingType.GRANARY) && can(BuildingType.GRANARY))           return BuildingType.GRANARY;
  if (!has(BuildingType.TEMPLE)  && can(BuildingType.TEMPLE))            return BuildingType.TEMPLE;

  // ── Tier 2: Military infrastructure ─────────────────────────
  if (isMil && !has(BuildingType.BARRACKS) && can(BuildingType.BARRACKS)) return BuildingType.BARRACKS;

  // ── Tier 3: City walls (militaristic / everyone when tech available) ─
  if (!has(BuildingType.CITY_WALLS) && can(BuildingType.CITY_WALLS) && (isMil || city.population >= 4))
    return BuildingType.CITY_WALLS;

  // ── Tier 4: Science (civilized/perfectionist first) ─────────
  if ((isCiv || isPerfect) && !has(BuildingType.LIBRARY) && can(BuildingType.LIBRARY))  return BuildingType.LIBRARY;
  if ((isCiv || isPerfect) && !has(BuildingType.UNIVERSITY) && can(BuildingType.UNIVERSITY)) return BuildingType.UNIVERSITY;

  // ── Tier 5: Growth capacity (aqueduct when city is large) ───
  if (!has(BuildingType.AQUEDUCT) && can(BuildingType.AQUEDUCT) && city.population >= 5) return BuildingType.AQUEDUCT;

  // ── Tier 6: Economy ──────────────────────────────────────────
  if (!has(BuildingType.MARKETPLACE) && can(BuildingType.MARKETPLACE))   return BuildingType.MARKETPLACE;
  if (!has(BuildingType.BANK)        && can(BuildingType.BANK))           return BuildingType.BANK;

  // ── Tier 7: Science for everyone ────────────────────────────
  if (!has(BuildingType.LIBRARY)     && can(BuildingType.LIBRARY))       return BuildingType.LIBRARY;
  if (!has(BuildingType.UNIVERSITY)  && can(BuildingType.UNIVERSITY))    return BuildingType.UNIVERSITY;

  // ── Tier 8: Happiness buildings ─────────────────────────────
  if (!has(BuildingType.CATHEDRAL)   && can(BuildingType.CATHEDRAL))     return BuildingType.CATHEDRAL;
  if (!has(BuildingType.COLOSSEUM)   && can(BuildingType.COLOSSEUM) && city.population >= 6) return BuildingType.COLOSSEUM;

  // ── Tier 10: Late-game production chain ─────────────────────
  if (!has(BuildingType.FACTORY)     && can(BuildingType.FACTORY))       return BuildingType.FACTORY;
  if (!has(BuildingType.POWER_PLANT) && can(BuildingType.POWER_PLANT))   return BuildingType.POWER_PLANT;
  if (!has(BuildingType.MANUFACTURING_PLANT) && can(BuildingType.MANUFACTURING_PLANT)) return BuildingType.MANUFACTURING_PLANT;

  return null;
}

/**
 * Return the first preferred wonder this civ can still build, or null.
 */
function getPreferredWonder(
  player: { civilizationType: CivilizationType; technologies: string[] },
  gameState: GameState,
): string | null {
  const builtWonders = getBuiltWonderIds(gameState);
  const preferences  = CIV_WONDER_PREFERENCES[player.civilizationType] ?? [];

  for (const wonderId of preferences) {
    if (builtWonders.includes(wonderId)) continue;
    const stats = WonderDefinitions[wonderId];
    if (!stats) continue;
    if (stats.requiredTechnology && !(player.technologies as string[]).includes(stats.requiredTechnology)) continue;
    return wonderId;
  }
  return null;
}

/**
 * Estimate production output for a city (shields per turn).
 * Simple approximation: base 1 + population, boosted for AI.
 */
function estimateProductionOutput(city: City): number {
  return Math.max(1, 1 + city.population);
}

// ─────────────────────────────────────────────────────────────
// Main entry points
// ─────────────────────────────────────────────────────────────

/** Set production for all AI cities that currently have nothing queued. */
export function processAICities(gameState: GameState, playerId: string): void {
  for (const city of gameState.cities.filter(c => c.playerId === playerId)) {
    if (!city.production) {
      setAICityProduction(city, gameState);
    }
  }
}

/** Choose what an AI city should build next. */
export function setAICityProduction(city: City, gameState: GameState): void {
  const aiTraits            = getAITraits(gameState, city.playerId);
  const aggressivenessScore = getAggressivenessScore(aiTraits);

  const player       = gameState.players.find(p => p.id === city.playerId);
  const playerUnits  = gameState.units.filter(u => u.playerId === city.playerId);
  const playerCities = gameState.cities.filter(c => c.playerId === city.playerId);

  const settlerCount   = playerUnits.filter(u => u.type === UnitType.SETTLERS).length;
  const militaryCount  = playerUnits.filter(u => isMilitaryUnit(u.type)).length;
  const settlersInProd = playerCities.filter(c =>
    c.production?.type === 'unit' && c.production?.item === UnitType.SETTLERS
  ).length;
  const totalSettlers  = settlerCount + settlersInProd;

  const defendersInCity  = countCityDefenders(city, gameState);
  const desiredDefenders = calculateDesiredDefenders(city, gameState);
  const needsDefense     = defendersInCity < desiredDefenders;

  const isExpansionist = aiTraits.development === 'expansionist';
  const isPerfectionist = aiTraits.development === 'perfectionist';
  const isMilitaristic  = aiTraits.militarism  === 'militaristic';
  const isCivilized     = aiTraits.militarism  === 'civilized';

  const nearbyEnemyCities = gameState.cities.filter(c =>
    c.playerId !== city.playerId && getDistance(city.position, c.position) <= 5
  );
  const nearbyEnemyUnits = gameState.units.filter(u =>
    u.playerId !== city.playerId && getDistance(city.position, u.position) <= 4
  );
  // Require at least 2 nearby enemy cities OR at least 1 nearby enemy unit to trigger threat mode
  const hasNearbyThreats = nearbyEnemyCities.length >= 2 || nearbyEnemyUnits.length > 0;

  const earlyGameTurn = isExpansionist ? 40 : isPerfectionist ? 25 : 30;
  const isEarlyGame   = gameState.turn <= earlyGameTurn;
  const isMidGame     = gameState.turn > earlyGameTurn && gameState.turn <= 80;

  // ── Settler budget ───────────────────────────────────────────
  // Every civ must want at least 2 cities. Perfectionists grow slowly but
  // must still expand — their previous formula (0.75 * 1 city = 0) was broken.
  let maxDesiredSettlers: number;
  if (isEarlyGame) {
    if      (isExpansionist)  maxDesiredSettlers = Math.min(playerCities.length + 2, 6);
    else if (isPerfectionist) maxDesiredSettlers = Math.max(2, Math.min(playerCities.length + 1, 3));
    else                       maxDesiredSettlers = Math.min(playerCities.length + 1, 4);
  } else if (isMidGame) {
    if      (isExpansionist)  maxDesiredSettlers = Math.max(3, Math.floor(playerCities.length * 0.6));
    else if (isPerfectionist) maxDesiredSettlers = Math.max(2, Math.floor(playerCities.length * 0.4));
    else                       maxDesiredSettlers = Math.max(2, Math.floor(playerCities.length * 0.5));
  } else {
    // Late game — all civs keep at least a trickle of expansion
    if      (isExpansionist)  maxDesiredSettlers = Math.max(2, Math.floor(playerCities.length * 0.3));
    else if (isPerfectionist) maxDesiredSettlers = Math.max(1, Math.floor(playerCities.length * 0.2));
    else                       maxDesiredSettlers = Math.max(1, Math.floor(playerCities.length * 0.25));
  }

  // ── Military budget ──────────────────────────────────────────
  // Reduced per-city ratios to prevent unit spam
  const unitsPerCity       = isMilitaristic ? 1.5 : isCivilized ? 1.0 : 1.2;
  const baseMilitaryNeeds  = Math.max(isMilitaristic ? 2 : 1, Math.floor(playerCities.length * unitsPerCity));
  // Hard cap: never desire more than 2 units per city regardless of threats
  const hardMilitaryCap    = playerCities.length * 2;
  const threatMult         = hasNearbyThreats ? (aggressivenessScore >= 1 ? 1.75 : 1.5) : 1;
  const rawDesiredMilitary = Math.min(Math.floor(baseMilitaryNeeds * threatMult), hardMilitaryCap);
  const shieldDrainCap     = player ? TaxSystem.calculateUnitShieldDrain(player, gameState) : 0;
  const drainBudget        = player?.isHuman ? playerCities.length : playerCities.length * 2;
  const militaryCapHit     = shieldDrainCap > drainBudget;
  const desiredMilitary    = militaryCapHit ? Math.min(rawDesiredMilitary, militaryCount) : rawDesiredMilitary;
  const minMilitaryBefore  = Math.max(1, playerCities.length);

  // ── Helper: set a building ───────────────────────────────────
  const setBuilding = (bt: BuildingType) => {
    const cost  = BUILDING_DEFINITIONS[bt]?.productionCost ?? 60;
    const prod  = estimateProductionOutput(city);
    city.production = { type: 'building', item: bt, turnsRemaining: Math.ceil(cost / prod) };
  };

  // ── Helper: set a wonder ─────────────────────────────────────
  const setWonder = (wonderId: string) => {
    const cost = WonderDefinitions[wonderId]?.productionCost ?? 300;
    const prod = estimateProductionOutput(city);
    city.production = { type: 'wonder', item: wonderId as WonderType, turnsRemaining: Math.ceil(cost / prod) };
  };

  // ── Helper: set best military unit ──────────────────────────
  const setMilitary = (purpose: 'defense' | 'offense' | 'general') => {
    const best = getBestMilitaryUnit(city.playerId, gameState, purpose);
    city.production = { type: 'unit', item: best.type, turnsRemaining: best.turns };
  };

  // ────────────────────────────────────────────────────────────
  // Priority 1 — City needs a defender
  // ────────────────────────────────────────────────────────────
  if (needsDefense) {
    setMilitary('defense');
    return;
  }

  // ────────────────────────────────────────────────────────────
  // Priority 2 — Foundation buildings: granary & temple
  // These are so valuable they should be built before any army expansion.
  // Allow if we have at least 1 defender already.
  // ────────────────────────────────────────────────────────────
  if (player && militaryCount >= minMilitaryBefore) {
    if (!cityHasBuilding(city, BuildingType.GRANARY) && canBuildBuilding(BuildingType.GRANARY, player.technologies as any[], city.buildings.map(b => b.type as BuildingType))) {
      setBuilding(BuildingType.GRANARY);
      return;
    }
    if (!cityHasBuilding(city, BuildingType.TEMPLE) && canBuildBuilding(BuildingType.TEMPLE, player.technologies as any[], city.buildings.map(b => b.type as BuildingType))) {
      setBuilding(BuildingType.TEMPLE);
      return;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Priority 2b — Naval exploration unit
  // Coastal cities with unexplored ocean nearby should build a
  // ship before flooding the land with more troops.
  // ────────────────────────────────────────────────────────────
  if (
    isCityCoastal(city, gameState) &&
    shouldBuildNavalUnits(city.playerId, gameState) &&
    !hasEnoughNavalUnits(city.playerId, gameState) &&
    militaryCount >= minMilitaryBefore
  ) {
    const navalType = getBestNavalUnit(city.playerId, gameState, 'exploration');
    const navalStats = getUnitStats(navalType);
    const navalCost  = navalStats?.productionCost ?? 40;
    const prod  = estimateProductionOutput(city);
    city.production = { type: 'unit', item: navalType, turnsRemaining: Math.ceil(navalCost / prod) };
    return;
  }

  // ────────────────────────────────────────────────────────────
  // Priority 3 — Threat response: build offensive units
  // ────────────────────────────────────────────────────────────
  if (hasNearbyThreats && militaryCount < desiredMilitary) {
    setMilitary('offense');
    return;
  }

  // ────────────────────────────────────────────────────────────
  // Priority 4 — Wonder pursuit
  // Civilized/perfectionist civs aggressively chase wonders;
  // others pursue them opportunistically in mid/late game.
  // Only when not under direct pressure and city is productive.
  // ────────────────────────────────────────────────────────────
  if (player && !hasNearbyThreats && militaryCount >= minMilitaryBefore) {
    const preferredWonder = getPreferredWonder(player as any, gameState);
    if (preferredWonder) {
      const prod = estimateProductionOutput(city);
      // Civilized/perfectionist always chase wonders if they have one;
      // others do so once they have enough military and in mid/late game.
      const shouldChaseWonder =
        (isCivilized || isPerfectionist)
          ? prod >= 2
          : !isEarlyGame && prod >= 3 && militaryCount >= baseMilitaryNeeds;

      if (shouldChaseWonder) {
        setWonder(preferredWonder);
        return;
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // Priority 4b — Guaranteed minimum expansion
  // If the civ has only 1 city and already has 1 defender, build a settler
  // immediately — don’t wait for military quotas to be satisfied first.
  // ────────────────────────────────────────────────────────────
  if (playerCities.length < 3 && totalSettlers < maxDesiredSettlers && militaryCount >= 1 && !needsDefense) {
    city.production = { type: 'unit', item: UnitType.SETTLERS, turnsRemaining: 3 };
    return;
  }

  // ────────────────────────────────────────────────────────────
  // Priority 5 — Early expansion settlers
  // ────────────────────────────────────────────────────────────
  if (totalSettlers < maxDesiredSettlers && isEarlyGame && militaryCount >= minMilitaryBefore) {
    city.production = { type: 'unit', item: UnitType.SETTLERS, turnsRemaining: 3 };
    return;
  }

  // ────────────────────────────────────────────────────────────
  // Priority 6 — Basic military needs
  // ────────────────────────────────────────────────────────────
  if (militaryCount < baseMilitaryNeeds) {
    setMilitary('general');
    return;
  }

  // ────────────────────────────────────────────────────────────
  // Priority 7 — Infrastructure buildings (tier 3+)
  // Now that we have enough military and basic buildings, build
  // the next best available improvement for this city.
  // ────────────────────────────────────────────────────────────
  if (player) {
    const nextBuilding = getNextPriorityBuilding(city, player as any, aiTraits);
    if (nextBuilding) {
      setBuilding(nextBuilding);
      return;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Priority 8 — Mid/late settlers
  // ────────────────────────────────────────────────────────────
  if (totalSettlers < maxDesiredSettlers) {
    city.production = { type: 'unit', item: UnitType.SETTLERS, turnsRemaining: 3 };
    return;
  }

  // ────────────────────────────────────────────────────────────
  // Priority 9 — Opportunistic wonder chase
  // Even non-builder civs should pick up available wonders now.
  // ────────────────────────────────────────────────────────────
  if (player) {
    const anyWonder = getPreferredWonder(player as any, gameState);
    if (!anyWonder) {
      // Try any available wonder even if not in preference list
      const builtWonders = getBuiltWonderIds(gameState);
      const availableWonder = Object.keys(WonderDefinitions).find(id => {
        if (builtWonders.includes(id)) return false;
        const stats = WonderDefinitions[id];
        return !stats.requiredTechnology || (player.technologies as string[]).includes(stats.requiredTechnology as string);
      });
      if (availableWonder) {
        setWonder(availableWonder);
        return;
      }
    } else {
      setWonder(anyWonder);
      return;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Priority 10 — Weighted variety fallback
  // Prefer infrastructure over military to avoid unit spam.
  // ────────────────────────────────────────────────────────────
  const options: Array<{ type: string; item: any; turns: number; weight: number }> = [];

  // Try any remaining building before defaulting to units
  if (player) {
    const nextBuilding = getNextPriorityBuilding(city, player as any, aiTraits);
    if (nextBuilding) {
      setBuilding(nextBuilding);
      return;
    }
  }

  // Only add military option if still under the hard cap
  if (militaryCount < hardMilitaryCap && (isMilitaristic || aggressivenessScore >= 1)) {
    const mu = getBestMilitaryUnit(city.playerId, gameState, 'general');
    options.push({ type: 'unit', item: mu.type, turns: mu.turns, weight: isMilitaristic ? 2 : 1 });
  }
  if (isExpansionist && totalSettlers < maxDesiredSettlers + 1) {
    options.push({ type: 'unit', item: UnitType.SETTLERS, turns: 3, weight: 2 });
  }

  // Final fallback: build a military unit only if below the hard cap
  if (options.length === 0) {
    if (militaryCount < hardMilitaryCap) {
      const mu = getBestMilitaryUnit(city.playerId, gameState, 'general');
      options.push({ type: 'unit', item: mu.type, turns: mu.turns, weight: 1 });
    } else {
      // At cap — re-evaluate next turn instead of queuing more units
      city.production = null;
      return;
    }
  }

  const totalWeight = options.reduce((s, o) => s + o.weight, 0);
  let rnd = Math.random() * totalWeight;
  let chosen = options[0];
  for (const opt of options) {
    rnd -= opt.weight;
    if (rnd <= 0) { chosen = opt; break; }
  }
  city.production = { type: chosen.type as any, item: chosen.item, turnsRemaining: chosen.turns };
}

/** Force re-evaluation of production for a city (called when production completes or conditions change). */
export function reevaluateCityProduction(city: City, gameState: GameState): void {
  city.production = null;
  setAICityProduction(city, gameState);
}
