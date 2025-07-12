import { TurnManager } from '../src/game/TurnManager';
import { GameState, City, UnitType, Player, TerrainType, BuildingType } from '../src/types/game';
import { CivilizationType } from '../src/game/CivilizationDefinitions';
import { TechnologyType } from '../src/game/TechnologyDefinitions';

/**
 * Test production completion behavior
 */
function testProductionCompletion() {
  console.log('Testing production completion behavior...');
  
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
        technologies: [
          TechnologyType.BRONZE_WORKING, // Required for Phalanx
          TechnologyType.POTTERY,        // Required for Granary
          TechnologyType.MASONRY         // Add some more basic techs
        ],
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

  // Create a test city
  const city: City = {
    id: 'city1',
    name: 'Rome',
    position: { x: 5, y: 5 },
    population: 2,
    playerId: 'player1',
    buildings: [],
    production: null,
    food: 0,
    foodStorage: 0,
    foodStorageCapacity: 20,
    production_points: 0,
    science: 0,
    culture: 0
  };

  gameState.cities.push(city);

  const turnManager = new TurnManager();

  // Test 1: Complete a unit production - should auto-start same unit type
  console.log('\n--- Test 1: Unit Production Completion ---');
  
  city.production = {
    type: 'unit',
    item: UnitType.PHALANX,
    turnsRemaining: 1
  };
  city.production_points = 3; // Enough to complete production
  
  console.log('Before completion:');
  console.log('- Production:', city.production);
  console.log('- Production points:', city.production_points);
  console.log('- Units count:', gameState.units.length);
  
  turnManager.processTurn(gameState);
  
  console.log('After completion:');
  console.log('- Production:', city.production);
  console.log('- Production points:', city.production_points);
  console.log('- Units count:', gameState.units.length);
  
  if (city.production && city.production.item === UnitType.PHALANX) {
    console.log('✓ SUCCESS: City continues building same unit type (Phalanx)');
  } else {
    console.log('✗ FAILURE: City is not continuing same unit type');
  }
  
  // Test 2: Complete a building production - should keep shields and clear production
  console.log('\n--- Test 2: Building Production Completion ---');
  
  city.production = {
    type: 'building',
    item: BuildingType.GRANARY,
    turnsRemaining: 1
  };
  city.production_points = 5; // Some shields accumulated
  
  console.log('Before completion:');
  console.log('- Production:', city.production);
  console.log('- Production points:', city.production_points);
  console.log('- Buildings count:', city.buildings.length);
  
  turnManager.processTurn(gameState);
  
  console.log('After completion:');
  console.log('- Production:', city.production);
  console.log('- Production points:', city.production_points);
  console.log('- Buildings count:', city.buildings.length);
  
  if (city.production === null && city.production_points === 6) {
    console.log('✓ SUCCESS: Building completed, shields kept (including current turn), production cleared');
  } else {
    console.log('✗ FAILURE: Building completion behavior incorrect');
    console.log(`  Expected: production=null, points=6; Got: production=${city.production}, points=${city.production_points}`);
  }
  
  console.log('\n--- Test 3: Shield Bug Test (Producing Nothing) ---');
  
  // Clear production to test the famous "shield bug"
  city.production = null;
  city.production_points = 10; // Start with some shields
  
  console.log('Before turn:');
  console.log('- Production:', city.production);
  console.log('- Production points:', city.production_points);
  
  turnManager.processTurn(gameState);
  
  console.log('After turn:');
  console.log('- Production:', city.production);
  console.log('- Production points:', city.production_points);
  
  if (city.production === null && city.production_points === 11) {
    console.log('✓ SUCCESS: Shields accumulated while producing nothing (Civ1 shield bug)');
  } else {
    console.log('✗ FAILURE: Shield bug not working correctly');
    console.log(`  Expected: production=null, points=11; Got: production=${city.production}, points=${city.production_points}`);
  }
  
  console.log('\n--- Tests Complete ---');
  console.log('Summary:');
  console.log('- Units now continue building the same type instead of defaulting to militia');
  console.log('- Buildings/wonders keep accumulated shields for next production');
  console.log('- Shields accumulate even when producing "nothing" (Civ1 shield bug)');
}

// Run the test
testProductionCompletion();
