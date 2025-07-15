import { Civ1MapGenerator } from '../src/game/Civ1MapGenerator';
import { TerrainType } from '../src/types/game';

console.log('Testing Civ1MapGenerator...');

const generator = new Civ1MapGenerator();

// Test different world sizes
const worldSizes = [
  { name: 'Tiny', value: Civ1MapGenerator.WorldSize.TINY },
  { name: 'Small', value: Civ1MapGenerator.WorldSize.SMALL },
  { name: 'Medium', value: Civ1MapGenerator.WorldSize.MEDIUM },
  { name: 'Large', value: Civ1MapGenerator.WorldSize.LARGE },
  { name: 'Huge', value: Civ1MapGenerator.WorldSize.HUGE },
  { name: 'Gigantic', value: Civ1MapGenerator.WorldSize.GIGANTIC }
];

for (const worldSize of worldSizes) {
  console.log(`\nTesting ${worldSize.name} world size (${worldSize.value})...`);
  
  const startTime = Date.now();
  const map = generator.generateCiv1Map(80, 50, worldSize.value);
  const endTime = Date.now();
  
  // Count terrain types
  const terrainCounts: Record<string, number> = {};
  let totalLandTiles = 0;
  
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 80; x++) {
      const terrain = map[y][x].terrain;
      terrainCounts[terrain] = (terrainCounts[terrain] || 0) + 1;
      
      if (terrain !== TerrainType.OCEAN) {
        totalLandTiles++;
      }
    }
  }
  
  console.log(`  Generation time: ${endTime - startTime}ms`);
  console.log(`  Total land tiles: ${totalLandTiles}`);
  console.log(`  Terrain distribution:`);
  
  for (const [terrain, count] of Object.entries(terrainCounts)) {
    const percentage = ((count / (80 * 50)) * 100).toFixed(1);
    console.log(`    ${terrain}: ${count} tiles (${percentage}%)`);
  }
  
  // Verify that we have landmasses (not all ocean)
  if (totalLandTiles === 0) {
    console.error(`  ERROR: No land tiles generated for ${worldSize.name}!`);
  } else {
    console.log(`  ✓ Successfully generated ${worldSize.name} world`);
  }
}

console.log('\nCiv1MapGenerator test completed.');
