/**
 * VillageSystem – handles tribal hut (goody hut) placement and encounter resolution.
 *
 * Rules are ported faithfully from Civilization 1:
 *   - Air units → nothing happens
 *   - Roll 0-3 determines reward category; distance to nearest city and tile
 *     land-value further refine the outcome
 *   - Barbarian units → nothing happens (they cannot benefit from villages)
 */

import type { GameState, Tile, Unit, Position } from '../types/game';
import { TerrainType, UnitCategory, UnitType } from '../types/game';
import { TechnologyType, canResearch, getTechnology } from './TechnologyDefinitions';
import { getUnitStats } from './UnitDefinitions';
import { t } from '../i18n/I18nService.js';
import { getUnitDisplayName } from '../utils/DisplayNames.js';
import { createUnit } from './Units';
import { GameTime } from '../utils/GameTime';
import { BARBARIAN_PLAYER_ID } from './BarbarianSystem';

// ── Result type ──────────────────────────────────────────────────────────────

export type VillageOutcomeType =
  | 'nothing'
  | 'gold'
  | 'advanced_tribe'
  | 'mercenaries'
  | 'technology'
  | 'barbarians';

export interface VillageEncounterResult {
  type: VillageOutcomeType;
  /** Human-readable message to display. Empty for 'nothing'. */
  message: string;
  goldAmount?: number;
  technologyType?: TechnologyType;
  /** UnitType gifted to the player (mercenaries / advanced tribe settler). */
  unitType?: UnitType;
}

// ── Terrain land-value table (Civ 1 style) ─────────────────────────────────

/**
 * Returns the intrinsic land-value score for a tile.
 * Values match the Civ 1 terrain table used in the hut-encounter logic.
 *   - ≥ 13 → "advanced tribe" (case 0 when far from cities)
 *   - < 13 → "valuable metal deposits" (50 gold)
 */
export function getTileLandValue(tile: Tile): number {
  let value: number;

  switch (tile.terrain) {
    case TerrainType.GRASSLAND:  value = 11; break;
    case TerrainType.PLAINS:     value = 8;  break;
    case TerrainType.DESERT:     value = 2;  break;
    case TerrainType.FOREST:     value = 8;  break;
    case TerrainType.HILLS:      value = 9;  break;
    case TerrainType.MOUNTAINS:  value = 13; break;
    case TerrainType.OCEAN:      value = 0;  break;
    case TerrainType.RIVER:      value = 11; break;
    case TerrainType.JUNGLE:     value = 8;  break;
    case TerrainType.SWAMP:      value = 6;  break;
    case TerrainType.ARCTIC:     value = 1;  break;
    case TerrainType.TUNDRA:     value = 3;  break;
    default:                     value = 5;  break;
  }

  // Shield variant adds +1 production equivalent
  if (tile.terrainVariant === 'shield') value += 1;

  // Any special resource adds +4 (oil adds +6 total)
  if (tile.resources && tile.resources.length > 0) {
    value += 4;
    if (tile.resources.includes('oil' as any)) value += 2;
  }

  return value;
}

// ── Utility helpers ──────────────────────────────────────────────────────────

function chebyshevDistance(a: Position, b: Position, mapWidth: number): number {
  const rawDx = Math.abs(a.x - b.x);
  const dx = Math.min(rawDx, mapWidth - rawDx); // horizontal wrapping
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy);
}

function distanceToNearestCity(position: Position, gameState: GameState): number {
  if (gameState.cities.length === 0) return 999;
  const mapWidth = gameState.worldMap[0]?.length ?? 80;
  let min = 999;
  for (const city of gameState.cities) {
    const d = chebyshevDistance(position, city.position, mapWidth);
    if (d < min) min = d;
  }
  return min;
}

/**
 * Starting from a random index, walks through all known TechnologyType values
 * (up to 1000 iterations) looking for the first tech the player doesn't own and
 * can currently research (all prerequisites met).
 */
