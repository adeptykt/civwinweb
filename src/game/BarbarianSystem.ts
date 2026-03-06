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

  private static processExistingBarbarians(
    gameState: GameState,
    game: import('./ai/AITypes').GameInterface,
  ): void {
    // Snapshot the list so spawning during iteration doesn't affect it.
    const barbs = gameState.units
      .filter(u => u.playerId === BARBARIAN_PLAYER_ID && u.movementPoints > 0);

    // Group nearby barbarians so they move toward the same target together.
    const groups = BarbarianSystem.groupByProximity(barbs, gameState);

    for (const group of groups) {
      // Compute the group's shared target once (nearest enemy/city to centroid).
      const sharedTarget = BarbarianSystem.findGroupTarget(group, gameState);
      for (const unit of group) {
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
   * Pick the enemy unit / city nearest to the centroid of the given group.
   * Returns null when there are no reachable targets.
   */
  private static findGroupTarget(group: Unit[], gameState: GameState): Position | null {
    const cx = Math.round(group.reduce((s, u) => s + u.position.x, 0) / group.length);
    const cy = Math.round(group.reduce((s, u) => s + u.position.y, 0) / group.length);
    return BarbarianSystem.findNearestTarget({ x: cx, y: cy }, gameState);
  }

  private static processSingleUnit(
    unit: Unit,
    gameState: GameState,
    game: import('./ai/AITypes').GameInterface,
    sharedTarget: Position | null,
  ): void {
    const mapWidth = gameState.worldMap[0]?.length ?? 80;

    // ── 1. Attack adjacent enemies ──────────────────────────────────────────
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
        game.moveUnit(unit.id, target.position);
        return;
      }
    }

    // ── 2. Move toward shared group target (keeps units moving together) ────
    // Fall back to a unit-local search only for isolated barbarians.
    const nearest = sharedTarget ?? BarbarianSystem.findNearestTarget(unit.position, gameState);
    if (!nearest) return;

    const candidates = BarbarianSystem.buildMoveCandidates(unit.position, nearest, mapWidth, gameState);

    for (const pos of candidates) {
      const tile = gameState.worldMap[pos.y]?.[pos.x];
      if (!tile) continue;
      if (tile.terrain === TerrainType.OCEAN) continue;
      if (!TerrainManager.isPassable(tile.terrain)) continue;

      // Don't stack barbarian units on the same tile.
      const occupied = gameState.units.some(
        u => u.playerId === BARBARIAN_PLAYER_ID && u.position.x === pos.x && u.position.y === pos.y,
      );
      if (occupied) continue;

      game.moveUnit(unit.id, pos);
      break;
    }
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

  /** Return the position of the closest non-barbarian unit or city. */
  private static findNearestTarget(
    from: Position,
    gameState: GameState,
  ): Position | null {
    const mapWidth = gameState.worldMap[0]?.length ?? 80;
    const chebyshev = (a: Position, b: Position): number => {
      const dx = Math.abs(a.x - b.x);
      return Math.max(Math.min(dx, mapWidth - dx), Math.abs(a.y - b.y));
    };

    let nearest: Position | null = null;
    let nearestDist = Infinity;

    for (const u of gameState.units) {
      if (u.playerId === BARBARIAN_PLAYER_ID) continue;
      const d = chebyshev(from, u.position);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = u.position;
      }
    }

    for (const city of gameState.cities) {
      const d = chebyshev(from, city.position);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = city.position;
      }
    }

    return nearest;
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
    const coastPos = BarbarianSystem.findSpawnTile(gameState, true);
    if (!coastPos) return;

    const shipType = BarbarianSystem.chooseNavalVessel(gameState);
    const cargoTypes = BarbarianSystem.chooseLandUnitTypes(gameState);
    const cargoCount = 1 + (Math.random() < 0.35 ? 1 : 0); // 1 or 2 units

    // Spawn the transport ship
    BarbarianSystem.spawnUnit(shipType, coastPos, gameState);

    // Spawn land troops on the same coastal tile (they represent embarked cargo)
    for (let i = 0; i < cargoCount; i++) {
      const unitType = cargoTypes[i % cargoTypes.length];
      BarbarianSystem.spawnUnit(unitType, coastPos, gameState);
    }

    console.log(
      `[Barbarians] Naval group (${shipType}) spawned at (${coastPos.x},${coastPos.y}) turn ${gameState.turn}`,
    );
  }

  // ── Unit type selection ───────────────────────────────────────────────────

  /**
   * Return a weighted pool of land military unit types appropriate for the
   * current world tech level. Barbarians are intentionally weaker than
   * well-developed civs.
   */
  private static chooseLandUnitTypes(gameState: GameState): UnitType[] {
    const knowsChivalry   = BarbarianSystem.worldKnows(gameState, TechnologyType.CHIVALRY);
    const knowsGunpowder  = BarbarianSystem.worldKnows(gameState, TechnologyType.GUNPOWDER);
    const knowsConscription = BarbarianSystem.worldKnows(gameState, TechnologyType.CONSCRIPTION);

    if (knowsConscription) {
      // Late tier: knights and cavalry (barbarians lag behind player armies)
      return BarbarianSystem.weightedPick([
        [UnitType.KNIGHTS,    3],
        [UnitType.CAVALRY,    3],
        [UnitType.CHARIOT,    1],
        [UnitType.LEGION,     1],
      ], 3);
    }

    if (knowsGunpowder) {
      // Mid tier: cavalry and chariots
      return BarbarianSystem.weightedPick([
        [UnitType.CAVALRY,    3],
        [UnitType.KNIGHTS,    2],
        [UnitType.CHARIOT,    2],
        [UnitType.LEGION,     1],
      ], 3);
    }

    if (knowsChivalry) {
      // Medieval tier: knights, cavalry
      return BarbarianSystem.weightedPick([
        [UnitType.CAVALRY,    3],
        [UnitType.CHARIOT,    2],
        [UnitType.LEGION,     2],
        [UnitType.CATAPULT,   1],
      ], 3);
    }

    // Early tier: classic raider units
    return BarbarianSystem.weightedPick([
      [UnitType.LEGION,     3],
      [UnitType.CAVALRY,    2],
      [UnitType.CHARIOT,    2],
      [UnitType.CATAPULT,   1],
    ], 3);
  }

  /**
   * Choose the naval vessel for a barbarian raid based on world tech level.
   *  - MAPMAKING known by 2+ players → Trireme
   *  - NAVIGATION known by 2+ players → Frigate
   *  - INDUSTRIALIZATION known by 2+ players → Transport
   */
  private static chooseNavalVessel(gameState: GameState): UnitType {
    if (BarbarianSystem.worldKnows(gameState, TechnologyType.INDUSTRIALIZATION)) {
      return UnitType.TRANSPORT;
    }
    if (BarbarianSystem.worldKnows(gameState, TechnologyType.NAVIGATION)) {
      return UnitType.FRIGATE;
    }
    // Default: trireme (requires MAPMAKING; if nobody has it yet skip the naval spawn)
    if (BarbarianSystem.worldKnows(gameState, TechnologyType.MAPMAKING)) {
      return UnitType.TRIREME;
    }
    return UnitType.TRIREME; // fallback – caller guards against this being too early
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
