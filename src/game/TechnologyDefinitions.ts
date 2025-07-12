// Technology definitions based on Civilization manual
export const TechnologyType = {
  // Starting Technologies (None prerequisite)
  POTTERY: 'pottery',
  ALPHABET: 'alphabet',
  CEREMONIAL_BURIAL: 'ceremonial_burial',
  BRONZE_WORKING: 'bronze_working',
  MASONRY: 'masonry',
  HORSEBACK_RIDING: 'horseback_riding',
  THE_WHEEL: 'the_wheel',
  
  // Early Technologies
  CURRENCY: 'currency',
  IRON_WORKING: 'iron_working',
  MAPMAKING: 'mapmaking',
  MATHEMATICS: 'mathematics',
  WRITING: 'writing',
  CODE_OF_LAWS: 'code_of_laws',
  MYSTICISM: 'mysticism',
  MONARCHY: 'monarchy',
  TRADE: 'trade',
  CONSTRUCTION: 'construction',
  
  // Middle Technologies  
  LITERACY: 'literacy',
  THE_REPUBLIC: 'the_republic',
  FEUDALISM: 'feudalism',
  CHIVALRY: 'chivalry',
  BRIDGE_BUILDING: 'bridge_building',
  ENGINEERING: 'engineering',
  ASTRONOMY: 'astronomy',
  NAVIGATION: 'navigation',
  BANKING: 'banking',
  INVENTION: 'invention',
  PHILOSOPHY: 'philosophy',
  DEMOCRACY: 'democracy',
  UNIVERSITY: 'university',
  PHYSICS: 'physics',
  
  // Advanced Technologies
  GUNPOWDER: 'gunpowder',
  MEDICINE: 'medicine',
  METALLURGY: 'metallurgy',
  CHEMISTRY: 'chemistry',
  THEORY_OF_GRAVITY: 'theory_of_gravity',
  STEAM_ENGINE: 'steam_engine',
  MAGNETISM: 'magnetism',
  EXPLOSIVES: 'explosives',
  RAILROAD: 'railroad',
  ELECTRICITY: 'electricity',
  STEEL: 'steel',
  INDUSTRIALIZATION: 'industrialization',
  CONSCRIPTION: 'conscription',
  THE_CORPORATION: 'the_corporation',
  REFINING: 'refining',
  RELIGION: 'religion',
  
  // Modern Technologies
  COMBUSTION: 'combustion',
  ELECTRONICS: 'electronics',
  AUTOMOBILE: 'automobile',
  FLIGHT: 'flight',
  ADVANCED_FLIGHT: 'advanced_flight',
  ATOMIC_THEORY: 'atomic_theory',
  MASS_PRODUCTION: 'mass_production',
  NUCLEAR_FISSION: 'nuclear_fission',
  NUCLEAR_POWER: 'nuclear_power',
  ROCKETRY: 'rocketry',
  COMPUTERS: 'computers',
  SPACE_FLIGHT: 'space_flight',
  PLASTICS: 'plastics',
  COMMUNISM: 'communism',
  LABOR_UNION: 'labor_union',
  RECYCLING: 'recycling',
  ROBOTICS: 'robotics',
  SUPERCONDUCTOR: 'superconductor',
  GENETIC_ENGINEERING: 'genetic_engineering',
  FUSION_POWER: 'fusion_power',
  FUTURE_TECH: 'future_tech'
} as const;

export type TechnologyType = typeof TechnologyType[keyof typeof TechnologyType];

export interface Technology {
  id: string;
  name: string;
  type: TechnologyType;
  cost: number;
  prerequisites: TechnologyType[];
  era: TechnologyEra;
  description: string;
  unlocks: {
    units?: string[];
    buildings?: string[];
    governments?: string[];
    improvements?: string[];
    wonders?: string[];
  };
}

export const TechnologyEra = {
  ANCIENT: 'ancient',
  CLASSICAL: 'classical', 
  MEDIEVAL: 'medieval',
  RENAISSANCE: 'renaissance',
  INDUSTRIAL: 'industrial',
  MODERN: 'modern',
  INFORMATION: 'information'
} as const;

export type TechnologyEra = typeof TechnologyEra[keyof typeof TechnologyEra];

