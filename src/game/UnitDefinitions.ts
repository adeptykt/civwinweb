import { UnitType, UnitStats, UnitCategory, Unit } from '../types/game';
import { TechnologyType } from './TechnologyDefinitions';
import { getUnitDisplayName } from '../utils/DisplayNames';

// Complete unit definitions based on Civilization manual
export const UNIT_DEFINITIONS: Record<UnitType, UnitStats> = {
  // Non-combat units
  [UnitType.SETTLERS]: {
    attack: 0,
    defense: 1,
    movement: 1,
    category: UnitCategory.SPECIAL,
    productionCost: 40,
    canAttack: false,
    canFortify: false,
    canMoveOnMountains: true,
    specialAbilities: ['found_city', 'build_improvements', 'add_population']
  },
  
  [UnitType.DIPLOMAT]: {
    attack: 0,
    defense: 0,
    movement: 2,
    category: UnitCategory.SPECIAL,
    requiredTechnology: TechnologyType.WRITING,
    productionCost: 30,
    canAttack: false,
    canFortify: false,
    canMoveOnMountains: true,
    specialAbilities: ['establish_embassy', 'steal_technology', 'sabotage', 'incite_revolt', 'bribe_units']
  },
  
  [UnitType.CARAVAN]: {
    attack: 0,
    defense: 1,
    movement: 1,
    category: UnitCategory.SPECIAL,
    requiredTechnology: TechnologyType.TRADE,
    productionCost: 50,
    canAttack: false,
    canFortify: false,
    canMoveOnMountains: true,
    specialAbilities: ['establish_trade_route', 'help_wonder_construction']
  },
  
  // Ancient military units
  [UnitType.MILITIA]: {
    attack: 1,
    defense: 1,
    movement: 1,
    category: UnitCategory.LAND,
    obsoletedBy: TechnologyType.BRONZE_WORKING,
    productionCost: 10,
    canAttack: true,
    canFortify: true,
    canMoveOnMountains: true
  },
  
  [UnitType.PHALANX]: {
    attack: 1,
    defense: 2,
    movement: 1,
    category: UnitCategory.LAND,
    requiredTechnology: TechnologyType.BRONZE_WORKING,
    obsoletedBy: TechnologyType.GUNPOWDER,
    productionCost: 20,
    canAttack: true,
    canFortify: true,
    canMoveOnMountains: true
  },
  
  [UnitType.LEGION]: {
    attack: 3,
    defense: 1,
    movement: 1,
    category: UnitCategory.LAND,
    requiredTechnology: TechnologyType.IRON_WORKING,
    productionCost: 20,
    canAttack: true,
    canFortify: true,
    canMoveOnMountains: true
  },
  
  [UnitType.CAVALRY]: {
    attack: 2,
    defense: 1,
    movement: 2,
    category: UnitCategory.LAND,
    requiredTechnology: TechnologyType.HORSEBACK_RIDING,
    obsoletedBy: TechnologyType.AUTOMOBILE,
    productionCost: 20,
    canAttack: true,
    canFortify: true,
    canMoveOnMountains: true
  },
  
  [UnitType.CHARIOT]: {
    attack: 4,
    defense: 1,
    movement: 2,
    category: UnitCategory.LAND,
    requiredTechnology: TechnologyType.THE_WHEEL,
    obsoletedBy: TechnologyType.CHIVALRY,
    productionCost: 40,
    canAttack: true,
    canFortify: true,
    canMoveOnMountains: true
  },
  
  [UnitType.CATAPULT]: {
    attack: 6,
    defense: 1,
    movement: 1,
    category: UnitCategory.LAND,
    requiredTechnology: TechnologyType.MATHEMATICS,
    obsoletedBy: TechnologyType.METALLURGY,
    productionCost: 40,
    canAttack: true,
    canFortify: true,
    canMoveOnMountains: true,
    specialAbilities: ['siege_warfare', 'ignore_city_walls']
  },
  
  // Medieval military units
  [UnitType.KNIGHTS]: {
    attack: 4,
    defense: 2,
    movement: 2,
    category: UnitCategory.LAND,
    requiredTechnology: TechnologyType.CHIVALRY,
    obsoletedBy: TechnologyType.AUTOMOBILE,
    productionCost: 40,
    canAttack: true,
    canFortify: true,
    canMoveOnMountains: true
  },
  
  // Gunpowder units
  [UnitType.MUSKETEERS]: {
    attack: 2,
    defense: 3,
    movement: 1,
    category: UnitCategory.LAND,
    requiredTechnology: TechnologyType.GUNPOWDER,
    obsoletedBy: TechnologyType.CONSCRIPTION,
    productionCost: 30,
    canAttack: true,
    canFortify: true,
    canMoveOnMountains: true
  },
  
  [UnitType.CANNON]: {
    attack: 8,
    defense: 1,
    movement: 1,
    category: UnitCategory.LAND,
    requiredTechnology: TechnologyType.METALLURGY,
    obsoletedBy: TechnologyType.ROBOTICS,
    productionCost: 40,
    canAttack: true,
    canFortify: true,
    canMoveOnMountains: true,
    specialAbilities: ['siege_warfare', 'ignore_city_walls']
  },
  
  // Industrial units
  [UnitType.RIFLEMEN]: {
    attack: 3,
    defense: 5,
    movement: 1,
    category: UnitCategory.LAND,
    requiredTechnology: TechnologyType.CONSCRIPTION,
    productionCost: 30,
    canAttack: true,
    canFortify: true,
    canMoveOnMountains: true
  },
  
  [UnitType.ARTILLERY]: {
    attack: 12,
    defense: 2,
    movement: 2,
    category: UnitCategory.LAND,
    requiredTechnology: TechnologyType.ROBOTICS,
    productionCost: 60,
    canAttack: true,
    canFortify: true,
    canMoveOnMountains: true,
    specialAbilities: ['siege_warfare', 'ignore_city_walls']
  },
  
  // Modern units
  [UnitType.ARMOR]: {
    attack: 10,
    defense: 5,
    movement: 3,
    category: UnitCategory.LAND,
    requiredTechnology: TechnologyType.AUTOMOBILE,
    productionCost: 80,
    canAttack: true,
    canFortify: true,
    canMoveOnMountains: true
  },
  
  [UnitType.MECH_INF]: {
    attack: 6,
    defense: 6,
    movement: 3,
    category: UnitCategory.LAND,
    requiredTechnology: TechnologyType.LABOR_UNION,
    productionCost: 50,
    canAttack: true,
    canFortify: true,
    canMoveOnMountains: true
  },
  
  // Naval units
  [UnitType.TRIREME]: {
    attack: 1,
    defense: 0,
    movement: 3,
    category: UnitCategory.NAVAL,
    requiredTechnology: TechnologyType.MAPMAKING,
    obsoletedBy: TechnologyType.NAVIGATION,
    productionCost: 40,
    canAttack: true,
    canFortify: false,
    canMoveOnWater: true,
    canCarryUnits: 2,
    specialAbilities: ['coastal_restriction', 'lost_at_sea_risk']
  },
  
  [UnitType.SAIL]: {
    attack: 1,
    defense: 1,
    movement: 3,
    category: UnitCategory.NAVAL,
    requiredTechnology: TechnologyType.NAVIGATION,
    obsoletedBy: TechnologyType.MAGNETISM,
    productionCost: 40,
    canAttack: true,
    canFortify: false,
    canMoveOnWater: true,
    canCarryUnits: 3
  },
  
  [UnitType.FRIGATE]: {
    attack: 2,
    defense: 2,
    movement: 3,
    category: UnitCategory.NAVAL,
    requiredTechnology: TechnologyType.MAGNETISM,
    obsoletedBy: TechnologyType.STEAM_ENGINE,
    productionCost: 40,
    canAttack: true,
    canFortify: false,
    canMoveOnWater: true,
    canCarryUnits: 4
  },
  
  [UnitType.IRONCLAD]: {
    attack: 4,
    defense: 4,
    movement: 4,
    category: UnitCategory.NAVAL,
    requiredTechnology: TechnologyType.STEAM_ENGINE,
    obsoletedBy: TechnologyType.STEEL,
    productionCost: 60,
    canAttack: true,
    canFortify: false,
    canMoveOnWater: true
  },
  
  [UnitType.CRUISER]: {
    attack: 6,
    defense: 6,
    movement: 6,
    category: UnitCategory.NAVAL,
    requiredTechnology: TechnologyType.COMBUSTION,
    productionCost: 80,
    canAttack: true,
    canFortify: false,
    canMoveOnWater: true,
    visibility: 2,
    specialAbilities: ['shore_bombardment']
  },
  
  [UnitType.BATTLESHIP]: {
    attack: 18,
    defense: 12,
    movement: 4,
    category: UnitCategory.NAVAL,
    requiredTechnology: TechnologyType.STEEL,
    productionCost: 160,
    canAttack: true,
    canFortify: false,
    canMoveOnWater: true,
    visibility: 2,
    specialAbilities: ['shore_bombardment']
  },
  
  [UnitType.CARRIER]: {
    attack: 1,
    defense: 12,
    movement: 5,
    category: UnitCategory.NAVAL,
    requiredTechnology: TechnologyType.ADVANCED_FLIGHT,
    productionCost: 160,
    canAttack: true,
    canFortify: false,
    canMoveOnWater: true,
    canCarryUnits: 8,
    visibility: 2,
    specialAbilities: ['air_base']
  },
  
  [UnitType.TRANSPORT]: {
    attack: 0,
    defense: 3,
    movement: 4,
    category: UnitCategory.NAVAL,
    requiredTechnology: TechnologyType.INDUSTRIALIZATION,
    productionCost: 50,
    canAttack: false,
    canFortify: false,
    canMoveOnWater: true,
    canCarryUnits: 8
  },
  
  [UnitType.SUBMARINE]: {
    attack: 8,
    defense: 2,
    movement: 3,
    category: UnitCategory.NAVAL,
    requiredTechnology: TechnologyType.MASS_PRODUCTION,
    productionCost: 50,
    canAttack: true,
    canFortify: false,
    canMoveOnWater: true,
    visibility: 2,
    specialAbilities: ['underwater', 'invisible_unless_adjacent']
  },
  
  // Air units
  [UnitType.FIGHTER]: {
    attack: 3,
    defense: 3,
    movement: 10,
    category: UnitCategory.AIR,
    requiredTechnology: TechnologyType.FLIGHT,
    productionCost: 60,
    canAttack: true,
    canFortify: false,
    canMoveOnMountains: true,
    specialAbilities: ['must_return_to_base', 'intercept_bombers']
  },
  
  [UnitType.BOMBER]: {
    attack: 12,
    defense: 1,
    movement: 8, // 16 with extended range
    category: UnitCategory.AIR,
    requiredTechnology: TechnologyType.ADVANCED_FLIGHT,
    productionCost: 120,
    canAttack: true,
    canFortify: false,
    canMoveOnMountains: true,
    visibility: 2,
    specialAbilities: ['must_return_to_base', 'ignore_city_walls', 'cannot_be_attacked_by_ground']
  },
  
  // Special units
  [UnitType.NUCLEAR]: {
    attack: 99,
    defense: 0,
    movement: 16,
    category: UnitCategory.SPECIAL,
    requiredTechnology: TechnologyType.ROCKETRY, // Also requires Nuclear Fission and Manhattan Project
    productionCost: 160,
    canAttack: true,
    canFortify: false,
    canMoveOnMountains: true,
    specialAbilities: ['nuclear_weapon', 'must_end_in_city_or_carrier', 'destroys_on_attack']
  },
  
  // Legacy units (for backward compatibility)
  [UnitType.WARRIOR]: {
    attack: 1,
    defense: 1,
    movement: 1,
    category: UnitCategory.LAND,
    productionCost: 10,
    canAttack: true,
    canFortify: true,
    canMoveOnMountains: true
  },
  
  [UnitType.SCOUT]: {
    attack: 0,
    defense: 1,
    movement: 2,
    category: UnitCategory.LAND,
    productionCost: 10,
    canAttack: false,
    canFortify: true,
    canMoveOnMountains: true
  },
  
  [UnitType.ARCHER]: {
    attack: 2,
    defense: 1,
    movement: 1,
    category: UnitCategory.LAND,
    productionCost: 20,
    canAttack: true,
    canFortify: true,
    canMoveOnMountains: true
  },
  
  [UnitType.SPEARMAN]: {
    attack: 1,
    defense: 2,
    movement: 1,
    category: UnitCategory.LAND,
    requiredTechnology: TechnologyType.BRONZE_WORKING,
    productionCost: 20,
    canAttack: true,
    canFortify: true,
    canMoveOnMountains: true
  }
};

