import { GameState, Unit, City, Position, UnitType } from '../../types/game';
import { getUnitStats } from '../UnitDefinitions';
import { TechnologyType } from '../TechnologyDefinitions';
import { TaxSystem } from '../TaxSystem';
import { ProductionManager } from '../ProductionManager';
import { DiplomacyManager, DiplomaticStatus, AIMood } from '../DiplomacyManager';
import { VisibilitySystem } from '../VisibilitySystem';
import { GameInterface } from './AITypes';
import {
  getAITraits,
  getAggressivenessScore,
  getDistance,
  moveUnitTowards,
  exploreRandomly,
  isMilitaryUnit,
  isTileUnseen,
  getUnitAtKey,
} from './AIUtils';

// ─────────────────────────────────────────────────────────────
// Turn-scoped caches – all invalidated when turn number changes.
// Prevents O(units×cities) repeated scans per military unit per turn.
// ─────────────────────────────────────────────────────────────

// cityId → current defender count
const _defenderCountCache = new Map<string, number>();
let   _defenderCountTurn  = -1;

// cityId → desired defender count
const _desiredDefendersCache = new Map<string, number>();
let   _desiredDefendersTurn  = -1;

// `${cityId},${radius}` → nearby enemy count
const _nearbyEnemiesCache = new Map<string, number>();
let   _nearbyEnemiesTurn  = -1;

// playerId → combined military score (cities×3 + units)
const _playerScoreCache = new Map<string, number>();
let   _playerScoreTurn  = -1;

// playerId → whether all their cities are sufficiently defended
const _allCitiesDefendedCache = new Map<string, boolean>();
let   _allCitiesDefendedTurn  = -1;

function invalidateCaches(turn: number): void {
  if (_defenderCountTurn !== turn)     { _defenderCountCache.clear();     _defenderCountTurn     = turn; }
  if (_desiredDefendersTurn !== turn)  { _desiredDefendersCache.clear();  _desiredDefendersTurn  = turn; }
  if (_nearbyEnemiesTurn !== turn)     { _nearbyEnemiesCache.clear();     _nearbyEnemiesTurn     = turn; }
  if (_playerScoreTurn !== turn)       { _playerScoreCache.clear();       _playerScoreTurn       = turn; }
  if (_allCitiesDefendedTurn !== turn) { _allCitiesDefendedCache.clear(); _allCitiesDefendedTurn = turn; }
}

// ─────────────────────────────────────────────────────────────
// Diplomatic helpers
// ─────────────────────────────────────────────────────────────

/**
 * Returns true when the AI unit is diplomatically allowed to attack the
 * target player.  Rules:
 *  - WAR       → always allowed
 *  - UNCONTACTED → never allowed (diplomacy must happen first)
 *  - NEUTRAL / PEACE → only allowed when AI is in AGGRESSIVE mood (very hostile)
 */
function getPlayerScore(playerId: string, gameState: GameState): number {
  invalidateCaches(gameState.turn);
  if (_playerScoreCache.has(playerId)) return _playerScoreCache.get(playerId)!;
  const score = gameState.cities.filter(c => c.playerId === playerId).length * 3
              + gameState.units.filter(u => u.playerId === playerId).length;
  _playerScoreCache.set(playerId, score);
  return score;
}

function canAIAttackPlayer(
  aiPlayerId: string,
  targetPlayerId: string,
  dm: DiplomacyManager,
  gameState: GameState,
): boolean {
  // Barbarians are always fair game — every civilisation is permanently at war with them.
  const targetPlayer = gameState.players.find(p => p.id === targetPlayerId);
  if ((targetPlayer as any)?.isBarbarian) return true;

  const status = dm.getRelationship(aiPlayerId, targetPlayerId).status;
  if (status === DiplomaticStatus.WAR) return true;
  if (status === DiplomaticStatus.UNCONTACTED) return false;

  // NEUTRAL or PEACE: only attack if AGGRESSIVE mood
  const aiPlayer = gameState.players.find(p => p.id === aiPlayerId);
  if (!aiPlayer || !targetPlayer) return false;

  const isAIStronger = getPlayerScore(aiPlayerId, gameState) > getPlayerScore(targetPlayerId, gameState) * 1.1;
  const mood = dm.calculateAIMood(aiPlayer, targetPlayer, isAIStronger, gameState.turn ?? 0);
  return mood === AIMood.AGGRESSIVE;
}

