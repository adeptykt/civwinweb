/**
 * BarbarianSystem – spawns and controls the barbarian faction.
 *
 * Barbarians are a special player that:
 *   - Has no cities, no research, no production queue
 *   - Spawns in groups of 2-3 military units + a diplomat on land, or a
 *     transport carrying land units on sea-adjacent tiles
 *   - Unit tier scales with how many real players have discovered key techs
 *   - Always attacks any non-barbarian unit or city in range
 *   - Is permanently at war with every other civilization
 *
 * Design inspired by Civilization 1's barbarian mechanics.
 */

import {
  GameState,
  Player,
  Position,
  Unit,
  UnitType,
  UnitCategory,
  TerrainType,
  GovernmentType,
} from '../types/game';
import { TechnologyType } from './TechnologyDefinitions';
import { CivilizationType } from './CivilizationDefinitions';
import { createUnit } from './Units';
import { getUnitStats } from './UnitDefinitions';
import { TerrainManager } from '../terrain/index';

// ── Constants ────────────────────────────────────────────────────────────────

export const BARBARIAN_PLAYER_ID = 'player-barbarian';

/** Minimum Chebyshev distance from any city when spawning a new barbarian group. */
const MIN_SPAWN_DIST_FROM_CITY = 7;
/** Minimum Chebyshev distance from any non-barbarian unit when spawning. */
const MIN_SPAWN_DIST_FROM_UNIT = 5;
/** Maximum barbarian units on the map at once (1 per N tiles). */
const MAP_TILES_PER_BARBARIAN = 500;
/** Chebyshev radius within which tiles must be ocean-adjacent to qualify for a naval spawn. */
const NAVAL_COASTAL_CHECK_RADIUS = 2;

// ── Player factory ────────────────────────────────────────────────────────────

/** Create the singleton barbarian Player record. */
export function createBarbarianPlayer(): Player {
  return {
    id: BARBARIAN_PLAYER_ID,
    name: 'Barbarians',
    civilizationType: CivilizationType.BARBARIANS,
    color: '#FF2200',
    isHuman: false,
    isBarbarian: true,
    science: 0,
    gold: 0,
    culture: 0,
    technologies: [],
    government: GovernmentType.DESPOTISM,
    taxRate: 0,
    luxuryRate: 0,
    usedCityNames: [],
  };
}

// ── System class ──────────────────────────────────────────────────────────────

export class BarbarianSystem {
  private static unitCounter = 0;

  // ── Turn entry-point ────────────────────────────────────────────────────────

  /**
   * Run one barbarian "turn":
   *   1. Move / attack with every existing barbarian unit.
   *   2. Attempt to spawn new barbarian units in the wilderness.
   *
   * Called from Game.processCurrentPlayerTurn() when the barbarian player
   * is current.
   */
  public static processBarbarianTurn(
    gameState: GameState,
    game: import('./ai/AITypes').GameInterface,
  ): void {
    BarbarianSystem.processExistingBarbarians(gameState, game);
    BarbarianSystem.spawnBarbarians(gameState);
  }

  // ── Unit movement / combat ──────────────────────────────────────────────────

  /** Radius (Chebyshev tiles) within which barbarian units are considered the same group. */
  private static readonly GROUP_RADIUS = 5;

  /**
   * Chebyshev sight radius.  Within this range a barbarian unit can "see"
   * an enemy and will pursue it.  Beyond it the unit wanders aimlessly.
   */
  private static readonly SIGHT_RADIUS = 4;

  private static processExistingBarbarians(
    gameState: GameState,
    game: import('./ai/AITypes').GameInterface,
  ): void {
    // Snapshot the list so spawning during iteration doesn't affect it.
    const barbs = gameState.units
      .filter(u => u.playerId === BARBARIAN_PLAYER_ID && u.movementPoints > 0);

    // Group nearby barbarians so they share awareness of nearby enemies.
    const groups = BarbarianSystem.groupByProximity(barbs, gameState);

    for (const group of groups) {
      for (const unit of group) {
        // Skip units that were killed by a defender earlier this same turn.
        if (!gameState.units.some(u => u.id === unit.id)) continue;

        // Recompute shared target per-unit so that a kill earlier in the group
        // (removing the target from gameState.units) doesn't leave later units
        // chasing a stale position.
        const sharedTarget = BarbarianSystem.findGroupTarget(group, gameState);
        BarbarianSystem.processSingleUnit(unit, gameState, game, sharedTarget);
      }
    }
  }

