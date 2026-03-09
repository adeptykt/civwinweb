// Technology imports
import { TechnologyType, TechnologyEra } from '../game/TechnologyDefinitions';
import type { Technology } from '../game/TechnologyDefinitions';

// Civilization imports
import { CivilizationType } from '../game/CivilizationDefinitions';
import type { Civilization } from '../game/CivilizationDefinitions';

// Game coordinate system types
export interface Position {
  x: number;
  y: number;
}

// Difficulty level (Civ 1-style, set at game start)
export type DifficultyLevel = 'chieftain' | 'warlord' | 'prince' | 'king' | 'emperor';

// Scenario system types
export const MapScenario = {
  RANDOM: 'random',
  EARTH: 'earth',
  CIV1: 'civ1'
};
export type MapScenario = typeof MapScenario[keyof typeof MapScenario];

export interface ScenarioConfig {
  name: string;
  description: string;
  width: number;
  height: number;
  generator: (width: number, height: number) => Tile[][];
}

export interface Tile {
  position: Position;
  terrain: TerrainType;
  terrainVariant?: TerrainVariant; // For shield grassland/river variants
  resources?: ResourceType[];
  unit?: Unit;
  city?: City;
  improvements?: Improvement[];
  hasVillage?: boolean; // True when a tribal hut / goody hut is present on this tile
}

export const TerrainType = {
  GRASSLAND: 'grassland',
  PLAINS: 'plains',
  DESERT: 'desert',
  FOREST: 'forest',
  HILLS: 'hills',
  MOUNTAINS: 'mountains',
  OCEAN: 'ocean',
  RIVER: 'river',
  JUNGLE: 'jungle',
  SWAMP: 'swamp',
  ARCTIC: 'arctic',
  TUNDRA: 'tundra'
};
export type TerrainType = typeof TerrainType[keyof typeof TerrainType];

export const ResourceType = {
  WHEAT: 'wheat',
  GOLD: 'gold',
  IRON: 'iron',
  HORSES: 'horses',
  FISH: 'fish',
  SEAL: 'seal',
  OASIS: 'oasis',
  GAME: 'game',
  COAL: 'coal',
  GEM: 'gem',
  OIL: 'oil'
};
export type ResourceType = typeof ResourceType[keyof typeof ResourceType];

// Unit system types
export interface Unit {
  id: string;
  type: UnitType;
  position: Position;
  movementPoints: number;
  maxMovementPoints: number;
  health: number;
  maxHealth: number;
  playerId: string;
  experience: number;
  isVeteran: boolean;
  fortified: boolean;
  fortifying?: boolean; // True if unit is in the process of fortifying (first turn of 2-turn fortification)
  fortificationTurns?: number; // How many turns of fortification have been completed
  sleeping?: boolean; // True if unit is sleeping (skips turns until manually awakened)
  buildingRoad?: boolean; // True if unit is in the process of building a road
  roadBuildingTurns?: number; // How many turns of road building have been completed
  buildingMine?: boolean; // True if unit is in the process of building a mine
  mineBuildingTurns?: number; // How many turns of mine building have been completed
  buildingIrrigation?: boolean; // True if unit is in the process of building irrigation
  irrigationBuildingTurns?: number; // How many turns of irrigation building have been completed
  gotoDestination?: Position; // Set when the unit has an active multi-turn goto order (G key / "Move Unit Here")
  automating?: boolean; // Set when a settler is in automated infrastructure improvement mode (A key)
}

export const UnitCategory = {
  LAND: 'land',
  NAVAL: 'naval',
  AIR: 'air',
  SPECIAL: 'special'
};
export type UnitCategory = typeof UnitCategory[keyof typeof UnitCategory];

export interface UnitStats {
  attack: number;
  defense: number;
  movement: number;
  category: UnitCategory;
  requiredTechnology?: TechnologyType;
  obsoletedBy?: TechnologyType;
  productionCost: number;
  canAttack: boolean;
  canFortify: boolean;
  canCarryUnits?: number; // For naval/air transport units
  visibility?: number; // For naval/air units with extended vision
  canMoveOnWater?: boolean; // For naval units that can move on ocean tiles
  canMoveOnMountains?: boolean; // For units that can move on mountain tiles
  specialAbilities?: string[];
}

export enum UnitType {
  // Non-combat units
  SETTLERS = 'settlers',
  DIPLOMAT = 'diplomat',
  CARAVAN = 'caravan',

  // Ancient military units
  MILITIA = 'militia',
  PHALANX = 'phalanx',
  LEGION = 'legion',
  CAVALRY = 'cavalry',
  CHARIOT = 'chariot',
  CATAPULT = 'catapult',