/** AI logic for military units — attack, defend, or patrol. */
export function handleMilitaryAI(unit: Unit, gameState: GameState, game?: GameInterface): void {
  const aiTraits          = getAITraits(gameState, unit.playerId);
  const aggressivenessScore = getAggressivenessScore(aiTraits);
  const shouldDefend      = shouldUnitDefendCity(unit, gameState);

  const dm = game?.getDiplomacyManager?.();

  // ── Peace / no-contact retreat ────────────────────────────────────────────
  // If this unit is adjacent to a player we cannot currently attack (uncontacted
  // or at peace), move toward our nearest friendly city to create separation.
  // This naturally handles the "retreat after signing peace" requirement.
  if (dm) {
    const mapWidth = gameState.worldMap[0]?.length ?? 80;
    const adjacentPeacefulUnit = gameState.units.find(u => {
      if (u.playerId === unit.playerId) return false;
      const dx = Math.abs(u.position.x - unit.position.x);
      const wrappedDx = Math.min(dx, mapWidth - dx);
      const dy = Math.abs(u.position.y - unit.position.y);
      return wrappedDx <= 1 && dy <= 1 && !canAIAttackPlayer(unit.playerId, u.playerId, dm, gameState);
    });
    if (adjacentPeacefulUnit) {
      const nearestFriendly = findNearestFriendlyCity(unit, gameState);
      if (nearestFriendly) {
        moveUnitTowards(unit, nearestFriendly.position, gameState, game);
      } else {
        exploreRandomly(unit, gameState, game);
      }
      return;
    }
  }

  const defenseChance = aiTraits.aggression === 'aggressive' ? 0.6
                      : aiTraits.aggression === 'friendly'   ? 0.9
                      : 0.75;

  if (shouldDefend) {
    // Always fortify when the city needs this unit — no random chance.
    // The old random 25% skip was causing defenders to wander, leaving the
    // city undefended and triggering an infinite militia-build loop.
    if (!unit.fortified && !unit.fortifying) {
      if (game) {
        game.fortifyUnit(unit.id);
      } else {
        unit.fortifying     = true;
        unit.movementPoints = 0;
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
    const targetPlayerId = bestTarget.type === 'city'
      ? (bestTarget.target as City).playerId
      : (bestTarget.target as Unit).playerId;
    if (!dm || canAIAttackPlayer(unit.playerId, targetPlayerId, dm, gameState)) {
      moveUnitTowards(unit, bestTarget.position, gameState, game);
      return;
    }
  }

  const enemyUnit = findNearestEnemy(unit, gameState);
  if (enemyUnit && getDistance(unit.position, enemyUnit.position) <= Math.max(3, searchRadius / 2)) {
    if (!dm || canAIAttackPlayer(unit.playerId, enemyUnit.playerId, dm, gameState)) {
      moveUnitTowards(unit, enemyUnit.position, gameState, game);
      return;
    }
  }

  const cityNeedingDefense = findCityNeedingDefense(unit, gameState);
  if (cityNeedingDefense) {
    //console.log(`AI unit ${unit.id} moving to defend ${cityNeedingDefense.name}`);
    moveUnitTowards(unit, cityNeedingDefense.position, gameState, game);
    return;
  }

  // All cities are adequately defended — this unit is free to explore/patrol.
  // Don't pull idle units back to cities; send them out to scout the map.
  const playerCities = gameState.cities.filter(c => c.playerId === unit.playerId);

  invalidateCaches(gameState.turn);
  let allCitiesDefended: boolean;
  if (_allCitiesDefendedCache.has(unit.playerId)) {
    allCitiesDefended = _allCitiesDefendedCache.get(unit.playerId)!;
  } else {
    allCitiesDefended = playerCities.every(c =>
      countCityDefenders(c, gameState) >= calculateDesiredDefenders(c, gameState)
    );
    _allCitiesDefendedCache.set(unit.playerId, allCitiesDefended);
  }

    if (allCitiesDefended) {
      const nearestEnemyCity = findNearestEnemyCity(unit, gameState);
      if (nearestEnemyCity
          && (!dm || canAIAttackPlayer(unit.playerId, nearestEnemyCity.playerId, dm, gameState))
          && (aiTraits.aggression === "aggressive" || Math.random() < 0.8)) {
        moveUnitTowards(unit, nearestEnemyCity.position, gameState, game);
      } else {
        exploreRandomly(unit, gameState, game);
      }
    } else {
    // Some city needs help but wasn't found within 8 tiles — explore toward
    // unseen areas rather than clumping at the nearest city
    const closestUndefended = findClosestUndefendedCity(unit, gameState);
    if (closestUndefended) {
      moveUnitTowards(unit, closestUndefended.position, gameState, game);
    } else {
      exploreRandomly(unit, gameState, game);
    }
  }
}

/** Default AI for non-military, non-settler units. */
export function handleDefaultUnitAI(unit: Unit, gameState: GameState, game?: GameInterface): void {
  exploreRandomly(unit, gameState, game);
}

// ─────────────────────────────────────────────────────────────
// Target-finding helpers
// ─────────────────────────────────────────────────────────────

/** Find the nearest enemy unit (any type) within the player's current line-of-sight. */
export function findNearestEnemy(unit: Unit, gameState: GameState): Unit | null {
  const visibleKeys = VisibilitySystem.getVisibleKeys(unit.playerId);
  let nearest: Unit | null = null;
  let nearestDist = Infinity;
  for (const key of visibleKeys) {
    const other = getUnitAtKey(key, gameState);
    if (!other || other.playerId === unit.playerId) continue;
    const d = getDistance(unit.position, other.position);
    if (d < nearestDist) { nearestDist = d; nearest = other; }
  }
  return nearest;
}

/** Find the nearest enemy city that is not fully in the shroud. */
export function findNearestEnemyCity(unit: Unit, gameState: GameState): City | null {
  let nearest: City | null = null;
  let nearestDist = Infinity;
  for (const city of gameState.cities) {
    if (city.playerId === unit.playerId) continue;
    if (isTileUnseen(city.position, unit.playerId, gameState)) continue;
    const d = getDistance(unit.position, city.position);
    if (d < nearestDist) { nearestDist = d; nearest = city; }
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

  // Cities are few — iterate them directly; use O(1) position index to count defenders.
  for (const city of gameState.cities) {
    if (city.playerId === unit.playerId) continue;
    if (isTileUnseen(city.position, unit.playerId, gameState)) continue;
    const d = getDistance(unit.position, city.position);
    if (d > radius) continue;
    const cityKey = `${city.position.x},${city.position.y}`;
    const defender = getUnitAtKey(cityKey, gameState);
    const undefended = !defender || defender.playerId !== city.playerId;
    const priority = 100 + (undefended ? 50 : 0) - d * 2;
    if (!best || priority > best.priority) best = { position: city.position, type: 'city', target: city, priority };
  }

  // Walk only currently-visible tiles for enemy units — O(visible tiles).
  const visibleKeys = VisibilitySystem.getVisibleKeys(unit.playerId);
  for (const key of visibleKeys) {
    const enemy = getUnitAtKey(key, gameState);
    if (!enemy || enemy.playerId === unit.playerId) continue;
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

  let available = allUnits.filter(u => !u.requiredTech || player.technologies.includes(u.requiredTech));
  if (available.length === 0) return { type: UnitType.MILITIA, turns: 2 };

  // Filter by what the city can realistically complete given shield drain.
  // Under Despotism/Monarchy, excess units drain shields/turn from city production,
  // making expensive units take tens of turns while cheap ones finish quickly.
  const shieldDrain = TaxSystem.calculateUnitShieldDrain(player, gameState);
  if (shieldDrain > 0) {
    const playerCitiesForDrain = gameState.cities.filter(c => c.playerId === playerId);
    if (playerCitiesForDrain.length > 0) {
      const totalPop = playerCitiesForDrain.reduce((sum, c) => sum + c.population, 0);
      const avgPop = totalPop / playerCitiesForDrain.length;
      const perCityDrain = shieldDrain / playerCitiesForDrain.length;
      const netShieldsPer = Math.max(0.5, avgPop - perCityDrain);
      const budgetMultiplier = player.isHuman ? 1 : 2;
      // Floor raised to 40 so Phalanx (20 shields) is always reachable even when
      // drain is high — previously the floor of 10 left militia as the only option.
      const maxAffordableCost = Math.max(40, Math.round(netShieldsPer * 20 * budgetMultiplier));
      const affordable = available.filter(
        u => ProductionManager.getProductionCost('unit', u.type as any) <= maxAffordableCost
      );
      if (affordable.length > 0) available = affordable;
    }
  }

  // Prefer non-militia units when alternatives exist — militia should only be
  // built when nothing better is researchable or affordable.
  const nonMilitia = available.filter(u => u.type !== UnitType.MILITIA);
  if (nonMilitia.length > 0) available = nonMilitia;

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

/** Returns true if the unit is currently in a city and should act as one of its defenders. */
export function shouldUnitDefendCity(unit: Unit, gameState: GameState): boolean {
  if (!isMilitaryUnit(unit.type)) return false;

  const city = gameState.cities.find(c =>
    c.playerId === unit.playerId &&
    c.position.x === unit.position.x &&
    c.position.y === unit.position.y
  );
  if (!city) return false;

  const desired = calculateDesiredDefenders(city, gameState);
  
  const unitsInCity = gameState.units.filter(u =>
    u.playerId === city.playerId &&
    u.position.x === city.position.x &&
    u.position.y === city.position.y &&
    isMilitaryUnit(u.type)
  );

  if (unitsInCity.length <= desired) {
    return true;
  }

  // If there's a surplus, prioritize keeping units that are already fortified
  unitsInCity.sort((a, b) => {
    const aDef = a.fortified || a.fortifying ? 1 : 0;
    const bDef = b.fortified || b.fortifying ? 1 : 0;
    return bDef - aDef;
  });

  const index = unitsInCity.findIndex(u => u.id === unit.id);
  return index >= 0 && index < desired;
}

/** Count military units currently at a city's tile (fortified or not). Cached per turn. */
export function countCityDefenders(city: City, gameState: GameState): number {
  invalidateCaches(gameState.turn);
  const key = city.id ?? city.name;
  if (_defenderCountCache.has(key)) return _defenderCountCache.get(key)!;
  let count = 0;
  for (const u of gameState.units) {
    if (u.playerId === city.playerId
        && u.position.x === city.position.x
        && u.position.y === city.position.y
        && isMilitaryUnit(u.type)) count++;
  }
  _defenderCountCache.set(key, count);
  return count;
}

/** Calculate the desired number of defenders for a city. Cached per turn. */
export function calculateDesiredDefenders(city: City, gameState: GameState): number {
  invalidateCaches(gameState.turn);
  const key = city.id ?? city.name;
  if (_desiredDefendersCache.has(key)) return _desiredDefendersCache.get(key)!;

  let base = 1;
  if (city.population >= 10) base = 2;

  const nearby = countNearbyEnemies(city, gameState, 5);
  if (nearby > 0) base += Math.min(nearby, 3);

  const playerCities = gameState.cities.filter(c => c.playerId === city.playerId);
  const isCapital = playerCities.length === 1 || city.name.toLowerCase().includes('capital');
  if (isCapital && nearby > 0) base += 1;

  const result = Math.min(base, 4);
  _desiredDefendersCache.set(key, result);
  return result;
}

/** Count nearby enemy units and cities (enemy cities count as 0.5). Cached per turn. */
export function countNearbyEnemies(city: City, gameState: GameState, radius: number): number {
  invalidateCaches(gameState.turn);
  const cacheKey = `${city.id ?? city.name},${radius}`;
  if (_nearbyEnemiesCache.has(cacheKey)) return _nearbyEnemiesCache.get(cacheKey)!;
  let count = 0;
  for (const u of gameState.units)  { if (u.playerId  !== city.playerId && getDistance(city.position, u.position)  <= radius) count++;     }
  for (const c of gameState.cities) { if (c.playerId  !== city.playerId && getDistance(city.position, c.position)  <= radius) count += 0.5; }
  const result = Math.floor(count);
  _nearbyEnemiesCache.set(cacheKey, result);
  return result;
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

/** Find the closest friendly city that still needs defenders (unlimited range). */
export function findClosestUndefendedCity(unit: Unit, gameState: GameState): City | null {
  let best: City | null = null;
  let bestDist = Infinity;
  for (const city of gameState.cities.filter(c => c.playerId === unit.playerId)) {
    if (countCityDefenders(city, gameState) < calculateDesiredDefenders(city, gameState)) {
      const d = getDistance(unit.position, city.position);
      if (d < bestDist) { bestDist = d; best = city; }
    }
  }
  return best;
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

  // Wake up excess defenders — send them out to explore or defend elsewhere
  if (!shouldUnitDefendCity(unit, gameState)) {
    // Check if another city needs defenders first
    const target = findCityNeedingDefense(unit, gameState)
      ?? findClosestUndefendedCity(unit, gameState);
    if (target) {
      console.log(`AI unit ${unit.id} moving from over-defended ${city.name} to ${target.name}`);
      wakeUpUnit(unit, game);
    } else {
      // No city needs defense — wake up to explore
      console.log(`AI unit ${unit.id} waking from ${city.name} to explore`);
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
