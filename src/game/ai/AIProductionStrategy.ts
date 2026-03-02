import { GameState, City, UnitType } from '../../types/game';
import { getAITraits, getAggressivenessScore, getDistance, isMilitaryUnit } from './AIUtils';
import { countCityDefenders, calculateDesiredDefenders, getBestMilitaryUnit } from './AICombatStrategy';
import { TaxSystem } from '../TaxSystem';

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
  const aiTraits           = getAITraits(gameState, city.playerId);
  const aggressivenessScore = getAggressivenessScore(aiTraits);

  const playerUnits  = gameState.units.filter(u => u.playerId === city.playerId);
  const playerCities = gameState.cities.filter(c => c.playerId === city.playerId);

  const settlerCount = playerUnits.filter(u => u.type === UnitType.SETTLERS).length;

  const militaryCount     = playerUnits.filter(u => isMilitaryUnit(u.type)).length;
  const settlersInProd    = playerCities.filter(c =>
    c.production?.type === 'unit' && c.production?.item === UnitType.SETTLERS
  ).length;
  const totalSettlers     = settlerCount + settlersInProd;

  const defendersInCity   = countCityDefenders(city, gameState);
  const desiredDefenders  = calculateDesiredDefenders(city, gameState);
  const needsDefense      = defendersInCity < desiredDefenders;

  const isExpansionist    = aiTraits.development === 'expansionist';
  const isPerfectionist   = aiTraits.development === 'perfectionist';
  const isMilitaristic    = aiTraits.militarism  === 'militaristic';
  const isCivilized       = aiTraits.militarism  === 'civilized';

  const nearbyEnemyCities = gameState.cities.filter(c =>
    c.playerId !== city.playerId && getDistance(city.position, c.position) <= 8
  );
  const nearbyEnemyUnits  = gameState.units.filter(u =>
    u.playerId !== city.playerId && getDistance(city.position, u.position) <= 5
  );
  const hasNearbyThreats  = nearbyEnemyCities.length > 0 || nearbyEnemyUnits.length > 0;

  const earlyGameTurn     = isExpansionist ? 25 : 15;
  const isEarlyGame       = gameState.turn <= earlyGameTurn;
  const isMidGame         = gameState.turn > earlyGameTurn && gameState.turn <= 50;

  // Max settlers logic
  let maxDesiredSettlers: number;
  if (isEarlyGame) {
    if      (isExpansionist)  maxDesiredSettlers = Math.min(playerCities.length + 2, 6);
    else if (isPerfectionist) maxDesiredSettlers = Math.min(Math.floor(playerCities.length * 0.75), 3);
    else                       maxDesiredSettlers = Math.min(playerCities.length + 1, 4);
  } else if (isMidGame) {
    if      (isExpansionist)  maxDesiredSettlers = Math.max(3, Math.floor(playerCities.length * 0.6));
    else if (isPerfectionist) maxDesiredSettlers = Math.max(1, Math.floor(playerCities.length * 0.25));
    else                       maxDesiredSettlers = Math.max(2, Math.floor(playerCities.length * 0.5));
  } else {
    maxDesiredSettlers = isExpansionist
      ? Math.max(2, Math.floor(playerCities.length * 0.3))
      : Math.max(1, Math.floor(playerCities.length * 0.2));
  }

  // Desired military
  const unitsPerCity       = isMilitaristic ? 2.5 : isCivilized ? 1.5 : 2.0;
  const baseMilitaryNeeds  = Math.max(isMilitaristic ? 3 : 2, Math.floor(playerCities.length * unitsPerCity));
  const threatMult         = hasNearbyThreats ? (aggressivenessScore >= 1 ? 2.5 : 2) : 1;
  const rawDesiredMilitary = Math.floor(baseMilitaryNeeds * threatMult);
  // Cap desired military at total population + 1 per city to limit shield drain under
  // Despotism/Monarchy (free units = total population; excess each cost 1 shield/turn).
  const player             = gameState.players.find(p => p.id === city.playerId);
  const totalPop           = playerCities.reduce((sum, c) => sum + c.population, 0);
  const shieldDrainCap     = player ? TaxSystem.calculateUnitShieldDrain(player, gameState) : 0;
  // Allow mild drain (up to 1 shield/city); anything more, stop growing the army.
  const drainBudget        = playerCities.length;
  const militaryCapHit     = shieldDrainCap > drainBudget;
  const desiredMilitary    = militaryCapHit
    ? Math.min(rawDesiredMilitary, militaryCount) // already at/over cap — don't build more
    : rawDesiredMilitary;
  const minMilitaryBefore  = Math.max(1, playerCities.length);

  // ── Priority 1: city defence ────────────────────────────────
  if (needsDefense) {
    const best = getBestMilitaryUnit(city.playerId, gameState, 'defense');
    city.production = { type: 'unit', item: best.type, turnsRemaining: best.turns };
  }
  // ── Priority 2: nearby threats ─────────────────────────────
  else if (hasNearbyThreats && militaryCount < desiredMilitary) {
    const best = getBestMilitaryUnit(city.playerId, gameState, 'offense');
    city.production = { type: 'unit', item: best.type, turnsRemaining: best.turns };
  }
  // ── Priority 3: early expansion (only if minimum military exists) ──
  else if (totalSettlers < maxDesiredSettlers && isEarlyGame && militaryCount >= minMilitaryBefore) {
    city.production = { type: 'unit', item: UnitType.SETTLERS, turnsRemaining: 3 };
  }
  // ── Priority 4: basic military needs ───────────────────────
  else if (militaryCount < baseMilitaryNeeds) {
    const best = getBestMilitaryUnit(city.playerId, gameState, 'general');
    city.production = { type: 'unit', item: best.type, turnsRemaining: best.turns };
  }
  // ── Priority 5: mid/late settlers ──────────────────────────
  else if (totalSettlers < maxDesiredSettlers) {
    city.production = { type: 'unit', item: UnitType.SETTLERS, turnsRemaining: 3 };
  }
  // ── Priority 6: variety ────────────────────────────────────
  else {
    const options: Array<{ type: string; item: any; turns: number; weight: number }> = [];
    if (isPerfectionist) {
      options.push(
        { type: 'building', item: 'granary', turns: 4, weight: 3 },
        { type: 'building', item: 'temple',  turns: 6, weight: 2 },
      );
    } else {
      options.push({ type: 'building', item: 'granary', turns: 4, weight: 2 });
    }
    if (isMilitaristic || aggressivenessScore >= 1) {
      const mu = getBestMilitaryUnit(city.playerId, gameState, 'general');
      options.push({ type: 'unit', item: mu.type, turns: mu.turns, weight: isMilitaristic ? 3 : 2 });
    }
    if (isExpansionist && totalSettlers < maxDesiredSettlers + 1) {
      options.push({ type: 'unit', item: UnitType.SETTLERS, turns: 3, weight: 2 });
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
}

/** Force re-evaluation of production for a city (called when production completes or conditions change). */
export function reevaluateCityProduction(city: City, gameState: GameState): void {
  city.production = null;
  setAICityProduction(city, gameState);
}