  // Medieval military units
  KNIGHTS = 'knights',

  // Gunpowder units
  MUSKETEERS = 'musketeers',
  CANNON = 'cannon',

  // Industrial units
  RIFLEMEN = 'riflemen',
  ARTILLERY = 'artillery',

  // Modern units
  ARMOR = 'armor',
  MECH_INF = 'mech_inf', // Mechanized Infantry

  // Naval units
  TRIREME = 'trireme',
  SAIL = 'sail',
  FRIGATE = 'frigate',
  IRONCLAD = 'ironclad',
  CRUISER = 'cruiser',
  BATTLESHIP = 'battleship',
  CARRIER = 'carrier',
  TRANSPORT = 'transport',
  SUBMARINE = 'submarine',

  // Air units
  FIGHTER = 'fighter',
  BOMBER = 'bomber',

  // Special units
  NUCLEAR = 'nuclear',

  // Legacy units (for backward compatibility)
  WARRIOR = 'warrior',
  SCOUT = 'scout',
  ARCHER = 'archer',
  SPEARMAN = 'spearman'
};

export type MilitaryUnit =
  | UnitType.MILITIA
  | UnitType.PHALANX
  | UnitType.LEGION
  | UnitType.CAVALRY
  | UnitType.CHARIOT
  | UnitType.CATAPULT
  | UnitType.KNIGHTS
  | UnitType.MUSKETEERS
  | UnitType.CANNON
  | UnitType.RIFLEMEN
  | UnitType.ARTILLERY
  | UnitType.ARMOR
  | UnitType.MECH_INF
  | UnitType.TRIREME
  | UnitType.SAIL
  | UnitType.FRIGATE
  | UnitType.IRONCLAD
  | UnitType.CRUISER
  | UnitType.BATTLESHIP
  | UnitType.TRANSPORT
  | UnitType.SUBMARINE
  | UnitType.FIGHTER
  | UnitType.BOMBER
  | UnitType.NUCLEAR;

export type NavalUnit =
  | UnitType.TRIREME
  | UnitType.SAIL
  | UnitType.FRIGATE
  | UnitType.IRONCLAD
  | UnitType.CRUISER
  | UnitType.BATTLESHIP
  | UnitType.CARRIER
  | UnitType.TRANSPORT
  | UnitType.SUBMARINE;

export type SpecialUnit =
  | UnitType.SETTLERS
  | UnitType.DIPLOMAT
  | UnitType.CARAVAN;

export type AirUnit =
  | UnitType.FIGHTER
  | UnitType.BOMBER
  | UnitType.NUCLEAR;

export interface City {
  id: string;
  name: string;
  position: Position;
  population: number;
  playerId: string;
  buildings: BuiltBuilding[];
  wonders: BuiltWonder[];
  production: ProductionItem | null;
  food: number;
  foodStorage: number;
  foodStorageCapacity: number;
  production_points: number;
  science: number;
  culture: number;
  workedTiles?: Array<{ dx: number, dy: number }>;
  specialists?: CitySpecialists;
  /** Player IDs that have directly observed this city (used for fog-of-war rendering). */
  discoveredByPlayers?: string[];
}

export interface BuiltBuilding {
  type: BuildingType;
  completedTurn: number;
}

export interface BuiltWonder {
  type: WonderType;
  completedTurn: number;
}

export const BuildingType = {
  // Basic buildings (available from start)
  BARRACKS: 'barracks',

  // Ancient buildings
  GRANARY: 'granary',
  TEMPLE: 'temple',
  PALACE: 'palace',
  CITY_WALLS: 'walls',

  // Classical buildings
  LIBRARY: 'library',
  MARKETPLACE: 'marketplace',
  COURTHOUSE: 'courthouse',

  // Medieval buildings
  AQUEDUCT: 'aqueduct',
  COLOSSEUM: 'colosseum',
  BANK: 'bank',
  CATHEDRAL: 'cathedral',
  UNIVERSITY: 'university',
  SEWER_SYSTEM: 'sewer_system',

  // Industrial buildings
  FACTORY: 'factory',
  POWER_PLANT: 'power_plant',

  // Modern buildings
  HYDRO_PLANT: 'hydro_plant',
  NUCLEAR_PLANT: 'nuclear_plant',
  MASS_TRANSIT: 'mass_transit',
  RECYCLING_CENTER: 'recycling_center',
  MANUFACTURING_PLANT: 'mfg_plant',
  SDI_DEFENSE: 'sdi_defense'
};
export type BuildingType = typeof BuildingType[keyof typeof BuildingType];

