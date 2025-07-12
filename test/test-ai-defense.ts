import { GameState, Unit, City, UnitType, Player, GovernmentType, TerrainType } from '../src/types/game';
import { AIPlayer } from '../src/game/AIPlayer';

/**
 * Test AI defensive behavior to ensure cities are properly defended
 */
async function testAIDefense() {
  console.log('Testing AI defensive behavior...');
  
  // Create a mock game state with an AI player and cities
  const gameState: GameState = {
    turn: 5,
    currentPlayer: 'ai1',
    players: [
      {
        id: 'ai1',
        name: 'AI Player 1',
        civilizationType: 'romans',
        color: '#ff0000',
        isHuman: false,
        science: 0,
        gold: 10,
        culture: 0,
        technologies: [],
        government: GovernmentType.DESPOTISM,
        usedCityNames: ['Rome', 'Antium']
      } as Player
    ],
    worldMap: Array(50).fill(null).map(() => 
      Array(50).fill(null).map(() => ({
        position: { x: 0, y: 0 },
        terrain: TerrainType.GRASSLAND
      }))
    ),
    units: [
      // One militia unit near Rome (should fortify to defend)
      {
        id: 'unit1',
        type: UnitType.MILITIA,
        position: { x: 10, y: 10 },
        movementPoints: 1,
        maxMovementPoints: 1,
        health: 100,
        maxHealth: 100,
        playerId: 'ai1',
        experience: 0,
        isVeteran: false,
        fortified: false
      } as Unit,
      // One militia unit near Antium (should fortify to defend)
      {
        id: 'unit2',
        type: UnitType.MILITIA,
        position: { x: 20, y: 20 },
        movementPoints: 1,
        maxMovementPoints: 1,
        health: 100,
        maxHealth: 100,
        playerId: 'ai1',
        experience: 0,
        isVeteran: false,
        fortified: false
      } as Unit,
      // One militia unit away from cities (should move to defend)
      {
        id: 'unit3',
        type: UnitType.MILITIA,
        position: { x: 5, y: 5 },
        movementPoints: 1,
        maxMovementPoints: 1,
        health: 100,
        maxHealth: 100,
        playerId: 'ai1',
        experience: 0,
        isVeteran: false,
        fortified: false
      } as Unit
    ],
    cities: [
      {
        id: 'city1',
        name: 'Rome',
        position: { x: 10, y: 10 },
        population: 1,
        playerId: 'ai1',
        buildings: [],
        production: null,
        food: 0,
        foodStorage: 0,
        foodStorageCapacity: 10,
        production_points: 0,
        science: 0,
        culture: 0
      } as City,
      {
        id: 'city2',
        name: 'Antium',
        position: { x: 20, y: 20 },
        population: 1,
        playerId: 'ai1',
        buildings: [],
        production: null,
        food: 0,
        foodStorage: 0,
        foodStorageCapacity: 10,
        production_points: 0,
        science: 0,
        culture: 0
      } as City
    ],
    gamePhase: 'playing',
    score: 0
  };

  console.log('Initial state:');
  console.log('- Rome (10,10): 1 militia unit present');
  console.log('- Antium (20,20): 1 militia unit present');
  console.log('- 1 militia unit at (5,5) - away from cities');
  console.log('');

  // Mock game interface for testing
  const mockGame = {
    moveUnit: (unitId: string, newPosition: { x: number; y: number }) => {
      console.log(`Moving unit ${unitId} to (${newPosition.x}, ${newPosition.y})`);
      const unit = gameState.units.find(u => u.id === unitId);
      if (unit) {
        unit.position = newPosition;
        unit.movementPoints = Math.max(0, unit.movementPoints - 1);
      }
      return true;
    },
    fortifyUnit: (unitId: string) => {
      console.log(`Fortifying unit ${unitId}`);
      const unit = gameState.units.find(u => u.id === unitId);
      if (unit) {
        unit.fortifying = true;
        unit.movementPoints = 0;
      }
      return true;
    },
    foundCity: (unitId: string) => {
      console.log(`Founding city with unit ${unitId}`);
      return true;
    },
    buildRoad: (unitId: string) => {
      console.log(`Building road with unit ${unitId}`);
      return true;
    },
    buildIrrigation: (unitId: string) => {
      console.log(`Building irrigation with unit ${unitId}`);
      return true;
    },
    wakeUnit: (unitId: string) => {
      console.log(`Waking unit ${unitId}`);
      const unit = gameState.units.find(u => u.id === unitId);
      if (unit) {
        unit.fortified = false;
        unit.fortifying = false;
      }
      return true;
    }
  };

  // Execute AI turn
  await AIPlayer.executeTurn(gameState, 'ai1', mockGame);
  
  console.log('\nAfter AI turn:');
  
  // Check results
  let defendersInRome = 0;
  let defendersInAntium = 0;
  let unitsNotDefending = 0;
  
  for (const unit of gameState.units) {
    if (unit.playerId === 'ai1') {
      const isDefending = unit.fortified || unit.fortifying;
      
      if (unit.position.x === 10 && unit.position.y === 10 && isDefending) {
        defendersInRome++;
      } else if (unit.position.x === 20 && unit.position.y === 20 && isDefending) {
        defendersInAntium++;
      } else if (!isDefending) {
        unitsNotDefending++;
      }
      
      console.log(`Unit ${unit.id} at (${unit.position.x}, ${unit.position.y}): ${isDefending ? 'DEFENDING' : 'NOT DEFENDING'}`);
    }
  }
  
  console.log(`\nDefense summary:`);
  console.log(`- Rome defenders: ${defendersInRome}`);
  console.log(`- Antium defenders: ${defendersInAntium}`);
  console.log(`- Units not defending: ${unitsNotDefending}`);
  
  // Test results
  const romeDefended = defendersInRome >= 1;
  const antiumDefended = defendersInAntium >= 1;
  const testPassed = romeDefended && antiumDefended;
  
  console.log(`\nTest Result: ${testPassed ? 'PASSED' : 'FAILED'}`);
  
  if (!testPassed) {
    console.log('❌ Cities are not properly defended!');
    if (!romeDefended) console.log('  - Rome lacks defenders');
    if (!antiumDefended) console.log('  - Antium lacks defenders');
  } else {
    console.log('✅ Cities are properly defended!');
  }
}

// Run the test
testAIDefense().catch(console.error);
