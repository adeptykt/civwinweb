/**
 * Test AI technology research selection to ensure:
 * 1. AI only picks technologies with satisfied prerequisites
 * 2. AI cannot research techs that require prerequisites not yet researched
 * 3. Tech tree progression is properly enforced
 */

import { describe, it, expect } from 'vitest';
import { GameState, Player, GovernmentType, TechnologyType, TerrainType } from '../src/types/game';
import { canResearch, TECHNOLOGY_DEFINITIONS } from '../src/game/TechnologyDefinitions';

// Helper to create a minimal player with specific technologies
function createPlayerWithTechs(techs: TechnologyType[]): Player {
  return {
    id: 'test-player',
    name: 'Test Player',
    civilizationType: 'romans',
    color: '#ff0000',
    isHuman: false,
    science: 0,
    gold: 50,
    culture: 0,
    technologies: techs,
    currentResearch: undefined,
    currentResearchProgress: 0,
    government: GovernmentType.DESPOTISM,
    usedCityNames: []
  };
}

// Helper to extract available techs (mirrors AIPlayer.getAvailableTechnologies)
function getAvailableTechnologies(player: Player): TechnologyType[] {
  const allTechs = Object.values(TechnologyType);
  return allTechs.filter(tech => {
    if (player.technologies.includes(tech)) {
      return false;
    }
    return canResearch(tech, player.technologies);
  });
}

