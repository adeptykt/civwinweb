import { GameState, City, UnitType, BuildingType, WonderType } from '../../types/game';
import { CivilizationType } from '../CivilizationDefinitions';
import { getAITraits, getAggressivenessScore, getDistance, isMilitaryUnit, isCityCoastal } from './AIUtils';
import { countCityDefenders, calculateDesiredDefenders, getBestMilitaryUnit } from './AICombatStrategy';
import { shouldBuildNavalUnits, hasEnoughNavalUnits, getBestNavalUnit, needsTransportForExpansion } from './AINavalStrategy';
import { TaxSystem } from '../TaxSystem';
import { BUILDING_DEFINITIONS, canBuildBuilding } from '../BuildingDefinitions';
import { WonderDefinitions } from '../WonderDefinitions';
import { getUnitStats } from '../UnitDefinitions';
import { getDifficultyParams } from '../DifficultyConfig';

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

// ─────────────────────────────────────────────────────────────
// Threat-level assessment — peacetime / tense / wartime
// ─────────────────────────────────────────────────────────────

type ThreatLevel = 'peacetime' | 'tense' | 'wartime';

/**
 * Assess the overall threat level for a player.
 * - **wartime**: enemy units within 6 tiles of any city, or recently lost a city
 * - **tense**: enemy cities within 8 tiles, or enemy units within 10 tiles
 * - **peacetime**: no significant nearby threats
 */
function assessThreatLevel(gameState: GameState, playerId: string): ThreatLevel {
  const playerCities = gameState.cities.filter(c => c.playerId === playerId);
  if (playerCities.length === 0) return 'wartime';

  let closestEnemyUnitDist = Infinity;
  let closestEnemyCityDist = Infinity;
  let totalNearbyEnemyUnits = 0;

  for (const city of playerCities) {
    for (const u of gameState.units) {
      if (u.playerId === playerId) continue;
      const d = getDistance(city.position, u.position);
      if (d < closestEnemyUnitDist) closestEnemyUnitDist = d;
      if (d <= 8) totalNearbyEnemyUnits++;
    }
    for (const c of gameState.cities) {
      if (c.playerId === playerId) continue;
      const d = getDistance(city.position, c.position);
      if (d < closestEnemyCityDist) closestEnemyCityDist = d;
    }
  }

  // Wartime: enemy units dangerously close or many enemies nearby
  if (closestEnemyUnitDist <= 6 || totalNearbyEnemyUnits >= 4) return 'wartime';

  // Tense: enemies in the neighbourhood
  if (closestEnemyUnitDist <= 10 || closestEnemyCityDist <= 8) return 'tense';

  return 'peacetime';
}

/**
 * Check whether a specific city is directly threatened (enemies within 5 tiles).
 */
