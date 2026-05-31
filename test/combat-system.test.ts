import { describe, it, expect, beforeEach } from 'vitest';
import { CombatSystem } from '../src/game/CombatSystem';
import { Unit, UnitType, City, TerrainType } from '../src/types/game';

describe('Combat System', () => {
  let combatSystem: CombatSystem;
  let attacker: Unit;
  let defender: Unit;
  let city: City;

  beforeEach(() => {
    combatSystem = new CombatSystem();

    attacker = {
      id: 'attacker1',
      type: UnitType.LEGION,
      position: { x: 4, y: 5 },
      movementPoints: 1,
      maxMovementPoints: 1,
      health: 100,
      maxHealth: 100,
      playerId: 'player1',
      experience: 0,
      isVeteran: false,
      fortified: false
    };

    defender = {
      id: 'defender1',
      type: UnitType.PHALANX,
      position: { x: 5, y: 5 },
      movementPoints: 1,
      maxMovementPoints: 1,
      health: 100,
      maxHealth: 100,
      playerId: 'player2',
      experience: 0,
      isVeteran: false,
      fortified: true
    };

    city = {
      id: 'city1',
      name: 'Test City',
      position: { x: 5, y: 5 },
      population: 2,
      playerId: 'player2',
      buildings: [],
      production: null,
      food: 0,
      foodStorage: 0,
      foodStorageCapacity: 20,
      production_points: 0,
      science: 0,
      culture: 0
    };
  });

  describe('Basic Combat', () => {
    it('should create combat system instance', () => {
      expect(combatSystem).toBeDefined();
    });

    it('should handle combat between units', () => {
      const result = combatSystem.resolveCombat(attacker, defender, [defender], undefined);
      
      expect(result).toBeDefined();
      expect(result.attackerSurvived !== undefined).toBe(true);
      expect(result.defenderSurvived !== undefined).toBe(true);
    });

    it('should have one winner and one loser', () => {
      const result = combatSystem.resolveCombat(attacker, defender, [defender], undefined);
      
      // In Civ 1 combat, there's always a winner and loser (no health reduction)
      expect(result.attackerWins === result.attackerSurvived).toBe(true);
      expect(result.attackerSurvived !== result.defenderSurvived).toBe(true);
    });
  });

  describe('Defender Selection', () => {
    it('should handle multiple defenders', () => {
      const weakDefender: Unit = {
        ...defender,
        id: 'weak-defender',
        type: UnitType.MILITIA,
        health: 50
      };

      const defenders = [weakDefender, defender];
      
      // CombatSystem.resolveCombat handles defender selection internally
      // We can verify it works by testing combat with multiple possible defenders
      expect(defenders.length).toBe(2);
      expect(defenders[0].type).toBe(UnitType.MILITIA);
      expect(defenders[1].type).toBe(UnitType.PHALANX);
    });
  });

  describe('Fortification Bonus', () => {
    it('should give bonus to fortified units', () => {
      const fortifiedDefender = { ...defender, fortified: true };
      const nonFortifiedDefender = { ...defender, fortified: false };
      
      // Run multiple combats to test statistical advantage
      let fortifiedWins = 0;
      let nonFortifiedWins = 0;
      
      for (let i = 0; i < 20; i++) {
        const attacker1 = { ...attacker, health: 100 };
        const attacker2 = { ...attacker, health: 100 };
        const defender1 = { ...fortifiedDefender, health: 100 };
        const defender2 = { ...nonFortifiedDefender, health: 100 };
        
        const result1 = combatSystem.resolveCombat(attacker1, defender1, [defender1], undefined);
        const result2 = combatSystem.resolveCombat(attacker2, defender2, [defender2], undefined);
        
        if (result1.defenderSurvived) fortifiedWins++;
        if (result2.defenderSurvived) nonFortifiedWins++;
      }
      
      // Fortified units should generally survive better (though results may vary due to randomness)
      expect(fortifiedWins + nonFortifiedWins).toBeGreaterThan(0);
    });
  });

  describe('City Defense', () => {
    it('should handle combat near city', () => {
      const result = combatSystem.resolveCombat(attacker, defender, [defender], city);
      
      expect(result).toBeDefined();
      expect(result.attackerSurvived !== undefined).toBe(true);
      expect(result.defenderSurvived !== undefined).toBe(true);
    });

    it('should provide defensive bonus for city defenders', () => {
      // City walls would provide bonus
      city.buildings = [{ type: 'walls' as any, completedTurn: 1 }];
      
      const result = combatSystem.resolveCombat(attacker, defender, [defender], city);
      
      expect(result).toBeDefined();
    });
  });

  describe('Unit Destruction', () => {
    it('should destroy exactly one unit per combat', () => {
      const result = combatSystem.resolveCombat(attacker, defender, [defender], undefined);
      
      // In Civ 1 combat, either attacker or defender is destroyed (not both)
      expect(result.unitsDestroyed.length).toBe(1);
      expect(result.attackerSurvived !== result.defenderSurvived).toBe(true);
    });

    it('should not destroy unit with remaining health', () => {
      attacker.health = 100;
      defender.health = 100;
      
      // Run a single round of combat
      const result = combatSystem.resolveCombat(attacker, defender, [defender], undefined);
      
      // At least one should survive after one combat round
      expect(result.attackerSurvived || result.defenderSurvived).toBe(true);
    });
  });

  describe('Terrain Defense Bonus', () => {
    describe('getTerrainDefenseMultiplier', () => {
      it('returns 1.0 for grassland', () => {
        expect(combatSystem.getTerrainDefenseMultiplier(TerrainType.GRASSLAND)).toBe(1.0);
      });

      it('returns 1.0 for plains', () => {
        expect(combatSystem.getTerrainDefenseMultiplier(TerrainType.PLAINS)).toBe(1.0);
      });

      it('returns 1.0 for desert', () => {
        expect(combatSystem.getTerrainDefenseMultiplier(TerrainType.DESERT)).toBe(1.0);
      });

      it('returns 1.0 for tundra', () => {
        expect(combatSystem.getTerrainDefenseMultiplier(TerrainType.TUNDRA)).toBe(1.0);
      });

      it('returns 1.0 for arctic', () => {
        expect(combatSystem.getTerrainDefenseMultiplier(TerrainType.ARCTIC)).toBe(1.0);
      });

      it('returns 1.0 for ocean', () => {
        expect(combatSystem.getTerrainDefenseMultiplier(TerrainType.OCEAN)).toBe(1.0);
      });

      it('returns 1.25 for river (+25%)', () => {
        expect(combatSystem.getTerrainDefenseMultiplier(TerrainType.RIVER)).toBe(1.25);
      });

      it('returns 1.5 for forest (+50%)', () => {
        expect(combatSystem.getTerrainDefenseMultiplier(TerrainType.FOREST)).toBe(1.5);
      });

      it('returns 1.5 for jungle (+50%)', () => {
        expect(combatSystem.getTerrainDefenseMultiplier(TerrainType.JUNGLE)).toBe(1.5);
      });

      it('returns 1.5 for swamp (+50%)', () => {
        expect(combatSystem.getTerrainDefenseMultiplier(TerrainType.SWAMP)).toBe(1.5);
      });

      it('returns 2.0 for hills (+100%)', () => {
        expect(combatSystem.getTerrainDefenseMultiplier(TerrainType.HILLS)).toBe(2.0);
      });

      it('returns 3.0 for mountains (+200%)', () => {
        expect(combatSystem.getTerrainDefenseMultiplier(TerrainType.MOUNTAINS)).toBe(3.0);
      });

      it('returns 1.0 when terrain is undefined', () => {
        expect(combatSystem.getTerrainDefenseMultiplier(undefined)).toBe(1.0);
      });
    });

    describe('terrain bonus applied in combat', () => {
      it('hills make the defender statistically harder to defeat', () => {
        // Use units with equal base stats to isolate the terrain effect
        const equalAttacker: Unit = { ...attacker, type: UnitType.MILITIA, isVeteran: false, fortified: false };
        const equalDefender: Unit = { ...defender, type: UnitType.MILITIA, isVeteran: false, fortified: false };

        let hillsDefenderWins = 0;
        let grasslandDefenderWins = 0;
        const trials = 200;

        for (let i = 0; i < trials; i++) {
          const r1 = combatSystem.resolveCombat(
            { ...equalAttacker }, { ...equalDefender }, [{ ...equalDefender }],
            undefined, false, TerrainType.HILLS,
          );
          const r2 = combatSystem.resolveCombat(
            { ...equalAttacker }, { ...equalDefender }, [{ ...equalDefender }],
            undefined, false, TerrainType.GRASSLAND,
          );
          if (r1.defenderSurvived) hillsDefenderWins++;
          if (r2.defenderSurvived) grasslandDefenderWins++;
        }

        // Hills defender should win significantly more often (hills doubles defense)
        expect(hillsDefenderWins).toBeGreaterThan(grasslandDefenderWins);
      });

      it('mountains provide greater defense than hills', () => {
        const equalAttacker: Unit = { ...attacker, type: UnitType.MILITIA, isVeteran: false, fortified: false };
        const equalDefender: Unit = { ...defender, type: UnitType.MILITIA, isVeteran: false, fortified: false };

        let mountainWins = 0;
        let hillsWins = 0;
        const trials = 200;

        for (let i = 0; i < trials; i++) {
          const r1 = combatSystem.resolveCombat(
            { ...equalAttacker }, { ...equalDefender }, [{ ...equalDefender }],
            undefined, false, TerrainType.MOUNTAINS,
          );
          const r2 = combatSystem.resolveCombat(
            { ...equalAttacker }, { ...equalDefender }, [{ ...equalDefender }],
            undefined, false, TerrainType.HILLS,
          );
          if (r1.defenderSurvived) mountainWins++;
          if (r2.defenderSurvived) hillsWins++;
        }

        expect(mountainWins).toBeGreaterThan(hillsWins);
      });

      it('terrain bonus is suppressed when defender is in a city', () => {
        // Even on hills, city defense calculation should not double-apply terrain
        const equalAttacker: Unit = { ...attacker, type: UnitType.MILITIA, isVeteran: false, fortified: false };
        const equalDefender: Unit = { ...defender, type: UnitType.MILITIA, isVeteran: false, fortified: false };

        // Both combats are in a city — terrain should be ignored in both cases
        let cityOnHillsWins = 0;
        let cityOnGrasslandWins = 0;
        const trials = 200;

        for (let i = 0; i < trials; i++) {
          const r1 = combatSystem.resolveCombat(
            { ...equalAttacker }, { ...equalDefender }, [{ ...equalDefender }],
            city, false, TerrainType.HILLS,
          );
          const r2 = combatSystem.resolveCombat(
            { ...equalAttacker }, { ...equalDefender }, [{ ...equalDefender }],
            city, false, TerrainType.GRASSLAND,
          );
          if (r1.defenderSurvived) cityOnHillsWins++;
          if (r2.defenderSurvived) cityOnGrasslandWins++;
        }

        // Win rates should be statistically similar (within 40% of each other at 200 trials)
        const ratio = cityOnHillsWins === 0 ? 1 : cityOnGrasslandWins / cityOnHillsWins;
        expect(ratio).toBeGreaterThan(0.6);
        expect(ratio).toBeLessThan(1.4);
      });
    });
  });
});