  /**
   * Partition units into proximity-based clusters.  Any two units within
   * GROUP_RADIUS Chebyshev tiles of each other (or connected through a chain
   * of such pairs) end up in the same group.
   */
  private static groupByProximity(units: Unit[], gameState: GameState): Unit[][] {
    const mapWidth = gameState.worldMap[0]?.length ?? 80;
    const chebyshev = (a: Position, b: Position): number => {
      const dx = Math.abs(a.x - b.x);
      return Math.max(Math.min(dx, mapWidth - dx), Math.abs(a.y - b.y));
    };

    const groups: Unit[][] = [];
    const assigned = new Set<string>();

    for (const unit of units) {
      if (assigned.has(unit.id)) continue;

      const group: Unit[] = [unit];
      assigned.add(unit.id);

      // Flood-fill: keep expanding until no more neighbours are found.
      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const candidate of units) {
          if (assigned.has(candidate.id)) continue;
          const isNear = group.some(
            g => chebyshev(g.position, candidate.position) <= BarbarianSystem.GROUP_RADIUS,
          );
          if (isNear) {
            group.push(candidate);
            assigned.add(candidate.id);
            expanded = true;
          }
        }
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Pick the enemy unit / city that is closest to *any* unit in the group
   * and within SIGHT_RADIUS of that unit.  Returns null when no group member
   * can see an enemy, causing the group to wander instead.
   */
  private static findGroupTarget(group: Unit[], gameState: GameState): Position | null {
    const mapWidth = gameState.worldMap[0]?.length ?? 80;
    const chebyshev = (a: Position, b: Position): number => {
      const dx = Math.abs(a.x - b.x);
      return Math.max(Math.min(dx, mapWidth - dx), Math.abs(a.y - b.y));
    };

    let bestTarget: Position | null = null;
    let bestDist = Infinity;

    for (const scout of group) {
      // Visible enemy units
      for (const u of gameState.units) {
        if (u.playerId === BARBARIAN_PLAYER_ID) continue;
        const d = chebyshev(scout.position, u.position);
        if (d <= BarbarianSystem.SIGHT_RADIUS && d < bestDist) {
          bestDist = d;
          bestTarget = u.position;
        }
      }
      // Visible cities
      for (const city of gameState.cities) {
        const d = chebyshev(scout.position, city.position);
        if (d <= BarbarianSystem.SIGHT_RADIUS && d < bestDist) {
          bestDist = d;
          bestTarget = city.position;
        }
      }
    }

    return bestTarget;
  }

  private static processSingleUnit(
    unit: Unit,
    gameState: GameState,
    game: import('./ai/AITypes').GameInterface,
    sharedTarget: Position | null,
  ): void {
    const mapWidth = gameState.worldMap[0]?.length ?? 80;

    // Loop until movement is exhausted.  We break early when:
    //   • the unit dies during combat
    //   • no valid move can be found (blocked / surrounded)
    while (unit.movementPoints > 0) {
      // Guard: unit may have been killed by a defender in a previous iteration.
      if (!gameState.units.some(u => u.id === unit.id)) return;

      // ── 1. Attack adjacent enemies ────────────────────────────────────────
      // Non-combat units (e.g. Diplomat) skip the attack step entirely.
      const unitStats = getUnitStats(unit.type);
      if (unitStats.canAttack) {
        const adjacentEnemies = gameState.units.filter(u => {
          if (u.playerId === BARBARIAN_PLAYER_ID) return false;
          const dx = Math.abs(u.position.x - unit.position.x);
          const wrappedDx = Math.min(dx, mapWidth - dx);
          const dy = Math.abs(u.position.y - unit.position.y);
          return wrappedDx <= 1 && dy <= 1 && !(wrappedDx === 0 && dy === 0);
        });

        if (adjacentEnemies.length > 0) {
          // Pick the weakest defender to maximize attack success odds.
          const target = adjacentEnemies.reduce((weakest, candidate) =>
            getUnitStats(candidate.type).defense < getUnitStats(weakest.type).defense
              ? candidate
              : weakest,
          );
          // Move onto the enemy tile – UnitMovementSystem detects enemies and routes
          // the call to initiateAutomaticCombat automatically.
          // Combat always ends the unit's turn regardless of remaining movement.
          game.moveUnit(unit.id, target.position);
          return;
        }
      }

      // ── 2. Pursue if a target is visible, otherwise wander ────────────────
      let moved = false;

      if (sharedTarget !== null) {
        // An enemy is within the group's collective sight — pursue it.
        const candidates = BarbarianSystem.buildMoveCandidates(unit.position, sharedTarget, mapWidth, gameState);
        for (const pos of candidates) {
          if (BarbarianSystem.isPassableForUnit(unit, pos, gameState)) {
            moved = game.moveUnit(unit.id, pos);
            break;
          }
        }
      } else {
        // No enemy in sight — wander randomly to explore / spread out.
        moved = BarbarianSystem.wanderUnit(unit, mapWidth, gameState, game);
      }

      // If no move was possible this iteration (e.g. surrounded), stop trying.
      if (!moved) break;
    }
  }

  /**
   * Move the unit in a random passable direction.  Avoids stacking on other
   * barbarians and tries all 8 neighbours in shuffled order.
   * Returns true if a move was successfully made, false if the unit is blocked.
   */
  private static wanderUnit(
    unit: Unit,
    mapWidth: number,
    gameState: GameState,
    game: import('./ai/AITypes').GameInterface,
  ): boolean {
    const mapHeight = gameState.worldMap.length ?? 50;
    const wrap = (x: number, y: number): Position => ({
      x: ((x % mapWidth) + mapWidth) % mapWidth,
      y: Math.max(0, Math.min(y, mapHeight - 1)),
    });

    // All 8 neighbouring tiles, shuffled.
    const deltas = [
      [-1, -1], [0, -1], [1, -1],
      [-1,  0],          [1,  0],
      [-1,  1], [0,  1], [1,  1],
    ] as [number, number][];

    // Fisher-Yates shuffle
    for (let i = deltas.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deltas[i], deltas[j]] = [deltas[j], deltas[i]];
    }

    for (const [dx, dy] of deltas) {
      const pos = wrap(unit.position.x + dx, unit.position.y + dy);
      if (!BarbarianSystem.isPassableForUnit(unit, pos, gameState)) continue;
      return game.moveUnit(unit.id, pos);
    }
    return false;
  }