function findGrantableTech(
  knownTechs: TechnologyType[],
): TechnologyType | null {
  const all = Object.values(TechnologyType) as TechnologyType[];
  const count = all.length;
  const startIdx = Math.floor(Math.random() * count);

  for (let i = 0; i < Math.min(1000, count); i++) {
    const tech = all[(startIdx + i) % count];
    if (knownTechs.includes(tech)) continue;
    if (!canResearch(tech, knownTechs)) continue;
    return tech;
  }
  return null;
}

// ── Core encounter resolver ──────────────────────────────────────────────────

/**
 * Resolves what the player finds in a tribal hut.
 * Does NOT mutate game state – call {@link applyVillageEncounterResult} for that.
 */
export function resolveVillageEncounter(
  unit: Unit,
  tile: Tile,
  gameState: GameState,
): VillageEncounterResult {
  const stats = getUnitStats(unit.type);

  // Air units → nothing happens
  if (stats.category === UnitCategory.AIR) {
    return { type: 'nothing', message: '' };
  }

  const player = gameState.players.find(p => p.id === unit.playerId);
  if (!player) return { type: 'nothing', message: '' };

  // Barbarian units cannot benefit from tribal huts.
  if ((player as any).isBarbarian) return { type: 'nothing', message: '' };

  const distCity = distanceToNearestCity(tile.position, gameState);
  const roll = Math.floor(Math.random() * 4); // 0 … 3

  switch (roll) {
    /* ── Case 0 ─────────────────────────────────────────────────── */
    case 0: {
      if (distCity >= 4) {
        if (getTileLandValue(tile) >= 13) {
          return {
            type: 'advanced_tribe',
            message: t('tribalVillage.advancedTribe'),
            unitType: UnitType.SETTLERS,
          };
        } else {
          return {
            type: 'gold',
            message: t('tribalVillage.goldMetal', { amount: 50 }),
            goldAmount: 50,
          };
        }
      } else {
        const unitType = Math.random() < 0.5 ? UnitType.LEGION : UnitType.CAVALRY;
        return {
          type: 'mercenaries',
          message: t('tribalVillage.mercenaries', { unit: getUnitDisplayName(unitType) }),
          unitType,
        };
      }
    }

    /* ── Case 1 ─────────────────────────────────────────────────── */
    case 1: {
      const year = GameTime.calculateYear(gameState.turn);
      // "Turn 0 (4000 BC)" is our turn 1; "year > 1000 AD" → year < -1000 (AD)
      const isVeryEarlyOrLate = gameState.turn === 1 || year < -1000;

      if (isVeryEarlyOrLate) {
        return {
          type: 'gold',
          message: t('tribalVillage.goldMetal', { amount: 50 }),
          goldAmount: 50,
        };
      }

      const tech = findGrantableTech(player.technologies);
      if (tech) {
        return {
          type: 'technology',
          message: t('tribalVillage.technology', { tech: getTechnology(tech).name }),
          technologyType: tech,
        };
      }
      // Fallback – all researchable techs already known
      return {
        type: 'gold',
        message: t('tribalVillage.goldMetal', { amount: 50 }),
        goldAmount: 50,
      };
    }

    /* ── Case 2 ─────────────────────────────────────────────────── */
    case 2: {
      return {
        type: 'gold',
        message: t('tribalVillage.goldMetal', { amount: 50 }),
        goldAmount: 50,
      };
    }

    /* ── Case 3 ─────────────────────────────────────────────────── */
    case 3: {
      const hasCities = gameState.cities.some(c => c.playerId === unit.playerId);

      if (distCity < 4 || !hasCities) {
        const unitType = Math.random() < 0.5 ? UnitType.LEGION : UnitType.CAVALRY;
        return {
          type: 'mercenaries',
          message: t('tribalVillage.mercenaries', { unit: getUnitDisplayName(unitType) }),
          unitType,
        };
      }
      return {
        type: 'barbarians',
        message: t('tribalVillage.barbarians'),
      };
    }

    default:
      return { type: 'nothing', message: '' };
  }
}

// ── State mutation ───────────────────────────────────────────────────────────

/**
 * Applies the result of a village encounter to the game state.
 * Clears `tile.hasVillage` as part of the mutation.
 */
