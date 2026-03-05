import {
  GameState,
  Unit,
  Position,
  ImprovementType,
} from '../types/game';
import { getUnitStats } from './UnitDefinitions';
import { CombatSystem, CombatResult } from './CombatSystem';
import { SoundEffects } from '../utils/SoundEffects';
import { VisibilitySystem } from './VisibilitySystem';
import { DiplomacyManager, DiplomacyProposal, DiplomaticStatus } from './DiplomacyManager';

export class CombatOrchestrator {
  constructor(
    private readonly gameState: GameState,
    private readonly emit: (event: string, data?: any) => void,
    private readonly combatSystem: CombatSystem,
    private readonly diplomacyManager: DiplomacyManager,
    private readonly pendingDiplomacyContacts: Array<{
      initiatorId: string;
      receiverId: string;
      proposal: DiplomacyProposal;
      turn: number;
    }>,
    private readonly canUnitMoveToTerrain: (unit: Unit, position: Position) => boolean,
    private readonly moveUnit: (unitId: string, position: Position) => boolean,
    private readonly removeUnitFromQueue: (unitId: string) => void,
    private readonly removeFromUnitQueueArray: (playerId: string) => void,
    private readonly getCurrentUnit: () => Unit | null,
    private readonly clearCurrentUnit: () => void,
    private readonly selectNextUnit: () => void,
  ) {}

  // ── Manual combat (called from UI) ───────────────────────────────────────

  public attackUnit(attackerUnitId: string, defenderUnitId: string): CombatResult | null {
    const attacker = this.gameState.units.find(u => u.id === attackerUnitId);
    const defender = this.gameState.units.find(u => u.id === defenderUnitId);

    if (!attacker || !defender) return null;

    // Get all units at the defender's position (for stack combat)
    const allUnitsAtPosition = this.gameState.units.filter(u =>
      u.position.x === defender.position.x && u.position.y === defender.position.y,
    );

    // Check if there's a city at the defender's position
    const cityAtPosition = this.gameState.cities.find(city =>
      city.position.x === defender.position.x && city.position.y === defender.position.y,
    );

    // Check if defender is on a fortress tile
    const defenderTile = this.gameState.worldMap[defender.position.y]?.[defender.position.x];
    const defenderHasFortress =
      defenderTile?.improvements?.some(imp => imp.type === ImprovementType.FORTRESS) || false;

    const result = this.combatSystem.executeAttack(
      attacker,
      defender,
      allUnitsAtPosition,
      cityAtPosition,
      defenderHasFortress,
    );

    if (result) {
      this.processCombatResult(result, defender.position);
    }

    return result;
  }

  /**
   * Called by the UI after the player confirms they want to declare war and attack.
   * Declares war on the target AI player, then re-invokes moveUnit so combat proceeds normally.
   */
  public confirmDeclareWarAndAttack(
    unitId: string,
    targetPosition: Position,
    aiPlayerId: string,
  ): boolean {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return false;
    const humanPlayer = this.gameState.players.find(p => p.id === unit.playerId);
    if (!humanPlayer) return false;

    this.diplomacyManager.updateStatus(humanPlayer.id, aiPlayerId, DiplomaticStatus.WAR);
    this.emit('diplomaticWarDeclared', { initiatorId: humanPlayer.id, receiverId: aiPlayerId });

    // Now that war is declared, moveUnit will pass through to initiateAutomaticCombat
    return this.moveUnit(unitId, targetPosition);
  }

  // ── Automatic combat (triggered when a unit moves onto an enemy tile) ────

