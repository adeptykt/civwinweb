import type { City } from '../types/game';
import { BuildingType } from '../types/game';

/**
 * Civilization I City Growth System
 * Implements the exact food storage and growth mechanics from the original game
 */
export class CityGrowthSystem {
  
  /**
   * Calculate food storage capacity needed for next population level
   * Following Civ1 formula: 20 for 1→2, 30 for 2→3, then +10 per level
   */
  public static calculateFoodStorageCapacity(currentPopulation: number): number {
    if (currentPopulation === 1) {
      return 20;
    } else if (currentPopulation === 2) {
      return 30;
    } else {
      // For population 3 and above: 40, 50, 60, 70, 80, 90, 100, 110, 120, etc.
      return 40 + ((currentPopulation - 3) * 10);
    }
  }

  /**
   * Initialize food storage for a new city
   */
  public static initializeCityFoodStorage(city: City): void {
    city.foodStorage = 0;
    city.foodStorageCapacity = this.calculateFoodStorageCapacity(city.population);
  }

  /**
   * Calculate food consumption for a city
   * Each citizen eats 2 food per turn
   */
  public static calculateFoodConsumption(city: City): number {
    return city.population * 2;
  }

  /**
   * Check if city can grow (has required buildings for population limits)
   */
  public static canCityGrow(city: City): boolean {
    const hasAqueduct = city.buildings.some(b => b.type === BuildingType.AQUEDUCT);

    // Check population limits
    if (city.population >= 10 && !hasAqueduct) {
      return false; // Need aqueduct to grow beyond 10
    }

    return true;
  }

  /**
   * Check if city has granary and apply its effects
   */
  public static hasGranary(city: City): boolean {
    return city.buildings.some(b => b.type === BuildingType.GRANARY);
  }

  /**
   * Process city growth for one turn
   * Returns true if city grew, false otherwise
   */
  public static processCityGrowth(city: City, foodProduction: number): boolean {
    // Calculate food consumption
    const foodConsumption = this.calculateFoodConsumption(city);
    
    // Calculate food surplus (can be negative)
    const foodSurplus = foodProduction - foodConsumption;
    
    if (foodSurplus > 0) {
      // Add surplus food to storage
      city.foodStorage += foodSurplus;
      
      // Check if we can grow
      if (city.foodStorage >= city.foodStorageCapacity && this.canCityGrow(city)) {
        // City grows!
        city.population++;
        
        // Handle granary effect
        if (this.hasGranary(city)) {
          // Granary: only 50% of food storage is used
          city.foodStorage = Math.floor(city.foodStorage / 2);
        } else {
          // No granary: food storage empties completely
          city.foodStorage = 0;
        }
        
        // Update food storage capacity for new population level
        city.foodStorageCapacity = this.calculateFoodStorageCapacity(city.population);
        
        return true; // City grew
      }
    } else if (foodSurplus < 0) {
      // Food deficit - take from storage first
      const deficit = Math.abs(foodSurplus);
      
      if (city.foodStorage >= deficit) {
        // Use stored food to cover deficit
        city.foodStorage -= deficit;
      } else {
        // Not enough stored food - starvation occurs
        city.foodStorage = 0;
        
        // Population decreases by 1 (unless protected by granary from famine)
        if (city.population > 1 && !this.hasGranary(city)) {
          city.population--;
          // Update food storage capacity for new population level
          city.foodStorageCapacity = this.calculateFoodStorageCapacity(city.population);
        }
      }
    }
    
    return false; // City did not grow
  }

  /**
   * Get growth progress as percentage for UI display
   */
  public static getGrowthProgress(city: City): number {
    if (city.foodStorageCapacity === 0) return 0;
    return Math.min(100, (city.foodStorage / city.foodStorageCapacity) * 100);
  }

  /**
   * Get turns until growth (estimate based on current food surplus)
   */
  public static getTurnsUntilGrowth(city: City, currentFoodSurplus: number): number {
    if (currentFoodSurplus <= 0 || !this.canCityGrow(city)) {
      return Infinity; // Cannot grow
    }
    
    const foodNeeded = city.foodStorageCapacity - city.foodStorage;
    return Math.ceil(foodNeeded / currentFoodSurplus);
  }
}
