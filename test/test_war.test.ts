import { describe, it, expect } from 'vitest';
import { Game } from '../src/game/Game';
import { UnitType } from '../src/game/UnitDefinitions';

describe('Game War', () => {
  it('should allow unit to attack after war declared', () => {
    const game = new Game();
    game.initializeNewGame(2, 0); // 2 players
    const human = game.getGameState().players.find(p => p.isHuman);
    const ai = game.getGameState().players.find(p => !p.isHuman);
    
    // Add units
    const humanUnit = {
      id: 'hu1', type: UnitType.MILITIA,
      position: { x: 5, y: 5 }, movementPoints: 1, maxMovementPoints: 1,
      health: 10, maxHealth: 10, playerId: human.id,
      experience: 0, isVeteran: false, fortified: false
    };
    const aiUnit = {
      id: 'au1', type: UnitType.MILITIA,
      position: { x: 6, y: 5 }, movementPoints: 1, maxMovementPoints: 1,
      health: 10, maxHealth: 10, playerId: ai.id,
      experience: 0, isVeteran: false, fortified: false
    };
    
    game.getGameState().units.push(humanUnit, aiUnit);
    game.getGameState().worldMap[5][5].terrainType = 'grassland';
    game.getGameState().worldMap[5][6].terrainType = 'grassland';
    
    // Attempt attack
    const r1 = game.moveUnit('hu1', {x: 6, y: 5});
    console.log('first move returns:', r1);
    
    // Confirm
    const r2 = game.confirmDeclareWarAndAttack('hu1', {x: 6, y: 5}, ai.id);
    console.log('second move returns:', r2);
    
    expect(r2).toBe(true);
  });
});