  public initiateAutomaticCombat(
    attacker: Unit,
    targetPosition: Position,
    enemyUnits: Unit[],
  ): boolean {
    console.log('initiateAutomaticCombat called', {
      attacker: attacker.type,
      attackerId: attacker.id,
      enemyCount: enemyUnits.length,
    });

    // Check if the attacker can attack
    const attackerStats = getUnitStats(attacker.type);
    if (!attackerStats.canAttack) {
      console.log('Unit cannot attack:', attacker.type, 'canAttack:', attackerStats.canAttack);
      SoundEffects.playInvalidActionSound();
      return false;
    }

    // If an AI unit is attacking a human unit and war has not yet been declared,
    // queue a war declaration dialog (shown at the start of the human's next turn)
    // and set the diplomatic status to WAR now so combat can proceed.
    const attackerPlayer = this.gameState.players.find(p => p.id === attacker.playerId);
    const humanDefender = enemyUnits.find(u => {
      const defPlayer = this.gameState.players.find(p => p.id === u.playerId);
      return defPlayer?.isHuman;
    });
    if (attackerPlayer && !attackerPlayer.isHuman && humanDefender) {
      const humanPlayer = this.gameState.players.find(p => p.id === humanDefender.playerId)!;
      const alreadyAtWar = this.diplomacyManager.isAtWar(attackerPlayer.id, humanPlayer.id);
      if (!alreadyAtWar) {
        // Declare war immediately so combat is valid
        this.diplomacyManager.updateStatus(attackerPlayer.id, humanPlayer.id, DiplomaticStatus.WAR);
        this.emit('diplomaticWarDeclared', { initiatorId: attackerPlayer.id, receiverId: humanPlayer.id });
        // Queue the notification dialog for the human's next turn
        this.pendingDiplomacyContacts.push({
          initiatorId: attackerPlayer.id,
          receiverId: humanPlayer.id,
          proposal: DiplomacyProposal.DECLARE_WAR,
          turn: this.gameState.turn,
        });
      }
    }

    console.log('Unit can attack, proceeding with combat');

    // Get the strongest enemy unit to defend (highest defense value)
    const defender = enemyUnits.reduce((strongest, current) => {
      const currentStats = getUnitStats(current.type);
      const strongestStats = getUnitStats(strongest.type);
      return currentStats.defense > strongestStats.defense ? current : strongest;
    });

    // Get all units at the target position (for stack combat)
    const allUnitsAtPosition = this.gameState.units.filter(u =>
      u.position.x === targetPosition.x && u.position.y === targetPosition.y,
    );

    // Check if there's a city at the target position
    const cityAtPosition = this.gameState.cities.find(
      city => city.position.x === targetPosition.x && city.position.y === targetPosition.y,
    );

    // Check if defender is on a fortress tile
    const defenderTile = this.gameState.worldMap[targetPosition.y]?.[targetPosition.x];
    const defenderHasFortress =
      defenderTile?.improvements?.some(imp => imp.type === ImprovementType.FORTRESS) || false;

    // Execute combat
    const result = this.combatSystem.executeAttack(
      attacker,
      defender,
      allUnitsAtPosition,
      cityAtPosition,
      defenderHasFortress,
    );

    if (result) {
      // Handle combat results
      this.processCombatResult(result, targetPosition);

      // If attacker wins and can still move, check if we can move to the target position
      if (result.attackerWins && result.attackerSurvived) {
        const cityAfterCombat = this.gameState.cities.find(
          city => city.position.x === targetPosition.x && city.position.y === targetPosition.y,
        );

        if (cityAfterCombat && cityAfterCombat.playerId !== attacker.playerId) {
          // Check if there are any remaining enemy units defending the city (after combat)
          const defendingUnits = this.gameState.units.filter(u =>
            u.position.x === targetPosition.x &&
            u.position.y === targetPosition.y &&
            u.playerId === cityAfterCombat.playerId,
          );

          if (defendingUnits.length === 0) {
            if (this.canUnitMoveToTerrain(attacker, targetPosition)) {
              // City is now undefended after combat, move in and capture it!
              attacker.position = targetPosition;
              console.log(
                `Capturing city ${cityAfterCombat.name} from player ${cityAfterCombat.playerId} to player ${attacker.playerId} after combat victory`,
              );

              const oldOwner = cityAfterCombat.playerId;
              cityAfterCombat.playerId = attacker.playerId;

              // Add captured city name to new owner's used names list
              const newOwnerPlayer = this.gameState.players.find(p => p.id === attacker.playerId);
              if (newOwnerPlayer && !newOwnerPlayer.usedCityNames.includes(cityAfterCombat.name)) {
                newOwnerPlayer.usedCityNames.push(cityAfterCombat.name);
              }

              // Clear any production from the previous owner
              cityAfterCombat.production = null;
              cityAfterCombat.production_points = 0;

              // Play civilization fanfare if human player captured the city
              const capturingPlayer = this.gameState.players.find(p => p.id === attacker.playerId);
              if (capturingPlayer?.isHuman) {
                SoundEffects.playCivilizationFanfare(capturingPlayer.civilizationType);
              }

              // Emit city capture event
              this.emit('cityCapture', {
                city: cityAfterCombat,
                newOwner: attacker.playerId,
                oldOwner,
                capturingUnit: attacker,
              });

              // Check for defeated players after city capture
              this.checkForDefeatedPlayers();

              console.log(
                `City ${cityAfterCombat.name} successfully captured by ${attacker.playerId} after combat`,
              );
            } else {
              console.log(
                `City ${cityAfterCombat.name} is undefended, but attacker cannot move into this terrain to capture it`,
              );
            }
          } else {
            console.log(
              `City ${cityAfterCombat.name} still has ${defendingUnits.length} defending units, attacker cannot move in`,
            );
          }
        } else {
          // No city at target position, or city belongs to attacker — normal movement after combat
          if (this.canUnitMoveToTerrain(attacker, targetPosition)) {
            attacker.position = targetPosition;
          }
        }

        // Update visibility and break fortification if the unit actually moved
        if (
          attacker.position.x === targetPosition.x &&
          attacker.position.y === targetPosition.y
        ) {
          VisibilitySystem.updateVisibilityForUnitMove(this.gameState, attacker, targetPosition);

          if (attacker.fortified || attacker.fortifying) {
            attacker.fortified = false;
            attacker.fortifying = false;
            attacker.fortificationTurns = 0;
          }

          if (attacker.buildingRoad) {
            attacker.buildingRoad = false;
            attacker.roadBuildingTurns = 0;
          }

          this.emit('unitMoved', { unit: attacker, newPosition: targetPosition });
        }
      }

      // Remove attacker from queue since combat always uses all movement points
      this.removeUnitFromQueue(attacker.id);

      return true;
    }

    return false;
  }

