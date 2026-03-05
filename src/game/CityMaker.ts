import { City, GameState, Player, Position, Unit, UnitType } from '../types/game';
import { getCivilization } from './CivilizationDefinitions';
import { CityGrowthSystem } from './CityGrowthSystem';
import { ProductionManager } from './ProductionManager';
import { ProductionType } from '../types/game';
import { SoundEffects } from '../utils/SoundEffects';

export class CityFoundingSystem {
  private gameState: GameState;
  private emit: (event: string, data?: any) => void;
  private removeUnitFromQueue: (unitId: string) => void;
  /**
   * Delegate to TurnManager.calculateProductionOutput — passed in so this
   * system does not depend on TurnManager directly.
   */
  private calcProductionOutput: (city: City, gameState: GameState) => number;

  // Random word components for generating city names when civilization list is exhausted
  private readonly cityPrefixes = [
    'New', 'Old', 'Great', 'Little', 'Upper', 'Lower', 'North', 'South', 'East', 'West',
    'Fort', 'Port', 'Mount', 'Lake', 'River', 'Valley', 'Hill', 'Stone', 'Golden', 'Silver',
  ];

  private readonly citySuffixes = [
    'town', 'city', 'burg', 'holm', 'ford', 'haven', 'port', 'field', 'wood', 'hill',
    'vale', 'stead', 'bridge', 'marsh', 'grove', 'ridge', 'fall', 'glen', 'moor', 'wick',
  ];

  constructor(
    gameState: GameState,
    emit: (event: string, data?: any) => void,
    removeUnitFromQueue: (unitId: string) => void,
    calcProductionOutput: (city: City, gameState: GameState) => number,
  ) {
    this.gameState = gameState;
    this.emit = emit;
    this.removeUnitFromQueue = removeUnitFromQueue;
    this.calcProductionOutput = calcProductionOutput;
  }

  // ── City naming ────────────────────────────────────────────────────────────

  private generateRandomCityName(): string {
    const prefix = this.cityPrefixes[Math.floor(Math.random() * this.cityPrefixes.length)];
    const suffix = this.citySuffixes[Math.floor(Math.random() * this.citySuffixes.length)];
    return `${prefix}${suffix}`;
  }

  public generateCityName(playerId: string): string {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) {
      console.warn('generateCityName: Player not found for ID:', playerId);
      return 'New City';
    }

    const civilization = getCivilization(player.civilizationType);
    console.log('generateCityName: Player civilization:', civilization.name, 'Available cities:', civilization.cities.length);
    console.log('generateCityName: Player used city names:', player.usedCityNames);

    const availableCityNames = civilization.cities.filter(
      cityName => !player.usedCityNames.includes(cityName)
    );

    console.log('generateCityName: Available city names:', availableCityNames);

    if (availableCityNames.length > 0) {
      const cityName = availableCityNames[0];
      console.log('generateCityName: Returning civilization city name:', cityName);
      return cityName;
    }

    console.log('generateCityName: All civilization names exhausted, generating random name');

    let randomName: string;
    let attempts = 0;
    const maxAttempts = 50;

    do {
      randomName = this.generateRandomCityName();
      attempts++;
    } while (player.usedCityNames.includes(randomName) && attempts < maxAttempts);

    if (player.usedCityNames.includes(randomName)) {
      randomName = `${randomName} ${player.usedCityNames.length + 1}`;
    }

