/**
 * TaxSystem – Civilization 1 faithful tax / trade / income mechanics.
 *
 * Flow per city each turn:
 *  1. Sum raw trade from worked tiles (city-centre + up to population-1 outer tiles)
 *  2. Apply government trade bonus (+1 trade/city for Republic / Democracy)
 *  3. Subtract corruption (distance-based for most govts; flat for Communism; none for Democracy)
 *  4. Split effective trade by the player's global tax / luxury / science rates
 *  5. Apply building multipliers (Marketplace/Bank ×1.5 each for gold & luxury;
 *                                  Library/University ×1.5 each for science)
 *  6. Add flat specialist contributions (Taxman +1g, Scientist +2s, Entertainer +2lux)
 *
 * Maintenance is deducted from gold income after the above.
 * Unit support costs follow government rules (Despotism gives free units = city population).
 */

import type { City, Player, GameState } from '../types/game';
import { BuildingType, GovernmentType, GOVERNMENTS, UnitType, UnitCategory } from '../types/game';
import { TerrainManager } from '../terrain/index';
import { BUILDING_DEFINITIONS } from './BuildingDefinitions';
import { applyResourceBonuses } from './ResourceBonuses';
import { getUnitStats } from './UnitDefinitions';

// ─── Public output types ──────────────────────────────────────────────────────

export interface CityTaxBreakdown {
  /** Raw trade arrows produced by worked tiles before any deductions */
  rawTrade: number;
  /** Trade lost to corruption */
  corruption: number;
  /** Trade remaining after corruption */
  effectiveTrade: number;
  /** Gold from tax rate (before building multipliers) */
  taxGold: number;
  /** Luxury from luxury rate (before building multipliers) */
  luxuryOutput: number;
  /** Science from science rate (before building multipliers) */
  scienceOutput: number;
  /** Gold after Marketplace/Bank multipliers */
  taxGoldBonused: number;
  /** Luxury after Marketplace/Bank multipliers */
  luxuryBonused: number;
  /** Science after Library/University multipliers */
  scienceBonused: number;
  /** Flat gold from Taxman specialists */
  specialistGold: number;
  /** Flat science from Scientist specialists */
  specialistScience: number;
  /** Flat luxury from Entertainer specialists */
  specialistLuxury: number;
  /** Final gold contributed by this city */
  totalGold: number;
  /** Final science contributed by this city */
  totalScience: number;
  /** Final luxury contributed by this city */
  totalLuxury: number;
}

export interface PlayerTaxSummary {
  /** Gross gold income from all cities */
  goldIncome: number;
  /** Science output from all cities */
  scienceIncome: number;
  /** Luxury output from all cities */
  luxuryIncome: number;
  /** Total building maintenance cost */
  maintenanceCost: number;
  /** Total unit support cost */
  unitSupportCost: number;
  /** Net gold per turn (goldIncome − maintenance − support) */
  netGoldIncome: number;
}

export interface EffectiveTaxRates {
  taxRate: number;
  luxuryRate: number;
  scienceRate: number;
}

// ─── TaxSystem ────────────────────────────────────────────────────────────────

export class TaxSystem {

  // ── Rate helpers ────────────────────────────────────────────────────────────

  /**
   * Return the player's effective tax/luxury/science rates.
   * All rates are 0 during Anarchy (no tax collection).
   */
  public static getEffectiveTaxRates(player: Player): EffectiveTaxRates {
    const gov = GOVERNMENTS[player.government];
    if (!gov.effects.taxCollection) {
      return { taxRate: 0, luxuryRate: 0, scienceRate: 0 };
    }
    const taxRate = player.taxRate ?? 40;
    const luxuryRate = player.luxuryRate ?? 10;
    const scienceRate = Math.max(0, 100 - taxRate - luxuryRate);
    return { taxRate, luxuryRate, scienceRate };
  }

  // ── Capital finder ──────────────────────────────────────────────────────────

  /**
   * Return the player's capital (city with the Palace), or the first city.
   */
  public static findCapitalCity(player: Player, cities: City[]): City | null {
    const playerCities = cities.filter(c => c.playerId === player.id);
    return (
      playerCities.find(c => c.buildings.some(b => b.type === BuildingType.PALACE)) ??
      playerCities[0] ??
      null
    );
  }

  // ── Corruption ──────────────────────────────────────────────────────────────

