import { GameState, Unit, City, Position, UnitType } from '../../types/game';
import { getUnitStats } from '../UnitDefinitions';
import { TechnologyType } from '../TechnologyDefinitions';
import { GameInterface } from './AITypes';
import {
  getAITraits,
  getAggressivenessScore,
  getDistance,
  moveUnitTowards,
  exploreRandomly,
  isMilitaryUnit,
} from './AIUtils';

// ─────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────

/** AI logic for military units — attack, defend, or patrol. */
export function handleMilitaryAI(unit: Unit, gameState: GameState, game?: GameInterface): void {
  const aiTraits          = getAITraits(gameState, unit.playerId);
  const aggressivenessScore = getAggressivenessScore(aiTraits);
  const shouldDefend      = shouldUnitDefendCity(unit, gameState);

  const defenseChance = aiTraits.aggression === 'aggressive' ? 0.6
                      : aiTraits.aggression === 'friendly'   ? 0.9
                      : 0.75;

  if (shouldDefend && Math.random() < defenseChance) {
    if (!unit.fortified && !unit.fortifying) {
      console.log(`AI unit ${unit.id} (${unit.type}) fortifying to defend city`);
      if (game) {
        game.fortifyUnit(unit.id);
      } else {
        unit.fortifying      = true;
        unit.movementPoints  = 0;
      }
    }
    return;
  }

  const searchRadius = aggressivenessScore >= 2 ? 8
                     : aggressivenessScore >= 1 ? 6
                     : aggressivenessScore >= 0 ? 4
                     : 2;

  const bestTarget = findBestEnemyTarget(unit, gameState);
  if (bestTarget && getDistance(unit.position, bestTarget.position) <= searchRadius) {
    if (bestTarget.type === 'city') {
      console.log(`AI unit ${unit.id} targeting enemy city ${(bestTarget.target as City).name}`);
    } else {
      console.log(`AI unit ${unit.id} targeting enemy unit ${(bestTarget.target as Unit).type}`);
    }
    moveUnitTowards(unit, bestTarget.position, gameState, game);
    return;
  }

  const enemyUnit = findNearestEnemy(unit, gameState);
  if (enemyUnit && getDistance(unit.position, enemyUnit.position) <= Math.max(3, searchRadius / 2)) {
    moveUnitTowards(unit, enemyUnit.position, gameState, game);
    return;
  }

  const cityNeedingDefense = findCityNeedingDefense(unit, gameState);
  if (cityNeedingDefense) {
    console.log(`AI unit ${unit.id} moving to defend ${cityNeedingDefense.name}`);
    moveUnitTowards(unit, cityNeedingDefense.position, gameState, game);
    return;
  }

  const nearest = findNearestFriendlyCity(unit, gameState);
  if (nearest && getDistance(unit.position, nearest.position) > 2) {
    moveUnitTowards(unit, nearest.position, gameState, game);
  } else {
    exploreRandomly(unit, gameState, game);
  }
}

/** Default AI for non-military, non-settler units. */
export function handleDefaultUnitAI(unit: Unit, gameState: GameState, game?: GameInterface): void {
  exploreRandomly(unit, gameState, game);
}

// ─────────────────────────────────────────────────────────────
// Target-finding helpers
// ─────────────────────────────────────────────────────────────

/** Find the nearest enemy unit (any type). */
export function findNearestEnemy(unit: Unit, gameState: GameState): Unit | null {
  let nearest: Unit | null = null;
  let nearestDist = Infinity;
  for (const other of gameState.units) {
    if (other.playerId !== unit.playerId) {
      const d = getDistance(unit.position, other.position);
      if (d < nearestDist) { nearestDist = d; nearest = other; }
    }
  }
  return nearest;
}

/** Find the nearest enemy city. */
export function findNearestEnemyCity(unit: Unit, gameState: GameState): City | null {
  let nearest: City | null = null;
  let nearestDist = Infinity;
  for (const city of gameState.cities) {
    if (city.playerId !== unit.playerId) {
      const d = getDistance(unit.position, city.position);
      if (d < nearestDist) { nearestDist = d; nearest = city; }
    }
  }
  return nearest;
}

/** Find the nearest friendly city. */
export function findNearestFriendlyCity(unit: Unit, gameState: GameState): City | null {
  let nearest: City | null = null;
  let nearestDist = Infinity;
  for (const city of gameState.cities) {
    if (city.playerId === unit.playerId) {
      const d = getDistance(unit.position, city.position);
      if (d < nearestDist) { nearestDist = d; nearest = city; }
    }
  }
  return nearest;
}

