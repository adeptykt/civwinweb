// Test mine building functionality
import { Game } from '../src/game/Game';
import { TurnManager } from '../src/game/TurnManager';
import { UnitType, ImprovementType, TerrainType } from '../src/types/game';

async function testMineBuilding() {
  console.log('Testing mine building functionality...');
  
  // Create a test game
  const game = new Game();
  game.initializeGame(['Test Player'], 'random');
  
  const gameState = game.getGameState();
  
  // Create a settler unit for testing
  const testPosition = { x: 10, y: 10 };
  const settler = game.createUnit(UnitType.SETTLERS, testPosition, gameState.currentPlayer);
  
  if (!settler) {
    console.error('Failed to create settler unit');
    return;
  }
  
  console.log('Created settler at position:', testPosition);
  
  // Test 1: Try to build mine on current tile
  console.log('Test 1: Building mine on', gameState.worldMap[testPosition.y][testPosition.x].terrain);
  const success1 = game.buildMine(settler.id);
  console.log('Mine building initiated:', success1);
  
  if (success1) {
    console.log('Settler should now be building a mine');
    console.log('Building mine:', settler.buildingMine);
    console.log('Mine building turns:', settler.mineBuildingTurns);
  }
  
  // Test 2: Process a turn to advance mine building
  const turnManager = new TurnManager();
  console.log('Processing turn 1...');
  turnManager.processTurn(gameState);
  
  console.log('After turn 1:');
  console.log('Building mine:', settler.buildingMine);
  console.log('Mine building turns:', settler.mineBuildingTurns);
  
  // Test 3: Process another turn to complete mine building
  console.log('Processing turn 2...');
  turnManager.processTurn(gameState);
  
  console.log('After turn 2:');
  console.log('Building mine:', settler.buildingMine);
  console.log('Mine building turns:', settler.mineBuildingTurns);
  
  // Check if mine was created
  const tile = gameState.worldMap[testPosition.y][testPosition.x];
  const hasMine = tile.improvements?.some(imp => imp.type === ImprovementType.MINE);
  console.log('Mine created on tile:', hasMine);
  
  if (hasMine) {
    console.log('SUCCESS: Mine building functionality is working!');
  } else {
    console.log('FAILED: Mine was not created after 2 turns');
  }
}

// Run the test
testMineBuilding().catch(console.error);
