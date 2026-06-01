import type { City, GameState, Player, Position } from '../types/game';
import { getUnitStats } from './UnitDefinitions';
import { getCivilization } from './CivilizationDefinitions';
import { calculateLiveScore } from './CivilizationScore';

export interface MilitaryCityRow {
  cityName: string;
  garrison: number;
  threatsNearby: number;
}

export interface MilitaryThreatRow {
  unitLabel: string;
  ownerName: string;
  nearCity: string;
  distance: number;
}

export interface MilitaryReport {
  totalMilitary: number;
  enemyMilitary: number;
  atWarWith: string[];
  cities: MilitaryCityRow[];
  threats: MilitaryThreatRow[];
}

export interface TradeCityRow {
  cityName: string;
  rawTrade: number;
  corruption: number;
  gold: number;
  science: number;
  luxury: number;
}

export interface TradeReport {
  cities: TradeCityRow[];
  totals: { gold: number; science: number; luxury: number; maintenance: number; netGold: number };
}

export interface DemographicsCivRow {
  civName: string;
  leader: string;
  cities: number;
  population: number;
  happy: number;
  content: number;
  unhappy: number;
  militaryUnits: number;
  technologies: number;
  score: number;
  isHuman: boolean;
}

export interface TopCityRow {
  rank: number;
  cityName: string;
  ownerName: string;
  population: number;
  score: number;
}

function wrappedDistance(a: Position, b: Position, mapWidth: number): number {
  const dx = Math.min(Math.abs(a.x - b.x), mapWidth - Math.abs(a.x - b.x));
  const dy = Math.abs(a.y - b.y);
  return dx + dy;
}

function isMilitaryUnit(type: string): boolean {
  try {
    const stats = getUnitStats(type as any);
    return stats.attack > 0 || stats.defense > 0;
  } catch {
    return false;
  }
}

function playerLabel(player: Player): string {
  const civ = getCivilization(player.civilizationType);
  return civ?.peoples ?? player.name;
}

export function buildMilitaryReport(
  gameState: GameState,
  human: Player,
  isHostile: (otherPlayerId: string) => boolean,
  isAtWar: (otherPlayerId: string) => boolean,
): MilitaryReport {
  const mapWidth = gameState.worldMap[0]?.length ?? 80;
  const humanCities = gameState.cities.filter(c => c.playerId === human.id);
  const atWarWith: string[] = [];

  for (const p of gameState.players) {
    if (p.id === human.id || p.defeated) continue;
    if (isAtWar(p.id)) {
      atWarWith.push(playerLabel(p));
    }
  }

  const humanMilitary = gameState.units.filter(
    u => u.playerId === human.id && isMilitaryUnit(u.type),
  );
  const enemyMilitary = gameState.units.filter(
    u => u.playerId !== human.id && !u.playerId.startsWith('barbarian') && isMilitaryUnit(u.type),
  );

  const cities: MilitaryCityRow[] = humanCities.map(city => {
    const garrison = gameState.units.filter(
      u =>
        u.playerId === human.id &&
        u.position.x === city.position.x &&
        u.position.y === city.position.y &&
        isMilitaryUnit(u.type),
    ).length;

    let threatsNearby = 0;
    for (const u of gameState.units) {
      if (u.playerId === human.id || !isHostile(u.playerId)) continue;
      const d = wrappedDistance(u.position, city.position, mapWidth);
      if (d <= 4) threatsNearby++;
    }
    return { cityName: city.name, garrison, threatsNearby };
  });

  const threats: MilitaryThreatRow[] = [];
  const seen = new Set<string>();
  for (const city of humanCities) {
    for (const u of gameState.units) {
      if (u.playerId === human.id || !isHostile(u.playerId)) continue;
      const d = wrappedDistance(u.position, city.position, mapWidth);
      if (d > 4) continue;
      const key = `${u.id}:${city.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const owner = gameState.players.find(p => p.id === u.playerId);
      threats.push({
        unitLabel: u.type,
        ownerName: owner ? playerLabel(owner) : u.playerId,
        nearCity: city.name,
        distance: d,
      });
    }
  }
  threats.sort((a, b) => a.distance - b.distance);

  return {
    totalMilitary: humanMilitary.length,
    enemyMilitary: enemyMilitary.length,
    atWarWith,
    cities,
    threats: threats.slice(0, 24),
  };
}

export function buildDemographicsReport(gameState: GameState): DemographicsCivRow[] {
  const rows: DemographicsCivRow[] = [];

  for (const player of gameState.players) {
    if (player.defeated || (player as Player & { isBarbarian?: boolean }).isBarbarian) continue;

    const civ = getCivilization(player.civilizationType);
    const playerCities = gameState.cities.filter(c => c.playerId === player.id);
    let happy = 0;
    let content = 0;
    let unhappy = 0;

    for (const city of playerCities) {
      happy += city.happyCitizens ?? 0;
      content += city.contentCitizens ?? 0;
      unhappy += city.unhappyCitizens ?? 0;
    }

    const militaryUnits = gameState.units.filter(
      u => u.playerId === player.id && isMilitaryUnit(u.type),
    ).length;

    const population = playerCities.reduce((s, c) => s + c.population, 0);
    const score = player.isHuman ? calculateLiveScore(gameState) : population * 10 + playerCities.length * 5;

    rows.push({
      civName: civ?.peoples ?? player.name,
      leader: civ?.leader ?? player.name,
      cities: playerCities.length,
      population,
      happy,
      content,
      unhappy,
      militaryUnits,
      technologies: player.technologies.length,
      score,
      isHuman: !!player.isHuman,
    });
  }

  rows.sort((a, b) => b.population - a.population);
  return rows;
}

export function buildTopCitiesReport(gameState: GameState, limit = 5): TopCityRow[] {
  const scored = gameState.cities
    .filter(c => {
      const owner = gameState.players.find(p => p.id === c.playerId);
      return owner && !owner.defeated && !(owner as Player & { isBarbarian?: boolean }).isBarbarian;
    })
    .map(city => {
      const owner = gameState.players.find(p => p.id === city.playerId)!;
      const buildingScore = (city.buildings?.length ?? 0) * 2;
      const wonderScore = (city.wonders?.length ?? 0) * 10;
      const score = city.population * 5 + buildingScore + wonderScore;
      return {
        cityName: city.name,
        ownerName: playerLabel(owner),
        population: city.population,
        score,
      };
    })
    .sort((a, b) => b.score - a.score || b.population - a.population)
    .slice(0, limit);

  return scored.map((row, i) => ({ rank: i + 1, ...row }));
}
