/**
 * Authoritative Civilization 1 resource bonus table.
 *
 * These are the bonuses added ON TOP of the base terrain yield when a
 * special resource is present on a tile.
 *
 * Reference: https://civilization.fandom.com/wiki/Special_resource_(Civ1)
 *
 *   Resource     Food  Shields  Trade
 *   Coal          0      +2       0
 *   Fish         +2       0       0
 *   Game         +2       0       0   (forest/plains/river)
 *   Game (tundra)+3       0       0   (tundra terrain only)
 *   Gems          0       0      +4
 *   Gold          0       0      +6
 *   Horses        0      +2       0
 *   Iron          0      +2       0   (not in original Civ1 but kept for game balance)
 *   Oasis        +3       0       0
 *   Oil           0      +4       0
 *   Seals        +2       0       0
 *   Wheat        +2       0       0
 */
export interface YieldBonus {
  food: number;
  production: number;
  trade: number;
}

/**
 * Returns the yield bonus for a given resource on a given terrain.
 * Pass `terrain` so the game/tundra distinction can be handled automatically.
 */
export function getResourceYieldBonus(resource: string, terrain: string): YieldBonus {
  switch (resource) {
    case 'wheat':
      return { food: 2, production: 0, trade: 0 };

    case 'fish':
      return { food: 2, production: 0, trade: 0 };

    case 'seal':
      return { food: 2, production: 0, trade: 0 };

    case 'game':
      // Tundra game gives one extra food compared to forest/plains game
      return terrain === 'tundra'
        ? { food: 3, production: 0, trade: 0 }
        : { food: 2, production: 0, trade: 0 };

    case 'oasis':
      return { food: 3, production: 0, trade: 0 };

    case 'coal':
      return { food: 0, production: 2, trade: 0 };

    case 'horses':
      return { food: 0, production: 2, trade: 0 };

    case 'iron':
      return { food: 0, production: 2, trade: 0 };

    case 'oil':
      return { food: 0, production: 4, trade: 0 };

    case 'gems':
    case 'gem':
      return { food: 0, production: 0, trade: 4 };

    case 'gold':
      return { food: 0, production: 0, trade: 6 };

    default:
      return { food: 0, production: 0, trade: 0 };
  }
}

/**
 * Apply all resource bonuses on a tile to an existing yields object (mutates in place).
 */
export function applyResourceBonuses(
  yields: { food: number; production: number; trade: number },
  resources: string[] | undefined,
  terrain: string,
): void {
  if (!resources || resources.length === 0) return;
  for (const resource of resources) {
    const bonus = getResourceYieldBonus(resource, terrain);
    yields.food       += bonus.food;
    yields.production += bonus.production;
    yields.trade      += bonus.trade;
  }
}
