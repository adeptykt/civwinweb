import { UnitType, UnitStats, BuildingType, UnitCategory, City, Tile, ProductionType } from '../types/game';
import { BuildingStats, BUILDING_DEFINITIONS } from './BuildingDefinitions';
import { WonderStats, WonderDefinitions } from './WonderDefinitions';
import { TechnologyType } from './TechnologyDefinitions';
import { UNIT_DEFINITIONS } from './UnitDefinitions';
import { WaterAccess } from '../utils/WaterAccess';
import { DebugSystem } from '../utils/DebugSystem';

export interface ProductionOption {
  type: 'unit' | 'building' | 'wonder';
  id: string;
  name: string;
  cost: number;
  turns: number;
  description?: string;
  requiredTechnology?: TechnologyType;
}

export class ProductionManager {
  /**
   * Get all available production options for a city based on known technologies
   */
  public static getAvailableProduction(
    knownTechnologies: TechnologyType[],
    existingBuildings: BuildingType[],
    cityProductionCapacity: number = 1,
    currentProductionPoints: number = 0,
    city?: City,
    worldMap?: Tile[][],
    gameState?: any // Added to check for existing wonders
  ): ProductionOption[] {
    const options: ProductionOption[] = [];
    
    // Check water access for the city
    const hasWaterAccess = city && worldMap ? WaterAccess.hasWaterAccess(city, worldMap) : true;
    
    // Add available units
    const currentProductionUnit = city?.production?.type === 'unit' ? city.production.item : null;
    const availableUnits = this.getAvailableUnits(knownTechnologies, hasWaterAccess, currentProductionUnit);
    availableUnits.forEach(unitType => {
      const stats = UNIT_DEFINITIONS[unitType];
      const remainingCost = Math.max(0, stats.productionCost - currentProductionPoints);
      const turns = remainingCost > 0 ? Math.ceil(remainingCost / cityProductionCapacity) : 1;
      
      options.push({
        type: 'unit',
        id: unitType,
        name: this.formatUnitName(unitType),
        cost: stats.productionCost,
        turns: turns,
        description: this.getUnitDescription(unitType, stats),
        requiredTechnology: stats.requiredTechnology
      });
    });
    
    // Add available buildings
    const availableBuildings = this.getAvailableBuildings(knownTechnologies, existingBuildings, hasWaterAccess);
    availableBuildings.forEach(buildingType => {
      const stats = BUILDING_DEFINITIONS[buildingType];
      const remainingCost = Math.max(0, stats.productionCost - currentProductionPoints);
      const turns = remainingCost > 0 ? Math.ceil(remainingCost / cityProductionCapacity) : 1;
      
      options.push({
        type: 'building',
        id: buildingType,
        name: stats.name,
        cost: stats.productionCost,
        turns: turns,
        description: stats.description,
        requiredTechnology: stats.requiredTechnology
      });
    });
    
    // Add available wonders
    const existingWonders = gameState ? this.getExistingWonders(gameState) : [];
    const availableWonders = this.getAvailableWonders(knownTechnologies, existingWonders);
    availableWonders.forEach(wonderId => {
      const stats = WonderDefinitions[wonderId];
      const remainingCost = Math.max(0, stats.productionCost - currentProductionPoints);
      const turns = remainingCost > 0 ? Math.ceil(remainingCost / cityProductionCapacity) : 1;
      
      options.push({
        type: 'wonder',
        id: wonderId,
        name: stats.name,
        cost: stats.productionCost,
        turns: turns,
        description: stats.description,
        requiredTechnology: stats.requiredTechnology
      });
    });
    
    // Sort options: Settlers first, then by cost (cheaper items first)
    options.sort((a, b) => {
      // Always put Settlers first
      if (a.id === UnitType.SETTLERS) return -1;
      if (b.id === UnitType.SETTLERS) return 1;
      
      // For all other items, sort by cost
      return a.cost - b.cost;
    });
    
    return options;
  }
  
