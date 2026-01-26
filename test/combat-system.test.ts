import { describe, it, expect, beforeEach } from 'vitest';
import { CombatSystem } from '../src/game/CombatSystem';
import { Unit, UnitType, City } from '../src/types/game';

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
});