/** Find the highest-priority enemy target within searchRadius tiles. */
export function findBestEnemyTarget(
  unit: Unit,
  gameState: GameState,
): { position: Position; type: 'city' | 'unit'; target: City | Unit } | null {
  const radius = 8;
  let best: { position: Position; type: 'city' | 'unit'; target: City | Unit; priority: number } | null = null;

  for (const city of gameState.cities) {
    if (city.playerId === unit.playerId) continue;
    const d = getDistance(unit.position, city.position);
    if (d > radius) continue;
    const defenders = gameState.units.filter(u =>
      u.position.x === city.position.x && u.position.y === city.position.y && u.playerId === city.playerId
    ).length;
    let priority = 100 + (defenders === 0 ? 50 : 0) - d * 2;
    if (!best || priority > best.priority) best = { position: city.position, type: 'city', target: city, priority };
  }

  for (const enemy of gameState.units) {
    if (enemy.playerId === unit.playerId) continue;
    const d = getDistance(unit.position, enemy.position);
    if (d > radius) continue;
    const stats = getUnitStats(enemy.type);
    let priority = 40 - d * 3;
    if (stats.defense < 2) priority += 10;
    if (enemy.type === UnitType.SETTLERS) priority += 15;
    if (!best || priority > best.priority) best = { position: enemy.position, type: 'unit', target: enemy, priority };
  }

  return best;
}

// ─────────────────────────────────────────────────────────────
// Unit selection
// ─────────────────────────────────────────────────────────────

/** Return the best available military unit to build. */
export function getBestMilitaryUnit(
  playerId: string,
  gameState: GameState,
  purpose: 'defense' | 'offense' | 'general' = 'general',
): { type: UnitType; turns: number } {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return { type: UnitType.MILITIA, turns: 2 };

  const aiTraits = getAITraits(gameState, playerId);
  const allUnits = [
    { type: UnitType.MECH_INF,   cost: 8,  requiredTech: TechnologyType.LABOR_UNION },
    { type: UnitType.ARMOR,      cost: 10, requiredTech: TechnologyType.AUTOMOBILE },
    { type: UnitType.ARTILLERY,  cost: 8,  requiredTech: TechnologyType.ROBOTICS },
    { type: UnitType.RIFLEMEN,   cost: 6,  requiredTech: TechnologyType.CONSCRIPTION },
    { type: UnitType.CANNON,     cost: 6,  requiredTech: TechnologyType.METALLURGY },
    { type: UnitType.MUSKETEERS, cost: 5,  requiredTech: TechnologyType.GUNPOWDER },
    { type: UnitType.KNIGHTS,    cost: 5,  requiredTech: TechnologyType.CHIVALRY },
    { type: UnitType.CATAPULT,   cost: 5,  requiredTech: TechnologyType.MATHEMATICS },
    { type: UnitType.CHARIOT,    cost: 4,  requiredTech: TechnologyType.THE_WHEEL },
    { type: UnitType.LEGION,     cost: 3,  requiredTech: TechnologyType.IRON_WORKING },
    { type: UnitType.CAVALRY,    cost: 3,  requiredTech: TechnologyType.HORSEBACK_RIDING },
    { type: UnitType.PHALANX,    cost: 3,  requiredTech: TechnologyType.BRONZE_WORKING },
    { type: UnitType.MILITIA,    cost: 2,  requiredTech: null as TechnologyType | null },
  ];

  const available = allUnits.filter(u => !u.requiredTech || player.technologies.includes(u.requiredTech));
  if (available.length === 0) return { type: UnitType.MILITIA, turns: 2 };

  let candidates = available;
  if (purpose === 'defense') {
    const defensive = available.filter(u => isDefensiveUnit(u.type));
    candidates = defensive.length > 0 ? defensive.slice(0, 3) : available.slice(0, 3);
  } else if (purpose === 'offense') {
    const offensive = available.filter(u => isOffensiveUnit(u.type));
    candidates = offensive.length > 0 ? offensive : available;
  }

  let selected;
  if (aiTraits.militarism === 'militaristic') {
    selected = Math.random() < 0.7 ? candidates[0] : candidates[Math.min(1, candidates.length - 1)];
  } else if (aiTraits.militarism === 'civilized') {
    if (Math.random() < 0.4) {
      selected = candidates[0];
    } else {
      const cheaper = candidates.slice(1);
      selected = cheaper[Math.floor(Math.random() * cheaper.length)] || candidates[0];
    }
  } else {
    selected = Math.random() < 0.6
      ? candidates[0]
      : candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];
  }

  return { type: selected.type, turns: Math.ceil(selected.cost / 1) };
}

/** Returns true if the unit type is primarily defensive (defense ≥ attack or defense ≥ 3). */
export function isDefensiveUnit(unitType: UnitType): boolean {
  const stats = getUnitStats(unitType);
  return !!stats && (stats.defense >= stats.attack || stats.defense >= 3);
}

