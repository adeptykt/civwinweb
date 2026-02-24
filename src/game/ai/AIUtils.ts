import { GameState, Unit, City, Position, UnitType, TerrainType } from '../../types/game';
import { getCivilization } from '../CivilizationDefinitions';
import { TerrainManager } from '../../terrain/index';
import type { AITraits, AggressionLevel, DevelopmentStyle, MilitarismLevel } from '../CivilizationDefinitions';
import type { GameInterface } from './AITypes';

// ─── Trait helpers ───────────────────────────────────────────────────────────

export function getAITraits(gameState: GameState, playerId: string): AITraits {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) {
    return {
      aggression: 'normal' as AggressionLevel,
      development: 'normal' as DevelopmentStyle,
      militarism: 'normal' as MilitarismLevel,
    };
  }
  return getCivilization(player.civilizationType).aiTraits;
}

export function getAggressivenessScore(traits: AITraits): number {
  let score = 0;
  switch (traits.aggression) {
    case 'friendly':   score -= 2; break;
    case 'aggressive': score += 2; break;
  }
  switch (traits.development) {
    case 'perfectionist': score -= 1; break;
    case 'expansionist':  score += 1; break;
  }
  switch (traits.militarism) {
    case 'civilized':    score -= 1; break;
    case 'militaristic': score += 2; break;
  }
  return score;
}

// ─── Position / map utilities ────────────────────────────────────────────────

export function getDistance(pos1: Position, pos2: Position): number {
  const mapWidth = 80; // Standard world width with wrapping
  const directDx = Math.abs(pos1.x - pos2.x);
  const wrappedDx = mapWidth - directDx;
  const dx = Math.min(directDx, wrappedDx);
  const dy = Math.abs(pos1.y - pos2.y);
  return dx + dy;
}

export function isAtPosition(pos1: Position, pos2: Position): boolean {
  return pos1.x === pos2.x && pos1.y === pos2.y;
}

export function isValidPosition(position: Position, gameState: GameState): boolean {
  const mapWidth  = gameState.worldMap[0]?.length || 80;
  const mapHeight = gameState.worldMap.length    || 50;
  let { x, y } = position;
  x = ((x % mapWidth) + mapWidth) % mapWidth;
  if (y < 0 || y >= mapHeight) return false;
  const tile = gameState.worldMap[y]?.[x];
  if (!tile) return false;
  if (tile.terrain === TerrainType.OCEAN) return false;
  return TerrainManager.isPassable(tile.terrain);
}

export function getValidMoves(position: Position, gameState: GameState): Position[] {
  const directions = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],          [1,  0],
    [-1,  1], [0,  1], [1,  1],
  ] as const;
  return directions
    .map(([dx, dy]) => ({ x: position.x + dx, y: position.y + dy }))
    .filter(pos => isValidPosition(pos, gameState));
}

// ─── Unit classification ─────────────────────────────────────────────────────

export function isMilitaryUnit(unitType: UnitType): boolean {
  const militaryTypes: UnitType[] = [
    UnitType.MILITIA,   UnitType.WARRIOR,   UnitType.PHALANX,  UnitType.LEGION,
    UnitType.KNIGHTS,   UnitType.MUSKETEERS, UnitType.RIFLEMEN, UnitType.ARTILLERY,
    UnitType.ARMOR,     UnitType.MECH_INF,  UnitType.CAVALRY,  UnitType.CHARIOT,
    UnitType.CATAPULT,  UnitType.CANNON,
  ];
  return militaryTypes.includes(unitType);
}

// ─── Shared city lookup ───────────────────────────────────────────────────────

export function findNearestCityAny(position: Position, gameState: GameState): City | null {
  let nearest: City | null = null;
  let minDist = Infinity;
  for (const city of gameState.cities) {
    const d = getDistance(position, city.position);
    if (d < minDist) { minDist = d; nearest = city; }
  }
  return nearest;
}

// ─── Shared unit movement ────────────────────────────────────────────────────

export function moveUnitTowards(
  unit: Unit,
  target: Position,
  gameState: GameState,
  game?: GameInterface,
): void {
  if (unit.movementPoints <= 0) return;
  const possibleMoves = getValidMoves(unit.position, gameState);
  if (possibleMoves.length === 0) return;

  const isSettler = unit.type === UnitType.SETTLERS;
  const randomnessChance = isSettler ? 0.3 : 0.1;

  if (Math.random() < randomnessChance) {
    const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    executeMove(unit, randomMove, game);
    return;
  }

  const goodMoves: Array<{ move: Position; distance: number }> = [];
  let bestDistance = getDistance(unit.position, target);

  for (const move of possibleMoves) {
    const d = getDistance(move, target);
    if (d < bestDistance) { goodMoves.push({ move, distance: d }); bestDistance = d; }
  }

  let chosenMove: Position;
  if (goodMoves.length > 0) {
    const best = goodMoves.filter(m => m.distance === bestDistance);
    chosenMove = best[Math.floor(Math.random() * best.length)].move;
  } else {
    chosenMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
  }

  executeMove(unit, chosenMove, game);
}

export function exploreRandomly(
  unit: Unit,
  gameState: GameState,
  game?: GameInterface,
): void {
  if (unit.movementPoints <= 0) return;
  const possibleMoves = getValidMoves(unit.position, gameState);
  if (possibleMoves.length === 0) return;

  let chosenMove: Position;

  if (unit.type === UnitType.SETTLERS) {
    // Weighted exploration: prefer empty land, avoid areas already crowded with cities.
    const weighted = possibleMoves.map(move => {
      let weight = 1;
      const nearest = findNearestCityAny(move, gameState);
      if (nearest) {
        const d = getDistance(move, nearest.position);
        if (d < 4) weight *= 0.3;
        else if (d < 6) weight *= 0.7;
      }
      const tile = gameState.worldMap[move.y]?.[move.x];
      if (tile) {
        switch (tile.terrain) {
          case TerrainType.GRASSLAND:
          case TerrainType.RIVER:   weight *= 1.5; break;
          case TerrainType.PLAINS:
          case TerrainType.HILLS:   weight *= 1.2; break;
          case TerrainType.DESERT:
          case TerrainType.SWAMP:   weight *= 0.5; break;
        }
      }
      return { move, weight };
    });

    const total = weighted.reduce((s, w) => s + w.weight, 0);
    let rng = Math.random() * total;
    chosenMove = weighted[0].move;
    for (const w of weighted) {
      rng -= w.weight;
      if (rng <= 0) { chosenMove = w.move; break; }
    }
  } else {
    chosenMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
  }

  executeMove(unit, chosenMove, game);
}

// ─── Internal helper ─────────────────────────────────────────────────────────

function executeMove(unit: Unit, pos: Position, game?: GameInterface): void {
  if (game) {
    game.moveUnit(unit.id, pos);
  } else {
    unit.position = pos;
    unit.movementPoints = Math.max(0, unit.movementPoints - 1);
  }
}
