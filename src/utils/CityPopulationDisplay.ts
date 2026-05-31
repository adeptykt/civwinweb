/**
 * Utility for converting city size to displayed population numbers
 * Based on Civilization I population display mechanics
 */

// Population mapping from city size to displayed population
// Based on authentic Civilization I population data
const CITY_POPULATION_MAPPING: Record<number, number> = {
  1: 10000,
  2: 30000,
  3: 60000,
  4: 100000,
  5: 150000,
  6: 210000,
  7: 280000,
  8: 360000,
  9: 450000,
  10: 550000,
  11: 660000,
  12: 780000,
  13: 910000,
  14: 1050000,
  15: 1200000,
  16: 1360000,
  17: 1530000,
  18: 1710000,
  19: 1900000,
  20: 2100000,
  21: 2310000,
  22: 2530000,
  23: 2760000,
  24: 3000000,
  25: 3250000,
  26: 3510000,
  27: 3780000,
  28: 4060000,
  29: 4350000,
  30: 4650000,
  31: 4960000,
  32: 5280000,
  33: 5610000,
  34: 5950000,
  35: 6300000,
  36: 6660000,
  37: 7030000,
  38: 7410000,
  39: 7800000,
  40: 8200000,
  41: 8610000,
  42: 9030000,
  43: 9460000,
  44: 9900000,
  45: 10350000,
  46: 10810000,
  47: 11280000,
  48: 11760000,
  49: 12250000,
  50: 12750000
};

/**
 * Convert city size to displayed population number
 * @param citySize The internal city size (1-50)
 * @returns The displayed population number
 */
export function getDisplayedPopulation(citySize: number): number {
  // Clamp city size to valid range
  const clampedSize = Math.max(1, Math.min(50, citySize));
  
  return CITY_POPULATION_MAPPING[clampedSize] || CITY_POPULATION_MAPPING[1];
}

/**
 * Format displayed population number with appropriate commas
 * @param population The population number to format
 * @returns Formatted population string (e.g., "1,050,000")
 */
export function formatPopulation(population: number): string {
  return population.toLocaleString();
}

/**
 * Get formatted population display for a city size
 * @param citySize The internal city size (1-50)
 * @returns Formatted population string (e.g., "1,050,000")
 */
export function getCityPopulationDisplay(citySize: number): string {
  const population = getDisplayedPopulation(citySize);
  return formatPopulation(population);
}

/**
 * Get all valid city sizes (for validation purposes)
 * @returns Array of valid city sizes [1, 2, 3, ..., 50]
 */
export function getValidCitySizes(): number[] {
  return Object.keys(CITY_POPULATION_MAPPING).map(Number).sort((a, b) => a - b);
}

/**
 * Check if a city size is valid
 * @param citySize The city size to check
 * @returns True if the city size is valid (1-50)
 */
export function isValidCitySize(citySize: number): boolean {
  return citySize >= 1 && citySize <= 50 && Number.isInteger(citySize);
}