  // ── Combat result processing ──────────────────────────────────────────────

  private processCombatResult(result: CombatResult, combatPosition: Position): void {
    const attackerPlayer = this.gameState.players.find(p => p.id === result.attacker.playerId);
    const defenderPlayer = this.gameState.players.find(p => p.id === result.defender.playerId);

    const humanPlayerInvolved = attackerPlayer?.isHuman || defenderPlayer?.isHuman;

    if (humanPlayerInvolved) {
      if (result.attackerWins) {
        if (attackerPlayer?.isHuman) {
          SoundEffects.playPlayerVictorySound();
        } else if (defenderPlayer?.isHuman) {
          SoundEffects.playPlayerDefeatSound();
        }
      } else {
        if (defenderPlayer?.isHuman) {
          SoundEffects.playPlayerVictorySound();
        } else if (attackerPlayer?.isHuman) {
          SoundEffects.playPlayerDefeatSound();
        }
      }
    }

    // Remove destroyed units from the game
    for (const destroyedUnit of result.unitsDestroyed) {
      const destroyedUnitSnapshot: Unit = {
        ...destroyedUnit,
        position: { ...destroyedUnit.position },
      };

      this.emit('unitDefeated', { unit: destroyedUnitSnapshot });

      this.gameState.units = this.gameState.units.filter(u => u.id !== destroyedUnit.id);
      this.removeUnitFromQueue(destroyedUnit.id);
    }

    // Handle city population loss
    if (result.cityPopulationLost && result.cityPopulationLost > 0) {
      const city = this.gameState.cities.find(
        c => c.position.x === combatPosition.x && c.position.y === combatPosition.y,
      );
      if (city) {
        city.population = Math.max(0, city.population - result.cityPopulationLost);
        this.emit('cityPopulationLost', { city, populationLost: result.cityPopulationLost });
      }
    }

    this.emit('combatResolved', result);
  }

  // ── Player elimination ────────────────────────────────────────────────────

  /**
   * Check for defeated players and eliminate them from the game.
   * A player is defeated if they have no cities and it's past the early game period.
   */
  public checkForDefeatedPlayers(): void {
    const earlyGameTurns = 20; // Players are safe from elimination for first 20 turns

    if (this.gameState.turn <= earlyGameTurns) {
      return;
    }

    const playersToEliminate: string[] = [];

    for (const player of this.gameState.players) {
      if (player.isHuman) continue;
      if (player.defeated) continue;

      const playerCities = this.gameState.cities.filter(city => city.playerId === player.id);
      if (playerCities.length === 0) {
        console.log(`Player ${player.name} (${player.id}) has been defeated - no cities remaining`);
        playersToEliminate.push(player.id);
      }
    }

    for (const playerId of playersToEliminate) {
      this.eliminatePlayer(playerId);
    }
  }

  private eliminatePlayer(playerId: string): void {
    console.log(`Eliminating player ${playerId} from the game`);

    const unitsToRemove = this.gameState.units.filter(unit => unit.playerId === playerId);
    console.log(`Removing ${unitsToRemove.length} units for eliminated player ${playerId}`);

    this.gameState.units = this.gameState.units.filter(unit => unit.playerId !== playerId);

    // Clean up the unit queue array (owned by Game.ts / UnitQueueSystem)
    this.removeFromUnitQueueArray(playerId);

    // If current unit belongs to eliminated player, advance to next unit
    const currentUnit = this.getCurrentUnit();
    if (currentUnit && currentUnit.playerId === playerId) {
      this.clearCurrentUnit();
      this.selectNextUnit();
    }

    // Mark player as eliminated (but keep in players array for historical record)
    const player = this.gameState.players.find(p => p.id === playerId);
    if (player) {
      player.defeated = true;
      console.log(`Player ${player.name} has been marked as defeated`);

      // Only emit event if defeat hasn't been acknowledged yet
      if (!player.defeatAcknowledged) {
        this.emit('playerEliminated', {
          playerId,
          playerName: player.name || playerId,
          turn: this.gameState.turn,
        });
      }
    }
  }

  public acknowledgePlayerDefeat(playerId: string): void {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (player) {
      player.defeatAcknowledged = true;
      console.log(`Player ${player.name} defeat acknowledged`);
    }
  }
}
