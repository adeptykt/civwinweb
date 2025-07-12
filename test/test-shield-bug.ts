import { TurnManager } from '../src/game/TurnManager';
import { GameState, City, Player, TerrainType } from '../src/types/game';
import { CivilizationType } from '../src/game/CivilizationDefinitions';
import { TechnologyType } from '../src/game/TechnologyDefinitions';

/**
 * Test the famous Civ1 "shield bug" - shields accumulate even when producing nothing
 */
function testShieldBug() {
  console.log('Testing Civ1 "shield bug" - shields accumulate when producing nothing...');
  
  // Create a mock game state
  const gameState: GameState = {
    turn: 1,
    currentPlayer: 'player1',
    players: [
      {
        id: 'player1',
        name: 'Test Player',
        civilizationType: CivilizationType.ROMANS,
        color: 'red',
        isHuman: true,
        science: 0,
        gold: 100,
        culture: 0,
        technologies: [TechnologyType.BRONZE_WORKING],
        government: 'despotism' as any,
        usedCityNames: ['Rome']
      } as Player
    ],
    worldMap: Array(10).fill(null).map((_, y) =>
      Array(10).fill(null).map((_, x) => ({
        position: { x, y },
        terrain: TerrainType.GRASSLAND,
        resources: [],
        improvements: []
      }))
    ),
    units: [],
    cities: [],
    gamePhase: 'playing' as any,
    score: 0
  };

  // Create a test city with no production (producing "nothing")
  const city: City = {
    id: 'city1',
    name: 'Rome',
    position: { x: 5, y: 5 },
    population: 2,
    playerId: 'player1',
    buildings: [],
    production: null, // This is the key - producing nothing
    food: 0,
    foodStorage: 0,
    foodStorageCapacity: 20,
    production_points: 0, // Start with 0 shields
    science: 0,
    culture: 0
  };

  gameState.cities.push(city);
  const turnManager = new TurnManager();

  console.log('Testing shield accumulation when producing nothing...');
  
  // Test multiple turns of producing nothing
  for (let turn = 1; turn <= 5; turn++) {
    const shieldsBefore = city.production_points;
    
    console.log(`\n--- Turn ${turn} ---`);
    console.log(`Before turn: shields=${shieldsBefore}, production=${city.production}`);
    
    // Process the turn
    turnManager.processTurn(gameState);
    
    const shieldsAfter = city.production_points;
    console.log(`After turn: shields=${shieldsAfter}, production=${city.production}`);
    
    // Check that shields increased even though nothing is being produced
    if (shieldsAfter > shieldsBefore) {
      console.log(`✓ SUCCESS: Shields increased from ${shieldsBefore} to ${shieldsAfter} while producing nothing`);
    } else {
      console.log(`✗ FAILURE: Shields did not increase (${shieldsBefore} -> ${shieldsAfter})`);
    }
    
    // Move to next player and back to simulate turn progression
    gameState.currentPlayer = gameState.players[0].id;
  }
  
  console.log(`\n--- Final Results ---`);
  console.log(`Final shield count: ${city.production_points}`);
  console.log(`Production status: ${city.production ? city.production.item : 'nothing (null)'}`);
  
  if (city.production_points >= 5 && city.production === null) {
    console.log('✓ SUCCESS: The famous Civ1 "shield bug" is working!');
    console.log('  - Shields accumulated over multiple turns');
    console.log('  - No production was selected (producing "nothing")');
    console.log('  - This matches the original Civilization 1 behavior');
  } else {
    console.log('✗ FAILURE: Shield bug is not working correctly');
  }
}

// Run the test
testShieldBug();