  /**
   * Get available units based on known technologies and water access
   */
  private static getAvailableUnits(
    knownTechnologies: TechnologyType[], 
    hasWaterAccess: boolean = true,
    currentProductionId?: string | null
  ): UnitType[] {
    // Define non-standard units that should only be available with Civ 2 enhancements
    const nonStandardUnits: UnitType[] = [
      UnitType.WARRIOR,
      UnitType.SCOUT,
      UnitType.ARCHER,
      UnitType.SPEARMAN
    ];
    
    const debugSystem = DebugSystem.getInstance();
    const civ2EnhancementsEnabled = debugSystem.isCiv2EnhancementsEnabled();
    
    return Object.keys(UNIT_DEFINITIONS).filter(unitType => {
      const unitTypeEnum = unitType as UnitType;
      const stats = UNIT_DEFINITIONS[unitTypeEnum];
      
      // Filter out non-standard units if Civ 2 enhancements are disabled
      if (!civ2EnhancementsEnabled && nonStandardUnits.includes(unitTypeEnum)) {
        return false;
      }
      
      // Check if it's a naval unit and requires water access
      if (stats.category === UnitCategory.NAVAL && !hasWaterAccess) {
        return false;
      }
      
      // If no technology requirement, it's available from the start
      if (stats.requiredTechnology && !knownTechnologies.includes(stats.requiredTechnology)) {
        return false;
      }
      
      // Check if obsolete
      if (stats.obsoletedBy && knownTechnologies.includes(stats.obsoletedBy)) {
        // Feature/Bug from Civ 1: If the city is already building the obsolete unit, it can continue
        if (unitTypeEnum !== currentProductionId) {
          return false;
        }
      }
      
      return true;
    }) as UnitType[];
  }
  
