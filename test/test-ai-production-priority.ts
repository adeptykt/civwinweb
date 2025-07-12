import { GameState, Unit, City, UnitType, Player, GovernmentType, TerrainType } from '../src/types/game';
import { AIPlayer } from '../src/game/AIPlayer';

/**
 * Test AI production priority for defensive units
 */
async function testAIProductionPriority() {
  console.log('Testing AI production priority for city defense...');
  
  // Create a mock game state with an AI city that has no defenders
  const gameState: GameState = {
    turn: 10,
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
        usedCityNames: ['Rome']
      } as Player
    ],
    worldMap: Array(50).fill(null).map(() => 
      Array(50).fill(null).map(() => ({
        position: { x: 0, y: 0 },
        terrain: TerrainType.GRASSLAND
      }))
    ),
    units: [
      // One settler unit away from the city
      {
        id: 'unit1',
        type: UnitType.SETTLERS,
        position: { x: 15, y: 15 },
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
        population: 2,
        playerId: 'ai1',
        buildings: [],
        production: null, // No current production
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
  console.log('- Rome (10,10): population 2, no defenders, no production');
  console.log('- 1 settler unit at (15,15) - away from city');
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
  
  // Check production results
  const rome = gameState.cities.find(c => c.name === 'Rome');
  if (rome && rome.production) {
    console.log(`Rome is now producing: ${rome.production.type} - ${rome.production.item}`);
    console.log(`Turns remaining: ${rome.production.turnsRemaining}`);
    
    // Check if production is a military unit
    const isMilitaryUnit = rome.production.type === 'unit' && 
      ['militia', 'warrior', 'phalanx', 'legion', 'knights', 'musketeers', 'riflemen', 'artillery', 'armor', 'mech_inf'].includes(rome.production.item as string);
    
    console.log(`\nTest Result: ${isMilitaryUnit ? 'PASSED' : 'FAILED'}`);
    
    if (isMilitaryUnit) {
      console.log('✅ AI prioritized military unit production for city defense!');
    } else {
      console.log('❌ AI did not prioritize military unit production for city defense!');
    }
  } else {
    console.log('❌ Rome has no production set!');
    console.log('Test Result: FAILED');
  }
}

// Run the test
testAIProductionPriority().catch(console.error);