describe('AI Technology Research Validation', () => {
  describe('Starting Technologies', () => {
    it('should only allow ancient techs at game start', () => {
      const player = createPlayerWithTechs([]);
      const available = getAvailableTechnologies(player);

      // All available techs should have no prerequisites
      available.forEach(tech => {
        const techDef = TECHNOLOGY_DEFINITIONS[tech];
        expect(techDef.prerequisites.length).toBe(0);
      });
    });

    it('should have at least 6 ancient technologies available', () => {
      const player = createPlayerWithTechs([]);
      const available = getAvailableTechnologies(player);
      expect(available.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Alphabet Technology Unlocks', () => {
    it('should unlock Writing after researching Alphabet', () => {
      const player = createPlayerWithTechs([TechnologyType.ALPHABET]);
      const available = getAvailableTechnologies(player);
      expect(available).toContain(TechnologyType.WRITING);
    });

    it('should require both Alphabet and Masonry for Mathematics', () => {
      // With only Alphabet
      const playerAlphabetOnly = createPlayerWithTechs([TechnologyType.ALPHABET]);
      const availableAlphabetOnly = getAvailableTechnologies(playerAlphabetOnly);
      expect(availableAlphabetOnly).not.toContain(TechnologyType.MATHEMATICS);

      // With both Alphabet and Masonry
      const playerBoth = createPlayerWithTechs([TechnologyType.ALPHABET, TechnologyType.MASONRY]);
      const availableBoth = getAvailableTechnologies(playerBoth);
      expect(availableBoth).toContain(TechnologyType.MATHEMATICS);
    });
  });

  describe('Mathematics Prerequisites', () => {
    it('should require Alphabet AND Masonry before Mathematics is available', () => {
      // With only Pottery
      const playerPottery = createPlayerWithTechs([TechnologyType.POTTERY]);
      const availablePottery = getAvailableTechnologies(playerPottery);
      expect(availablePottery).not.toContain(TechnologyType.MATHEMATICS);

      // With only Alphabet
      const playerAlphabet = createPlayerWithTechs([TechnologyType.ALPHABET]);
      const availableAlphabet = getAvailableTechnologies(playerAlphabet);
      expect(availableAlphabet).not.toContain(TechnologyType.MATHEMATICS);

      // With both prerequisites
      const playerBoth = createPlayerWithTechs([TechnologyType.ALPHABET, TechnologyType.MASONRY]);
      const availableBoth = getAvailableTechnologies(playerBoth);
      expect(availableBoth).toContain(TechnologyType.MATHEMATICS);
    });
  });

  describe('Physics Technology Chain', () => {
    it('should require Mathematics and Navigation for Physics', () => {
      // Without Mathematics
      const playerNoMath = createPlayerWithTechs([TechnologyType.MAPMAKING, TechnologyType.ASTRONOMY]);
      const availableNoMath = getAvailableTechnologies(playerNoMath);
      expect(availableNoMath).not.toContain(TechnologyType.PHYSICS);

      // Without Navigation (which requires MAPMAKING and ASTRONOMY)
      const playerNoNav = createPlayerWithTechs([TechnologyType.ALPHABET, TechnologyType.MASONRY]);
      const availableNoNav = getAvailableTechnologies(playerNoNav);
      expect(availableNoNav).not.toContain(TechnologyType.PHYSICS);
    });

    it('should unlock Physics with proper prerequisite chain', () => {
      // Need: Alphabet + Masonry (for Mathematics), Mapmaking + Astronomy (for Navigation)
      const player = createPlayerWithTechs([
        TechnologyType.ALPHABET,
        TechnologyType.MASONRY,
        TechnologyType.MAPMAKING,
        TechnologyType.ASTRONOMY,
        TechnologyType.NAVIGATION,
        TechnologyType.MATHEMATICS
      ]);
      const available = getAvailableTechnologies(player);
      expect(available).toContain(TechnologyType.PHYSICS);
    });
  });

  describe('Banking Technology', () => {
    it('should require Trade and The Republic before Banking is available', () => {
      const player = createPlayerWithTechs([TechnologyType.POTTERY]);
      const available = getAvailableTechnologies(player);
      expect(available).not.toContain(TechnologyType.BANKING);
    });

    it('should allow Banking with Trade and The Republic researched', () => {
      const player = createPlayerWithTechs([TechnologyType.TRADE, TechnologyType.THE_REPUBLIC]);
      const available = getAvailableTechnologies(player);
      expect(available).toContain(TechnologyType.BANKING);
    });
  });

  describe('No Unmet Prerequisites', () => {
    it('should never allow technologies with unmet prerequisites', () => {
      const testConfigs: TechnologyType[][] = [
        [],
        [TechnologyType.ALPHABET],
        [TechnologyType.ALPHABET, TechnologyType.MATHEMATICS],
        [TechnologyType.POTTERY, TechnologyType.BRONZE_WORKING],
        [TechnologyType.ALPHABET, TechnologyType.WRITING, TechnologyType.LITERACY]
      ];

      for (const config of testConfigs) {
        const player = createPlayerWithTechs(config);
        const available = getAvailableTechnologies(player);

        // Check every available tech
        for (const tech of available) {
          const techDef = TECHNOLOGY_DEFINITIONS[tech];
          const prereqsMet = techDef.prerequisites.every(prereq =>
            player.technologies.includes(prereq)
          );
          expect(prereqsMet).toBe(true);
        }
      }
    });
  });

  describe('Late-Game Technology Blocking', () => {
    it('should not allow Fusion Power without proper prerequisites', () => {
      // At game start
      const playerStart = createPlayerWithTechs([]);
      const availableStart = getAvailableTechnologies(playerStart);
      expect(availableStart).not.toContain(TechnologyType.FUSION_POWER);

      // With just early techs
      const playerEarly = createPlayerWithTechs([
        TechnologyType.ALPHABET,
        TechnologyType.BRONZE_WORKING,
        TechnologyType.POTTERY
      ]);
      const availableEarly = getAvailableTechnologies(playerEarly);
      expect(availableEarly).not.toContain(TechnologyType.FUSION_POWER);
    });

    it('should not allow Future Tech without Fusion Power', () => {
      const player = createPlayerWithTechs([TechnologyType.ALPHABET]);
      const available = getAvailableTechnologies(player);
      expect(available).not.toContain(TechnologyType.FUTURE_TECH);
    });
  });

  describe('canResearch Function', () => {
    it('should return true when all prerequisites are met', () => {
      const player = createPlayerWithTechs([
        TechnologyType.ALPHABET,
        TechnologyType.MASONRY,
        TechnologyType.MAPMAKING,
        TechnologyType.ASTRONOMY,
        TechnologyType.NAVIGATION,
        TechnologyType.MATHEMATICS
      ]);
      const result = canResearch(TechnologyType.PHYSICS, player.technologies);
      expect(result).toBe(true);
    });

    it('should return false when prerequisites are not met', () => {
      const player = createPlayerWithTechs([TechnologyType.ALPHABET]);
      const result = canResearch(TechnologyType.PHYSICS, player.technologies);
      expect(result).toBe(false);
    });

    it('should return true for ancient techs with empty prerequisites', () => {
      const player = createPlayerWithTechs([]);
      const result = canResearch(TechnologyType.POTTERY, player.technologies);
      expect(result).toBe(true);
    });

    it('should return false if tech is already researched', () => {
      const player = createPlayerWithTechs([TechnologyType.ALPHABET]);
      // Even if prerequisites are met, if tech is already researched,
      // the AIPlayer.getAvailableTechnologies filters it out
      const available = getAvailableTechnologies(player);
      expect(available).not.toContain(TechnologyType.ALPHABET);
    });
  });

  describe('Multiple Prerequisites', () => {
    it('should properly validate all prerequisites are required', () => {
      // Find a tech with multiple prerequisites
      const multiPrereqTech = Object.values(TechnologyType).find(tech => {
        const prereqs = TECHNOLOGY_DEFINITIONS[tech].prerequisites;
        return prereqs.length >= 2;
      });

      if (multiPrereqTech) {
        const prereqs = TECHNOLOGY_DEFINITIONS[multiPrereqTech].prerequisites;

        // Test with only first prerequisite - should not be available
        const playerPartial = createPlayerWithTechs([prereqs[0]]);
        const availablePartial = getAvailableTechnologies(playerPartial);
        expect(availablePartial).not.toContain(multiPrereqTech);

        // Test with all prerequisites - should be available
        const playerFull = createPlayerWithTechs(prereqs);
        const availableFull = getAvailableTechnologies(playerFull);
        expect(availableFull).toContain(multiPrereqTech);
      }
    });
  });
});