export const WonderType = {
  // Ancient Wonders
  PYRAMIDS: 'pyramids',
  HANGING_GARDENS: 'hanging_gardens',
  COLOSSUS: 'colossus',
  LIGHTHOUSE: 'lighthouse',
  GREAT_LIBRARY: 'great_library',
  ORACLE: 'oracle',
  GREAT_WALL: 'great_wall',

  // Classical Wonders
  // STATUE_OF_ZEUS: 'statue_of_zeus',
  // TEMPLE_OF_ARTEMIS: 'temple_of_artemis',
  // MAUSOLEUM: 'mausoleum',

  // Medieval Wonders
  MARCO_POLOS_EMBASSY: 'marco_polos_embassy',
  MICHELANGELOS_CHAPEL: 'michelangelos_chapel',
  SHAKESPEARES_THEATRE: 'shakespeares_theatre',
  LEONARDOS_WORKSHOP: 'leonardos_workshop',
  MAGELLANS_EXPEDITION: 'magellans_expedition',

  // Renaissance Wonders
  COPERNICUS_OBSERVATORY: 'copernicus_observatory',
  ISAAC_NEWTONS_COLLEGE: 'isaac_newtons_college',
  JS_BACHS_CATHEDRAL: 'js_bachs_cathedral',

  // Industrial Wonders
  DARWINS_VOYAGE: 'darwins_voyage',
  STATUE_OF_LIBERTY: 'statue_of_liberty',
  // EIFFEL_TOWER: 'eiffel_tower',
  WOMENS_SUFFRAGE: 'womens_suffrage',
  HOOVER_DAM: 'hoover_dam',

  // Modern Wonders
  MANHATTAN_PROJECT: 'manhattan_project',
  UNITED_NATIONS: 'united_nations',
  APOLLO_PROGRAM: 'apollo_program',
  SETI_PROGRAM: 'seti_program',
  CURE_FOR_CANCER: 'cure_for_cancer'
};
export type WonderType = typeof WonderType[keyof typeof WonderType];

export const ProductionType = {
  UNIT: 'unit',
  BUILDING: 'building',
  WONDER: 'wonder'
};

export type ProductionType = typeof ProductionType[keyof typeof ProductionType];

export interface ProductionItem {
  type: ProductionType;
  item: UnitType | BuildingType | WonderType;
  turnsRemaining: number;
}

// Improvement types
export interface Improvement {
  type: ImprovementType;
  completedTurn: number;
}

export const ImprovementType = {
  FARM: 'farm',
  MINE: 'mine',
  ROAD: 'road',
  RAILROAD: 'railroad',
  IRRIGATION: 'irrigation',
  FORTRESS: 'fortress'
} as const;
export type ImprovementType = typeof ImprovementType[keyof typeof ImprovementType];

// Specialist citizen types
export const SpecialistType = {
  TAXMAN: 'taxman',
  SCIENTIST: 'scientist',
  ENTERTAINER: 'entertainer'
} as const;
export type SpecialistType = typeof SpecialistType[keyof typeof SpecialistType];

export interface CitySpecialists {
  taxmen: number;
  scientists: number;
  entertainers: number;
}

// Player and game state types
export interface Player {
  id: string;
  name: string;
  civilizationType: CivilizationType;
  color: string;
  isHuman: boolean;
  science: number;
  gold: number;
  culture: number;
  technologies: TechnologyType[];
  /**
   * @description Technology currently being researched
   */
  currentResearch?: TechnologyType;
  /**
   * @description Science points accumulated toward current research
   */
  currentResearchProgress?: number;
  /**
   * @description Current government type
   */
  government: GovernmentType;
  /**
   * @description Percentage of trade directed to taxes (gold). Default 40.
   */
  taxRate: number;
  /**
   * @description Percentage of trade directed to luxuries (happiness). Default 10.
   */
  luxuryRate: number;
  /**
   * @description turns remaining until government change is complete
   */
  revolutionTurns?: number;
  /**
   * @description Cities founded by this player
   */
  usedCityNames: string[];
  /**
   * @description Whether this player has been defeated
   */
  defeated?: boolean;
  /**
   * @description Whether the player's defeat notification has been acknowledged
   */
  defeatAcknowledged?: boolean;
  /**
   * @description True for the special barbarian faction – exempt from normal
   * gameplay systems (research, production, diplomacy, victory conditions).
   */
  isBarbarian?: boolean;
}

// Government system types
export const GovernmentType = {
  DESPOTISM: 'despotism',
  ANARCHY: 'anarchy',
  MONARCHY: 'monarchy',
  COMMUNISM: 'communism',
  REPUBLIC: 'republic',
  DEMOCRACY: 'democracy'
} as const;
export type GovernmentType = typeof GovernmentType[keyof typeof GovernmentType];

