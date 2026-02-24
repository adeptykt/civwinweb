import { GameState, City, UnitType } from '../../types/game';
import { getAITraits, getAggressivenessScore, getDistance } from './AIUtils';
import { countCityDefenders, calculateDesiredDefenders, getBestMilitaryUnit } from './AICombatStrategy';

/** Set production for all AI cities that currently have nothing queued. */
export function processAICities(gameState: GameState, playerId: string): void {
  for (const city of gameState.cities.filter(c => c.playerId === playerId)) {
    if (!city.production) {
      console.log(`AICity: ${city.name} (${city.id}) has no production set, determining production...`);
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

  const militaryTypes: UnitType[] = [
    UnitType.MILITIA, UnitType.WARRIOR, UnitType.PHALANX, UnitType.LEGION,
    UnitType.KNIGHTS, UnitType.MUSKETEERS, UnitType.RIFLEMEN, UnitType.ARTILLERY,
    UnitType.ARMOR, UnitType.MECH_INF, UnitType.CAVALRY, UnitType.CHARIOT,
    UnitType.CATAPULT, UnitType.CANNON,
  ];
  const militaryCount     = playerUnits.filter(u => militaryTypes.includes(u.type)).length;
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
  const desiredMilitary    = Math.floor(baseMilitaryNeeds * threatMult);
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
    console.log(`AICity: ${city.name} choosing varied production: ${chosen.type} ${chosen.item}`);
    city.production = { type: chosen.type as any, item: chosen.item, turnsRemaining: chosen.turns };
  }

  console.log(`AICity: ${city.name} production set:`, city.production);
}

/** Force re-evaluation of production for a city (called when production completes or conditions change). */
export function reevaluateCityProduction(city: City, gameState: GameState): void {
  if (city.production) {
    console.log(`AI re-evaluating production for ${city.name} - current: ${city.production.type} ${city.production.item}`);
  }
  city.production = null;
  setAICityProduction(city, gameState);
}
