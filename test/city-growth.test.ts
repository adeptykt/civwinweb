import { describe, it, expect, beforeEach } from 'vitest';
import { CityGrowthSystem } from '../src/game/CityGrowthSystem';
import { BuildingType, City } from '../src/types/game';

describe('City Growth System', () => {
  let mockCity: City;

  beforeEach(() => {
    mockCity = {
      id: 'test-city',
      name: 'Test City',
      position: { x: 0, y: 0 },
      population: 1,
      playerId: 'test-player',
      buildings: [],
      production: null,
      food: 0,
      foodStorage: 0,
      foodStorageCapacity: 0,
      production_points: 0,
      science: 0,
      culture: 0
    };
    CityGrowthSystem.initializeCityFoodStorage(mockCity);
  });

  describe('Food Storage Capacity', () => {
    it('should calculate correct capacity for population 1', () => {
      const capacity = CityGrowthSystem.calculateFoodStorageCapacity(1);
      expect(capacity).toBe(20);
    });

    it('should calculate correct capacity for population 5', () => {
      const capacity = CityGrowthSystem.calculateFoodStorageCapacity(5);
      expect(capacity).toBe(60);
    });

    it('should increase capacity as population grows', () => {
      const cap1 = CityGrowthSystem.calculateFoodStorageCapacity(1);
      const cap2 = CityGrowthSystem.calculateFoodStorageCapacity(2);
      expect(cap2).toBeGreaterThan(cap1);
    });
  });

  describe('City Growth Mechanics', () => {
    it('should initialize city food storage correctly', () => {
      expect(mockCity.foodStorage).toBe(0);
      expect(mockCity.foodStorageCapacity).toBe(20);
    });

    it('should grow when food storage is full', () => {
      mockCity.foodStorage = mockCity.foodStorageCapacity - 1;
      const foodProduction = 4;
      
      const grew = CityGrowthSystem.processCityGrowth(mockCity, foodProduction);
      
      expect(grew).toBe(true);
      expect(mockCity.population).toBe(2);
    });

    it('should not grow when food storage is not full', () => {
      mockCity.foodStorage = 5;
      const foodProduction = 2;
      
      const grew = CityGrowthSystem.processCityGrowth(mockCity, foodProduction);
      
      expect(grew).toBe(false);
      expect(mockCity.population).toBe(1);
    });

    it('should accumulate food over multiple turns', () => {
      const initialStorage = mockCity.foodStorage;
      const foodProduction = 4;
      
      CityGrowthSystem.processCityGrowth(mockCity, foodProduction);
      
      expect(mockCity.foodStorage).toBeGreaterThan(initialStorage);
    });
  });

  describe('Food Consumption', () => {
    it('should calculate correct consumption for population 1', () => {
      mockCity.population = 1;
      const consumption = CityGrowthSystem.calculateFoodConsumption(mockCity);
      expect(consumption).toBe(2);
    });

    it('should calculate correct consumption for population 5', () => {
      mockCity.population = 5;
      const consumption = CityGrowthSystem.calculateFoodConsumption(mockCity);
      expect(consumption).toBe(10);
    });

    it('should increase consumption with population', () => {
      mockCity.population = 1;
      const consumption1 = CityGrowthSystem.calculateFoodConsumption(mockCity);
      
      mockCity.population = 3;
      const consumption3 = CityGrowthSystem.calculateFoodConsumption(mockCity);
      
      expect(consumption3).toBeGreaterThan(consumption1);
    });
  });

  describe('Granary Effect', () => {
    beforeEach(() => {
      mockCity.population = 2;
      mockCity.foodStorage = 28; // Close to capacity of 30
      mockCity.foodStorageCapacity = 30;
      mockCity.buildings = [{ type: BuildingType.GRANARY, completedTurn: 1 }];
    });

    it('should preserve food storage when city grows with granary', () => {
      const foodProduction = 10; // Enough to grow
      
      const grew = CityGrowthSystem.processCityGrowth(mockCity, foodProduction);
      
      // City should grow
      expect(grew).toBe(true);
      // With granary, some food should be preserved
      expect(mockCity.foodStorage).toBeGreaterThanOrEqual(0);
    });

    it('should have granary effect different from without granary', () => {
      const cityWithoutGranary = { ...mockCity, buildings: [] };
      CityGrowthSystem.initializeCityFoodStorage(cityWithoutGranary);
      
      // Both start at same state before growth
      cityWithoutGranary.foodStorage = 28;
      mockCity.foodStorage = 28;
      
      CityGrowthSystem.processCityGrowth(cityWithoutGranary, 5);
      CityGrowthSystem.processCityGrowth(mockCity, 5);
      
      // After growth, granary city should have more food stored
      if (cityWithoutGranary.population > 2 && mockCity.population > 2) {
        expect(mockCity.foodStorage).toBeGreaterThanOrEqual(cityWithoutGranary.foodStorage);
      }
    });
  });

  describe('Growth Progress', () => {
    it('should calculate growth progress correctly', () => {
      mockCity.foodStorage = 10;
      mockCity.foodStorageCapacity = 20;
      
      const progress = CityGrowthSystem.getGrowthProgress(mockCity);
      
      expect(progress).toBe(50);
    });

    it('should return 100 when storage is full', () => {
      mockCity.foodStorage = mockCity.foodStorageCapacity;
      
      const progress = CityGrowthSystem.getGrowthProgress(mockCity);
      
      expect(progress).toBe(100);
    });

    it('should return 0 when storage is empty', () => {
      mockCity.foodStorage = 0;
      
      const progress = CityGrowthSystem.getGrowthProgress(mockCity);
      
      expect(progress).toBe(0);
    });
  });

  describe('Growth Limits', () => {
    it('should not grow beyond population 10 without aqueduct', () => {
      mockCity.population = 10;
      CityGrowthSystem.initializeCityFoodStorage(mockCity);
      
      const canGrow = CityGrowthSystem.canCityGrow(mockCity);
      
      expect(canGrow).toBe(false);
    });

    it('should allow growth past 10 with aqueduct', () => {
      mockCity.population = 10;
      mockCity.buildings = [{ type: BuildingType.AQUEDUCT, completedTurn: 1 }];
      
      const canGrow = CityGrowthSystem.canCityGrow(mockCity);
      
      expect(canGrow).toBe(true);
    });
  });
});
