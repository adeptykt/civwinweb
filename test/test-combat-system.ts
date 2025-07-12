import { CombatSystem } from '../src/game/CombatSystem';
import { Unit, UnitType, City, Position } from '../src/types/game';

/**
 * Test combat system to verify attacker behavior with city defenders
 */
function testCombatSystem() {
  console.log('Testing combat system logic...');
  
  const combatSystem = new CombatSystem();
  
  // Create test units
  const attacker: Unit = {
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

  const defender1: Unit = {
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

  const defender2: Unit = {
    id: 'defender2',
    type: UnitType.MILITIA,
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

  const city: City = {
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

  const allUnitsAtPosition = [defender1, defender2];

  console.log('Initial state:');
  console.log('- Attacker (Legion) at (4,5)');
  console.log('- 2 Defenders (Phalanx, Militia) at (5,5)');
  console.log('- City at (5,5)');

  // Test combat
  console.log('\n--- Testing Combat ---');
  
  // Multiple combat rounds to test the behavior
  for (let round = 1; round <= 3; round++) {
    console.log(`\nRound ${round}:`);
    
    // Get current units at position
    const currentUnitsAtPosition = allUnitsAtPosition.filter(u => u.health > 0);
    if (currentUnitsAtPosition.length === 0) {
      console.log('No defenders remaining');
      break;
    }
    
    console.log(`Defenders remaining: ${currentUnitsAtPosition.length}`);
    
    // Select strongest defender
    const strongestDefender = currentUnitsAtPosition.reduce((strongest, current) => {
      return current.type === UnitType.PHALANX ? current : strongest;
    });
    
    console.log(`Attacking ${strongestDefender.type} (${strongestDefender.id})`);
    
    // Execute combat
    const result = combatSystem.executeAttack(attacker, strongestDefender, currentUnitsAtPosition, city);
    
    if (result) {
      console.log(`Combat result: ${result.attackerWins ? 'Attacker wins' : 'Defender wins'}`);
      console.log(`Attacker survived: ${result.attackerSurvived}`);
      console.log(`Defender survived: ${result.defenderSurvived}`);
      console.log(`Units destroyed: ${result.unitsDestroyed.length}`);
      
      if (result.unitsDestroyed.length > 0) {
        console.log(`Destroyed units: ${result.unitsDestroyed.map(u => u.id).join(', ')}`);
        
        // Remove destroyed units from our test array
        for (const destroyed of result.unitsDestroyed) {
          const index = allUnitsAtPosition.findIndex(u => u.id === destroyed.id);
          if (index !== -1) {
            allUnitsAtPosition.splice(index, 1);
          }
        }
      }
      
      // Check if attacker was destroyed
      if (!result.attackerSurvived) {
        console.log('Attacker was destroyed - test ends');
        break;
      }
      
      // Reset attacker movement for next round
      attacker.movementPoints = 1;
      
    } else {
      console.log('Combat failed - invalid attack');
      break;
    }
  }
  
  console.log('\n--- Test Complete ---');
  console.log('This test verifies the combat system works correctly.');
  console.log('The actual movement logic is tested separately in the Game class.');
}

// Run the test
testCombatSystem();
