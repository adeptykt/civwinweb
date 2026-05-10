import { WonderType } from '../types/game';
import { TechnologyType } from './TechnologyDefinitions';
import { t } from '../i18n/I18nService.js';

export interface WonderStats {
  name: string;
  productionCost: number;
  description: string;
  effects: string[];
  requiredTechnology?: TechnologyType;
  obsoletedBy?: TechnologyType;
  spritePath?: string;
}

export const WonderDefinitions: Record<string, WonderStats> = {
  // Antiquity
  [WonderType.COLOSSUS]: {
    name: 'Colossus',
    productionCost: 200,
    description: 'A massive bronze statue that brings extra trade to squares with existing trade.',
    effects: ['One extra trade arrow on squares where there is already at least one trade arrow'],
    requiredTechnology: TechnologyType.BRONZE_WORKING,
    obsoletedBy: TechnologyType.ELECTRICITY,
    spritePath: '/src/assets/tinywonders/colossus.png'
  },

  [WonderType.GREAT_LIBRARY]: {
    name: 'Great Library',
    productionCost: 300,
    description: 'The greatest repository of knowledge in the ancient world.',
    effects: ['Receive any technology that any two other civilizations have'],
    requiredTechnology: TechnologyType.LITERACY,
    obsoletedBy: TechnologyType.UNIVERSITY,
    spritePath: '/src/assets/tinywonders/great_library.png'
  },

  [WonderType.GREAT_WALL]: {
    name: 'Great Wall',
    productionCost: 300,
    description: 'A massive fortification that ensures peaceful relations with other civilizations.',
    effects: ['Other leaders always offer a peace treaty'],
    requiredTechnology: TechnologyType.MASONRY,
    obsoletedBy: TechnologyType.GUNPOWDER,
    spritePath: '/src/assets/tinywonders/great_wall.png'
  },

  [WonderType.HANGING_GARDENS]: {
    name: 'Hanging Gardens',
    productionCost: 300,
    description: 'One of the seven wonders of the ancient world. Makes one content person happy in all cities.',
    effects: ['One content person becomes happy in all cities'],
    requiredTechnology: TechnologyType.POTTERY,
    obsoletedBy: TechnologyType.INVENTION,
    spritePath: '/src/assets/tinywonders/hanging_gardens.png'
  },

  [WonderType.LIGHTHOUSE]: {
    name: 'Lighthouse',
    productionCost: 200,
    description: 'A beacon that guides ships safely to harbor, improving naval movement.',
    effects: ['+1 movement for ships'],
    requiredTechnology: TechnologyType.MAPMAKING,
    obsoletedBy: TechnologyType.MAGNETISM,
    spritePath: '/src/assets/tinywonders/lighthouse.png'
  },

  [WonderType.ORACLE]: {
    name: 'Oracle',
    productionCost: 300,
    description: 'Ancient shrine that doubles the effect of temples in all cities.',
    effects: ['Doubles the effect of temples in all cities'],
    requiredTechnology: TechnologyType.MYSTICISM,
    obsoletedBy: TechnologyType.RELIGION,
    spritePath: '/src/assets/tinywonders/oracle.png'
  },

  [WonderType.PYRAMIDS]: {
    name: 'Pyramids',
    productionCost: 300,
    description: 'Magnificent tombs that allow switching to any government with only one turn of Anarchy.',
    effects: ['Switch to any government with only one turn of Anarchy'],
    requiredTechnology: TechnologyType.MASONRY,
    obsoletedBy: TechnologyType.COMMUNISM,
    spritePath: '/src/assets/tinywonders/pyramids.png'
  },

  // Middle Ages
  [WonderType.COPERNICUS_OBSERVATORY]: {
    name: "Copernicus' Observatory",
    productionCost: 300,
    description: 'A center of astronomical learning that doubles science production in its city.',
    effects: ['Increases science production by 100% in the city'],
    requiredTechnology: TechnologyType.ASTRONOMY,
    obsoletedBy: TechnologyType.AUTOMOBILE,
    spritePath: '/src/assets/tinywonders/copernicus_observatory.png'
  },

  [WonderType.DARWINS_VOYAGE]: {
    name: "Darwin's Voyage",
    productionCost: 300,
    description: 'Revolutionary scientific discoveries that provide immediate technological advances.',
    effects: ['Two Civilization Advances are discovered immediately'],
    requiredTechnology: TechnologyType.RAILROAD,
    spritePath: '/src/assets/tinywonders/darwins_voyage.png'
  },

  [WonderType.ISAAC_NEWTONS_COLLEGE]: {
    name: "Isaac Newton's College",
    productionCost: 400,
    description: 'A center of learning that increases the effectiveness of Libraries and Universities.',
    effects: ['Increases Library and University effects from 50% each to 83% each in all cities'],
    requiredTechnology: TechnologyType.THEORY_OF_GRAVITY,
    obsoletedBy: TechnologyType.NUCLEAR_FISSION,
    spritePath: '/src/assets/tinywonders/isaac_newtons_college.png'
  },

  [WonderType.JS_BACHS_CATHEDRAL]: {
    name: "J.S. Bach's Cathedral",
    productionCost: 400,
    description: 'Beautiful music that makes unhappy people content on the same continent.',
    effects: ['2 unhappy people become content in all cities on the same continent'],
    requiredTechnology: TechnologyType.RELIGION,
    spritePath: '/src/assets/tinywonders/js_bachs_cathedral.png'
  },

  [WonderType.MAGELLANS_EXPEDITION]: {
    name: "Magellan's Expedition",
    productionCost: 400,
    description: 'The first circumnavigation of the globe improves naval movement.',
    effects: ['+1 movement for ships'],
    requiredTechnology: TechnologyType.NAVIGATION,
    spritePath: '/src/assets/tinywonders/magellans_expedition.png'
  },

  [WonderType.MICHELANGELOS_CHAPEL]: {
    name: "Michelangelo's Chapel",
    productionCost: 300,
    description: 'Magnificent artwork that increases Cathedral effectiveness by 50%.',
    effects: ['Cathedral effect increases by 50% in all cities'],
    requiredTechnology: TechnologyType.RELIGION,
    obsoletedBy: TechnologyType.COMMUNISM,
    spritePath: '/src/assets/tinywonders/michelangelos_chapel.png'
  },

  [WonderType.SHAKESPEARES_THEATRE]: {
    name: "Shakespeare's Theatre",
    productionCost: 400,
    description: 'The greatest theatrical works make all unhappy citizens content in its city.',
    effects: ['All unhappy citizens become content in the city'],
    requiredTechnology: TechnologyType.MEDICINE,
    obsoletedBy: TechnologyType.ELECTRONICS,
    spritePath: '/src/assets/tinywonders/shakespeares_theatre.png'
  },

  // Industrial Age
  [WonderType.APOLLO_PROGRAM]: {
    name: 'Apollo Program',
    productionCost: 600,
    description: 'Enables spaceship construction and reveals all cities in the world.',
    effects: ['Spaceship parts may be built', 'Reveals every city in the world'],
    requiredTechnology: TechnologyType.SPACE_FLIGHT,
    spritePath: '/src/assets/tinywonders/apollo_program.png'
  },

  [WonderType.CURE_FOR_CANCER]: {
    name: 'Cure for Cancer',
    productionCost: 600,
    description: 'A medical breakthrough that makes one content person happy in all cities.',
    effects: ['One content person becomes happy in all cities'],
    requiredTechnology: TechnologyType.GENETIC_ENGINEERING,
    spritePath: '/src/assets/tinywonders/cure_for_cancer.png'
  },

  [WonderType.HOOVER_DAM]: {
    name: 'Hoover Dam',
    productionCost: 600,
    description: 'A massive hydroelectric project that provides hydro power to all cities on the same continent.',
    effects: ['Supplies hydro power (acts as hydroplant) in all cities on the same continent'],
    requiredTechnology: TechnologyType.ELECTRONICS,
    spritePath: '/src/assets/tinywonders/hoover_dam.png'
  },

  [WonderType.MANHATTAN_PROJECT]: {
    name: 'Manhattan Project',
    productionCost: 600,
    description: 'The development of atomic weapons enables nuclear unit construction for all civilizations.',
    effects: ['Nuclear units may be built by all civilizations with Rocketry'],
    requiredTechnology: TechnologyType.NUCLEAR_FISSION,
    spritePath: '/src/assets/tinywonders/manhattan_project.png'
  },

  [WonderType.SETI_PROGRAM]: {
    name: 'SETI Program',
    productionCost: 600,
    description: 'The search for extraterrestrial intelligence increases science production.',
    effects: ['Increases science production by 50% in all cities'],
    requiredTechnology: TechnologyType.COMPUTERS,
    spritePath: '/src/assets/tinywonders/seti_program.png'
  },

  [WonderType.UNITED_NATIONS]: {
    name: 'United Nations',
    productionCost: 600,
    description: 'An international organization that ensures other leaders always offer peace.',
    effects: ['Other leaders always offer a peace treaty'],
    requiredTechnology: TechnologyType.COMMUNISM,
    spritePath: '/src/assets/tinywonders/united_nations.png'
  },

  [WonderType.WOMENS_SUFFRAGE]: {
    name: "Women's Suffrage",
    productionCost: 600,
    description: 'Equal rights that reduce the unhappiness from units outside home cities in Democracy and Republic.',
    effects: ['Decreases effect of units outside home city to 1 in Democracy and 0 in Republic'],
    requiredTechnology: TechnologyType.INDUSTRIALIZATION,
    spritePath: '/src/assets/tinywonders/womens_suffrage.png'
  }
};

export function getWonderStats(wonderId: string): WonderStats | undefined {
  const w = WonderDefinitions[wonderId];
  if (!w) return undefined;
  return {
    ...w,
    name: t(`wonders.${wonderId}.name`),
    description: t(`wonders.${wonderId}.description`),
    effects: w.effects.map((_, i) => t(`wonders.${wonderId}.effects.${i}`))
  };
}
