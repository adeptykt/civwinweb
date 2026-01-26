import { describe, it, expect } from 'vitest';
import { ProductionManager } from '../src/game/ProductionManager';
import { TechnologyType } from '../src/game/TechnologyDefinitions';
import { BuildingType } from '../src/types/game';

describe('Production System', () => {
  describe('Starting Technologies', () => {
    it('should provide basic production options at game start', () => {
      const startingTechs: TechnologyType[] = [];
      const noBuildings: BuildingType[] = [];
      const options = ProductionManager.getAvailableProduction(startingTechs, noBuildings, 2);
      
      expect(options.length).toBeGreaterThan(0);
      expect(options.map(opt => opt.name)).toContain('Settlers');
      expect(options.map(opt => opt.name)).toContain('Militia');
    });
  });

  describe('Technology Requirements', () => {
    it('should allow Phalanx with Bronze Working', () => {
      const techs = [TechnologyType.BRONZE_WORKING];
      const noBuildings: BuildingType[] = [];
      const options = ProductionManager.getAvailableProduction(techs, noBuildings, 2);
      
      expect(options.map(opt => opt.name)).toContain('Phalanx');
    });

    it('should unlock multiple options with multiple technologies', () => {
      const techs = [
        TechnologyType.POTTERY,
        TechnologyType.BRONZE_WORKING,
        TechnologyType.CEREMONIAL_BURIAL,
        TechnologyType.WRITING
      ];
      const noBuildings: BuildingType[] = [];
      const options = ProductionManager.getAvailableProduction(techs, noBuildings, 2);
      
      expect(options.length).toBeGreaterThan(3);
      // Should have units, buildings, etc.
      const hasUnits = options.some(opt => opt.type === 'unit');
      const hasBuildings = options.some(opt => opt.type === 'building');
      expect(hasUnits).toBe(true);
      expect(hasBuildings).toBe(true);
    });
  });

  describe('Building Dependencies', () => {
    it('should not allow Bank without Marketplace', () => {
      const techs = [TechnologyType.CURRENCY, TechnologyType.BANKING];
      const noBuildings: BuildingType[] = [];
      const options = ProductionManager.getAvailableProduction(techs, noBuildings, 2);
      
      expect(options.map(opt => opt.name)).not.toContain('Bank');
    });

    it('should allow Bank with Marketplace built', () => {
      const techs = [TechnologyType.CURRENCY, TechnologyType.BANKING];
      const withMarketplace = [BuildingType.MARKETPLACE];
      const options = ProductionManager.getAvailableProduction(techs, withMarketplace, 2);
      
      expect(options.map(opt => opt.name)).toContain('Bank');
    });
  });

  describe('Duplicate Buildings', () => {
    it('should not allow building same building twice', () => {
      const techs = [TechnologyType.POTTERY];
      const withGranary = [BuildingType.GRANARY];
      const options = ProductionManager.getAvailableProduction(techs, withGranary, 2);
      
      expect(options.map(opt => opt.name)).not.toContain('Granary');
    });

    it('should allow building Granary when not already built', () => {
      const techs = [TechnologyType.POTTERY];
      const noBuildings: BuildingType[] = [];
      const options = ProductionManager.getAvailableProduction(techs, noBuildings, 2);
      
      expect(options.map(opt => opt.name)).toContain('Granary');
    });
  });
});
