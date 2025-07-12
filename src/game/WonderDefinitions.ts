import { TechnologyType } from './TechnologyDefinitions';

export interface WonderStats {
  name: string;
  productionCost: number;
  description: string;
  effects: string[];
  requiredTechnology?: TechnologyType;
  spritePath?: string;
}

export const WONDER_DEFINITIONS: Record<string, WonderStats> = {
  // Antiquity
  'colossus': {
    name: 'Colossus',
    productionCost: 200,
    description: 'A massive bronze statue that brings extra trade to squares with existing trade.',
    effects: ['One extra trade arrow on squares where there is already at least one trade arrow'],
    requiredTechnology: 'bronze_working',
    spritePath: '/src/assets/tinywonders/colossus.png'
  },
  
  'great_library': {
    name: 'Great Library',
    productionCost: 300,
    description: 'The greatest repository of knowledge in the ancient world.',
    effects: ['Receive any technology that any two other civilizations have'],
    requiredTechnology: 'literacy',
    spritePath: '/src/assets/tinywonders/great_library.png'
  },
  
  'great_wall': {
    name: 'Great Wall',
    productionCost: 300,
    description: 'A massive fortification that ensures peaceful relations with other civilizations.',
    effects: ['Other leaders always offer a peace treaty'],
    requiredTechnology: 'masonry',
    spritePath: '/src/assets/tinywonders/great_wall.png'
  },
  
  'hanging_gardens': {
    name: 'Hanging Gardens',
    productionCost: 300,
    description: 'One of the seven wonders of the ancient world. Makes one content person happy in all cities.',
    effects: ['One content person becomes happy in all cities'],
    requiredTechnology: 'pottery',
    spritePath: '/src/assets/tinywonders/hanging_gardens.png'
  },
  
  'lighthouse': {
    name: 'Lighthouse',
    productionCost: 200,
    description: 'A beacon that guides ships safely to harbor, improving naval movement.',
    effects: ['+1 movement for ships'],
    requiredTechnology: 'mapmaking',
    spritePath: '/src/assets/tinywonders/lighthouse.png'
  },
  
  'oracle': {
    name: 'Oracle',
    productionCost: 300,
    description: 'Ancient shrine that doubles the effect of temples in all cities.',
    effects: ['Doubles the effect of temples in all cities'],
    requiredTechnology: 'mysticism',
    spritePath: '/src/assets/tinywonders/oracle.png'
  },
  
  'pyramids': {
    name: 'Pyramids',
    productionCost: 300,
    description: 'Magnificent tombs that allow switching to any government with only one turn of Anarchy.',
    effects: ['Switch to any government with only one turn of Anarchy'],
    requiredTechnology: 'masonry',
    spritePath: '/src/assets/tinywonders/pyramids.png'
  },
  
  // Middle Ages
  'copernicus_observatory': {
    name: "Copernicus' Observatory",
    productionCost: 300,
    description: 'A center of astronomical learning that doubles science production in its city.',
    effects: ['Increases science production by 100% in the city'],
    requiredTechnology: 'astronomy',
    spritePath: '/src/assets/tinywonders/copernicus_observatory.png'
  },
  
  'darwins_voyage': {
    name: "Darwin's Voyage",
    productionCost: 300,
    description: 'Revolutionary scientific discoveries that provide immediate technological advances.',
    effects: ['Two Civilization Advances are discovered immediately'],
    requiredTechnology: 'railroad',
    spritePath: '/src/assets/tinywonders/darwins_voyage.png'
  },
  
  'isaac_newtons_college': {
    name: "Isaac Newton's College",
    productionCost: 400,
    description: 'A center of learning that increases the effectiveness of Libraries and Universities.',
    effects: ['Increases Library and University effects from 50% each to 83% each in all cities'],
    requiredTechnology: 'theory_of_gravity',
    spritePath: '/src/assets/tinywonders/isaac_newtons_college.png'
  },
  
  'js_bachs_cathedral': {
    name: "J.S. Bach's Cathedral",
    productionCost: 400,
    description: 'Beautiful music that makes unhappy people content on the same continent.',
    effects: ['2 unhappy people become content in all cities on the same continent'],
    requiredTechnology: 'religion',
    spritePath: '/src/assets/tinywonders/js_bachs_cathedral.png'
  },
  
  'magellans_expedition': {
    name: "Magellan's Expedition",
    productionCost: 400,
    description: 'The first circumnavigation of the globe improves naval movement.',
    effects: ['+1 movement for ships'],
    requiredTechnology: 'navigation',
    spritePath: '/src/assets/tinywonders/magellans_expedition.png'
  },
  
  'michelangelos_chapel': {
    name: "Michelangelo's Chapel",
    productionCost: 300,
    description: 'Magnificent artwork that increases Cathedral effectiveness by 50%.',
    effects: ['Cathedral effect increases by 50% in all cities'],
    requiredTechnology: 'religion',
    spritePath: '/src/assets/tinywonders/michelangelos_chapel.png'
  },
  
  'shakespeares_theatre': {
    name: "Shakespeare's Theatre",
    productionCost: 400,
    description: 'The greatest theatrical works make all unhappy citizens content in its city.',
    effects: ['All unhappy citizens become content in the city'],
    requiredTechnology: 'medicine',
    spritePath: '/src/assets/tinywonders/shakespeares_theatre.png'
  },
  
  // Industrial Age
  'apollo_program': {
    name: 'Apollo Program',
    productionCost: 600,
    description: 'Enables spaceship construction and reveals all cities in the world.',
    effects: ['Spaceship parts may be built', 'Reveals every city in the world'],
    requiredTechnology: 'space_flight',
    spritePath: '/src/assets/tinywonders/apollo_program.png'
  },
  
  'cure_for_cancer': {
    name: 'Cure for Cancer',
    productionCost: 600,
    description: 'A medical breakthrough that makes one content person happy in all cities.',
    effects: ['One content person becomes happy in all cities'],
    requiredTechnology: 'genetic_engineering',
    spritePath: '/src/assets/tinywonders/cure_for_cancer.png'
  },
  
  'hoover_dam': {
    name: 'Hoover Dam',
    productionCost: 600,
    description: 'A massive hydroelectric project that provides hydro power to all cities on the same continent.',
    effects: ['Supplies hydro power (acts as hydroplant) in all cities on the same continent'],
    requiredTechnology: 'electronics',
    spritePath: '/src/assets/tinywonders/hoover_dam.png'
  },
  
  'manhattan_project': {
    name: 'Manhattan Project',
    productionCost: 600,
    description: 'The development of atomic weapons enables nuclear unit construction for all civilizations.',
    effects: ['Nuclear units may be built by all civilizations with Rocketry'],
    requiredTechnology: 'nuclear_fission',
    spritePath: '/src/assets/tinywonders/manhattan_project.png'
  },
  
  'seti_program': {
    name: 'SETI Program',
    productionCost: 600,
    description: 'The search for extraterrestrial intelligence increases science production.',
    effects: ['Increases science production by 50% in all cities'],
    requiredTechnology: 'computers',
    spritePath: '/src/assets/tinywonders/seti_program.png'
  },
  
  'united_nations': {
    name: 'United Nations',
    productionCost: 600,
    description: 'An international organization that ensures other leaders always offer peace.',
    effects: ['Other leaders always offer a peace treaty'],
    requiredTechnology: 'communism',
    spritePath: '/src/assets/tinywonders/united_nations.png'
  },
  
  'womens_suffrage': {
    name: "Women's Suffrage",
    productionCost: 600,
    description: 'Equal rights that reduce the unhappiness from units outside home cities in Democracy and Republic.',
    effects: ['Decreases effect of units outside home city to 1 in Democracy and 0 in Republic'],
    requiredTechnology: 'industrialization',
    spritePath: '/src/assets/tinywonders/womens_suffrage.png'
  }
};