export interface Government {
  type: GovernmentType;
  name: string;
  description: string;
  requiredTechnology?: TechnologyType; // Technology needed to unlock this government
  effects: GovernmentEffects;
  restrictions: GovernmentRestrictions;
}

export interface GovernmentEffects {
  // Production modifiers
  productionPenalty: boolean; // true if 3+ production tiles are reduced by 1
  corruptionType: 'distance' | 'flat' | 'none'; // How corruption is calculated
  tradeBonus: boolean; // true if +1 trade where trade already exists

  // Unit support costs
  militarySupport: {
    freeUnits: 'population' | 'none'; // Free units equal to population or none
    costPerUnit: number; // Resource cost per military unit
  };
  settlerSupport: number; // Food cost per settler

  // Happiness effects
  martialLawAvailable: boolean; // Can military units make unhappy citizens content
  unhappinessFromMilitary: number; // Unhappy citizens per military unit away from home city

  // Other effects
  taxCollection: boolean; // false during anarchy
  maintenanceCosts: boolean; // false during anarchy  
  scientificResearch: boolean; // false during anarchy
}

export interface GovernmentRestrictions {
  senateOverride: boolean; // Senate can override war decisions
  revolutionRisk: boolean; // Risk of revolution if cities in disorder
  peaceOffers: boolean; // Senate accepts all peace offers
}

export const GOVERNMENTS: Record<GovernmentType, Government> = {
  [GovernmentType.DESPOTISM]: {
    type: GovernmentType.DESPOTISM,
    name: 'Despotism',
    description: 'You rule by absolute power. The people just have to live with it because your will is enforced by the army.',
    effects: {
      productionPenalty: true, // 3+ production reduced by 1
      corruptionType: 'distance',
      tradeBonus: false,
      militarySupport: {
        freeUnits: 'population', // Free units equal to total city population
        costPerUnit: 0           // Excess units cost shields (production), not gold
      },
      settlerSupport: 0, // Settlers eat food/production, not gold
      martialLawAvailable: true,
      unhappinessFromMilitary: 0,
      taxCollection: true,
      maintenanceCosts: true,
      scientificResearch: true
    },
    restrictions: {
      senateOverride: false,
      revolutionRisk: false,
      peaceOffers: false
    }
  },

  [GovernmentType.ANARCHY]: {
    type: GovernmentType.ANARCHY,
    name: 'Anarchy',
    description: 'You have temporarily lost control of government. Cities continue to operate on their own but some important operations come to a halt.',
    effects: {
      productionPenalty: true, // Same as despotism
      corruptionType: 'distance',
      tradeBonus: false,
      militarySupport: {
        freeUnits: 'population',
        costPerUnit: 0  // No gold costs during anarchy
      },
      settlerSupport: 0,
      martialLawAvailable: true,
      unhappinessFromMilitary: 0,
      taxCollection: false, // No tax revenue
      maintenanceCosts: false, // No maintenance costs
      scientificResearch: false // No research
    },
    restrictions: {
      senateOverride: false,
      revolutionRisk: false,
      peaceOffers: false
    }
  },

  [GovernmentType.MONARCHY]: {
    type: GovernmentType.MONARCHY,
    name: 'Monarchy',
    description: 'Your rule is less absolute, and more with the acceptance of the people, especially an aristocracy of upper class citizens.',
    requiredTechnology: TechnologyType.MONARCHY,
    effects: {
      productionPenalty: false, // No production penalty
      corruptionType: 'distance',
      tradeBonus: false,
      militarySupport: {
        freeUnits: 'population', // 1 free unit per city (approx. via population)
        costPerUnit: 0           // Excess units cost shields, not gold
      },
      settlerSupport: 0, // Settlers eat food/production, not gold
      martialLawAvailable: true,
      unhappinessFromMilitary: 0,
      taxCollection: true,
      maintenanceCosts: true,
      scientificResearch: true
    },
    restrictions: {
      senateOverride: false,
      revolutionRisk: false,
      peaceOffers: false
    }
  },

  [GovernmentType.COMMUNISM]: {
    type: GovernmentType.COMMUNISM,
    name: 'Communism',
    description: 'You are the head of the communistic government, and rule with the support of the controlling party.',
    requiredTechnology: TechnologyType.COMMUNISM,
    effects: {
      productionPenalty: false, // No production penalty
      corruptionType: 'flat', // Flat corruption rate for all cities
      tradeBonus: false,
      militarySupport: {
        freeUnits: 'population', // All units effectively free (state absorbs costs)
        costPerUnit: 0           // No gold upkeep — a key advantage of Communism
      },
      settlerSupport: 0,
      martialLawAvailable: true,
      unhappinessFromMilitary: 0,
      taxCollection: true,
      maintenanceCosts: true,
      scientificResearch: true
    },
    restrictions: {
      senateOverride: false,
      revolutionRisk: false,
      peaceOffers: false
    }
  },

  [GovernmentType.REPUBLIC]: {
    type: GovernmentType.REPUBLIC,
    name: 'The Republic',
    description: 'You rule over the assembly of city-states. The people have a great deal of personal and economic freedom, resulting in greatly increased trade.',
    requiredTechnology: TechnologyType.THE_REPUBLIC,
    effects: {
      productionPenalty: false, // No production penalty
      corruptionType: 'distance',
      tradeBonus: true, // +1 trade where trade already exists
      militarySupport: {
        freeUnits: 'population', // 1 free unit per city population point
        costPerUnit: 1           // Excess units cost 1 gold/turn
      },
      settlerSupport: 1, // Settlers cost 1 gold/turn in Republic
      martialLawAvailable: false,
      unhappinessFromMilitary: 1, // 1 unhappy citizen per unit away from home
      taxCollection: true,
      maintenanceCosts: true,
      scientificResearch: true
    },
    restrictions: {
      senateOverride: true, // Senate can override decisions
      revolutionRisk: false,
      peaceOffers: true // Senate accepts all peace offers
    }
  },

  [GovernmentType.DEMOCRACY]: {
    type: GovernmentType.DEMOCRACY,
    name: 'Democracy',
    description: 'You rule as the elected executive of a democracy. The degree of freedom results in maximum opportunity for economic production and trade.',
    requiredTechnology: TechnologyType.DEMOCRACY,
    effects: {
      productionPenalty: false, // No production penalty
      corruptionType: 'none', // No corruption
      tradeBonus: true, // +1 trade where trade already exists
      militarySupport: {
        freeUnits: 'population', // 1 free unit per city population point
        costPerUnit: 1           // Excess units cost 1 gold/turn
      },
      settlerSupport: 2, // Settlers cost 2 gold/turn in Democracy (expensive!)
      martialLawAvailable: false,
      unhappinessFromMilitary: 2, // 2 unhappy citizens per unit away from home
      taxCollection: true,
      maintenanceCosts: true,
      scientificResearch: true
    },
    restrictions: {
      senateOverride: true, // Senate can override decisions
      revolutionRisk: true, // Risk of revolution if cities in disorder for 2+ turns
      peaceOffers: true // Senate accepts all peace offers
    }
  }
};