// Complete technology tree based on authentic Civilization 1 manual
export const TECHNOLOGY_DEFINITIONS: Record<TechnologyType, Technology> = {
  // Starting Technologies (None prerequisite)
  [TechnologyType.POTTERY]: {
    id: TechnologyType.POTTERY,
    name: 'Pottery',
    type: TechnologyType.POTTERY,
    cost: 6,
    prerequisites: [],
    era: TechnologyEra.ANCIENT,
    description: 'Enables food storage and early civilization development',
    unlocks: {
      buildings: ['granary'],
      wonders: ['hanging_gardens']
    }
  },

  [TechnologyType.ALPHABET]: {
    id: TechnologyType.ALPHABET,
    name: 'Alphabet',
    type: TechnologyType.ALPHABET,
    cost: 6,
    prerequisites: [],
    era: TechnologyEra.ANCIENT,
    description: 'Foundation of written communication',
    unlocks: {}
  },

  [TechnologyType.CEREMONIAL_BURIAL]: {
    id: TechnologyType.CEREMONIAL_BURIAL,
    name: 'Ceremonial Burial',
    type: TechnologyType.CEREMONIAL_BURIAL,
    cost: 6,
    prerequisites: [],
    era: TechnologyEra.ANCIENT,
    description: 'Religious practices and social organization',
    unlocks: {
      buildings: ['temple']
    }
  },

  [TechnologyType.BRONZE_WORKING]: {
    id: TechnologyType.BRONZE_WORKING,
    name: 'Bronze Working',
    type: TechnologyType.BRONZE_WORKING,
    cost: 8,
    prerequisites: [],
    era: TechnologyEra.ANCIENT,
    description: 'Metal working enables stronger weapons and tools',
    unlocks: {
      units: ['phalanx'],
      wonders: ['colossus']
    }
  },

  [TechnologyType.MASONRY]: {
    id: TechnologyType.MASONRY,
    name: 'Masonry',
    type: TechnologyType.MASONRY,
    cost: 8,
    prerequisites: [],
    era: TechnologyEra.ANCIENT,
    description: 'Stone construction techniques',
    unlocks: {
      buildings: ['palace', 'city_walls'],
      wonders: ['great_wall', 'pyramids']
    }
  },

  [TechnologyType.HORSEBACK_RIDING]: {
    id: TechnologyType.HORSEBACK_RIDING,
    name: 'Horseback Riding',
    type: TechnologyType.HORSEBACK_RIDING,
    cost: 10,
    prerequisites: [],
    era: TechnologyEra.ANCIENT,
    description: 'Domestication of horses for transportation and warfare',
    unlocks: {
      units: ['cavalry']
    }
  },

  [TechnologyType.THE_WHEEL]: {
    id: TechnologyType.THE_WHEEL,
    name: 'The Wheel',
    type: TechnologyType.THE_WHEEL,
    cost: 10,
    prerequisites: [],
    era: TechnologyEra.ANCIENT,
    description: 'Revolutionary invention enabling transportation and machinery',
    unlocks: {
      units: ['chariot']
    }
  },

  // Early Technologies
  [TechnologyType.CURRENCY]: {
    id: TechnologyType.CURRENCY,
    name: 'Currency',
    type: TechnologyType.CURRENCY,
    cost: 14,
    prerequisites: [TechnologyType.BRONZE_WORKING],
    era: TechnologyEra.CLASSICAL,
    description: 'Standardized trade and economic systems',
    unlocks: {
      buildings: ['marketplace']
    }
  },

  [TechnologyType.IRON_WORKING]: {
    id: TechnologyType.IRON_WORKING,
    name: 'Iron Working',
    type: TechnologyType.IRON_WORKING,
    cost: 12,
    prerequisites: [TechnologyType.BRONZE_WORKING],
    era: TechnologyEra.CLASSICAL,
    description: 'Superior metal working techniques',
    unlocks: {
      units: ['legion']
    }
  },

  [TechnologyType.MAPMAKING]: {
    id: TechnologyType.MAPMAKING,
    name: 'Map Making',
    type: TechnologyType.MAPMAKING,
    cost: 14,
    prerequisites: [TechnologyType.ALPHABET],
    era: TechnologyEra.CLASSICAL,
    description: 'Navigation and exploration techniques',
    unlocks: {
      units: ['trireme'],
      wonders: ['lighthouse']
    }
  },

  [TechnologyType.MATHEMATICS]: {
    id: TechnologyType.MATHEMATICS,
    name: 'Mathematics',
    type: TechnologyType.MATHEMATICS,
    cost: 12,
    prerequisites: [TechnologyType.ALPHABET, TechnologyType.MASONRY],
    era: TechnologyEra.CLASSICAL,
    description: 'Numerical systems and calculations',
    unlocks: {
      units: ['catapult']
    }
  },

  [TechnologyType.WRITING]: {
    id: TechnologyType.WRITING,
    name: 'Writing',
    type: TechnologyType.WRITING,
    cost: 12,
    prerequisites: [TechnologyType.ALPHABET],
    era: TechnologyEra.CLASSICAL,
    description: 'Record keeping and communication advancement',
    unlocks: {
      units: ['diplomat'],
      buildings: ['library']
    }
  },

  [TechnologyType.CODE_OF_LAWS]: {
    id: TechnologyType.CODE_OF_LAWS,
    name: 'Code of Laws',
    type: TechnologyType.CODE_OF_LAWS,
    cost: 14,
    prerequisites: [TechnologyType.ALPHABET],
    era: TechnologyEra.CLASSICAL,
    description: 'Legal system and civil organization',
    unlocks: {
      buildings: ['courthouse']
    }
  },

  [TechnologyType.MYSTICISM]: {
    id: TechnologyType.MYSTICISM,
    name: 'Mysticism',
    type: TechnologyType.MYSTICISM,
    cost: 8,
    prerequisites: [TechnologyType.CEREMONIAL_BURIAL],
    era: TechnologyEra.ANCIENT,
    description: 'Spiritual beliefs and religious practices',
    unlocks: {
      buildings: ['oracle']
    }
  },

  [TechnologyType.MONARCHY]: {
    id: TechnologyType.MONARCHY,
    name: 'Monarchy',
    type: TechnologyType.MONARCHY,
    cost: 16,
    prerequisites: [TechnologyType.CEREMONIAL_BURIAL, TechnologyType.CODE_OF_LAWS],
    era: TechnologyEra.CLASSICAL,
    description: 'Hereditary rule and royal authority',
    unlocks: {}
  },

  [TechnologyType.TRADE]: {
    id: TechnologyType.TRADE,
    name: 'Trade',
    type: TechnologyType.TRADE,
    cost: 16,
    prerequisites: [TechnologyType.CURRENCY, TechnologyType.CODE_OF_LAWS],
    era: TechnologyEra.CLASSICAL,
    description: 'Commercial exchange and merchant activity',
    unlocks: {
      units: ['caravan']
    }
  },

  [TechnologyType.CONSTRUCTION]: {
    id: TechnologyType.CONSTRUCTION,
    name: 'Construction',
    type: TechnologyType.CONSTRUCTION,
    cost: 18,
    prerequisites: [TechnologyType.MASONRY, TechnologyType.CURRENCY],
    era: TechnologyEra.CLASSICAL,
    description: 'Advanced building techniques',
    unlocks: {
      buildings: ['aqueduct', 'colosseum'],
      improvements: ['fortress']
    }
  },

  // Middle Technologies
  [TechnologyType.LITERACY]: {
    id: TechnologyType.LITERACY,
    name: 'Literacy',
    type: TechnologyType.LITERACY,
    cost: 18,
    prerequisites: [TechnologyType.WRITING, TechnologyType.CODE_OF_LAWS],
    era: TechnologyEra.CLASSICAL,
    description: 'Widespread reading and writing ability',
    unlocks: {
      wonders: ['great_library']
    }
  },

  [TechnologyType.THE_REPUBLIC]: {
    id: TechnologyType.THE_REPUBLIC,
    name: 'The Republic',
    type: TechnologyType.THE_REPUBLIC,
    cost: 20,
    prerequisites: [TechnologyType.CODE_OF_LAWS, TechnologyType.LITERACY],
    era: TechnologyEra.CLASSICAL,
    description: 'Democratic governance and civic participation',
    unlocks: {}
  },

  [TechnologyType.FEUDALISM]: {
    id: TechnologyType.FEUDALISM,
    name: 'Feudalism',
    type: TechnologyType.FEUDALISM,
    cost: 20,
    prerequisites: [TechnologyType.MASONRY, TechnologyType.MONARCHY],
    era: TechnologyEra.MEDIEVAL,
    description: 'Medieval social and political system',
    unlocks: {}
  },

  [TechnologyType.CHIVALRY]: {
    id: TechnologyType.CHIVALRY,
    name: 'Chivalry',
    type: TechnologyType.CHIVALRY,
    cost: 22,
    prerequisites: [TechnologyType.FEUDALISM, TechnologyType.HORSEBACK_RIDING],
    era: TechnologyEra.MEDIEVAL,
    description: 'Code of honor for mounted warriors',
    unlocks: {
      units: ['knight']
    }
  },

  [TechnologyType.BRIDGE_BUILDING]: {
    id: TechnologyType.BRIDGE_BUILDING,
    name: 'Bridge Building',
    type: TechnologyType.BRIDGE_BUILDING,
    cost: 20,
    prerequisites: [TechnologyType.IRON_WORKING, TechnologyType.ALPHABET],
    era: TechnologyEra.CLASSICAL,
    description: 'Engineering techniques for crossing rivers',
    unlocks: {
      improvements: ['road_on_river']
    }
  },

  [TechnologyType.ENGINEERING]: {
    id: TechnologyType.ENGINEERING,
    name: 'Engineering',
    type: TechnologyType.ENGINEERING,
    cost: 24,
    prerequisites: [TechnologyType.THE_WHEEL, TechnologyType.CONSTRUCTION],
    era: TechnologyEra.CLASSICAL,
    description: 'Advanced construction and mechanical principles',
    unlocks: {}
  },

  [TechnologyType.ASTRONOMY]: {
    id: TechnologyType.ASTRONOMY,
    name: 'Astronomy',
    type: TechnologyType.ASTRONOMY,
    cost: 22,
    prerequisites: [TechnologyType.MYSTICISM, TechnologyType.MATHEMATICS],
    era: TechnologyEra.MEDIEVAL,
    description: 'Study of celestial bodies',
    unlocks: {
      wonders: ['copernicus_observatory']
    }
  },

  [TechnologyType.NAVIGATION]: {
    id: TechnologyType.NAVIGATION,
    name: 'Navigation',
    type: TechnologyType.NAVIGATION,
    cost: 24,
    prerequisites: [TechnologyType.MAPMAKING, TechnologyType.ASTRONOMY],
    era: TechnologyEra.MEDIEVAL,
    description: 'Advanced seafaring and exploration',
    unlocks: {
      units: ['sail'],
      wonders: ['magellans_expedition']
    }
  },

  [TechnologyType.BANKING]: {
    id: TechnologyType.BANKING,
    name: 'Banking',
    type: TechnologyType.BANKING,
    cost: 24,
    prerequisites: [TechnologyType.TRADE, TechnologyType.THE_REPUBLIC],
    era: TechnologyEra.MEDIEVAL,
    description: 'Financial institutions and credit systems',
    unlocks: {
      buildings: ['bank']
    }
  },

  [TechnologyType.INVENTION]: {
    id: TechnologyType.INVENTION,
    name: 'Invention',
    type: TechnologyType.INVENTION,
    cost: 26,
    prerequisites: [TechnologyType.ENGINEERING, TechnologyType.LITERACY],
    era: TechnologyEra.RENAISSANCE,
    description: 'Systematic approach to creating new technologies',
    unlocks: {}
  },

  [TechnologyType.PHILOSOPHY]: {
    id: TechnologyType.PHILOSOPHY,
    name: 'Philosophy',
    type: TechnologyType.PHILOSOPHY,
    cost: 24,
    prerequisites: [TechnologyType.MYSTICISM, TechnologyType.LITERACY],
    era: TechnologyEra.RENAISSANCE,
    description: 'Systematic thinking about existence and knowledge',
    unlocks: {}
  },

  [TechnologyType.DEMOCRACY]: {
    id: TechnologyType.DEMOCRACY,
    name: 'Democracy',
    type: TechnologyType.DEMOCRACY,
    cost: 28,
    prerequisites: [TechnologyType.PHILOSOPHY, TechnologyType.LITERACY],
    era: TechnologyEra.RENAISSANCE,
    description: 'Government by the people',
    unlocks: {}
  },

  [TechnologyType.UNIVERSITY]: {
    id: TechnologyType.UNIVERSITY,
    name: 'University',
    type: TechnologyType.UNIVERSITY,
    cost: 26,
    prerequisites: [TechnologyType.MATHEMATICS, TechnologyType.PHILOSOPHY],
    era: TechnologyEra.RENAISSANCE,
    description: 'Higher learning and research institutions',
    unlocks: {
      buildings: ['university']
    }
  },

  [TechnologyType.PHYSICS]: {
    id: TechnologyType.PHYSICS,
    name: 'Physics',
    type: TechnologyType.PHYSICS,
    cost: 28,
    prerequisites: [TechnologyType.MATHEMATICS, TechnologyType.NAVIGATION],
    era: TechnologyEra.RENAISSANCE,
    description: 'Understanding of natural forces and matter',
    unlocks: {}
  },

  // Advanced Technologies
  [TechnologyType.GUNPOWDER]: {
    id: TechnologyType.GUNPOWDER,
    name: 'Gunpowder',
    type: TechnologyType.GUNPOWDER,
    cost: 30,
    prerequisites: [TechnologyType.INVENTION, TechnologyType.IRON_WORKING],
    era: TechnologyEra.RENAISSANCE,
    description: 'Explosive powder revolutionizes warfare',
    unlocks: {
      units: ['musketeer']
    }
  },

  [TechnologyType.MEDICINE]: {
    id: TechnologyType.MEDICINE,
    name: 'Medicine',
    type: TechnologyType.MEDICINE,
    cost: 28,
    prerequisites: [TechnologyType.PHILOSOPHY, TechnologyType.TRADE],
    era: TechnologyEra.RENAISSANCE,
    description: 'Healing arts and medical knowledge',
    unlocks: {
      wonders: ['shakespeares_theatre']
    }
  },

  [TechnologyType.METALLURGY]: {
    id: TechnologyType.METALLURGY,
    name: 'Metallurgy',
    type: TechnologyType.METALLURGY,
    cost: 32,
    prerequisites: [TechnologyType.GUNPOWDER, TechnologyType.UNIVERSITY],
    era: TechnologyEra.RENAISSANCE,
    description: 'Advanced metal working and alloys',
    unlocks: {
      units: ['cannon']
    }
  },

  [TechnologyType.CHEMISTRY]: {
    id: TechnologyType.CHEMISTRY,
    name: 'Chemistry',
    type: TechnologyType.CHEMISTRY,
    cost: 30,
    prerequisites: [TechnologyType.UNIVERSITY, TechnologyType.MEDICINE],
    era: TechnologyEra.RENAISSANCE,
    description: 'Study of matter and chemical reactions',
    unlocks: {}
  },

  [TechnologyType.THEORY_OF_GRAVITY]: {
    id: TechnologyType.THEORY_OF_GRAVITY,
    name: 'Theory of Gravity',
    type: TechnologyType.THEORY_OF_GRAVITY,
    cost: 32,
    prerequisites: [TechnologyType.ASTRONOMY, TechnologyType.UNIVERSITY],
    era: TechnologyEra.RENAISSANCE,
    description: 'Understanding of gravitational forces',
    unlocks: {
      wonders: ['isaac_newtons_college']
    }
  },

  [TechnologyType.STEAM_ENGINE]: {
    id: TechnologyType.STEAM_ENGINE,
    name: 'Steam Engine',
    type: TechnologyType.STEAM_ENGINE,
    cost: 34,
    prerequisites: [TechnologyType.PHYSICS, TechnologyType.INVENTION],
    era: TechnologyEra.INDUSTRIAL,
    description: 'Mechanical power from steam pressure',
    unlocks: {
      units: ['ironclad']
    }
  },

  [TechnologyType.MAGNETISM]: {
    id: TechnologyType.MAGNETISM,
    name: 'Magnetism',
    type: TechnologyType.MAGNETISM,
    cost: 34,
    prerequisites: [TechnologyType.NAVIGATION, TechnologyType.PHYSICS],
    era: TechnologyEra.INDUSTRIAL,
    description: 'Understanding of magnetic forces',
    unlocks: {
      units: ['frigate']
    }
  },

  [TechnologyType.EXPLOSIVES]: {
    id: TechnologyType.EXPLOSIVES,
    name: 'Explosives',
    type: TechnologyType.EXPLOSIVES,
    cost: 34,
    prerequisites: [TechnologyType.GUNPOWDER, TechnologyType.CHEMISTRY],
    era: TechnologyEra.INDUSTRIAL,
    description: 'Powerful explosive compounds for mining and warfare',
    unlocks: {}
  },

  [TechnologyType.RAILROAD]: {
    id: TechnologyType.RAILROAD,
    name: 'Railroad',
    type: TechnologyType.RAILROAD,
    cost: 36,
    prerequisites: [TechnologyType.STEAM_ENGINE, TechnologyType.BRIDGE_BUILDING],
    era: TechnologyEra.INDUSTRIAL,
    description: 'Steam-powered transportation networks',
    unlocks: {
      improvements: ['railroad'],
      wonders: ['darwins_voyage']
    }
  },

  [TechnologyType.ELECTRICITY]: {
    id: TechnologyType.ELECTRICITY,
    name: 'Electricity',
    type: TechnologyType.ELECTRICITY,
    cost: 38,
    prerequisites: [TechnologyType.MAGNETISM, TechnologyType.METALLURGY],
    era: TechnologyEra.INDUSTRIAL,
    description: 'Harnessing electrical power',
    unlocks: {}
  },

  [TechnologyType.STEEL]: {
    id: TechnologyType.STEEL,
    name: 'Steel',
    type: TechnologyType.STEEL,
    cost: 40,
    prerequisites: [TechnologyType.METALLURGY, TechnologyType.INDUSTRIALIZATION],
    era: TechnologyEra.INDUSTRIAL,
    description: 'Superior metal alloy production',
    unlocks: {
      units: ['battleship']
    }
  },

  [TechnologyType.INDUSTRIALIZATION]: {
    id: TechnologyType.INDUSTRIALIZATION,
    name: 'Industrialization',
    type: TechnologyType.INDUSTRIALIZATION,
    cost: 38,
    prerequisites: [TechnologyType.RAILROAD, TechnologyType.BANKING],
    era: TechnologyEra.INDUSTRIAL,
    description: 'Mass production and factory systems',
    unlocks: {
      units: ['transport'],
      buildings: ['factory'],
      wonders: ['womens_suffrage']
    }
  },

  [TechnologyType.CONSCRIPTION]: {
    id: TechnologyType.CONSCRIPTION,
    name: 'Conscription',
    type: TechnologyType.CONSCRIPTION,
    cost: 36,
    prerequisites: [TechnologyType.THE_REPUBLIC, TechnologyType.EXPLOSIVES],
    era: TechnologyEra.INDUSTRIAL,
    description: 'Mandatory military service',
    unlocks: {
      units: ['rifleman']
    }
  },

  [TechnologyType.THE_CORPORATION]: {
    id: TechnologyType.THE_CORPORATION,
    name: 'The Corporation',
    type: TechnologyType.THE_CORPORATION,
    cost: 40,
    prerequisites: [TechnologyType.BANKING, TechnologyType.INDUSTRIALIZATION],
    era: TechnologyEra.INDUSTRIAL,
    description: 'Large-scale business organization',
    unlocks: {}
  },

  [TechnologyType.REFINING]: {
    id: TechnologyType.REFINING,
    name: 'Refining',
    type: TechnologyType.REFINING,
    cost: 42,
    prerequisites: [TechnologyType.CHEMISTRY, TechnologyType.THE_CORPORATION],
    era: TechnologyEra.INDUSTRIAL,
    description: 'Processing of raw materials into useful products',
    unlocks: {
      buildings: ['power_plant']
    }
  },

  [TechnologyType.RELIGION]: {
    id: TechnologyType.RELIGION,
    name: 'Religion',
    type: TechnologyType.RELIGION,
    cost: 26,
    prerequisites: [TechnologyType.PHILOSOPHY, TechnologyType.WRITING],
    era: TechnologyEra.RENAISSANCE,
    description: 'Organized spiritual beliefs and practices that unite communities',
    unlocks: {
      buildings: ['cathedral'],
      wonders: ['js_bachs_cathedral', 'michelangelos_chapel']
    }
  },

  // Modern Technologies
  [TechnologyType.COMBUSTION]: {
    id: TechnologyType.COMBUSTION,
    name: 'Combustion',
    type: TechnologyType.COMBUSTION,
    cost: 44,
    prerequisites: [TechnologyType.REFINING, TechnologyType.EXPLOSIVES],
    era: TechnologyEra.MODERN,
    description: 'Internal combustion engines',
    unlocks: {
      units: ['cruiser']
    }
  },

  [TechnologyType.ELECTRONICS]: {
    id: TechnologyType.ELECTRONICS,
    name: 'Electronics',
    type: TechnologyType.ELECTRONICS,
    cost: 42,
    prerequisites: [TechnologyType.ELECTRICITY],
    era: TechnologyEra.MODERN,
    description: 'Electronic circuits and devices',
    unlocks: {
      buildings: ['hydro_plant'],
      wonders: ['hoover_dam']
    }
  },

  [TechnologyType.AUTOMOBILE]: {
    id: TechnologyType.AUTOMOBILE,
    name: 'Automobile',
    type: TechnologyType.AUTOMOBILE,
    cost: 46,
    prerequisites: [TechnologyType.COMBUSTION, TechnologyType.STEEL],
    era: TechnologyEra.MODERN,
    description: 'Self-propelled vehicles',
    unlocks: {
      units: ['armor']
    }
  },

  [TechnologyType.FLIGHT]: {
    id: TechnologyType.FLIGHT,
    name: 'Flight',
    type: TechnologyType.FLIGHT,
    cost: 48,
    prerequisites: [TechnologyType.COMBUSTION, TechnologyType.PHYSICS],
    era: TechnologyEra.MODERN,
    description: 'Powered aircraft and aviation',
    unlocks: {
      units: ['fighter']
    }
  },

  [TechnologyType.ADVANCED_FLIGHT]: {
    id: TechnologyType.ADVANCED_FLIGHT,
    name: 'Advanced Flight',
    type: TechnologyType.ADVANCED_FLIGHT,
    cost: 52,
    prerequisites: [TechnologyType.FLIGHT, TechnologyType.ELECTRICITY],
    era: TechnologyEra.MODERN,
    description: 'Advanced aviation and bomber aircraft',
    unlocks: {
      units: ['bomber', 'carrier']
    }
  },

  [TechnologyType.ATOMIC_THEORY]: {
    id: TechnologyType.ATOMIC_THEORY,
    name: 'Atomic Theory',
    type: TechnologyType.ATOMIC_THEORY,
    cost: 50,
    prerequisites: [TechnologyType.THEORY_OF_GRAVITY, TechnologyType.PHYSICS],
    era: TechnologyEra.MODERN,
    description: 'Understanding of atomic structure and forces',
    unlocks: {}
  },

  [TechnologyType.MASS_PRODUCTION]: {
    id: TechnologyType.MASS_PRODUCTION,
    name: 'Mass Production',
    type: TechnologyType.MASS_PRODUCTION,
    cost: 50,
    prerequisites: [TechnologyType.AUTOMOBILE, TechnologyType.THE_CORPORATION],
    era: TechnologyEra.MODERN,
    description: 'Assembly line manufacturing',
    unlocks: {
      units: ['submarine'],
      buildings: ['mass_transit']
    }
  },

  [TechnologyType.NUCLEAR_FISSION]: {
    id: TechnologyType.NUCLEAR_FISSION,
    name: 'Nuclear Fission',
    type: TechnologyType.NUCLEAR_FISSION,
    cost: 54,
    prerequisites: [TechnologyType.MASS_PRODUCTION, TechnologyType.ATOMIC_THEORY],
    era: TechnologyEra.MODERN,
    description: 'Splitting atoms for energy and weapons',
    unlocks: {
      wonders: ['manhattan_project']
    }
  },

  [TechnologyType.NUCLEAR_POWER]: {
    id: TechnologyType.NUCLEAR_POWER,
    name: 'Nuclear Power',
    type: TechnologyType.NUCLEAR_POWER,
    cost: 56,
    prerequisites: [TechnologyType.NUCLEAR_FISSION, TechnologyType.ELECTRONICS],
    era: TechnologyEra.MODERN,
    description: 'Peaceful use of nuclear energy',
    unlocks: {
      buildings: ['nuclear_plant']
    }
  },

  [TechnologyType.ROCKETRY]: {
    id: TechnologyType.ROCKETRY,
    name: 'Rocketry',
    type: TechnologyType.ROCKETRY,
    cost: 58,
    prerequisites: [TechnologyType.ADVANCED_FLIGHT, TechnologyType.ELECTRONICS],
    era: TechnologyEra.MODERN,
    description: 'Rocket propulsion technology',
    unlocks: {
      units: ['nuclear']
    }
  },

  [TechnologyType.COMPUTERS]: {
    id: TechnologyType.COMPUTERS,
    name: 'Computers',
    type: TechnologyType.COMPUTERS,
    cost: 60,
    prerequisites: [TechnologyType.MATHEMATICS, TechnologyType.ELECTRONICS],
    era: TechnologyEra.MODERN,
    description: 'Electronic computation and data processing',
    unlocks: {
      wonders: ['seti_program']
    }
  },

  [TechnologyType.SPACE_FLIGHT]: {
    id: TechnologyType.SPACE_FLIGHT,
    name: 'Space Flight',
    type: TechnologyType.SPACE_FLIGHT,
    cost: 62,
    prerequisites: [TechnologyType.COMPUTERS, TechnologyType.ROCKETRY],
    era: TechnologyEra.MODERN,
    description: 'Travel beyond Earth\'s atmosphere',
    unlocks: {
      wonders: ['apollo_program'],
      units: ['ss_structure']
    }
  },

  [TechnologyType.PLASTICS]: {
    id: TechnologyType.PLASTICS,
    name: 'Plastics',
    type: TechnologyType.PLASTICS,
    cost: 64,
    prerequisites: [TechnologyType.REFINING, TechnologyType.SPACE_FLIGHT],
    era: TechnologyEra.MODERN,
    description: 'Synthetic polymer materials',
    unlocks: {
      units: ['ss_component']
    }
  },

  [TechnologyType.COMMUNISM]: {
    id: TechnologyType.COMMUNISM,
    name: 'Communism',
    type: TechnologyType.COMMUNISM,
    cost: 44,
    prerequisites: [TechnologyType.PHILOSOPHY, TechnologyType.INDUSTRIALIZATION],
    era: TechnologyEra.MODERN,
    description: 'Collective ownership of property',
    unlocks: {
      wonders: ['united_nations']
    }
  },

  [TechnologyType.LABOR_UNION]: {
    id: TechnologyType.LABOR_UNION,
    name: 'Labor Union',
    type: TechnologyType.LABOR_UNION,
    cost: 52,
    prerequisites: [TechnologyType.MASS_PRODUCTION, TechnologyType.COMMUNISM],
    era: TechnologyEra.MODERN,
    description: 'Worker organization and rights',
    unlocks: {
      units: ['mech_infantry']
    }
  },

  [TechnologyType.RECYCLING]: {
    id: TechnologyType.RECYCLING,
    name: 'Recycling',
    type: TechnologyType.RECYCLING,
    cost: 54,
    prerequisites: [TechnologyType.MASS_PRODUCTION, TechnologyType.DEMOCRACY],
    era: TechnologyEra.MODERN,
    description: 'Reuse of materials to reduce waste',
    unlocks: {
      buildings: ['recycling_center']
    }
  },

  [TechnologyType.ROBOTICS]: {
    id: TechnologyType.ROBOTICS,
    name: 'Robotics',
    type: TechnologyType.ROBOTICS,
    cost: 66,
    prerequisites: [TechnologyType.PLASTICS, TechnologyType.COMPUTERS],
    era: TechnologyEra.MODERN,
    description: 'Automated machinery and artificial intelligence',
    unlocks: {
      units: ['artillery', 'ss_module'],
      buildings: ['mfg_plant']
    }
  },

  [TechnologyType.SUPERCONDUCTOR]: {
    id: TechnologyType.SUPERCONDUCTOR,
    name: 'Superconductor',
    type: TechnologyType.SUPERCONDUCTOR,
    cost: 68,
    prerequisites: [TechnologyType.PLASTICS, TechnologyType.MASS_PRODUCTION],
    era: TechnologyEra.MODERN,
    description: 'Materials with zero electrical resistance',
    unlocks: {
      buildings: ['sdi_defense']
    }
  },

  [TechnologyType.GENETIC_ENGINEERING]: {
    id: TechnologyType.GENETIC_ENGINEERING,
    name: 'Genetic Engineering',
    type: TechnologyType.GENETIC_ENGINEERING,
    cost: 56,
    prerequisites: [TechnologyType.MEDICINE, TechnologyType.THE_CORPORATION],
    era: TechnologyEra.MODERN,
    description: 'Manipulation of genetic material',
    unlocks: {
      wonders: ['cure_for_cancer']
    }
  },

  [TechnologyType.FUSION_POWER]: {
    id: TechnologyType.FUSION_POWER,
    name: 'Fusion Power',
    type: TechnologyType.FUSION_POWER,
    cost: 70,
    prerequisites: [TechnologyType.NUCLEAR_POWER, TechnologyType.SUPERCONDUCTOR],
    era: TechnologyEra.MODERN,
    description: 'Unlimited clean energy from nuclear fusion',
    unlocks: {}
  },

  [TechnologyType.FUTURE_TECH]: {
    id: TechnologyType.FUTURE_TECH,
    name: 'Future Tech',
    type: TechnologyType.FUTURE_TECH,
    cost: 72,
    prerequisites: [TechnologyType.FUSION_POWER],
    era: TechnologyEra.MODERN,
    description: 'Advanced technologies beyond current understanding',
    unlocks: {}
  }
};