// Helper functions for unit management
export function getUnitStats(unitType: UnitType): UnitStats {
  return UNIT_DEFINITIONS[unitType];
}

export function getUnitName(unitType: UnitType): string {
  return getUnitDisplayName(unitType);
}

export function getUnitsByCategory(category: UnitCategory): UnitType[] {
  return Object.entries(UNIT_DEFINITIONS)
    .filter(([_, stats]) => stats.category === category)
    .map(([type, _]) => type as UnitType);
}

export function getAvailableUnits(knownTechnologies: TechnologyType[]): UnitType[] {
  return Object.entries(UNIT_DEFINITIONS)
    .filter(([_, stats]) => 
      !stats.requiredTechnology || knownTechnologies.includes(stats.requiredTechnology)
    )
    .map(([type, _]) => type as UnitType);
}

export function canUnitAttack(unitType: UnitType): boolean {
  return UNIT_DEFINITIONS[unitType].canAttack;
}

export function canUnitFortify(unitType: UnitType): boolean {
  return UNIT_DEFINITIONS[unitType].canFortify;
}

export function getUnitProductionCost(unitType: UnitType): number {
  return UNIT_DEFINITIONS[unitType].productionCost;
}

export function canUnitSleep(unitType: UnitType): boolean {
  // Air units cannot sleep
  return UNIT_DEFINITIONS[unitType].category !== UnitCategory.AIR;
}

export function canUnitWakeUp(unit: Unit): boolean {
  // A unit can wake up if it's currently sleeping
  return unit.sleeping === true;
}

export function isUnitSleeping(unit: Unit): boolean {
  return unit.sleeping === true;
}
