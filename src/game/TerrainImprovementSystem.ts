import { GameState, Unit, UnitType, TerrainType, ImprovementType, TechnologyType } from '../types/game';
import { getUnitStats } from './UnitDefinitions';
import { TerrainManager } from '../terrain/index';
import { SettingsManager } from '../utils/SettingsManager';

/**
 * Manages all terrain improvement operations: building roads, railroads,
 * irrigation, mines, and fortresses. Extracted from Game.ts.
 */
export class TerrainImprovementSystem {
  constructor(
    private gameState: GameState,
    private emit: (event: string, data?: any) => void,
    private removeUnitFromQueue: (unitId: string) => void
  ) {}

  // ── Road / Railroad ───────────────────────────────────────────────────────

  public buildRoad(unitId: string): boolean {
    const unit = this.gameState.units.find((u: Unit) => u.id === unitId);
    if (!unit || unit.type !== UnitType.SETTLERS) {
      console.log('buildRoad: Only Settlers can build roads');
      return false;
    }

    if (unit.playerId !== this.gameState.currentPlayer) {
      console.log('buildRoad: Unit does not belong to current player');
      return false;
    }

    const tile = this.gameState.worldMap[unit.position.y]?.[unit.position.x];
    if (!tile || tile.terrain === TerrainType.OCEAN) {
      console.log('buildRoad: Invalid tile position or oceanic terrain');
      return false;
    }

    const player = this.gameState.players.find(p => p.id === unit.playerId);
    const anyTileImprovement = SettingsManager.getInstance().getSetting('anyTileImprovement');

    // Check if roads can be built over rivers - requires Bridge Building technology
    if (tile.terrain === TerrainType.RIVER) {
      if (!anyTileImprovement && !player?.technologies.includes(TechnologyType.BRIDGE_BUILDING)) {
        console.log('buildRoad: Bridge Building technology required to build roads over rivers');
        return false;
      }
    }

    // Check if road/railroad already exists
    const hasRoad = tile.improvements?.some(imp => imp.type === ImprovementType.ROAD);
    const hasRailroad = tile.improvements?.some(imp => imp.type === ImprovementType.RAILROAD);

    if (hasRailroad) {
      console.log('buildRoad: Railroad already exists on this tile');
      return false;
    }

    if (hasRoad) {
      if (!anyTileImprovement && !player?.technologies.includes(TechnologyType.RAILROAD)) {
        console.log('buildRoad: Railroad technology required to upgrade road');
        return false;
      }
    }

    // Determine how many turns are required for this terrain
    const requiredTurns = this.getRoadBuildingTurns(tile.terrain);

    if (unit.buildingRoad) {
      console.log('buildRoad: Unit is already building a road');
      return false;
    }

    // Initialize road building state
    unit.buildingRoad = true;
    unit.roadBuildingTurns = 0;
    unit.movementPoints = 0; // End turn when building

    // Cancel any active goto order so the settler doesn't move next turn
    if (unit.gotoDestination) {
      delete unit.gotoDestination;
      this.emit('gotoCancelled', { unit });
    }

    // Remove unit from queue since turn ends
    this.removeUnitFromQueue(unitId);

    console.log(`buildRoad: Started building road at (${unit.position.x}, ${unit.position.y}) - ${requiredTurns} turns`);
    this.emit('roadBuildingStarted', {
      unit,
      position: unit.position,
      turnsRemaining: requiredTurns
    });

    return true;
  }

  public cancelRoadBuilding(unitId: string): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;

    if (unit.buildingRoad) {
      unit.buildingRoad = false;
      unit.roadBuildingTurns = 0;
      console.log('cancelRoadBuilding: Road building cancelled');
      this.emit('roadBuildingCancelled', unit);
    }