  /**
   * Get available buildings based on known technologies, existing buildings, and water access
   */
  private static getAvailableBuildings(
    knownTechnologies: TechnologyType[], 
    existingBuildings: BuildingType[],
    hasWaterAccess: boolean = true
  ): BuildingType[] {
    return Object.values(BuildingType).filter(buildingType => {
      const stats = BUILDING_DEFINITIONS[buildingType];
      
      // Check if it's a water-dependent building and requires water access
      if (this.requiresWaterAccess(buildingType) && !hasWaterAccess) {
        return false;
      }
      
      // Check if already built (most buildings can only be built once)
      if (existingBuildings.includes(buildingType)) {
        return false;
      }
      
      // Check technology requirement
      if (stats.requiredTechnology && !knownTechnologies.includes(stats.requiredTechnology)) {
        return false;
      }
      
      // Check building requirement (e.g., Bank requires Marketplace)
      if (stats.requiredBuilding && !existingBuildings.includes(stats.requiredBuilding)) {
        return false;
      }
      
      // Check if obsolete
      if (stats.obsoletedBy && knownTechnologies.includes(stats.obsoletedBy)) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Format unit names for display
   */
  private static formatUnitName(unitType: UnitType): string {
    return unitType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  /**
   * Get a description for a unit based on its stats
   */
  private static getUnitDescription(_unitType: UnitType, stats: UnitStats): string {
    const parts: string[] = [];
    
    if (stats.attack > 0) {
      parts.push(`Attack: ${stats.attack}`);
    }
    
    if (stats.defense > 0) {
      parts.push(`Defense: ${stats.defense}`);
    }
    
    parts.push(`Movement: ${stats.movement}`);
    
    if (stats.specialAbilities && stats.specialAbilities.length > 0) {
      const abilities = stats.specialAbilities.map(ability => 
        ability.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      );
      parts.push(`Special: ${abilities.join(', ')}`);
    }
    
    return parts.join(' | ');
  }
  
  /**
   * Check if a specific production option is available
   */
  public static canProduce(
    type: ProductionType,
    id: string,
    knownTechnologies: TechnologyType[],
    existingBuildings: BuildingType[] = [],
    hasWaterAccess: boolean = true,
    existingWonders: string[] = [],
    isCurrentlyProducing: boolean = false
  ): boolean {
    if (type === ProductionType.UNIT) {
      const stats = UNIT_DEFINITIONS[id as UnitType];
      if (!stats) return false;
      
      // Check if it's a naval unit and requires water access
      if (stats.category === UnitCategory.NAVAL && !hasWaterAccess) {
        return false;
      }
      
      if (stats.requiredTechnology && !knownTechnologies.includes(stats.requiredTechnology)) {
        return false;
      }
      
      // Check obsolescence unless currently producing it (Civ 1 bug/feature)
      if (!isCurrentlyProducing && stats.obsoletedBy && knownTechnologies.includes(stats.obsoletedBy)) {
        return false;
      }
      
      return true;
    } else if (type === ProductionType.BUILDING) {
      const stats = BUILDING_DEFINITIONS[id as BuildingType];
      if (!stats) return false;
      
      // Check if it's a water-dependent building and requires water access
      if (this.requiresWaterAccess(id as BuildingType) && !hasWaterAccess) {
        return false;
      }
      
      // Check if already built
      if (existingBuildings.includes(id as BuildingType)) {
        return false;
      }
      
      // Check technology requirement
      if (stats.requiredTechnology && !knownTechnologies.includes(stats.requiredTechnology)) {
        return false;
      }
      
      // Check building requirement
      if (stats.requiredBuilding && !existingBuildings.includes(stats.requiredBuilding)) {
        return false;
      }
      
      return true;
    } else if (type === ProductionType.WONDER) {
      const stats = WonderDefinitions[id];
      if (!stats) return false;
      
      // Check if already built (wonders can only be built once per game)
      if (existingWonders.includes(id)) {
        return false;
      }
      
      // Check technology requirement
      if (stats.requiredTechnology && !knownTechnologies.includes(stats.requiredTechnology)) {
        return false;
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Get production cost for an item
   */
  public static getProductionCost(type: ProductionType, id: UnitType | BuildingType): number {
    if (type === ProductionType.UNIT) {
      const stats = UNIT_DEFINITIONS[id];
      return stats.productionCost;
    } else if (type === ProductionType.BUILDING) {
      const stats = BUILDING_DEFINITIONS[id];
      return stats?.productionCost || 0;
    } else if (type === ProductionType.WONDER) {
      const stats = WonderDefinitions[id];
      return stats?.productionCost || 0;
    }
    
    return 0;
  }
  
  /**
   * Check if a building requires water access
   */
  private static requiresWaterAccess(buildingType: BuildingType): boolean {
    // Buildings that require water access
    const waterDependentBuildings: BuildingType[] = [
      BuildingType.HYDRO_PLANT
      // Add other water-dependent buildings here if needed
    ];
    
    return waterDependentBuildings.includes(buildingType);
  }
  
  /**
   * Get available wonders based on known technologies and existing wonders
   */
  private static getAvailableWonders(
    knownTechnologies: TechnologyType[], 
    existingWonders: string[]
  ): string[] {
    return Object.keys(WonderDefinitions).filter(wonderId => {
      const stats = WonderDefinitions[wonderId];
      
      // Check if already built (wonders can only be built once per game)
      if (existingWonders.includes(wonderId)) {
        return false;
      }
      
      // Check technology requirement
      if (stats.requiredTechnology && !knownTechnologies.includes(stats.requiredTechnology)) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Get all existing wonders from the game state
   */
  private static getExistingWonders(gameState: any): string[] {
    const existingWonders: string[] = [];
    
    // Check all cities for existing wonders
    if (gameState.cities) {
      gameState.cities.forEach((city: any) => {
        if (city.buildings) {
          city.buildings.forEach((building: any) => {
            // Wonder buildings are prefixed with 'wonder_'
            if (building.type.startsWith('wonder_')) {
              const wonderId = building.type.replace('wonder_', '');
              if (!existingWonders.includes(wonderId)) {
                existingWonders.push(wonderId);
              }
            }
          });
        }
      });
    }
    
    return existingWonders;
  }
}
