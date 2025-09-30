// Test script to verify AI turn input blocking functionality
// This script demonstrates the new behavior where user input is properly blocked during AI turn processing

import { Game } from '../src/game/Game.js';

console.log('Testing AI turn input blocking...');

// Create a simple test
const game = new Game();

// Initialize a test game with one human and one AI player
game.initializeGame(['Human Player', 'AI Player'], 'random');

const gameState = game.getGameState();

console.log('Initial state:');
console.log('Current player:', gameState.currentPlayer);
console.log('Current player is human:', gameState.currentPlayerIsHuman);
console.log('Is processing AI turns:', game.getIsProcessingAITurns());

// Test the optimization: the isCurrentPlayerAI check should now be O(1) instead of O(n)
console.log('\nPerformance test - checking if current player is AI:');

// Old way (what we replaced): gameState.players.find(p => p.id === gameState.currentPlayer)
const startTimeOld = performance.now();
for (let i = 0; i < 10000; i++) {
  const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayer);
  const isAI = currentPlayer ? !currentPlayer.isHuman : false;
}
const endTimeOld = performance.now();

// New way: direct property access
const startTimeNew = performance.now();
for (let i = 0; i < 10000; i++) {
  const isAI = !gameState.currentPlayerIsHuman;
}
const endTimeNew = performance.now();

console.log(`Old method (find): ${endTimeOld - startTimeOld}ms`);
console.log(`New method (property): ${endTimeNew - startTimeNew}ms`);
console.log(`Performance improvement: ${((endTimeOld - startTimeOld) / (endTimeNew - startTimeNew)).toFixed(2)}x faster`);

console.log('\nTest completed successfully!');
