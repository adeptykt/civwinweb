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
  // Ancient Era
  'hanging_gardens': {
    name: 'Hanging Gardens',
    productionCost: 200,
    description: 'One of the seven wonders of the ancient world. Increases happiness and population growth.',
    effects: ['Population growth +1 in all cities', '+1 happiness in all cities'],
    requiredTechnology: 'pottery',
    spritePath: '/src/assets/tinywonders/hanging_gardens.png'
  },
  
  'colossus': {
    name: 'Colossus',
    productionCost: 200,
    description: 'A massive bronze statue that brings trade and prosperity to your civilization.',
    effects: ['+1 trade in all coastal cities', '+1 happiness in all cities'],
    requiredTechnology: 'bronze_working',
    spritePath: '/src/assets/tinywonders/colossus.png'
  },
  
  'great_wall': {
    name: 'Great Wall',
    productionCost: 300,
    description: 'A massive fortification that protects your civilization from invasion.',
    effects: ['All cities gain +2 defense', 'Prevents barbarian invasions'],
    requiredTechnology: 'masonry',
    spritePath: '/src/assets/tinywonders/great_wall.png'
  },
  
  'pyramids': {
    name: 'Pyramids',
    productionCost: 300,
    description: 'Magnificent tombs that demonstrate your civilization\'s power and engineering.',
    effects: ['Granary effect in all cities', '+1 happiness in all cities'],
    requiredTechnology: 'masonry',
    spritePath: '/src/assets/tinywonders/pyramids.png'
  },
  
  'lighthouse': {
    name: 'Lighthouse',
    productionCost: 200,
    description: 'A beacon that guides ships safely to harbor, improving naval trade.',
    effects: ['+1 movement for all naval units', '+1 trade in all coastal cities'],
    requiredTechnology: 'mapmaking',
    spritePath: '/src/assets/tinywonders/lighthouse.png'
  },
  
  // Classical Era
  'great_library': {
    name: 'Great Library',
    productionCost: 300,
    description: 'The greatest repository of knowledge in the ancient world.',
    effects: ['Free technology when any civilization discovers one', '+50% science in the city'],
    requiredTechnology: 'literacy',
    spritePath: '/src/assets/tinywonders/great_library.png'
  },
  
  // Medieval Era
  'copernicus_observatory': {
    name: "Copernicus' Observatory",
    productionCost: 300,
    description: 'A center of astronomical learning that advances scientific knowledge.',
    effects: ['+50% science in the city', '+1 science in all cities'],
    requiredTechnology: 'astronomy',
    spritePath: '/src/assets/tinywonders/copernicus_observatory.png'
  },
  
  'magellans_expedition': {
    name: "Magellan's Expedition",
    productionCost: 400,
    description: 'The first circumnavigation of the globe opens new trade routes.',
    effects: ['+2 movement for all naval units', 'Reveals all ocean tiles'],
    requiredTechnology: 'navigation',
    spritePath: '/src/assets/tinywonders/magellans_expedition.png'
  },
  
  // Renaissance Era
  'shakespeares_theatre': {
    name: "Shakespeare's Theatre",
    productionCost: 300,
    description: 'The greatest theatrical works inspire happiness throughout your empire.',
    effects: ['+3 happiness in all cities', 'Eliminates unhappiness from government type'],
    requiredTechnology: 'medicine',
    spritePath: '/src/assets/tinywonders/shakespeares_theatre.png'
  },
  
  'isaac_newtons_college': {
    name: "Isaac Newton's College",
    productionCost: 400,
    description: 'A center of learning that revolutionizes scientific understanding.',
    effects: ['+100% science in the city', '+1 science in all cities'],
    requiredTechnology: 'theory_of_gravity',
    spritePath: '/src/assets/tinywonders/isaac_newtons_college.png'
  },
  
  // Industrial Era
  'darwins_voyage': {
    name: "Darwin's Voyage",
    productionCost: 400,
    description: 'Revolutionary scientific discoveries that advance human knowledge.',
    effects: ['2 free technologies', '+1 science in all cities'],
    requiredTechnology: 'railroad',
    spritePath: '/src/assets/tinywonders/darwins_voyage.png'
  },
  
  'womens_suffrage': {
    name: "Women's Suffrage",
    productionCost: 600,
    description: 'Equal rights for all citizens improves happiness and productivity.',
    effects: ['+1 happiness in all cities', '+1 production in all cities'],
    requiredTechnology: 'industrialization',
    spritePath: '/src/assets/tinywonders/womens_suffrage.png'
  },
  
  'js_bachs_cathedral': {
    name: "J.S. Bach's Cathedral",
    productionCost: 400,
    description: 'Beautiful music that inspires happiness and culture.',
    effects: ['+2 happiness in all cities', '+1 culture in all cities'],
    requiredTechnology: 'religion',
    spritePath: '/src/assets/tinywonders/js_bachs_cathedral.png'
  },
  
  'michelangelos_chapel': {
    name: "Michelangelo's Chapel",
    productionCost: 400,
    description: 'Magnificent artwork that inspires happiness and culture.',
    effects: ['+2 happiness in all cities', '+1 culture in all cities'],
    requiredTechnology: 'religion',
    spritePath: '/src/assets/tinywonders/michelangelos_chapel.png'
  },
  
  'hoover_dam': {
    name: 'Hoover Dam',
    productionCost: 600,
    description: 'A massive hydroelectric project that provides clean energy.',
    effects: ['Hydro Plant effect in all cities', '+1 production in all cities'],
    requiredTechnology: 'electronics',
    spritePath: '/src/assets/tinywonders/hoover_dam.png'
  },
  
  // Modern Era
  'manhattan_project': {
    name: 'Manhattan Project',
    productionCost: 600,
    description: 'The development of atomic weapons changes warfare forever.',
    effects: ['Enables nuclear weapons', 'All civilizations can build nuclear units'],
    requiredTechnology: 'nuclear_fission',
    spritePath: '/src/assets/tinywonders/manhattan_project.png'
  },
  
  'united_nations': {
    name: 'United Nations',
    productionCost: 600,
    description: 'An international organization promoting peace and cooperation.',
    effects: ['No anarchy when changing government', '+1 happiness in all cities'],
    requiredTechnology: 'communism',
    spritePath: '/src/assets/tinywonders/united_nations.png'
  },
  
  'apollo_program': {
    name: 'Apollo Program',
    productionCost: 600,
    description: 'The first manned mission to the moon inspires your civilization.',
    effects: ['Reveals entire world map', '+1 science in all cities'],
    requiredTechnology: 'space_flight',
    spritePath: '/src/assets/tinywonders/apollo_program.png'
  },
  
  'seti_program': {
    name: 'SETI Program',
    productionCost: 600,
    description: 'The search for extraterrestrial intelligence advances science.',
    effects: ['+100% science in the city', '+1 science in all cities'],
    requiredTechnology: 'computers',
    spritePath: '/src/assets/tinywonders/seti_program.png'
  },
  
  'cure_for_cancer': {
    name: 'Cure for Cancer',
    productionCost: 600,
    description: 'A medical breakthrough that improves the health of all humanity.',
    effects: ['+1 happiness in all cities', '+2 population growth in all cities'],
    requiredTechnology: 'genetic_engineering',
    spritePath: '/src/assets/tinywonders/cure_for_cancer.png'
  }
};
