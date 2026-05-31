import { TechnologyType } from './TechnologyDefinitions';
import { BuildingType } from '../types/game';
import { t } from '../i18n/I18nService.js';

export interface BuildingStats {
  name: string;
  description: string;
  productionCost: number;
  maintenanceCost: number;
  requiredTechnology?: TechnologyType;
  requiredBuilding?: BuildingType; // Some buildings require others first
  effects: BuildingEffects;
  obsoletedBy?: TechnologyType; // When this tech is discovered, building becomes obsolete
  spritePath: string; // Path to the tinybuilding sprite
}

export interface BuildingEffects {
  // Happiness effects
  happyFaces?: number; // Number of unhappy citizens made content
  
  // Economic effects
  foodBonus?: number; // Percentage bonus to food production (unused for Granary — see granaryKeepsHalfFoodOnGrowth)
  /** Civ 1 style: after growth, half of food in the box is kept toward the next size */
  granaryKeepsHalfFoodOnGrowth?: boolean;
  productionBonus?: number; // Percentage bonus to production (shields)
  tradeBonus?: number; // Percentage bonus to trade
  scienceBonus?: number; // Percentage bonus to science
  
  // Special effects
  preventsFamine?: boolean;
  preventsFireAndPlague?: boolean;
  preventsVolcano?: boolean;
  preventsFlood?: boolean;
  preventsPirateRaids?: boolean;
  reducesCorruption?: number; // Percentage reduction in corruption
  triplesCityDefense?: boolean; // City walls effect
  populationGrowthLimit?: number; // Max population without this building
  veteranUnits?: boolean; // New units start as veterans
  reducesNuclearMeltdownRisk?: boolean;
  reducesPollution?: boolean;
  eliminatesPopulationPollution?: boolean;
  powerBonus?: number; // Additional bonus when combined with power plants
}