  /**
   * Corruption rate (0–1) for a city.
   * - Democracy:  0%
   * - Communism:  flat 20% (halved by Courthouse)
   * - Others:     distance-based up to 40% (Despotism/Anarchy) or 25% (Monarchy/Republic),
   *               halved by Courthouse
   */
  public static calculateCorruptionRate(city: City, player: Player, gameState: GameState): number {
    const gov = GOVERNMENTS[player.government];

    if (gov.effects.corruptionType === 'none') return 0;

    const hasCourthouse = city.buildings.some(b => b.type === BuildingType.COURTHOUSE);

    if (gov.effects.corruptionType === 'flat') {
      const base = 0.20;
      return hasCourthouse ? base * 0.5 : base;
    }

    // Distance-based
    const capital = TaxSystem.findCapitalCity(player, gameState.cities);
    if (!capital || capital.id === city.id) return 0;

    const mapWidth = gameState.worldMap[0]?.length ?? 80;
    const rawDx = Math.abs(city.position.x - capital.position.x);
    const dx = Math.min(rawDx, mapWidth - rawDx);
    const dy = Math.abs(city.position.y - capital.position.y);
    const distance = Math.sqrt(dx * dx + dy * dy);

    const mapDiagonal = Math.sqrt(
      mapWidth * mapWidth + gameState.worldMap.length * gameState.worldMap.length
    );

    const isDespotism =
      player.government === GovernmentType.DESPOTISM ||
      player.government === GovernmentType.ANARCHY;
    const maxRate = isDespotism ? 0.40 : 0.25;

    const baseRate = Math.min(maxRate, (distance / mapDiagonal) * maxRate * 2);
    return hasCourthouse ? baseRate * 0.5 : baseRate;
  }

  // ── Tile yield helper ───────────────────────────────────────────────────────

  /**
   * Compute the full yields for a tile (terrain + variant + resources + improvements).
   */
  public static getTileYields(tile: any): { food: number; production: number; trade: number } {
    const yields = TerrainManager.getTerrainYields(tile.terrain);

    // Shield grassland / shield river variant
    if (tile.terrainVariant === 'shield') {
      yields.production += 1;
    }

    // Special resources — authoritative Civ1 values from ResourceBonuses.ts
    if (tile.resources) {
      applyResourceBonuses(yields, tile.resources as string[], tile.terrain as string);
    }

    // Tile improvements
    if (tile.improvements) {
      for (const imp of tile.improvements as Array<{ type: string }>) {
        switch (imp.type) {
          case 'irrigation':
            if (['grassland', 'plains', 'desert', 'river'].includes(tile.terrain)) {
              yields.food += 1;
            }
            break;
          case 'mine':
            if (tile.terrain === 'hills') yields.production += 3;
            else if (tile.terrain === 'mountains') yields.production += 2;
            else if (tile.terrain === 'desert') yields.production += 1;
            else if (tile.terrain !== 'ocean') yields.production += 1;
            break;
          case 'road':
            // Roads add +1 trade to all non-ocean land tiles (Civ1)
            if (!['ocean', 'arctic', 'tundra'].includes(tile.terrain)) {
              yields.trade += 1;
            }
            break;
          case 'farm':
            yields.food += 1;
            break;
        }
      }
    }

    return yields;
  }

  // ── Auto tile selection ─────────────────────────────────────────────────────