// Helper functions for technology management
export function getTechnology(type: TechnologyType): Technology {
  return TECHNOLOGY_DEFINITIONS[type];
}

export function getTechnologiesByEra(era: TechnologyEra): Technology[] {
  return Object.values(TECHNOLOGY_DEFINITIONS).filter(tech => tech.era === era);
}

export function getPrerequisites(type: TechnologyType): TechnologyType[] {
  return TECHNOLOGY_DEFINITIONS[type].prerequisites;
}

export function canResearch(type: TechnologyType, knownTechnologies: TechnologyType[]): boolean {
  const prerequisites = getPrerequisites(type);
  return prerequisites.every(prereq => knownTechnologies.includes(prereq));
}

export function getResearchCost(type: TechnologyType): number {
  return TECHNOLOGY_DEFINITIONS[type].cost;
}

export function getUnlockedUnits(type: TechnologyType): string[] {
  return TECHNOLOGY_DEFINITIONS[type].unlocks.units || [];
}

export function getUnlockedBuildings(type: TechnologyType): string[] {
  return TECHNOLOGY_DEFINITIONS[type].unlocks.buildings || [];
}

export function getUnlockedGovernments(type: TechnologyType): string[] {
  return TECHNOLOGY_DEFINITIONS[type].unlocks.governments || [];
}
