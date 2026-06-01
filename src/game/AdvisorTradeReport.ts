import type { GameState, Player } from '../types/game';
import { TaxSystem } from './TaxSystem';
import type { TradeCityRow, TradeReport } from './AdvisorReports';

export function buildTradeReport(gameState: GameState, player: Player): TradeReport {
  const playerCities = gameState.cities.filter(c => c.playerId === player.id);
  const cities: TradeCityRow[] = playerCities.map(city => {
    const bd = TaxSystem.calculateCityTaxBreakdown(city, player, gameState);
    return {
      cityName: city.name,
      rawTrade: bd.rawTrade,
      corruption: bd.corruption,
      gold: bd.totalGold,
      science: bd.totalScience,
      luxury: bd.totalLuxury,
    };
  });

  const summary = TaxSystem.calculatePlayerTaxSummary(player, gameState);
  return {
    cities,
    totals: {
      gold: summary.goldIncome,
      science: summary.scienceIncome,
      luxury: summary.luxuryIncome,
      maintenance: summary.maintenanceCost + summary.unitSupportCost,
      netGold: summary.netGoldIncome,
    },
  };
}
