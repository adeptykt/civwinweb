import type { GameState, City, Position } from '../types/game';
import { TaxSystem } from './TaxSystem';

export function normalizeTradeRouteCityPair(id1: string, id2: string): { cityIdA: string; cityIdB: string } {
  return id1 < id2 ? { cityIdA: id1, cityIdB: id2 } : { cityIdA: id2, cityIdB: id1 };
}

export function tradeRouteAlreadyExists(gameState: GameState, id1: string, id2: string): boolean {
  const { cityIdA, cityIdB } = normalizeTradeRouteCityPair(id1, id2);
  return (gameState.tradeRoutes ?? []).some(r => r.cityIdA === cityIdA && r.cityIdB === cityIdB);
}

export function wrappedCityDistance(a: Position, b: Position, mapWidth: number): number {
  const dx = Math.abs(a.x - b.x);
  const wrappedDx = Math.min(dx, mapWidth - dx);
  const dy = Math.abs(a.y - b.y);
  return wrappedDx + dy;
}

/** Lump-sum gold split when a caravan opens a route (Civ I–style payoff). */
export function computeCaravanTradeLumpGold(
  gameState: GameState,
  origin: City,
  dest: City,
): { ownerGold: number; partnerGold: number } {
  const mapWidth = gameState.worldMap[0]?.length ?? 80;
  const tradeSum =
    TaxSystem.calculateCityWorktileTradeSum(origin, gameState) +
    TaxSystem.calculateCityWorktileTradeSum(dest, gameState);
  const dist = wrappedCityDistance(origin.position, dest.position, mapWidth);
  const base = tradeSum + dist * 3;
  const ownerGold = Math.max(15, Math.floor(base * 0.55));
  const partnerGold = Math.max(10, Math.floor(base * 0.35));
  return { ownerGold, partnerGold };
}
