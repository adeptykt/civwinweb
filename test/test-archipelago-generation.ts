import { MapGenerator } from '../src/game/MapGenerator';
import { TerrainType } from '../src/types/game';

// Test archipelago generation for continent separation
function testArchipelagoGeneration() {
  console.log('Testing archipelago map generation with continent separation...');
  
  const mapGenerator = new MapGenerator();
  const map = mapGenerator.generateMap(80, 50, 'random');
  
  // Count terrain types
  const terrainCounts: Record<string, number> = {};
  let totalTiles = 0;
  
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      const terrain = map[y][x].terrain;
      terrainCounts[terrain] = (terrainCounts[terrain] || 0) + 1;
      totalTiles++;
    }
  }
  
  console.log('Terrain distribution:');
  for (const [terrain, count] of Object.entries(terrainCounts)) {
    const percentage = ((count / totalTiles) * 100).toFixed(1);
    console.log(`  ${terrain}: ${count} tiles (${percentage}%)`);
  }
  
  // Check if we have a good archipelago balance
  const oceanPercentage = (terrainCounts[TerrainType.OCEAN] || 0) / totalTiles * 100;
  const landTiles = totalTiles - (terrainCounts[TerrainType.OCEAN] || 0);
  const landPercentage = (landTiles / totalTiles) * 100;
  
  console.log(`\nArchipelago analysis:`);
  console.log(`  Ocean: ${oceanPercentage.toFixed(1)}%`);
  console.log(`  Land: ${landPercentage.toFixed(1)}%`);
  
  // For a good archipelago with continent separation, we want 50-70% ocean, 30-50% land
  if (oceanPercentage >= 50 && oceanPercentage <= 70) {
    console.log('✅ Good archipelago ocean ratio for continent separation');
  } else if (oceanPercentage < 50) {
    console.log('❌ Too much land - needs more ocean separation');
  } else {
    console.log('❌ Too much ocean - needs more land');
  }
  
  // Count unique terrain types on land (should have variety)
  const landTerrainTypes = Object.keys(terrainCounts).filter(t => t !== TerrainType.OCEAN).length;
  console.log(`  Land terrain variety: ${landTerrainTypes} different types`);
  
  if (landTerrainTypes >= 5) {
    console.log('✅ Good terrain variety');
  } else {
    console.log('❌ Limited terrain variety');
  }
  
  // Analyze continent separation by checking for large ocean gaps
  let continentSeparationGood = true;
  const sampleRows = [10, 25, 40]; // Sample some rows
  
  for (const row of sampleRows) {
    if (row < map.length) {
      let consecutiveOcean = 0;
      let maxOceanGap = 0;
      
      for (let x = 0; x < map[row].length; x++) {
        if (map[row][x].terrain === TerrainType.OCEAN) {
          consecutiveOcean++;
          maxOceanGap = Math.max(maxOceanGap, consecutiveOcean);
        } else {
          consecutiveOcean = 0;
        }
      }
      
      if (maxOceanGap >= 8) {
        console.log(`✅ Good continent separation found in row ${row} (${maxOceanGap} ocean tiles)`);
      }
    }
  }
  
  // Visual representation (simplified)
  console.log('\nMap preview (O=Ocean, L=Land):');
  for (let y = 0; y < Math.min(15, map.length); y++) {
    let row = '';
    for (let x = 0; x < Math.min(60, map[y].length); x++) {
      row += map[y][x].terrain === TerrainType.OCEAN ? 'O' : 'L';
    }
    console.log(row);
  }
}

// Run the test
testArchipelagoGeneration();
