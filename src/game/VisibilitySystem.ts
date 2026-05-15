import { GameState, Player, Unit, City, VisibilityMap, VisibilityState, Position } from '../types/game';
import { getUnitStats } from './UnitDefinitions';

/**
 * Manages fog of war and tile visibility for players
 */
export class VisibilitySystem {
  /**
   * Per-player Set of "x,y" keys that are currently VISIBLE.
   * Kept in sync with visibilityMap.tiles so that updateVisibilityForPlayer
   * can demote VISIBLE→EXPLORED in O(visibleTiles) instead of O(W×H).
   */
  private static readonly currentlyVisibleKeys: Map<string, Set<string>> = new Map();

  /**
   * Return the set of "x,y" tile keys currently visible to the given player.
   * Returns an empty set if the player has no visibility data yet.
   */
  public static getVisibleKeys(playerId: string): ReadonlySet<string> {
    return this.currentlyVisibleKeys.get(playerId) ?? new Set();
  }

  /**
   * Initialize visibility maps for all players
   */
  public static initializeVisibility(gameState: GameState): void {
    // Clear stale Sets from any previous game before reinitialising.
    this.currentlyVisibleKeys.clear();

    const mapWidth = gameState.worldMap[0].length;
    const mapHeight = gameState.worldMap.length;

    // Fresh fog grid every new game. Reusing the previous Map left explored tiles
    // from the last session until overwritten — the viewport still showed that stale
    // shroud until centerOn jumped to the new settler (looked like two spawn sites).
    gameState.visibility = new Map();

    gameState.players.forEach(player => {
      const visibilityMap: VisibilityMap = {
        tiles: Array(mapHeight)
          .fill(null)
          .map(() => Array(mapWidth).fill(VisibilityState.UNSEEN)),
      };
      gameState.visibility!.set(player.id, visibilityMap);
      this.currentlyVisibleKeys.set(player.id, new Set());
    });

    // Reveal starting positions for all players
    this.revealStartingPositions(gameState);
  }

  /**
   * Reveal areas around starting units and cities
   */
  private static revealStartingPositions(gameState: GameState): void {
    gameState.players.forEach(player => {
      // Reveal around starting units
      const playerUnits = gameState.units.filter(unit => unit.playerId === player.id);
      playerUnits.forEach(unit => {
        this.revealAroundPosition(gameState, player.id, unit.position, this.getUnitVisionRange(unit));
      });

      // Reveal around starting cities
      const playerCities = gameState.cities.filter(city => city.playerId === player.id);
      playerCities.forEach(city => {
        this.revealAroundPosition(gameState, player.id, city.position, 2); // Cities have 2-tile vision
      });
      
      // Update visibility for this player to make starting areas VISIBLE (not just EXPLORED)
      this.updateVisibilityForPlayer(gameState, player.id);
    });
  }

  /**
   * Update visibility when a unit moves
   */
  public static updateVisibilityForUnitMove(gameState: GameState, unit: Unit, toPosition: Position): void {
    const visionRange = this.getUnitVisionRange(unit);
    
    // Reveal new areas that this unit can now see
    this.revealAroundPosition(gameState, unit.playerId, toPosition, visionRange);
    
    // Recalculate all visibility for this player to handle overlapping vision correctly
    this.updateVisibilityForPlayer(gameState, unit.playerId);
  }