function isCityDirectlyThreatened(city: City, gameState: GameState): boolean {
  return gameState.units.some(u =>
    u.playerId !== city.playerId && getDistance(city.position, u.position) <= 5
  );
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

  const isExpansionist = aiTraits.development === 'expansionist';
  const isPerfectionist = aiTraits.development === 'perfectionist';
  const isMilitaristic  = aiTraits.militarism  === 'militaristic';
  const isCivilized     = aiTraits.militarism  === 'civilized';

  // ── Threat-level assessment ──────────────────────────────────
  const threatLevel          = assessThreatLevel(gameState, city.playerId);
  const isWartime            = threatLevel === 'wartime';
  const isTense              = threatLevel === 'tense';
  const isPeacetime          = threatLevel === 'peacetime';
  const cityThreatened       = isCityDirectlyThreatened(city, gameState);

  // "Fortification floor" — the minimum defenders required before ANY other production
  // is considered. Once the city hits this bar it transitions to development priorities
  // (settlers, buildings, wonders). The full desiredDefenders target is still topped-up
  // later in the priority chain, just without blocking everything else.
//   • Peacetime:  1 defender is enough to start building settlers/improvements
    //   • Tense:      up to 2 defenders, then diversify
    //   • Wartime / directly threatened: fill to the full computed target
    const productionDefenseFloor =
      cityThreatened || isWartime
        ? desiredDefenders                    // Active threat — fill to full target first
        : isTense
        ? Math.min(desiredDefenders, 2)       // Tense — 2 max before switching priorities
        : Math.min(desiredDefenders, 1);      // Peacetime — 1 is enough, then develop

  const needsDefense = defendersInCity < productionDefenseFloor;

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
  // During wartime, cut settler production to focus on military
  if (isWartime) maxDesiredSettlers = Math.max(0, maxDesiredSettlers - 1);

  // Scale settler desire by difficulty — on Chieftain the AI expands slowly
  const diffParams = getDifficultyParams(gameState.difficulty ?? 'chieftain');
  maxDesiredSettlers = Math.max(1, Math.round(maxDesiredSettlers * diffParams.aiSettlerMultiplier));

  // ── Military budget — adjusted by threat level ───────────────
  const unitsPerCity       = isMilitaristic ? 1.2 : isCivilized ? 0.75 : 1.0;
  const baseMilitaryNeeds  = Math.max(isMilitaristic ? 2 : 1, Math.floor(playerCities.length * unitsPerCity));
  // Hard cap: never desire more than 1.5 units per city
  const hardMilitaryCap    = Math.ceil(playerCities.length * 1.5);
  // Scale threat multiplier by threat level
  const threatMult         = isWartime ? (aggressivenessScore >= 1 ? 2.0 : 1.75)
                           : isTense  ? (aggressivenessScore >= 1 ? 1.5 : 1.25)
                           : 1;
  const rawDesiredMilitary = Math.min(Math.floor(baseMilitaryNeeds * threatMult), hardMilitaryCap);
  const shieldDrainCap     = player ? TaxSystem.calculateUnitShieldDrain(player, gameState) : 0;
  const drainBudget        = player?.isHuman ? playerCities.length : playerCities.length * 2;
  const militaryCapHit     = shieldDrainCap > drainBudget;
  // Scale military desire by difficulty — on Chieftain the AI keeps a smaller army
  const scaledMilitary     = Math.max(1, Math.round(rawDesiredMilitary * diffParams.aiMilitaryMultiplier));
  const desiredMilitary    = militaryCapHit ? Math.min(scaledMilitary, militaryCount) : scaledMilitary;
  // Only require 1 defender per 2 cities before allowing settlers — previously
  // this equalled cityCount which starved expansion for mid-size civs.
  const minMilitaryBefore  = Math.max(1, Math.ceil(playerCities.length / 2));

  // Whether we already have "enough" military (to decide when to build other things)
  const hasSufficientMilitary = militaryCount >= baseMilitaryNeeds;

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
  // Priority 1 — City needs a defender (always)
  // ────────────────────────────────────────────────────────────
  if (needsDefense) {
    setMilitary('defense');
    return;
  }

  // ────────────────────────────────────────────────────────────
  // Priority 2 — Early expansion settlers
  // Must come BEFORE buildings so a new civ doesn't spend its first
  // 20 turns on granary+temple instead of founding a second city.
  // Gate: has minimum military AND city is not actively threatened.
  // ────────────────────────────────────────────────────────────
  if (
    totalSettlers < maxDesiredSettlers &&
    militaryCount >= minMilitaryBefore &&
    !cityThreatened &&
    !isWartime
  ) {
    city.production = { type: 'unit', item: UnitType.SETTLERS, turnsRemaining: 3 };
    return;
  }

  // ────────────────────────────────────────────────────────────
  // Priority 3 — Foundation buildings: granary & temple
  // Build these before expanding military, since they're cheap
  // and provide huge long-term value.
  // ────────────────────────────────────────────────────────────
  if (player && defendersInCity >= 1) {
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
  // Priority 2b — Naval unit (transport for island civs, else exploration)
  // Island-locked civs must build a carry-capable ship to grow their empire;
  // coastal civs with unexplored ocean build an exploration vessel first.
  // ────────────────────────────────────────────────────────────
  if (
    isCityCoastal(city, gameState) &&
    shouldBuildNavalUnits(city.playerId, gameState) &&
    !hasEnoughNavalUnits(city.playerId, gameState) &&
    militaryCount >= minMilitaryBefore
  ) {
    const purpose = needsTransportForExpansion(city.playerId, gameState) ? 'transport' : 'exploration';
    const navalType = getBestNavalUnit(city.playerId, gameState, purpose);
    const navalStats = getUnitStats(navalType);
    const navalCost  = navalStats?.productionCost ?? 40;
    const prod  = estimateProductionOutput(city);
    city.production = { type: 'unit', item: navalType, turnsRemaining: Math.ceil(navalCost / prod) };
    return;
  }

  // ────────────────────────────────────────────────────────────
  // Priority 3 — Threat response: build offensive units
  // ────────────────────────────────────────────────────────────
  if (isWartime && militaryCount < desiredMilitary) {
    if (player && !cityThreatened && estimateProductionOutput(city) >= 4) {
      const preferredWonder = getPreferredWonder(player as any, gameState);
      if (preferredWonder && (isCivilized || isPerfectionist || Math.random() < 0.3)) {
        setWonder(preferredWonder);
        return;
      }
    }
    setMilitary('offense');
    return;
  }

  // Tense: build some military but don't panic
  if (isTense && militaryCount < desiredMilitary && !hasSufficientMilitary) {
    setMilitary('general');
    return;
  }

  // Wonder pursuit — peacetime & tense
  if (player && !cityThreatened && hasSufficientMilitary) {
    const preferredWonder = getPreferredWonder(player as any, gameState);
    if (preferredWonder) {
      const prod = estimateProductionOutput(city);
      // Civilized/perfectionist always chase wonders if they have one;
      // others do so once they have enough military and in mid/late game.
      const shouldChaseWonder =
        (isCivilized || isPerfectionist)
          ? prod >= 2
          : prod >= 3 && (isPeacetime || (!isEarlyGame && militaryCount >= baseMilitaryNeeds));

      if (shouldChaseWonder) {
        setWonder(preferredWonder);
        return;
      }
    }
  }

  // Infrastructure buildings — prioritise over more military in peacetime
  if (player) {
    const nextBuilding = getNextPriorityBuilding(city, player as any, aiTraits);
    if (nextBuilding) {
      setBuilding(nextBuilding);
      return;
    }
  }

  // Top up city defense to the full desired level now that development priorities
  // have been addressed. This is a lower priority than settlers/buildings/wonders
  // but still happens before pure military expansion.
  if (defendersInCity < desiredDefenders) {
    setMilitary('defense');
    return;
  }

  // Fill up military to desired level only under active threat.
  // In peacetime, existing units are enough — avoid spamming units between settlers.
  if (!isPeacetime && militaryCount < desiredMilitary && militaryCount < hardMilitaryCap) {
    setMilitary('general');
    return;
  }

  // Mid/late settlers
  if (totalSettlers < maxDesiredSettlers) {
    city.production = { type: 'unit', item: UnitType.SETTLERS, turnsRemaining: 3 };
    return;
  }

  // Opportunistic wonder chase
  if (player) {
    const anyWonder = getPreferredWonder(player as any, gameState);
    if (!anyWonder) {
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

  // Fallback: prefer infrastructure, avoid unit spam
  if (player) {
    const nextBuilding = getNextPriorityBuilding(city, player as any, aiTraits);
    if (nextBuilding) {
      setBuilding(nextBuilding);
      return;
    }
  }

  // Only add more military if below the hard cap and it makes sense
  if (militaryCount < hardMilitaryCap && (isMilitaristic || isWartime || isTense)) {
    setMilitary('general');
    return;
  }

  // At cap or in peacetime with everything built
  city.production = null;
}

/** Force re-evaluation of production for a city (called when production completes or conditions change). */
export function reevaluateCityProduction(city: City, gameState: GameState): void {
  city.production = null;
  setAICityProduction(city, gameState);
}