  /** True if a position is a passable non-ocean tile with no barbarian already on it. */
  private static isPassableLand(pos: Position, gameState: GameState): boolean {
    const tile = gameState.worldMap[pos.y]?.[pos.x];
    if (!tile) return false;
    if (tile.terrain === TerrainType.OCEAN) return false;
    if (!TerrainManager.isPassable(tile.terrain)) return false;
    // Avoid stacking barbarian units on the same tile.
    return !gameState.units.some(
      u => u.playerId === BARBARIAN_PLAYER_ID && u.position.x === pos.x && u.position.y === pos.y,
    );
  }

  /** True if a position is an ocean tile with no barbarian naval unit already on it. */
  private static isPassableOcean(pos: Position, gameState: GameState): boolean {
    const tile = gameState.worldMap[pos.y]?.[pos.x];
    if (!tile) return false;
    if (tile.terrain !== TerrainType.OCEAN) return false;
    return !gameState.units.some(
      u => u.playerId === BARBARIAN_PLAYER_ID &&
        getUnitStats(u.type).category === UnitCategory.NAVAL &&
        u.position.x === pos.x && u.position.y === pos.y,
    );
  }

  /** Passability check appropriate for a unit (land units require non-ocean; naval require ocean). */
  private static isPassableForUnit(unit: Unit, pos: Position, gameState: GameState): boolean {
    return getUnitStats(unit.type).category === UnitCategory.NAVAL
      ? BarbarianSystem.isPassableOcean(pos, gameState)
      : BarbarianSystem.isPassableLand(pos, gameState);
  }