    return true;
  }

  // ── Irrigation ────────────────────────────────────────────────────────────

  public buildIrrigation(unitId: string): boolean {
    const unit = this.gameState.units.find((u: Unit) => u.id === unitId);
    if (!unit || unit.type !== UnitType.SETTLERS) {
      console.log('buildIrrigation: Only Settlers can build irrigation');
      return false;
    }

    if (unit.playerId !== this.gameState.currentPlayer) {
      console.log('buildIrrigation: Unit does not belong to current player');
      return false;
    }

    const tile = this.gameState.worldMap[unit.position.y]?.[unit.position.x];
    if (!tile) {
      console.log('buildIrrigation: Invalid tile position');
      return false;
    }

    // Check if terrain can be irrigated
    const irrigatableTerrains = [
      TerrainType.DESERT,
      TerrainType.GRASSLAND,
      TerrainType.HILLS,
      TerrainType.PLAINS,
      TerrainType.RIVER
    ];

    const anyTileImprovement = SettingsManager.getInstance().getSetting('anyTileImprovement');

    if (!anyTileImprovement && !irrigatableTerrains.includes(tile.terrain)) {
      console.log('buildIrrigation: This terrain cannot be irrigated');
      return false;
    }

    // Check if irrigation already exists
    const hasIrrigation = tile.improvements?.some(imp => imp.type === ImprovementType.IRRIGATION);
    if (hasIrrigation) {
      console.log('buildIrrigation: Irrigation already exists on this tile');
      return false;
    }

    // Mine and irrigation are mutually exclusive — remove any mine first
    if (tile.improvements?.some(imp => imp.type === ImprovementType.MINE)) {
      tile.improvements = tile.improvements!.filter(imp => imp.type !== ImprovementType.MINE);
      console.log('buildIrrigation: Removed existing mine to place irrigation');
    }

    // Check water access requirement
    if (!anyTileImprovement && !this.hasWaterAccess(unit.position.x, unit.position.y)) {
      console.log('buildIrrigation: No water access - must be adjacent to river, ocean, or irrigated tile');
      return false;
    }

    // Add irrigation improvement
    if (!tile.improvements) {
      tile.improvements = [];
    }

    tile.improvements.push({
      type: ImprovementType.IRRIGATION,
      completedTurn: this.gameState.turn
    });

    console.log(`buildIrrigation: Irrigation built at (${unit.position.x}, ${unit.position.y})`);
    this.emit('terrainImproved', {
      position: unit.position,
      improvement: 'irrigation',
      playerId: unit.playerId
    });

    return true;
  }

  // ── Mine ──────────────────────────────────────────────────────────────────

  public buildMine(unitId: string): boolean {
    const unit = this.gameState.units.find((u: Unit) => u.id === unitId);
    if (!unit || unit.type !== UnitType.SETTLERS) {
      console.log('buildMine: Only Settlers can build mines');
      return false;
    }

    if (unit.playerId !== this.gameState.currentPlayer) {
      console.log('buildMine: Unit does not belong to current player');
      return false;
    }

    const tile = this.gameState.worldMap[unit.position.y]?.[unit.position.x];
    if (!tile) {
      console.log('buildMine: Invalid tile position');
      return false;
    }

    // Check if terrain can be mined (all land tiles except ocean can be mined)
    const unmineableTerrains = [TerrainType.OCEAN];
    const anyTileImprovementForMine = SettingsManager.getInstance().getSetting('anyTileImprovement');
    if (!anyTileImprovementForMine && unmineableTerrains.includes(tile.terrain)) {
      console.log('buildMine: This terrain cannot be mined');
      return false;
    }

    // Check if mine already exists
    const hasMine = tile.improvements?.some(imp => imp.type === ImprovementType.MINE);
    if (hasMine) {
      console.log('buildMine: Mine already exists on this tile');
      return false;
    }

    // Check if unit is already building a mine
    if (unit.buildingMine) {
      console.log('buildMine: Unit is already building a mine');
      return false;
    }

    // Start mine building process
    unit.buildingMine = true;
    unit.mineBuildingTurns = 0;
    unit.movementPoints = 0; // End turn when starting mine building

    // Cancel any active goto order so the settler doesn't move next turn
    // (processGotoUnits would call moveUnit which resets buildingMine)
    if (unit.gotoDestination) {
      delete unit.gotoDestination;
      this.emit('gotoCancelled', { unit });
    }

    // Remove unit from queue since turn ends
    this.removeUnitFromQueue(unitId);

    const requiredTurns = this.getMineBuildingTurnsForTile(tile);
    console.log(`buildMine: Started building mine at (${unit.position.x}, ${unit.position.y}) - ${requiredTurns} turns`);
    this.emit('mineBuildingStarted', {
      unit,
      position: unit.position,
      turnsRemaining: requiredTurns
    });

    return true;
  }

  public cancelMineBuilding(unitId: string): boolean {
    const unit = this.gameState.units.find((u: Unit) => u.id === unitId);
    if (!unit) {
      return false;
    }

    if (unit.buildingMine) {
      unit.buildingMine = false;
      unit.mineBuildingTurns = 0;
      console.log(`cancelMineBuilding: Cancelled mine building at (${unit.position.x}, ${unit.position.y})`);
      this.emit('mineBuildingCancelled', unit);
      return true;
    }

    return false;
  }

  // ── Fortress ──────────────────────────────────────────────────────────────

  public buildFortress(unitId: string): boolean {
    const unit = this.gameState.units.find((u: Unit) => u.id === unitId);
    if (!unit || unit.type !== UnitType.SETTLERS) {
      console.log('buildFortress: Only Settlers can build fortresses');
      return false;
    }

    if (unit.playerId !== this.gameState.currentPlayer) {
      console.log('buildFortress: Unit does not belong to current player');
      return false;
    }

    // Check if player has Construction technology
    const player = this.gameState.players.find(p => p.id === unit.playerId);
    if (!player?.technologies.includes(TechnologyType.CONSTRUCTION)) {
      console.log('buildFortress: Construction technology required to build fortress');
      return false;
    }

    const tile = this.gameState.worldMap[unit.position.y]?.[unit.position.x];
    if (!tile) {
      console.log('buildFortress: Invalid tile position');
      return false;
    }

    // Check if position is in a city square - fortresses cannot be built in cities
    const cityAtPosition = this.gameState.cities.find(city =>
      city.position.x === unit.position.x && city.position.y === unit.position.y
    );
    if (cityAtPosition) {
      console.log('buildFortress: Fortress cannot be built in a city square');
      return false;
    }

    // Check if fortress already exists
    const hasFortress = tile.improvements?.some(imp => imp.type === ImprovementType.FORTRESS);
    if (hasFortress) {
      console.log('buildFortress: Fortress already exists on this tile');
      return false;
    }

    // Check if terrain allows fortress building (cannot build on ocean)
    if (tile.terrain === TerrainType.OCEAN) {
      console.log('buildFortress: Fortress cannot be built on ocean');
      return false;
    }

    // Add fortress improvement
    if (!tile.improvements) {
      tile.improvements = [];
    }

    tile.improvements.push({
      type: ImprovementType.FORTRESS,
      completedTurn: this.gameState.turn
    });

    // End unit's turn
    unit.movementPoints = 0;
    this.removeUnitFromQueue(unitId);

    console.log(`buildFortress: Fortress built at (${unit.position.x}, ${unit.position.y})`);
    this.emit('terrainImproved', {
      position: unit.position,
      improvement: 'fortress',
      playerId: unit.playerId
    });

    return true;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /** Return the combined food/production/trade yields for a tile including all improvements. */
  public getTerrainYieldsWithImprovements(x: number, y: number): { food: number; production: number; trade: number } {
    const tile = this.gameState.worldMap[y]?.[x];
    if (!tile) {
      return { food: 0, production: 0, trade: 0 };
    }

    // Get base yields
    const baseYields = TerrainManager.getTerrainYields(tile.terrain);
    let yields = { ...baseYields };

    // Apply improvement bonuses
    if (tile.improvements) {
      for (const improvement of tile.improvements) {
        switch (improvement.type) {
          case ImprovementType.IRRIGATION:
            yields.food += 1;
            break;

          case ImprovementType.MINE:
            if (tile.terrain === TerrainType.DESERT) {
              yields.production += 1;
            } else if (tile.terrain === TerrainType.HILLS) {
              yields.production += 3;
            } else if (tile.terrain === TerrainType.MOUNTAINS) {
              yields.production += 1;
            }
            break;

          case ImprovementType.ROAD:
            // Roads increase trade for specific terrains
            if (tile.terrain === TerrainType.GRASSLAND ||
              tile.terrain === TerrainType.PLAINS ||
              tile.terrain === TerrainType.DESERT) {
              yields.trade += 1;
            }
            break;
        }
      }
    }

    return yields;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Returns true if (x, y) is adjacent (N/E/S/W) to a river, ocean, or irrigated tile. */
  private hasWaterAccess(x: number, y: number): boolean {
    const mapWidth = this.gameState.worldMap[0].length;
    const mapHeight = this.gameState.worldMap.length;

    // Check adjacent tiles (not diagonal)
    const directions = [
      { dx: 0, dy: -1 }, // North
      { dx: 1, dy: 0 },  // East
      { dx: 0, dy: 1 },  // South
      { dx: -1, dy: 0 }  // West
    ];

    for (const dir of directions) {
      let checkX = x + dir.dx;
      let checkY = y + dir.dy;

      // Handle horizontal wrapping
      if (checkX < 0) checkX = mapWidth - 1;
      if (checkX >= mapWidth) checkX = 0;

      // Skip if out of vertical bounds
      if (checkY < 0 || checkY >= mapHeight) continue;

      const adjacentTile = this.gameState.worldMap[checkY]?.[checkX];
      if (!adjacentTile) continue;

      // Water access sources:
      // 1. River or Ocean terrain
      if (adjacentTile.terrain === TerrainType.RIVER || adjacentTile.terrain === TerrainType.OCEAN) {
        return true;
      }

      // 2. Another irrigated tile
      const hasIrrigation = adjacentTile.improvements?.some(imp => imp.type === ImprovementType.IRRIGATION);
      if (hasIrrigation) {
        return true;
      }
    }

    return false;
  }

  /** Returns the number of turns required to build a road on the given terrain. */
  private getRoadBuildingTurns(terrainType: TerrainType): number {
    // 1 turn: grassland, desert, plains
    // 2 turns: forest, jungle, hills, mountains, rivers
    switch (terrainType) {
      case TerrainType.GRASSLAND:
      case TerrainType.DESERT:
      case TerrainType.PLAINS:
        return 1;
      case TerrainType.FOREST:
      case TerrainType.JUNGLE:
      case TerrainType.HILLS:
      case TerrainType.MOUNTAINS:
      case TerrainType.RIVER:
        return 2;
      default:
        return 1; // Default to 1 turn for unknown terrain
    }
  }

  /** Returns the number of turns required to build a mine on the given tile. */
  private getMineBuildingTurnsForTile(tile: { terrain: TerrainType } | null | undefined): number {
    if (!tile) return 3;
    switch (tile.terrain) {
      case TerrainType.GRASSLAND:
      case TerrainType.PLAINS:
      case TerrainType.RIVER:
        return 3;
      case TerrainType.DESERT:
      case TerrainType.HILLS:
      case TerrainType.FOREST:
        return 4;
      case TerrainType.MOUNTAINS:
      case TerrainType.JUNGLE:
        return 5;
      default:
        return 3;
    }
  }
}
