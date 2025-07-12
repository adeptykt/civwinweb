import { Game } from '../src/game/Game';
import { GameState, UnitType, TerrainType, Player, Unit, City, Position } from '../src/types/game';
import { CivilizationType } from '../src/game/CivilizationDefinitions';

/**
 * Test to verify that attacking units don't move into cities when defenders remain
 */
async function testCombatCityDefense() {
  console.log('Testing combat city defense logic...');
  
  // Create a game with two players
  const game = new Game();
  game.initializeGame(['Player 1', 'Player 2'], 'earth');
  
  // Get the game state to work with
  const gameState = game.getGameState();
  
  // Find a suitable location for our test (flat terrain)
  let testPosition: Position | null = null;
  for (let y = 10; y < 20; y++) {
    for (let x = 10; x < 20; x++) {
      if (gameState.worldMap[y] && gameState.worldMap[y][x] && 
          gameState.worldMap[y][x].terrain === TerrainType.GRASSLAND) {
        testPosition = { x, y };
        break;
      }
    }
    if (testPosition) break;
  }
  
  if (!testPosition) {
    console.error('Could not find suitable test position');
    return;
  }

  console.log('Using test position:', testPosition);
  
  // Manually create units and city for testing
  // We'll use the game's internal structure, but through controlled actions
  
  // Create a city at the test position for player 2
  const city: City = {
    id: 'test-city',
    name: 'Test City',
    position: testPosition,
    population: 2,
    playerId: gameState.players[1].id,
    buildings: [],
    production: null,
    food: 0,
    foodStorage: 0,
    foodStorageCapacity: 20,
    production_points: 0,
    science: 0,
    culture: 0
  };
  
  // Add city to game state
  gameState.cities.push(city);

  // Create defending units
  const defender1: Unit = {
    id: 'defender1',
    type: UnitType.PHALANX,
    position: testPosition,
    movementPoints: 1,
    maxMovementPoints: 1,
    health: 100,
    maxHealth: 100,
    playerId: gameState.players[1].id,
    experience: 0,
    isVeteran: false,
    fortified: true
  };

  const defender2: Unit = {
    id: 'defender2',
    type: UnitType.MILITIA,
    position: testPosition,
    movementPoints: 1,
    maxMovementPoints: 1,
    health: 100,
    maxHealth: 100,
    playerId: gameState.players[1].id,
    experience: 0,
    isVeteran: false,
    fortified: true
  };

  // Create attacking unit adjacent to city
  const attackerPosition = { x: testPosition.x - 1, y: testPosition.y };
  const attacker: Unit = {
    id: 'attacker1',
    type: UnitType.LEGION,
    position: attackerPosition,
    movementPoints: 1,
    maxMovementPoints: 1,
    health: 100,
    maxHealth: 100,
    playerId: gameState.players[0].id,
    experience: 0,
    isVeteran: false,
    fortified: false
  };

  // Add units to game state
  gameState.units.push(defender1, defender2, attacker);

  console.log('Initial state:');
  console.log('- City at', testPosition, 'owned by', gameState.players[1].name);
  console.log('- 2 defending units at', testPosition);
  console.log('- 1 attacking unit at', attackerPosition);

  // Test: Attack the city - should defeat one defender but not move in
  console.log('\n--- Test: Attack city with multiple defenders ---');
  const initialAttackerPosition = { ...attacker.position };
  
  try {
    const result = game.moveUnit('attacker1', testPosition);
    console.log('Move result:', result);
    
    // Check current state
    const currentAttacker = gameState.units.find(u => u.id === 'attacker1');
    if (currentAttacker) {
      console.log('Attacker position after combat:', currentAttacker.position);
      
      // Check if attacker moved into city
      if (currentAttacker.position.x === testPosition.x && currentAttacker.position.y === testPosition.y) {
        console.log('✗ FAILURE: Attacker moved into city when defenders remain');
      } else {
        console.log('✓ SUCCESS: Attacker stayed at original position');
      }
    } else {
      console.log('Attacker was destroyed in combat');
    }
    
    // Check remaining defenders
    const remainingDefenders = gameState.units.filter(u => 
      u.position.x === testPosition.x && u.position.y === testPosition.y && u.playerId === gameState.players[1].id
    );
    console.log('Remaining defenders:', remainingDefenders.length);
    
  } catch (error) {
    console.error('Error during combat:', error);
  }

  console.log('\n--- Test Complete ---');
}

// Run the test
testCombatCityDefense().catch(console.error);