  /** Return candidate positions ordered by priority (diagonal first, then axis-aligned). */
  private static buildMoveCandidates(
    from: Position,
    target: Position,
    mapWidth: number,
    gameState: GameState,
  ): Position[] {
    const mapHeight = gameState.worldMap.length ?? 50;

    // Wrap-aware delta
    const rawDx = target.x - from.x;
    const wdx =
      rawDx > mapWidth / 2 ? rawDx - mapWidth : rawDx < -mapWidth / 2 ? rawDx + mapWidth : rawDx;

    const sx = wdx === 0 ? 0 : wdx > 0 ? 1 : -1;
    const sy = target.y === from.y ? 0 : target.y > from.y ? 1 : -1;

    const wrap = (x: number, y: number): Position => ({
      x: ((x % mapWidth) + mapWidth) % mapWidth,
      y: Math.max(0, Math.min(y, mapHeight - 1)),
    });

    const candidates: Position[] = [];

    if (sx !== 0 && sy !== 0) {
      candidates.push(wrap(from.x + sx, from.y + sy)); // diagonal
      candidates.push(wrap(from.x + sx, from.y));       // horizontal
      candidates.push(wrap(from.x, from.y + sy));       // vertical
    } else if (sx !== 0) {
      candidates.push(wrap(from.x + sx, from.y));
      candidates.push(wrap(from.x + sx, from.y + 1));
      candidates.push(wrap(from.x + sx, from.y - 1));
    } else {
      candidates.push(wrap(from.x, from.y + sy));
      candidates.push(wrap(from.x + 1, from.y + sy));
      candidates.push(wrap(from.x - 1, from.y + sy));
    }

    return candidates;
  }

  // ── Tech-tier helpers ─────────────────────────────────────────────────────

  /**
   * Count how many real (non-barbarian) players have discovered a given technology.
   */
  private static playerCountWithTech(gameState: GameState, tech: TechnologyType): number {
    return gameState.players.filter(
      p => !p.isBarbarian && !p.defeated && p.technologies.includes(tech),
    ).length;
  }

  /**
   * True when at least `threshold` real players know the tech – meaning
   * barbarians "learn" of it and can field those units.
   */
  private static worldKnows(gameState: GameState, tech: TechnologyType, threshold = 2): boolean {
    return BarbarianSystem.playerCountWithTech(gameState, tech) >= threshold;
  }

  // ── Spawning ──────────────────────────────────────────────────────────────

  /**
   * Attempt to spawn one barbarian group this turn.
   * Groups consist of 2-3 military units + 1 diplomat (land) or a transport
   * ship carrying land troops (naval).
   */
  private static spawnBarbarians(gameState: GameState): void {
    if (gameState.turn < 10) return;

    const mapWidth = gameState.worldMap[0]?.length ?? 80;
    const mapHeight = gameState.worldMap.length ?? 50;
    const maxBarbs = Math.max(2, Math.floor((mapWidth * mapHeight) / MAP_TILES_PER_BARBARIAN));

    const currentCount = gameState.units.filter(u => u.playerId === BARBARIAN_PLAYER_ID).length;
    if (currentCount >= maxBarbs) return;

    // Spawn chance ramps from ~3 % to 30 % over the first 250 turns.
    const spawnChance = Math.min(0.30, 0.03 + gameState.turn / 250);
    if (Math.random() > spawnChance) return;

    // 25 % chance of a naval raid (when the map has enough ocean tiles).
    const tryNaval = Math.random() < 0.25;
    if (tryNaval) {
      BarbarianSystem.spawnNavalGroup(gameState);
    } else {
      BarbarianSystem.spawnLandGroup(gameState);
    }
  }

  // ── Land group ────────────────────────────────────────────────────────────