// Game event types
export interface GameEvent {
  type: 'technologyCompleted' | 'cityFounded' | 'unitDestroyed' | 'diplomaticAction';
  playerId: string;
  technologyType?: TechnologyType;
  player?: Player;
  // Add other event data as needed
}

export interface GameState {
  turn: number;
  currentPlayer: string;
  currentPlayerIsHuman: boolean; // Track if current player is human to avoid find() loops
  players: Player[];
  worldMap: Tile[][];
  units: Unit[];
  cities: City[];
  gamePhase: GamePhase;
  score: number;
  difficulty: DifficultyLevel; // Game difficulty (affects research cost, AI bonuses, happiness, scoring)
  events?: GameEvent[]; // Events that occurred this turn
  visibility?: Map<string, VisibilityMap>; // Per-player visibility (playerId -> visibility map)
}

export const GamePhase = {
  SETUP: 'setup',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ENDED: 'ended'
} as const;
export type GamePhase = typeof GamePhase[keyof typeof GamePhase];

// UI and rendering types
export interface ViewPort {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  viewport: ViewPort;
  tileSize: number;
}

// Re-export technology types
export { Technology, TechnologyType, TechnologyEra };

// Terrain variant types for special terrain configurations in Civ1
export const TerrainVariant = {
  NONE: 'none',
  SHIELD: 'shield' // For shield grassland and shield river that produce +1 production
} as const;
export type TerrainVariant = typeof TerrainVariant[keyof typeof TerrainVariant];

// Visibility and fog of war types
export const VisibilityState = {
  UNSEEN: 'unseen',      // Never explored, completely black
  EXPLORED: 'explored',   // Previously seen, but no current vision (fog of war)
  VISIBLE: 'visible'      // Currently visible
} as const;
export type VisibilityState = typeof VisibilityState[keyof typeof VisibilityState];

export interface VisibilityMap {
  tiles: VisibilityState[][]; // 2D array matching worldMap dimensions
}