    console.log('generateCityName: Returning random city name:', randomName);
    return randomName;
  }

  // ── City founding ──────────────────────────────────────────────────────────

  public foundCity(unitId: string, cityName?: string): boolean {
    const unit = this.gameState.units.find((u: Unit) => u.id === unitId);
    if (!unit || unit.type !== UnitType.SETTLERS) return false;

    if (!this.isValidPosition(unit.position)) {
      console.log('foundCity: Cannot found city - invalid terrain');
      return false;
    }

    const minDistance = 3;
    for (const city of this.gameState.cities) {
      if (this.calculateWrappedDistance(unit.position, city.position) < minDistance) {
        console.log('foundCity: Cannot found city - too close to existing city');
        return false;
      }
    }

    console.log('foundCity: Founding city for player:', unit.playerId);

    const finalCityName = cityName || this.generateCityName(unit.playerId);
    console.log('foundCity: Final city name chosen:', finalCityName);

    const player = this.gameState.players.find(p => p.id === unit.playerId);
    if (player && !player.usedCityNames.includes(finalCityName)) {
      player.usedCityNames.push(finalCityName);
      console.log('foundCity: Marked city name as used. Player used names now:', player.usedCityNames);
    }

    const city: City = {
      id: `city-${Date.now()}`,
      name: finalCityName,
      position: unit.position,
      population: 1,
      playerId: unit.playerId,
      buildings: [],
      wonders: [],
      production: null,
      food: 0,
      foodStorage: 0,
      foodStorageCapacity: 0,
      production_points: 0,
      science: 0,
      culture: 0,
      discoveredByPlayers: [unit.playerId],
    };

    CityGrowthSystem.initializeCityFoodStorage(city);
    this.gameState.cities.push(city);

    const bestDefensiveUnit = this.getBestDefensiveUnit(unit.playerId);
    if (bestDefensiveUnit) {
      city.production = {
        type: 'unit' as any,
        item: bestDefensiveUnit.type as any,
        turnsRemaining: bestDefensiveUnit.turns,
      };
    }

    this.gameState.units = this.gameState.units.filter((u: Unit) => u.id !== unitId);
    this.removeUnitFromQueue(unitId);

    const foundingPlayer = this.gameState.players.find(p => p.id === unit.playerId);
    if (foundingPlayer?.isHuman) {
      SoundEffects.playCityFoundingSound();
    }

    this.emit('cityFounded', city);
    return true;
  }

  // ── City management ────────────────────────────────────────────────────────

  public renameCity(cityId: string, newName: string): boolean {
    const city = this.gameState.cities.find(c => c.id === cityId);
    if (!city) return false;

    const oldName = city.name;
    city.name = newName;

    const player = this.gameState.players.find(p => p.id === city.playerId);
    if (player) {
      const oldNameIndex = player.usedCityNames.indexOf(oldName);
      if (oldNameIndex !== -1) {
        player.usedCityNames.splice(oldNameIndex, 1);
      }
      if (!player.usedCityNames.includes(newName)) {
        player.usedCityNames.push(newName);
      }
    }

    this.emit('cityRenamed', { city, oldName, newName });
    return true;
  }

  public getCityProductionOutput(cityId: string): number {
    const city = this.gameState.cities.find(c => c.id === cityId);
    if (!city) return 0;
    return this.calcProductionOutput(city, this.gameState);
  }

  public changeCityProduction(cityId: string, production: string): boolean {
    const city = this.gameState.cities.find(c => c.id === cityId);
    if (!city) return false;

    const player = this.gameState.players.find(p => p.id === city.playerId);
    if (!player) return false;

    const existingBuildings = city.buildings.map(b => b.type as any);
    const actualCityProduction = Math.max(1, this.calcProductionOutput(city, this.gameState));
    const availableOptions = ProductionManager.getAvailableProduction(
      player.technologies,
      existingBuildings,
      actualCityProduction,
      city.production_points,
      city,
      this.gameState.worldMap,
      this.gameState,
    );

    const selectedOption = availableOptions.find(opt =>
      opt.id === production || opt.name === production || opt.id === production.toLowerCase()
    );

    if (!selectedOption) {
      console.warn(`Production option '${production}' is not available for this city`);
      return false;
    }

    city.production = {
      type: selectedOption.type,
      item: selectedOption.id,
      turnsRemaining: selectedOption.turns,
    } as any;

    this.emit('cityProductionChanged', { city, production });
    return true;
  }

  // Initialize food storage for all existing cities (for backward compatibility)
  public initializeFoodStorageForExistingCities(): void {
    this.gameState.cities.forEach(city => {
      if (city.foodStorageCapacity === undefined) {
        CityGrowthSystem.initializeCityFoodStorage(city);
      }
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private getBestDefensiveUnit(playerId: string): { type: string; turns: number } | null {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return null;

    const defensiveUnits = [
      UnitType.RIFLEMEN,
      UnitType.MUSKETEERS,
      UnitType.PHALANX,
      UnitType.MILITIA,
    ];

    for (const unitType of defensiveUnits) {
      if (ProductionManager.canProduce(ProductionType.UNIT, unitType, player.technologies, [])) {
        const cost = ProductionManager.getProductionCost(ProductionType.UNIT, unitType);
        const turns = Math.ceil(cost / 1);
        return { type: unitType, turns };
      }
    }

    return null;
  }

  private calculateWrappedDistance(pos1: Position, pos2: Position): number {
    const mapWidth = this.gameState.worldMap[0]?.length || 80;
    const directDx = Math.abs(pos1.x - pos2.x);
    const wrappedDx = mapWidth - directDx;
    const dx = Math.min(directDx, wrappedDx);
    const dy = Math.abs(pos1.y - pos2.y);
    return dx + dy;
  }

  private isValidPosition(position: Position): boolean {
    const { y } = position;
    const mapHeight = this.gameState.worldMap.length || 50;
    if (y < 0 || y >= mapHeight) return false;
    return true;
  }

  // Lookup table for production time estimates (carried over for reference)
  private getProductionTime(item: string): number {
    const productionTimes: { [key: string]: number } = {
      'Settler': 4, 'Warrior': 2, 'Phalanx': 3, 'Archer': 3, 'Legion': 4,
      'Scout': 2, 'Granary': 6, 'Barracks': 4, 'Library': 8, 'Temple': 6, 'Walls': 10,
    };
    return productionTimes[item] || 3;
  }
}