export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingStats> = {
  [BuildingType.BARRACKS]: {
    name: 'Barracks',
    description: 'Military training facility. All units produced in this city start as veterans.',
    productionCost: 40,
    maintenanceCost: 1,
    spritePath: '/src/assets/tinybuildings/barracks.png',
    effects: {
      veteranUnits: true,
      preventsPirateRaids: true
    }
  },

  [BuildingType.GRANARY]: {
    name: 'Granary',
    description:
      'Food storage. When the city grows, half of the food already in the box is kept toward the next population (Civ 1). Also prevents losing population to famine.',
    productionCost: 60,
    maintenanceCost: 1,
    requiredTechnology: TechnologyType.POTTERY,
    spritePath: '/src/assets/tinybuildings/granary.png',
    effects: {
      granaryKeepsHalfFoodOnGrowth: true,
      preventsFamine: true
    }
  },

  [BuildingType.TEMPLE]: {
    name: 'Temple',
    description: 'Religious building that makes citizens happier and prevents volcanic disasters.',
    productionCost: 40,
    maintenanceCost: 1,
    requiredTechnology: TechnologyType.CEREMONIAL_BURIAL,
    spritePath: '/src/assets/tinybuildings/temple.png',
    effects: {
      happyFaces: 1, // Makes 1 unhappy citizen content
      preventsVolcano: true
    }
  },

  [BuildingType.PALACE]: {
    name: 'Palace',
    description: 'Seat of government. Reduces corruption throughout your empire.',
    productionCost: 200,
    maintenanceCost: 0,
    requiredTechnology: TechnologyType.MASONRY,
    spritePath: '/src/assets/tinybuildings/palace.png',
    effects: {
      reducesCorruption: 100 // Center of empire for corruption calculations
    }
  },

  [BuildingType.CITY_WALLS]: {
    name: 'City Walls',
    description: 'Fortifications that triple the defense of units in the city and prevent floods.',
    productionCost: 120,
    maintenanceCost: 2,
    requiredTechnology: TechnologyType.MASONRY,
    spritePath: '/src/assets/tinybuildings/city_walls.png',
    effects: {
      triplesCityDefense: true,
      preventsFlood: true
    }
  },

  [BuildingType.LIBRARY]: {
    name: 'Library',
    description: 'Center of learning that increases science production by 50%.',
    productionCost: 80,
    maintenanceCost: 1,
    requiredTechnology: TechnologyType.WRITING,
    spritePath: '/src/assets/tinybuildings/library.png',
    effects: {
      scienceBonus: 50
    }
  },

  [BuildingType.MARKETPLACE]: {
    name: 'Marketplace',
    description: 'Trading center that increases tax revenue and luxuries by 50%.',
    productionCost: 80,
    maintenanceCost: 1,
    requiredTechnology: TechnologyType.CURRENCY,
    spritePath: '/src/assets/tinybuildings/marketplace.png',
    effects: {
      tradeBonus: 50
    }
  },

  [BuildingType.COURTHOUSE]: {
    name: 'Courthouse',
    description: 'Legal center that reduces corruption in the city by 50%.',
    productionCost: 80,
    maintenanceCost: 1,
    requiredTechnology: TechnologyType.CODE_OF_LAWS,
    spritePath: '/src/assets/tinybuildings/courthouse.png',
    effects: {
      reducesCorruption: 50
    }
  },

  [BuildingType.AQUEDUCT]: {
    name: 'Aqueduct',
    description: 'Water system that allows cities to grow beyond size 10 and prevents fire and plague.',
    productionCost: 120,
    maintenanceCost: 2,
    requiredTechnology: TechnologyType.CONSTRUCTION,
    spritePath: '/src/assets/tinybuildings/aqueduct.png',
    effects: {
      populationGrowthLimit: 10, // Cities can't grow past 10 without this
      preventsFireAndPlague: true
    }
  },

  [BuildingType.COLOSSEUM]: {
    name: 'Colosseum',
    description: 'Entertainment venue that makes 3 unhappy citizens content.',
    productionCost: 100,
    maintenanceCost: 4,
    requiredTechnology: TechnologyType.CONSTRUCTION,
    spritePath: '/src/assets/tinybuildings/colosseum.png',
    effects: {
      happyFaces: 3
    }
  },

  [BuildingType.BANK]: {
    name: 'Bank',
    description: 'Financial institution that increases tax revenue and luxuries by 50%. Requires Marketplace.',
    productionCost: 120,
    maintenanceCost: 3,
    requiredTechnology: TechnologyType.BANKING,
    requiredBuilding: BuildingType.MARKETPLACE,
    spritePath: '/src/assets/tinybuildings/bank.png',
    effects: {
      tradeBonus: 50 // Stacks with marketplace for 100% total bonus
    }
  },

  [BuildingType.CATHEDRAL]: {
    name: 'Cathedral',
    description: 'Great religious building that makes 4 unhappy citizens content.',
    productionCost: 160,
    maintenanceCost: 3,
    requiredTechnology: TechnologyType.RELIGION,
    spritePath: '/src/assets/tinybuildings/cathedral.png',
    effects: {
      happyFaces: 4
    }
  },

  [BuildingType.UNIVERSITY]: {
    name: 'University',
    description: 'Higher learning institution that increases science by 50%. Requires Library.',
    productionCost: 160,
    maintenanceCost: 3,
    requiredTechnology: TechnologyType.UNIVERSITY,
    requiredBuilding: BuildingType.LIBRARY,
    spritePath: '/src/assets/tinybuildings/university.png',
    effects: {
      scienceBonus: 50 // Stacks with library for 100% total bonus
    }
  },

  [BuildingType.SEWER_SYSTEM]: {
    name: 'Sewer System',
    description: 'Sanitation system that allows cities to grow beyond size 12. Requires Aqueduct.',
    productionCost: 120,
    maintenanceCost: 2,
    requiredTechnology: TechnologyType.MEDICINE,
    requiredBuilding: BuildingType.AQUEDUCT,
    spritePath: '/src/assets/tinybuildings/sewer_system.png',
    effects: {
      populationGrowthLimit: 12 // Cities can't grow past 12 without this
    }
  },

  [BuildingType.FACTORY]: {
    name: 'Factory',
    description: 'Industrial facility that increases production by 50%.',
    productionCost: 200,
    maintenanceCost: 4,
    requiredTechnology: TechnologyType.INDUSTRIALIZATION,
    spritePath: '/src/assets/tinybuildings/factory.png',
    effects: {
      productionBonus: 50,
      powerBonus: 50 // Gets additional 50% with power plants
    }
  },

  [BuildingType.POWER_PLANT]: {
    name: 'Power Plant',
    description: 'Coal-fired power plant that doubles factory/manufacturing plant bonuses.',
    productionCost: 160,
    maintenanceCost: 4,
    requiredTechnology: TechnologyType.REFINING,
    spritePath: '/src/assets/tinybuildings/power_plant.png',
    effects: {
      powerBonus: 100 // Doubles production bonuses from factories
    }
  },

  [BuildingType.HYDRO_PLANT]: {
    name: 'Hydro Plant',
    description: 'Clean hydroelectric power that doubles factory bonuses and reduces pollution. Requires water access.',
    productionCost: 240,
    maintenanceCost: 4,
    requiredTechnology: TechnologyType.ELECTRONICS,
    spritePath: '/src/assets/tinybuildings/hydro_plant.png',
    effects: {
      powerBonus: 100,
      reducesPollution: true
    }
  },

  [BuildingType.NUCLEAR_PLANT]: {
    name: 'Nuclear Plant',
    description: 'Nuclear power plant that doubles factory bonuses. Risk of meltdown if city in disorder.',
    productionCost: 160,
    maintenanceCost: 2,
    requiredTechnology: TechnologyType.NUCLEAR_POWER,
    spritePath: '/src/assets/tinybuildings/nuclear_plant.png',
    effects: {
      powerBonus: 100,
      reducesPollution: true,
      reducesNuclearMeltdownRisk: false // Actually increases risk during disorder
    }
  },

  [BuildingType.MASS_TRANSIT]: {
    name: 'Mass Transit',
    description: 'Public transportation that eliminates pollution from population.',
    productionCost: 160,
    maintenanceCost: 4,
    requiredTechnology: TechnologyType.MASS_PRODUCTION,
    spritePath: '/src/assets/tinybuildings/mass_transit.png',
    effects: {
      eliminatesPopulationPollution: true
    }
  },

  [BuildingType.RECYCLING_CENTER]: {
    name: 'Recycling Center',
    description: 'Waste management facility that reduces pollution by two-thirds.',
    productionCost: 200,
    maintenanceCost: 2,
    requiredTechnology: TechnologyType.RECYCLING,
    spritePath: '/src/assets/tinybuildings/recycling_center.png',
    effects: {
      reducesPollution: true
    }
  },

  [BuildingType.MANUFACTURING_PLANT]: {
    name: 'Manufacturing Plant',
    description: 'Advanced factory that increases production by 100%. Makes regular factories obsolete.',
    productionCost: 320,
    maintenanceCost: 6,
    requiredTechnology: TechnologyType.ROBOTICS,
    spritePath: '/src/assets/tinybuildings/mfg_plant.png',
    effects: {
      productionBonus: 100,
      powerBonus: 50 // Gets additional 50% with power plants
    }
  },

  [BuildingType.SDI_DEFENSE]: {
    name: 'SDI Defense',
    description: 'Strategic Defense Initiative that protects the city from nuclear attacks.',
    productionCost: 200,
    maintenanceCost: 4,
    requiredTechnology: TechnologyType.SUPERCONDUCTOR,
    spritePath: '/src/assets/tinybuildings/sdi_defense.png',
    effects: {
      // Special: Immunity to nuclear attacks (handled in combat system)
    }
  }
};

// Helper functions
export function getBuildingStats(buildingType: BuildingType): BuildingStats {
  const b = BUILDING_DEFINITIONS[buildingType];
  return {
    ...b,
    name: t(`buildings.${buildingType}.name`),
    description: t(`buildings.${buildingType}.description`)
  };
}

export function getAvailableBuildings(knownTechnologies: TechnologyType[], existingBuildings: BuildingType[]): BuildingType[] {
  return Object.values(BuildingType).filter(buildingType => {
    const stats = getBuildingStats(buildingType);
    
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

export function canBuildBuilding(
  buildingType: BuildingType, 
  knownTechnologies: TechnologyType[], 
  existingBuildings: BuildingType[]
): boolean {
  return getAvailableBuildings(knownTechnologies, existingBuildings).includes(buildingType);
}
