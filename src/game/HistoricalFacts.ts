/**
 * Historical facts database with interesting real-world events
 * Years are represented as actual historical years (e.g., 500 BC = -500, 2000 AD = 2000)
 */

import { t } from '../i18n/I18nService.js';

export interface HistoricalFact {
  year: number;
  title: string;
  description: string;
}

// Keep only years here; localized strings come from i18n catalogs.
const historicalFactYears: number[] = [
  -4000, -3900, -3800, -3700, -3600, -3500, -3400, -3300, -3200, -3100,
  -3000, -2900, -2800, -2700, -2600, -2500, -2400, -2300, -2200, -2100,
  -2000, -1900, -1800, -1700, -1600, -1500, -1400, -1300, -1200, -1100,
  -1000, -900, -800, -700, -600, -500, -400, -300, -200, -100, -50, -6,
  1, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300,
  1400, 1500, 1600, 1700, 1750, 1800, 1850, 1900, 1920, 1945, 1969, 2000, 2020,
];

function buildLocalizedHistoricalFact(year: number): HistoricalFact {
  return {
    year,
    title: t(`historicalFacts.${year}.title`),
    description: t(`historicalFacts.${year}.description`),
  };
}

/**
 * Get a historical fact for a given year
 * Falls back to nearby years if exact year not found
 */
export function getHistoricalFact(year: number): HistoricalFact | null {
  // First try to find exact match
  if (historicalFactYears.includes(year)) {
    return buildLocalizedHistoricalFact(year);
  }

  // If no exact match, find closest year
  let closestYear: number | null = null;
  let closestDistance = Infinity;

  for (const factYear of historicalFactYears) {
    const distance = Math.abs(factYear - year);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestYear = factYear;
    }
  }

  return closestYear !== null ? buildLocalizedHistoricalFact(closestYear) : null;
}

/**
 * Get a random historical fact
 */
export function getRandomHistoricalFact(): HistoricalFact {
  const year = historicalFactYears[Math.floor(Math.random() * historicalFactYears.length)];
  return buildLocalizedHistoricalFact(year);
}