/** Returns true if the unit type is primarily offensive (attack > defense, or high attack, or siege). */
export function isOffensiveUnit(unitType: UnitType): boolean {
  const stats = getUnitStats(unitType);
  if (!stats) return false;
  const siege = stats.specialAbilities?.includes('siege_warfare') ||
                stats.specialAbilities?.includes('ignore_city_walls');
  return stats.attack > stats.defense || siege || stats.attack >= 6;
}

// ─────────────────────────────────────────────────────────────
// Defense helpers
// ─────────────────────────────────────────────────────────────

/** Returns true if the unit is currently in a city that needs more defenders. */
export function shouldUnitDefendCity(unit: Unit, gameState: GameState): boolean {
  const city = gameState.cities.find(c =>
    c.playerId === unit.playerId &&
    c.position.x === unit.position.x &&
    c.position.y === unit.position.y
  );
  if (!city) return false;
  const current = countCityDefenders(city, gameState);
  const desired = calculateDesiredDefenders(city, gameState);
  if (current < desired) {
    console.log(`City ${city.name} needs defense: ${current}/${desired} defenders`);
    return true;
  }
  return false;
}

/** Count military units currently at a city's tile (fortified or not). */
export function countCityDefenders(city: City, gameState: GameState): number {
  return gameState.units.filter(u =>
    u.playerId === city.playerId &&
    u.position.x === city.position.x &&
    u.position.y === city.position.y &&
    isMilitaryUnit(u.type)
  ).length;
}

/** Calculate the desired number of defenders for a city. */
export function calculateDesiredDefenders(city: City, gameState: GameState): number {
  let base = 1;
  if (city.population >= 6)      base = 3;
  else if (city.population >= 3) base = 2;

  const nearby = countNearbyEnemies(city, gameState, 5);
  if (nearby > 0) base += Math.min(nearby, 3);

  const playerCities = gameState.cities.filter(c => c.playerId === city.playerId);
  if (playerCities.length === 1 || city.name.toLowerCase().includes('capital')) base += 1;

  return Math.min(base, 4);
}

/** Count nearby enemy units and cities (enemy cities count as 0.5). */
export function countNearbyEnemies(city: City, gameState: GameState, radius: number): number {
  let count = 0;
  for (const u of gameState.units)  { if (u.playerId  !== city.playerId && getDistance(city.position, u.position)      <= radius) count++;    }
  for (const c of gameState.cities) { if (c.playerId  !== city.playerId && getDistance(city.position, c.position)      <= radius) count += 0.5; }
  return Math.floor(count);
}

/** Find a friendly city within 8 tiles that needs more defenders, if any. */
export function findCityNeedingDefense(unit: Unit, gameState: GameState): City | null {
  for (const city of gameState.cities.filter(c => c.playerId === unit.playerId)) {
    if (countCityDefenders(city, gameState) < calculateDesiredDefenders(city, gameState)) {
      if (getDistance(unit.position, city.position) <= 8) return city;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Fortification management
// ─────────────────────────────────────────────────────────────

/** Re-evaluate a fortified unit — wake it if the city has too many defenders. */
export function reevaluateFortifiedUnit(unit: Unit, gameState: GameState, game?: GameInterface): void {
  const city = gameState.cities.find(c =>
    c.playerId === unit.playerId &&
    c.position.x === unit.position.x &&
    c.position.y === unit.position.y
  );

  if (!city) {
    console.log(`AI unit ${unit.id} fortified outside city - waking up`);
    wakeUpUnit(unit, game);
    return;
  }

  if (countCityDefenders(city, gameState) > calculateDesiredDefenders(city, gameState) + 1) {
    const target = findCityNeedingDefense(unit, gameState);
    if (target) {
      console.log(`AI unit ${unit.id} moving from over-defended ${city.name} to ${target.name}`);
      wakeUpUnit(unit, game);
    }
  }
}

/** Wake up a fortified unit. */
export function wakeUpUnit(unit: Unit, game?: GameInterface): void {
  if (game && 'wakeUnit' in game) {
    (game as any).wakeUnit(unit.id);
  } else {
    unit.fortified          = false;
    unit.fortifying         = false;
    unit.fortificationTurns = 0;
  }
}

/** Log the defensive status of all cities for a player (debugging). */
export function logDefensiveStatus(gameState: GameState, playerId: string): void {
  console.log(`=== AI Defensive Status for Player ${playerId} ===`);
  for (const city of gameState.cities.filter(c => c.playerId === playerId)) {
    const current = countCityDefenders(city, gameState);
    const desired = calculateDesiredDefenders(city, gameState);
    console.log(`${current >= desired ? '✅' : '❌'} ${city.name}: ${current}/${desired} defenders (pop: ${city.population})`);
  }
}
