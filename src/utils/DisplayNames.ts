import { BuildingType, UnitType } from '../types/game';
import { BUILDING_DEFINITIONS } from '../game/BuildingDefinitions';
import { UNIT_DEFINITIONS } from '../game/UnitDefinitions';

/**
 * Utility functions to convert game IDs to human-readable display names
 */

/**
 * Convert a building ID to its display name
 */
export function getBuildingDisplayName(buildingId: BuildingType | string): string {
  // Handle string IDs that might not be in the enum
  const buildingType = buildingId as BuildingType;
  const definition = BUILDING_DEFINITIONS[buildingType];
  if (definition) {
    return definition.name;
  }
  
  // Fallback: convert snake_case to Title Case
  return toTitleCase(buildingId.toString());
}

/**
 * Convert a unit ID to its display name
 */
export function getUnitDisplayName(unitId: UnitType | string): string {
  // For units, we need to create display names since they don't have name properties
  const unitIdStr = unitId.toString();
  
  // Special cases for units with specific naming
  const specialNames: Record<string, string> = {
    'mech_inf': 'Mechanized Infantry',
    'settlers': 'Settlers',
    'diplomat': 'Diplomat',
    'caravan': 'Caravan',
    'militia': 'Militia',
    'phalanx': 'Phalanx',
    'legion': 'Legion',
    'cavalry': 'Cavalry',
    'chariot': 'Chariot',
    'catapult': 'Catapult',
    'knights': 'Knights',
    'musketeers': 'Musketeers',
    'cannon': 'Cannon',
    'riflemen': 'Riflemen',
    'artillery': 'Artillery',
    'armor': 'Armor',
    'trireme': 'Trireme',
    'sail': 'Sail',
    'frigate': 'Frigate',
    'ironclad': 'Ironclad',
    'cruiser': 'Cruiser',
    'battleship': 'Battleship',
    'carrier': 'Carrier',
    'transport': 'Transport',
    'submarine': 'Submarine',
    'fighter': 'Fighter',
    'bomber': 'Bomber',
    'nuclear': 'Nuclear',
    'warrior': 'Warrior',
    'scout': 'Scout',
    'archer': 'Archer',
    'spearman': 'Spearman'
  };
  
  return specialNames[unitIdStr] || toTitleCase(unitIdStr);
}

/**
 * Convert a wonder ID to its display name
 */
export function getWonderDisplayName(wonderId: string): string {
  // Special cases for wonders with specific naming
  const wonderNames: Record<string, string> = {
    'hanging_gardens': 'Hanging Gardens',
    'colossus': 'Colossus',
    'great_wall': 'Great Wall',
    'pyramids': 'Pyramids',
    'lighthouse': 'Lighthouse',
    'great_library': 'Great Library',
    'copernicus_observatory': "Copernicus' Observatory",
    'magellans_expedition': "Magellan's Expedition",
    'shakespeares_theatre': "Shakespeare's Theatre",
    'isaac_newtons_college': "Isaac Newton's College",
    'darwins_voyage': "Darwin's Voyage"
  };
  
  return wonderNames[wonderId] || toTitleCase(wonderId);
}

/**
 * Convert a government ID to its display name
 */
export function getGovernmentDisplayName(governmentId: string): string {
  const governmentNames: Record<string, string> = {
    'despotism': 'Despotism',
    'anarchy': 'Anarchy',
    'monarchy': 'Monarchy',
    'communism': 'Communism',
    'republic': 'The Republic',
    'democracy': 'Democracy'
  };
  
  return governmentNames[governmentId] || toTitleCase(governmentId);
}

/**
 * Convert an improvement ID to its display name
 */
export function getImprovementDisplayName(improvementId: string): string {
  const improvementNames: Record<string, string> = {
    'farm': 'Farm',
    'mine': 'Mine',
    'road': 'Road',
    'irrigation': 'Irrigation',
    'fortress': 'Fortress'
  };
  
  return improvementNames[improvementId] || toTitleCase(improvementId);
}

/**
 * Convert snake_case or camelCase to Title Case
 */
function toTitleCase(str: string): string {
  return str
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