  private static spawnLandGroup(gameState: GameState): void {
    const spawnPos = BarbarianSystem.findSpawnTile(gameState, false);
    if (!spawnPos) return;

    const militaryTypes = BarbarianSystem.chooseLandUnitTypes(gameState);
    const groupSize = 1 + (Math.random() < 0.35 ? 1 : 0); // usually 1, occasionally 2

    const spawnedTypes: UnitType[] = [];

    // Spawn military units (spread on tiles adjacent to the anchor point when possible)
    const anchorTiles = BarbarianSystem.clusterTiles(spawnPos, groupSize, gameState, false);
    for (let i = 0; i < groupSize; i++) {
      const pos = anchorTiles[i] ?? spawnPos;
      const unitType = militaryTypes[i % militaryTypes.length];
      BarbarianSystem.spawnUnit(unitType, pos, gameState);
      spawnedTypes.push(unitType);
    }

    // Always add a Diplomat to the group (Civ 1 mechanic: barbarians "negotiate" with cities)
    const dipPos = anchorTiles[groupSize] ?? spawnPos;
    BarbarianSystem.spawnUnit(UnitType.DIPLOMAT, dipPos, gameState);

    console.log(
      `[Barbarians] Land group spawned at (${spawnPos.x},${spawnPos.y}) turn ${gameState.turn}:`,
      [...spawnedTypes, UnitType.DIPLOMAT].join(', '),
    );
  }

  // ── Naval group ───────────────────────────────────────────────────────────

  private static spawnNavalGroup(gameState: GameState): void {
    const shipPos = BarbarianSystem.findNavalSpawnTile(gameState);
    if (!shipPos) return;

    const shipType = BarbarianSystem.chooseNavalVessel(gameState);
    if (!shipType) return; // no naval tech researched by 2+ players yet

    const cargoTypes = BarbarianSystem.chooseLandUnitTypes(gameState);
    const cargoCount = 1 + (Math.random() < 0.35 ? 1 : 0); // 1 or 2 units

    // Spawn the ship on the ocean tile so it can actually move.
    BarbarianSystem.spawnUnit(shipType, shipPos, gameState);

    // Find adjacent passable land tiles to spawn the raiding troops.
    const mapWidth  = gameState.worldMap[0]?.length ?? 80;
    const mapHeight = gameState.worldMap.length ?? 50;
    const landTiles: Position[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = ((shipPos.x + dx) % mapWidth + mapWidth) % mapWidth;
        const ny = Math.max(0, Math.min(shipPos.y + dy, mapHeight - 1));
        const candidate = { x: nx, y: ny };
        if (BarbarianSystem.isPassableLand(candidate, gameState)) {
          landTiles.push(candidate);
        }
      }
    }

    // Spawn troops on adjacent land tiles; skip if the spawn site has no coastline.
    for (let i = 0; i < cargoCount; i++) {
      const pos = landTiles[i];
      if (!pos) break;
      const unitType = cargoTypes[i % cargoTypes.length];
      BarbarianSystem.spawnUnit(unitType, pos, gameState);
    }

