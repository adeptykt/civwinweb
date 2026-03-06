import { Unit, Position, City, BuildingType, ImprovementType, TerrainType } from '../types/game';
import { BaseUnit } from './Units';
import { getUnitStats } from './UnitDefinitions';

export interface CombatResult {
  attacker: Unit;
  defender: Unit;
  attackerWins: boolean;
  attackerSurvived: boolean;
  defenderSurvived: boolean;
  experienceGained: number;
  unitsDestroyed: Unit[]; // For stack combat
  cityPopulationLost?: number; // If city was attacked
}

export class CombatSystem {

  // Resolve combat between attacker and defender(s) with new Civ 1 mechanics
  public resolveCombat(
    attacker: Unit,
    defender: Unit,
    allUnitsAtPosition: Unit[],
    cityAtPosition?: City,
    defenderHasFortress: boolean = false,
    defenderTerrain?: TerrainType
  ): CombatResult {
    const attackerStrength = this.getEffectiveAttackStrength(attacker);
    const defenderStrength = this.getEffectiveDefenseStrength(defender, defenderHasFortress, cityAtPosition, defenderTerrain);

    // Calculate win probability: attacker_strength / (attacker_strength + defender_strength)
    const totalStrength = attackerStrength + defenderStrength;
    const attackerWinChance = attackerStrength / totalStrength;

    // Determine winner randomly based on strength ratio
    const attackerWins = Math.random() < attackerWinChance;

    let unitsDestroyed: Unit[] = [];
    let experienceGained = 0;
    let cityPopulationLost = 0;

    if (attackerWins) {
      // Attacker wins
      if (cityAtPosition || defenderHasFortress) {
        // In cities and fortresses, units defend one at a time
        unitsDestroyed = [defender];

        // If defending a city, city loses 1 population unless it has walls
        if (cityAtPosition) {
          const hasWalls = cityAtPosition.buildings.some(b => b.type === BuildingType.CITY_WALLS);
          if (!hasWalls) {
            cityPopulationLost = 1;
          }
        }
      } else {
        // In open terrain, entire stack is destroyed
        // Since tiles can only have units from one player, all units at position belong to the defender
        unitsDestroyed = allUnitsAtPosition.filter(u => u.playerId === defender.playerId);
      }

      experienceGained = 10;
      // Award experience to attacker
      attacker.experience += experienceGained;
      this.checkForVeteranStatus(attacker);
    } else {
      // Defender wins - attacker is destroyed
      unitsDestroyed = [attacker];
    }

    return {
      attacker,
      defender,
      attackerWins,
      attackerSurvived: attackerWins,
      defenderSurvived: !attackerWins || !unitsDestroyed.includes(defender),
      experienceGained,
      unitsDestroyed,
      cityPopulationLost: cityPopulationLost > 0 ? cityPopulationLost : undefined
    };
  }

  // Get effective attack strength considering bonuses
  private getEffectiveAttackStrength(unit: Unit): number {
    const stats = getUnitStats(unit.type);
    let strength = stats.attack;

    // Veteran bonus
    if (unit.isVeteran) {
      strength = Math.floor(strength * 1.5);
    }

    return strength;
  }

  // Get effective defense strength considering bonuses
  private getEffectiveDefenseStrength(unit: Unit, hasFortress: boolean = false, city?: City, terrain?: TerrainType): number {
    const stats = getUnitStats(unit.type);
    let strength = stats.defense;

    // Veteran bonus
    if (unit.isVeteran) {
      strength = Math.floor(strength * 1.5);
    }

    // Fortification bonus
    if (unit.fortified) {
      strength = Math.floor(strength * 1.5);
    }

    // Fortress bonus - doubles defensive strength
    if (hasFortress) {
      strength = Math.floor(strength * 2.0);
    }

    // City walls bonus - triples defensive strength
    if (city) {
      const hasWalls = city.buildings.some(b => b.type === BuildingType.CITY_WALLS);
      if (hasWalls) {
        strength = Math.floor(strength * 3.0);
      }
    }

    // Terrain defense bonus (only applies outside cities)
    if (!city) {
      strength = Math.floor(strength * this.getTerrainDefenseMultiplier(terrain));
    }

    return strength;
  }

  /**
   * Returns the Civ 1 terrain defense multiplier for the given terrain type.
   * Applied to the raw defense strength before other bonuses.
   * Terrain bonus is suppressed when a defender is in a city (city walls / walls
   * represent man-made fortification that supersedes natural terrain).
   */
  public getTerrainDefenseMultiplier(terrain?: TerrainType): number {
    switch (terrain) {
      case TerrainType.HILLS:
        return 2.0;   // +100% — key defensive terrain in Civ 1
      case TerrainType.MOUNTAINS:
        return 3.0;   // +200% — near-impenetrable for early units
      case TerrainType.FOREST:
      case TerrainType.JUNGLE:
      case TerrainType.SWAMP:
        return 1.5;   // +50% — broken terrain slows attackers
      case TerrainType.RIVER:
        return 1.25;  // +25% — river-crossing penalty reflected as defender bonus
      default:
        return 1.0;   // Grassland, plains, desert, tundra, arctic, ocean — no bonus
    }
  }

  // Check if unit should become veteran
  private checkForVeteranStatus(unit: Unit): void {
    if (unit.experience >= 100 && !unit.isVeteran) {
      unit.isVeteran = true;
    }
  }

  public canAttack(attacker: Unit, defender: Unit): boolean {
    const attackerStats = getUnitStats(attacker.type);

    // Only units that can attack may initiate combat
    if (!attackerStats.canAttack) {
      return false;
    }

    // Check if units are adjacent (simplified)
    const distance = this.calculateDistance(attacker.position, defender.position);
    if (distance > 1) {
      return false;
    }

    // Check if attacker has movement points
    if (attacker.movementPoints <= 0) {
      return false;
    }

    // Cannot attack units of same player
    if (attacker.playerId === defender.playerId) {
      return false;
    }

    return true;
  }

  // Calculate distance between two positions (Chebyshev distance for 8-directional adjacency)
  private calculateDistance(pos1: Position, pos2: Position): number {
    // Use Chebyshev distance to allow diagonal attacks
    // This makes all 8 surrounding squares (cardinal + diagonal) have distance = 1
    return Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.y - pos2.y));
  }

  // Execute attack if valid
  public executeAttack(
    attacker: Unit,
    defender: Unit,
    allUnitsAtPosition: Unit[],
    cityAtPosition?: City,
    defenderHasFortress: boolean = false,
    defenderTerrain?: TerrainType
  ): CombatResult | null {
    if (!this.canAttack(attacker, defender)) {
      return null;
    }

    // Attacking uses all remaining movement points
    attacker.movementPoints = Math.max(0, attacker.movementPoints - 1);

    return this.resolveCombat(attacker, defender, allUnitsAtPosition, cityAtPosition, defenderHasFortress, defenderTerrain);
  }
}