  /**
   * Update visibility for all units and cities for a player
   */
  public static updateVisibilityForPlayer(gameState: GameState, playerId: string): void {
    if (!gameState.visibility || !gameState.visibility.has(playerId)) {
      return;
    }

    const visibilityMap = gameState.visibility.get(playerId)!;

    // Demote previously-VISIBLE tiles to EXPLORED using the key set
    // – O(visibleTiles) instead of O(W×H = 4 000).
    const visibleKeys = this.getOrCreateVisibleKeys(playerId);
    visibleKeys.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      if (visibilityMap.tiles[y]?.[x] === VisibilityState.VISIBLE) {
        visibilityMap.tiles[y][x] = VisibilityState.EXPLORED;
      }
    });
    visibleKeys.clear();

    // Then update vision from all units and cities
    const playerUnits = gameState.units.filter(unit => unit.playerId === playerId);
    playerUnits.forEach(unit => {
      this.updateVisionFromPosition(gameState, playerId, unit.position, this.getUnitVisionRange(unit), true);
    });

    const playerCities = gameState.cities.filter(city => city.playerId === playerId);
    playerCities.forEach(city => {
      this.updateVisionFromPosition(gameState, playerId, city.position, 2, true);
    });
  }

  /**
   * Reveal tiles around a position (permanent exploration)
   */
  private static revealAroundPosition(gameState: GameState, playerId: string, position: Position, range: number): void {
    if (!gameState.visibility || !gameState.visibility.has(playerId)) {
      return;
    }

    const visibilityMap = gameState.visibility.get(playerId)!;
    const mapHeight = gameState.worldMap.length;
    const mapWidth = gameState.worldMap[0].length;

    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        // Check if this offset is within vision range
        if (this.isWithinVisionRange(dx, dy, range)) {
          const x = (position.x + dx + mapWidth) % mapWidth;
          const y = position.y + dy;

          if (y >= 0 && y < mapHeight) {
            // Reveal the tile if it hasn't been seen before
            if (visibilityMap.tiles[y][x] === VisibilityState.UNSEEN) {
              visibilityMap.tiles[y][x] = VisibilityState.EXPLORED;
            }
          }
        }
      }
    }
  }

  /**
   * Update current vision from a position
   */
  private static updateVisionFromPosition(gameState: GameState, playerId: string, position: Position, range: number, isVisible: boolean): void {
    if (!gameState.visibility || !gameState.visibility.has(playerId)) {
      return;
    }

    const visibilityMap = gameState.visibility.get(playerId)!;
    const mapHeight = gameState.worldMap.length;
    const mapWidth = gameState.worldMap[0].length;

    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        // Check if this offset is within vision range
        if (this.isWithinVisionRange(dx, dy, range)) {
          const x = (position.x + dx + mapWidth) % mapWidth;
          const y = position.y + dy;

          if (y >= 0 && y < mapHeight) {
            const visibleKeys = this.getOrCreateVisibleKeys(playerId);
            if (isVisible) {
              visibilityMap.tiles[y][x] = VisibilityState.VISIBLE;
              visibleKeys.add(`${x},${y}`);
              // Mark any city on this tile as discovered by this player
              const cityHere = gameState.cities.find(c => c.position.x === x && c.position.y === y);
              if (cityHere) {
                if (!cityHere.discoveredByPlayers) cityHere.discoveredByPlayers = [];
                if (!cityHere.discoveredByPlayers.includes(playerId)) {
                  cityHere.discoveredByPlayers.push(playerId);
                }
              }
            } else {
              if (visibilityMap.tiles[y][x] === VisibilityState.VISIBLE) {
                visibilityMap.tiles[y][x] = VisibilityState.EXPLORED;
                visibleKeys.delete(`${x},${y}`);
              }
            }
          }
        }
      }
    }
  }

  /** Lazily create the visible-keys Set for a player. */
  private static getOrCreateVisibleKeys(playerId: string): Set<string> {
    let keys = this.currentlyVisibleKeys.get(playerId);
    if (!keys) {
      keys = new Set();
      this.currentlyVisibleKeys.set(playerId, keys);
    }
    return keys;
  }

  /**
   * Get vision range for a unit
   */
  private static getUnitVisionRange(unit: Unit): number {
    const stats = getUnitStats(unit.type);
    
    // Some units have extended vision range
    if (stats.visibility) {
      return stats.visibility;
    }
    
    // Default vision range is 1 tile
    return 1;
  }

  /**
   * Check if a tile is visible to a player
   */
  public static isTileVisible(gameState: GameState, playerId: string, position: Position): boolean {
    if (!gameState.visibility || !gameState.visibility.has(playerId)) {
      return false;
    }

    const visibilityMap = gameState.visibility.get(playerId)!;
    const { x, y } = position;

    if (y >= 0 && y < visibilityMap.tiles.length && 
        x >= 0 && x < visibilityMap.tiles[0].length) {
      return visibilityMap.tiles[y][x] === VisibilityState.VISIBLE;
    }

    return false;
  }

  /**
   * Check if a tile has been explored by a player
   */
  public static isTileExplored(gameState: GameState, playerId: string, position: Position): boolean {
    if (!gameState.visibility || !gameState.visibility.has(playerId)) {
      return false;
    }

    const visibilityMap = gameState.visibility.get(playerId)!;
    const { x, y } = position;

    if (y >= 0 && y < visibilityMap.tiles.length && 
        x >= 0 && x < visibilityMap.tiles[0].length) {
      return visibilityMap.tiles[y][x] !== VisibilityState.UNSEEN;
    }

    return false;
  }

  /**
   * Get visibility state for a tile
   */
  public static getTileVisibility(gameState: GameState, playerId: string, position: Position): VisibilityState {
    if (!gameState.visibility || !gameState.visibility.has(playerId)) {
      return VisibilityState.UNSEEN;
    }

    const visibilityMap = gameState.visibility.get(playerId)!;
    const { x, y } = position;

    if (y >= 0 && y < visibilityMap.tiles.length && 
        x >= 0 && x < visibilityMap.tiles[0].length) {
      return visibilityMap.tiles[y][x];
    }

    return VisibilityState.UNSEEN;
  }

  /**
   * Check if a position offset is within vision range
   */
  private static isWithinVisionRange(dx: number, dy: number, range: number): boolean {
    // For range 1, include all 8 adjacent tiles (including diagonals)
    // This means all tiles where both dx and dy are at most 1
    if (range === 1) {
      return Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
    }
    
    // For larger ranges, use circular vision (Euclidean distance)
    return dx * dx + dy * dy <= range * range;
  }
}
