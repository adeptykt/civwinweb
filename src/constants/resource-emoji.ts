/**
 * Canonical resource type → emoji variants mapping.
 * Each resource may have one or more emoji alternatives; the same tile always
 * renders the same variant (chosen deterministically from its world position).
 *
 * Used by GameRenderer, CityView, TileInfoDialog, and any future consumers.
 */
export const RESOURCE_EMOJI: Record<string, string[]> = {
  wheat:  ['🌾'],
  fish:   ['🐟', '🐠', '🦈'],
  seal:   ['🦭'],
  game:   ['🦌', '🐗'],
  oasis:  ['🏝️'],
  coal:   ['🪨'],
  horses: ['🐎'],
  oil:    ['🛢️'],
  gem:    ['💎'],
  gold:   ['⚜️'],
};

/**
 * Returns the emoji for a resource at a given world tile position.
 * The selection is deterministic — the same (resource, x, y) always yields
 * the same emoji, so the map looks consistent across frames and redraws.
 */
export function pickResourceEmoji(resource: string, tileX: number, tileY: number): string {
  const variants = RESOURCE_EMOJI[resource];
  if (!variants || variants.length === 0) return '🔹';
  if (variants.length === 1) return variants[0];
  // Cheap but well-distributed integer hash of the tile coordinates.
  const hash = Math.abs((tileX * 374761393 + tileY * 1234567891) | 0);
  return variants[hash % variants.length];
}