    console.log(
      `[Barbarians] Naval group (${shipType}) spawned at (${shipPos.x},${shipPos.y}) turn ${gameState.turn}`,
    );
  }

  // ── Unit type selection ───────────────────────────────────────────────────

  /**
   * Master pool of land military units barbarians can spawn, each gated behind
   * a required technology.  A unit is only eligible when 2+ real players have
   * already researched its prerequisite tech (or it has no prerequisite).
   * Weights reflect desirability as a raiding unit.
   */
  private static readonly LAND_UNIT_POOL: Array<{
    type: UnitType;
    requiredTech: TechnologyType | null;
    weight: number;
  }> = [
    { type: UnitType.MILITIA,   requiredTech: null,                            weight: 2 },
    { type: UnitType.PHALANX,   requiredTech: TechnologyType.BRONZE_WORKING,   weight: 2 },
    { type: UnitType.LEGION,    requiredTech: TechnologyType.IRON_WORKING,     weight: 3 },
    { type: UnitType.CAVALRY,   requiredTech: TechnologyType.HORSEBACK_RIDING, weight: 3 },
    { type: UnitType.CHARIOT,   requiredTech: TechnologyType.THE_WHEEL,        weight: 3 },
    { type: UnitType.CATAPULT,  requiredTech: TechnologyType.MATHEMATICS,      weight: 2 },
    { type: UnitType.KNIGHTS,   requiredTech: TechnologyType.CHIVALRY,         weight: 3 },
    { type: UnitType.CANNON,    requiredTech: TechnologyType.METALLURGY,       weight: 2 },
    { type: UnitType.RIFLEMEN,  requiredTech: TechnologyType.CONSCRIPTION,     weight: 2 },
  ];

  /**
   * Return a weighted pool of land military unit types whose prerequisite
   * technology is already known by 2+ real players.  Falls back to Militia
   * if nothing else qualifies yet.
   */
  private static chooseLandUnitTypes(gameState: GameState): UnitType[] {
    const eligible = BarbarianSystem.LAND_UNIT_POOL.filter(entry =>
      entry.requiredTech === null ||
      BarbarianSystem.worldKnows(gameState, entry.requiredTech),
    );

    // Should always have at least Militia, but guard just in case.
    const pool = eligible.length > 0 ? eligible : [{ type: UnitType.MILITIA, weight: 1 }];

    return BarbarianSystem.weightedPick(
      pool.map(e => [e.type, e.weight] as [UnitType, number]),
      3,
    );
  }

  /**
   * Choose the naval vessel for a barbarian raid based on world tech level.
   * Returns null when no naval tech is known by 2+ players — the spawn is
   * skipped entirely in that case.
   *  - MAPMAKING known by 2+ players → Trireme
   *  - NAVIGATION known by 2+ players → Frigate
   *  - INDUSTRIALIZATION known by 2+ players → Transport
   */
  private static chooseNavalVessel(gameState: GameState): UnitType | null {
    if (BarbarianSystem.worldKnows(gameState, TechnologyType.INDUSTRIALIZATION)) {
      return UnitType.TRANSPORT;
    }
    if (BarbarianSystem.worldKnows(gameState, TechnologyType.NAVIGATION)) {
      return UnitType.FRIGATE;
    }
    if (BarbarianSystem.worldKnows(gameState, TechnologyType.MAPMAKING)) {
      return UnitType.TRIREME;
    }
    return null; // no naval tech known yet — skip naval spawn
  }

  /**
   * Draw `count` unit types from a weighted pool (with replacement).
   * `pool` is an array of [UnitType, weight] tuples.
   */
  private static weightedPick(pool: [UnitType, number][], count: number): UnitType[] {
    const total = pool.reduce((s, [, w]) => s + w, 0);
    const results: UnitType[] = [];
    for (let i = 0; i < count; i++) {
      let r = Math.random() * total;
      for (const [type, weight] of pool) {
        r -= weight;
        if (r <= 0) { results.push(type); break; }
      }
      // Safety – shouldn't happen but push first entry if we somehow fell through
      if (results.length <= i) results.push(pool[0][0]);
    }
    return results;
  }

  // ── Tile helpers ──────────────────────────────────────────────────────────

  /**
   * Return `count` passable, unoccupied land tiles clustered around `anchor`.
   * The anchor itself is index 0; extra tiles are adjacent land tiles.
   */
  private static clusterTiles(
    anchor: Position,
    count: number,
    gameState: GameState,
    _coastal: boolean,
  ): Position[] {
    const mapWidth  = gameState.worldMap[0]?.length ?? 80;
    const mapHeight = gameState.worldMap.length ?? 50;
    const result: Position[] = [anchor];

    const offsets = [
      [-1,-1],[0,-1],[1,-1],
      [-1, 0],       [1, 0],
      [-1, 1],[0, 1],[1, 1],
    ];

    for (const [dx, dy] of offsets) {
      if (result.length >= count) break;
      const nx = ((anchor.x + dx) % mapWidth + mapWidth) % mapWidth;
      const ny = Math.max(0, Math.min(anchor.y + dy, mapHeight - 1));
      const tile = gameState.worldMap[ny]?.[nx];
      if (!tile) continue;
      if (tile.terrain === TerrainType.OCEAN) continue;
      if (!TerrainManager.isPassable(tile.terrain)) continue;
      const occupied = gameState.units.some(u => u.position.x === nx && u.position.y === ny);
      if (occupied) continue;
      result.push({ x: nx, y: ny });
    }

    // Pad with anchor if we didn't find enough distinct tiles
    while (result.length < count) result.push(anchor);
    return result;
  }

  /**
   * Find a spawn tile for a barbarian naval vessel: must be an ocean tile
   * adjacent to at least one passable land tile (so raids are meaningful),
   * and far from existing cities and non-barbarian units.
   */
  private static findNavalSpawnTile(gameState: GameState): Position | null {
    const mapWidth  = gameState.worldMap[0]?.length ?? 80;
    const mapHeight = gameState.worldMap.length ?? 50;

    const chebyshev = (ax: number, ay: number, bx: number, by: number): number => {
      const dx = Math.abs(ax - bx);
      return Math.max(Math.min(dx, mapWidth - dx), Math.abs(ay - by));
    };

    const hasAdjacentLand = (x: number, y: number): boolean => {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = ((x + dx) % mapWidth + mapWidth) % mapWidth;
          const ny = Math.max(0, Math.min(y + dy, mapHeight - 1));
          const t = gameState.worldMap[ny]?.[nx];
          if (t && t.terrain !== TerrainType.OCEAN && TerrainManager.isPassable(t.terrain)) return true;
        }
      }
      return false;
    };

    const candidates: Position[] = [];

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const tile = gameState.worldMap[y][x];
        if (tile.terrain !== TerrainType.OCEAN) continue;
        if (!hasAdjacentLand(x, y)) continue;

        const farFromCities = gameState.cities.every(
          c => chebyshev(x, y, c.position.x, c.position.y) >= MIN_SPAWN_DIST_FROM_CITY,
        );
        if (!farFromCities) continue;

        const farFromUnits = gameState.units
          .filter(u => u.playerId !== BARBARIAN_PLAYER_ID)
          .every(u => chebyshev(x, y, u.position.x, u.position.y) >= MIN_SPAWN_DIST_FROM_UNIT);
        if (!farFromUnits) continue;

        const occupied = gameState.units.some(u => u.position.x === x && u.position.y === y);
        if (occupied) continue;

        candidates.push({ x, y });
      }
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private static findSpawnTile(gameState: GameState, coastal: boolean): Position | null {
    const mapWidth  = gameState.worldMap[0]?.length ?? 80;
    const mapHeight = gameState.worldMap.length ?? 50;

    const chebyshev = (ax: number, ay: number, bx: number, by: number): number => {
      const dx = Math.abs(ax - bx);
      return Math.max(Math.min(dx, mapWidth - dx), Math.abs(ay - by));
    };

    const isCoastalTile = (x: number, y: number): boolean => {
      for (let dy = -NAVAL_COASTAL_CHECK_RADIUS; dy <= NAVAL_COASTAL_CHECK_RADIUS; dy++) {
        for (let dx = -NAVAL_COASTAL_CHECK_RADIUS; dx <= NAVAL_COASTAL_CHECK_RADIUS; dx++) {
          const nx = ((x + dx) % mapWidth + mapWidth) % mapWidth;
          const ny = Math.max(0, Math.min(y + dy, mapHeight - 1));
          if (gameState.worldMap[ny]?.[nx]?.terrain === TerrainType.OCEAN) return true;
        }
      }
      return false;
    };

    const candidates: Position[] = [];

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const tile = gameState.worldMap[y][x];
        if (tile.terrain === TerrainType.OCEAN) continue;
        if (!TerrainManager.isPassable(tile.terrain)) continue;

        if (coastal && !isCoastalTile(x, y)) continue;

        const farFromCities = gameState.cities.every(
          c => chebyshev(x, y, c.position.x, c.position.y) >= MIN_SPAWN_DIST_FROM_CITY,
        );
        if (!farFromCities) continue;

        const farFromUnits = gameState.units
          .filter(u => u.playerId !== BARBARIAN_PLAYER_ID)
          .every(u => chebyshev(x, y, u.position.x, u.position.y) >= MIN_SPAWN_DIST_FROM_UNIT);
        if (!farFromUnits) continue;

        const occupied = gameState.units.some(u => u.position.x === x && u.position.y === y);
        if (occupied) continue;

        candidates.push({ x, y });
      }
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private static spawnUnit(type: UnitType, pos: Position, gameState: GameState): Unit {
    BarbarianSystem.unitCounter++;
    const unit = createUnit(
      `barbarian-${BarbarianSystem.unitCounter}`,
      type,
      pos,
      BARBARIAN_PLAYER_ID,
    );
    gameState.units.push(unit);
    return unit;
  }
}