export function applyVillageEncounterResult(
  result: VillageEncounterResult,
  unit: Unit,
  tile: Tile,
  gameState: GameState,
  emit: (event: string, data?: any) => void,
): void {
  // Always consume the village
  tile.hasVillage = false;

  if (result.type === 'nothing') return;

  const player = gameState.players.find(p => p.id === unit.playerId);
  if (!player) return;

  switch (result.type) {
    case 'gold': {
      player.gold += result.goldAmount ?? 50;
      break;
    }

    case 'advanced_tribe': {
      // Spawn a free Settlers unit at the village location
      const settler = createUnit(
        `unit-village-settler-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        UnitType.SETTLERS,
        { ...tile.position },
        unit.playerId,
      );
      gameState.units.push(settler);
      break;
    }

    case 'mercenaries': {
      if (result.unitType) {
        const newUnit = createUnit(
          `unit-village-merc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          result.unitType,
          { ...tile.position },
          unit.playerId,
        );
        gameState.units.push(newUnit);
      }
      break;
    }

    case 'technology': {
      if (result.technologyType && !player.technologies.includes(result.technologyType)) {
        player.technologies.push(result.technologyType);
        emit('technologyResearched', {
          playerId: player.id,
          technologyType: result.technologyType,
        });
      }
      break;
    }

    case 'barbarians': {
      // Spawn 2–3 militia units for the barbarian faction near the village.
      // Using BARBARIAN_PLAYER_ID ensures they are treated as barbarians by
      // combat, diplomacy, and elimination logic — not as a real civilization.
      const spawnPos = getAdjacentSpawnPositions(tile.position, gameState);
      const count = Math.min(spawnPos.length, 2 + Math.floor(Math.random() * 2));
      for (let i = 0; i < count; i++) {
        const barb = createUnit(
          `unit-barbarian-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${i}`,
          UnitType.MILITIA,
          spawnPos[i],
          BARBARIAN_PLAYER_ID,
        );
        gameState.units.push(barb);
      }
      break;
    }
  }

  emit('villageEncountered', { unit, tile, result });
}

// ── Adjacent tile helper ─────────────────────────────────────────────────────

function getAdjacentSpawnPositions(
  position: Position,
  gameState: GameState,
): Position[] {
  const mapWidth  = gameState.worldMap[0]?.length ?? 80;
  const mapHeight = gameState.worldMap.length ?? 50;
  const result: Position[] = [];

  for (const { dx, dy } of [
    { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
    { dx: -1, dy:  0 },                    { dx: 1, dy:  0 },
    { dx: -1, dy:  1 }, { dx: 0, dy:  1 }, { dx: 1, dy:  1 },
  ]) {
    const nx = ((position.x + dx) % mapWidth + mapWidth) % mapWidth;
    const ny = position.y + dy;
    if (ny < 0 || ny >= mapHeight) continue;

    const tile = gameState.worldMap[ny]?.[nx];
    if (!tile) continue;
    if (tile.terrain === TerrainType.OCEAN || tile.terrain === TerrainType.ARCTIC) continue;

    const occupied =
      gameState.units.some(u => u.position.x === nx && u.position.y === ny) ||
      gameState.cities.some(c => c.position.x === nx && c.position.y === ny);
    if (occupied) continue;

    result.push({ x: nx, y: ny });
  }

  return result;
}

// ── Map-generation helper ────────────────────────────────────────────────────

/** Village density: roughly 1 hut per 100 eligible land tiles. */
const VILLAGE_DENSITY = 1 / 100;

/**
 * Randomly scatters tribal huts across all passable land tiles.
 * Called at the end of every map generator's generation method.
 * Skips ocean, arctic, and mountain tiles since those cannot be easily settled.
 */
export function placeVillagesOnMap(
  map: Tile[][],
  width: number,
  height: number,
): void {
  const impassable: string[] = [
    TerrainType.OCEAN,
    TerrainType.ARCTIC,
    TerrainType.MOUNTAINS,
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = map[y][x];
      if (impassable.includes(tile.terrain)) continue;
      if (Math.random() < VILLAGE_DENSITY) {
        tile.hasVillage = true;
      }
    }
  }
}