  /**
   * Pick up to `city.population` tiles automatically, sorted by highest total value.
   * Mirrors what CityView does when no manual tile selection is set.
   */
  private static getAutoWorkedTiles(
    city: City,
    gameState: GameState
  ): Array<{ dx: number; dy: number }> {
    const mapWidth = gameState.worldMap[0]?.length ?? 80;
    const candidates: Array<{ dx: number; dy: number; value: number }> = [];

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue; // skip corners

        const tileY = city.position.y + dy;
        if (tileY < 0 || tileY >= gameState.worldMap.length) continue;

        const tileX = ((city.position.x + dx) % mapWidth + mapWidth) % mapWidth;
        const tile = gameState.worldMap[tileY]?.[tileX];
        if (!tile) continue;

        const y = TaxSystem.getTileYields(tile);
        candidates.push({ dx, dy, value: y.food + y.production + y.trade });
      }
    }

    candidates.sort((a, b) => b.value - a.value);
    return candidates.slice(0, city.population);
  }

  // ── City raw trade ──────────────────────────────────────────────────────────

  /**
   * Sum trade arrows from the city-centre tile plus all worked outer tiles.
   * Applies the government trade bonus (+1/city for Republic and Democracy).
   */
  public static calculateCityRawTrade(city: City, gameState: GameState): number {
    const mapWidth = gameState.worldMap[0]?.length ?? 80;

    // City-centre (min 1 trade)
    const centreTile = gameState.worldMap[city.position.y]?.[city.position.x];
    let totalTrade = centreTile
      ? Math.max(1, TaxSystem.getTileYields(centreTile).trade)
      : 1;

    // Worked outer tiles
    const workedTiles =
      city.workedTiles && city.workedTiles.length > 0
        ? city.workedTiles
        : TaxSystem.getAutoWorkedTiles(city, gameState);

    for (const { dx, dy } of workedTiles) {
      const tileY = city.position.y + dy;
      if (tileY < 0 || tileY >= gameState.worldMap.length) continue;
      const tileX = ((city.position.x + dx) % mapWidth + mapWidth) % mapWidth;
      const tile = gameState.worldMap[tileY]?.[tileX];
      if (tile) totalTrade += TaxSystem.getTileYields(tile).trade;
    }

    // Government trade bonus
    const player = gameState.players.find(p => p.id === city.playerId);
    if (player) {
      const gov = GOVERNMENTS[player.government];
      if (gov.effects.tradeBonus && totalTrade > 0) totalTrade += 1;
    }

    return totalTrade;
  }

  // ── Per-city breakdown ──────────────────────────────────────────────────────

  /**
   * Full Civ-1-style tax breakdown for a single city.
   */
  public static calculateCityTaxBreakdown(
    city: City,
    player: Player,
    gameState: GameState
  ): CityTaxBreakdown {
    const rates = TaxSystem.getEffectiveTaxRates(player);

    // 1. Raw trade
    const rawTrade = TaxSystem.calculateCityRawTrade(city, gameState);

    // 2. Corruption
    const corruptionRate = TaxSystem.calculateCorruptionRate(city, player, gameState);
    const corruption = Math.floor(rawTrade * corruptionRate);
    const effectiveTrade = Math.max(0, rawTrade - corruption);

    // 3. Split by rates
    // Distribute arrows strictly by fractional remainders, tie-breaking in order: Tax -> Science -> Luxury
    let taxGold = 0;
    let luxuryOutput = 0;
    let scienceOutput = 0;

    const totalRates = rates.taxRate + rates.scienceRate + rates.luxuryRate;
    if (totalRates > 0) {
      const taxRaw = (effectiveTrade * rates.taxRate) / 100;
      const luxRaw = (effectiveTrade * rates.luxuryRate) / 100;
      const sciRaw = (effectiveTrade * rates.scienceRate) / 100;

      taxGold = Math.floor(taxRaw);
      luxuryOutput = Math.floor(luxRaw);
      scienceOutput = Math.floor(sciRaw);

      const remainder = effectiveTrade - taxGold - luxuryOutput - scienceOutput;

      const fractions = [
        { type: 'tax', val: taxRaw - taxGold, order: 1 },
        { type: 'sci', val: sciRaw - scienceOutput, order: 2 },
        { type: 'lux', val: luxRaw - luxuryOutput, order: 3 },
      ].sort((a, b) => {
        if (Math.abs(b.val - a.val) > 0.001) return b.val - a.val;
        return a.order - b.order;
      });

      for (let i = 0; i < remainder; i++) {
        if (fractions[i].type === 'tax') taxGold++;
        else if (fractions[i].type === 'sci') scienceOutput++;
        else if (fractions[i].type === 'lux') luxuryOutput++;
      }
    }

    // 4. Building multipliers
    const hasMarketplace = city.buildings.some(b => b.type === BuildingType.MARKETPLACE);
    const hasBank = city.buildings.some(b => b.type === BuildingType.BANK);
    const hasLibrary = city.buildings.some(b => b.type === BuildingType.LIBRARY);
    const hasUniversity = city.buildings.some(b => b.type === BuildingType.UNIVERSITY);

    const taxLuxMult = (hasMarketplace ? 1.5 : 1.0) * (hasBank ? 1.5 : 1.0);
    const sciMult = (hasLibrary ? 1.5 : 1.0) * (hasUniversity ? 1.5 : 1.0);

    const taxGoldBonused = Math.floor(taxGold * taxLuxMult);
    const luxuryBonused = Math.floor(luxuryOutput * taxLuxMult);
    const scienceBonused = Math.floor(scienceOutput * sciMult);

    // 5. Specialists (flat contributions, not affected by corruption or rates)
    const sp = city.specialists ?? { taxmen: 0, scientists: 0, entertainers: 0 };
    const specialistGold = sp.taxmen * 1;
    const specialistScience = sp.scientists * 2;
    const specialistLuxury = sp.entertainers * 2;

    return {
      rawTrade,
      corruption,
      effectiveTrade,
      taxGold,
      luxuryOutput,
      scienceOutput,
      taxGoldBonused,
      luxuryBonused,
      scienceBonused,
      specialistGold,
      specialistScience,
      specialistLuxury,
      totalGold: taxGoldBonused + specialistGold,
      totalScience: scienceBonused + specialistScience,
      totalLuxury: luxuryBonused + specialistLuxury,
    };
  }

  // ── Maintenance & unit support ──────────────────────────────────────────────

  /**
   * Total building maintenance cost for a player's cities.
   * Returns 0 during Anarchy.
   */
  public static calculateMaintenanceCost(
    player: Player,
    playerCities: City[]
  ): number {
    const gov = GOVERNMENTS[player.government];
    if (!gov.effects.maintenanceCosts) return 0;

    let total = 0;
    for (const city of playerCities) {
      for (const building of city.buildings) {
        if ((building.type as string).startsWith('wonder_')) continue;
        const def = BUILDING_DEFINITIONS[building.type as BuildingType];
        if (def) total += def.maintenanceCost;
      }
    }
    return total;
  }

  /**
   * Unit gold cost for a player per turn.
   *
   * Despotism / Monarchy / Communism: costPerUnit = 0, so gold cost is always 0.
   *   Excess units under those governments cost shields instead (see calculateUnitShieldDrain).
   * Republic / Democracy: all military units cost 1 gold/turn; settlers cost settlerSupport gold.
   */
  public static calculateUnitSupportCost(player: Player, gameState: GameState): number {
    const gov = GOVERNMENTS[player.government];
    const playerUnits = gameState.units.filter(u => u.playerId === player.id);
    const playerCities = gameState.cities.filter(c => c.playerId === player.id);

    // Military units = anything that is not a Settler or Caravan
    const militaryUnits = playerUnits.filter(u => {
      try {
        const stats = getUnitStats(u.type);
        return stats.category !== UnitCategory.SPECIAL;
      } catch {
        return u.type !== UnitType.SETTLERS && u.type !== UnitType.CARAVAN;
      }
    });

    const settlerCount = playerUnits.filter(u => u.type === UnitType.SETTLERS).length;

    let supportCost = 0;

    if (gov.effects.militarySupport.freeUnits === 'population') {
      const totalPop = playerCities.reduce((sum, c) => sum + c.population, 0);
      const paidUnits = Math.max(0, militaryUnits.length - totalPop);
      supportCost += paidUnits * gov.effects.militarySupport.costPerUnit;
    } else {
      supportCost += militaryUnits.length * gov.effects.militarySupport.costPerUnit;
    }

    // Settlers cost gold equal to their support value (1 under Despotism, 2 under others)
    supportCost += settlerCount * gov.effects.settlerSupport;

    return supportCost;
  }

  /**
   * Total shield (production) drain per turn from excess units.
   *
   * Applies only under Despotism and Monarchy:
   *   - Free military units = total city population across the empire.
   *   - Each unit beyond that costs 1 shield/turn, distributed across cities.
   *
   * Returns 0 for all other governments (they use gold upkeep or have no cost).
   */
  public static calculateUnitShieldDrain(player: Player, gameState: GameState): number {
    if (
      player.government !== GovernmentType.DESPOTISM &&
      player.government !== GovernmentType.MONARCHY
    ) {
      return 0;
    }

    const playerUnits = gameState.units.filter(u => u.playerId === player.id);
    const playerCities = gameState.cities.filter(c => c.playerId === player.id);

    const militaryUnits = playerUnits.filter(u => {
      try {
        const stats = getUnitStats(u.type);
        return stats.category !== UnitCategory.SPECIAL;
      } catch {
        return u.type !== UnitType.SETTLERS && u.type !== UnitType.CARAVAN;
      }
    });

    const totalPop = playerCities.reduce((sum, c) => sum + c.population, 0);
    return Math.max(0, militaryUnits.length - totalPop);
  }

  // ── Empire-wide summary ─────────────────────────────────────────────────────

  /**
   * Calculate the full per-turn tax summary for a player.
   */
  public static calculatePlayerTaxSummary(
    player: Player,
    gameState: GameState
  ): PlayerTaxSummary {
    const playerCities = gameState.cities.filter(c => c.playerId === player.id);

    let goldIncome = 0;
    let scienceIncome = 0;
    let luxuryIncome = 0;

    for (const city of playerCities) {
      const bd = TaxSystem.calculateCityTaxBreakdown(city, player, gameState);
      goldIncome += bd.totalGold;
      scienceIncome += bd.totalScience;
      luxuryIncome += bd.totalLuxury;
    }

    const maintenanceCost = TaxSystem.calculateMaintenanceCost(player, playerCities);
    const unitSupportCost = TaxSystem.calculateUnitSupportCost(player, gameState);
    const netGoldIncome = goldIncome - maintenanceCost - unitSupportCost;

    return {
      goldIncome,
      scienceIncome,
      luxuryIncome,
      maintenanceCost,
      unitSupportCost,
      netGoldIncome,
    };
  }
}
