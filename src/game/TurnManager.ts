import type { GameState, Unit, City, UnitType, Tile, ProductionQueueItem } from '../types/game';
import { ImprovementType, TerrainType, ProductionType, GovernmentType, TechnologyType, BuildingType, GOVERNMENTS } from '../types/game';
import { createUnit } from './Units';
import { getUnitStats } from './UnitDefinitions';
import { getResearchCost } from './TechnologyDefinitions';
import { getDifficultyParams } from './DifficultyConfig';
import { ProductionManager } from './ProductionManager';
import { UNIT_DEFINITIONS } from './UnitDefinitions';
import { CityGrowthSystem } from './CityGrowthSystem';
import { WaterAccess } from '../utils/WaterAccess';
import { VisibilitySystem } from './VisibilitySystem';
import { applyResourceBonuses } from './ResourceBonuses';
import { TerrainManager } from '../terrain';
import { AIPlayer } from './AIPlayer';
import { TaxSystem } from './TaxSystem';
import { HappinessSystem } from './HappinessSystem';
import { DebugSystem } from '../utils/DebugSystem';

export class TurnManager {
  /** Dev cheat: shields per turn when "Fast City Production" is enabled in settings. */
  private static readonly FAST_PRODUCTION_SHIELD_MULTIPLIER = 25;
  
  // Callback for building completion events
  private onBuildingCompleted?: (city: City, buildingType: string, isWonder: boolean) => void;
  // Callback for terrain improvement completion (mine)
  private onTerrainImproved?: (position: { x: number; y: number }) => void;
  // Callback fired when civil disorder topples a government (Republic/Democracy)
  private onGovernmentCollapsed?: (playerId: string) => void;

  constructor(
    onBuildingCompleted?: (city: City, buildingType: string, isWonder: boolean) => void,
    onTerrainImproved?: (position: { x: number; y: number }) => void,
    onGovernmentCollapsed?: (playerId: string) => void
  ) {
    this.onBuildingCompleted = onBuildingCompleted;
    this.onTerrainImproved = onTerrainImproved;
    this.onGovernmentCollapsed = onGovernmentCollapsed;
  }
  
  // Process end of turn
  public processTurn(gameState: GameState): void {
    // Process fortification progression for current player's units
    this.processFortificationProgression(gameState);
    
    // Process road building progression for current player's units
    this.processRoadBuilding(gameState);

    // Process mine building progression for current player's units
    this.processMineBuilding(gameState);

    // Process irrigation building progression for current player's units
    this.processIrrigationBuilding(gameState);
    
    // Restore movement points for current player's units
    this.restoreMovementPoints(gameState);
    
    // Process cities for current player
    this.processCities(gameState);
    
    // Update player resources
    this.updatePlayerResources(gameState);
    
    // Update visibility for current player (refresh vision)
    VisibilitySystem.updateVisibilityForPlayer(gameState, gameState.currentPlayer);

    // Decrement revolution timer for the current player
    this.decrementRevolution(gameState);

    // Check if civil disorder should topple the current player's government
    this.checkGovernmentDisorderCollapse(gameState);

    // Move to next player
    this.nextPlayer(gameState);
    
    // If back to first player, increment turn counter
    if (gameState.currentPlayer === gameState.players[0].id) {
      gameState.turn++;
    }
  }

  // Update movement points for all units of current player using new unit system
  private restoreMovementPoints(gameState: GameState): void {
    const currentPlayer = gameState.currentPlayer;
    
    gameState.units
      .filter(unit => unit.playerId === currentPlayer)
      .forEach(unit => {
        const stats = getUnitStats(unit.type);
        unit.maxMovementPoints = stats.movement;
        unit.movementPoints = stats.movement;
      });
  }

  // Process all cities for current player
  private processCities(gameState: GameState): void {
    const currentPlayerId = gameState.currentPlayer;
    const player = gameState.players.find(p => p.id === currentPlayerId);
    const playerCities = gameState.cities.filter(city => city.playerId === currentPlayerId);

    playerCities.forEach(city => {
      this.processCityGrowth(city, gameState);
      this.processCityProduction(city, gameState, player);
    });

    // Update happiness for all player cities (after production so luxury income
    // from entertainers/buildings is already reflected in the TaxSystem breakdown).
    if (player) {
      playerCities.forEach(city => this.processCityHappiness(city, player, gameState));
    }

    // Deduct shield drain from excess units (Despotism / Monarchy only).
    // In Civ 1 this comes out of the home city; since we don't track home cities
    // we spread the cost evenly across all cities, flooring per city.
    if (player && playerCities.length > 0) {
      const shieldDrain = TaxSystem.calculateUnitShieldDrain(player, gameState);
      if (shieldDrain > 0) {
        const drainPerCity = Math.floor(shieldDrain / playerCities.length);
        let remainder = shieldDrain - drainPerCity * playerCities.length;
        for (const city of playerCities) {
          const cityDrain = drainPerCity + (remainder > 0 ? 1 : 0);
          if (remainder > 0) remainder--;
          city.production_points = Math.max(0, city.production_points - cityDrain);
        }
      }
    }
  }

  // Process city growth using Civilization I mechanics
  private processCityGrowth(city: City, gameState: GameState): void {
    // Initialize food storage system if not already done
    if (city.foodStorageCapacity === undefined) {
      CityGrowthSystem.initializeCityFoodStorage(city);
    }

    // Apply AI food storage reduction based on difficulty.
    // Lower capacity means the city fills its granary faster → grows sooner.
    const cityPlayer = gameState.players.find(p => p.id === city.playerId);
    if (cityPlayer && !cityPlayer.isHuman) {
      const params = getDifficultyParams(gameState.difficulty ?? 'chieftain');
      if (params.aiFoodStorageMultiplier !== 1.0) {
        city.foodStorageCapacity = Math.max(
          5,
          Math.ceil(CityGrowthSystem.calculateFoodStorageCapacity(city.population) * params.aiFoodStorageMultiplier)
        );
      }
    }
    
    // Calculate actual food production from city tiles and buildings
    const foodProduction = this.calculateCityFoodProduction(city, gameState);
    
    // Process growth using proper Civ1 mechanics
    const cityGrew = CityGrowthSystem.processCityGrowth(city, foodProduction);
    
    if (cityGrew) {
      // After growth CityGrowthSystem resets foodStorageCapacity to normal;
      // re-apply the AI difficulty reduction for the new population level.
      if (cityPlayer && !cityPlayer.isHuman) {
        const params = getDifficultyParams(gameState.difficulty ?? 'chieftain');
        if (params.aiFoodStorageMultiplier !== 1.0) {
          city.foodStorageCapacity = Math.max(
            5,
            Math.ceil(CityGrowthSystem.calculateFoodStorageCapacity(city.population) * params.aiFoodStorageMultiplier)
          );
        }
      }
    }
  }

  // Calculate total food production for a city from tile yields
  private calculateCityFoodProduction(city: City, gameState: GameState): number {
    const mapWidth = gameState.worldMap[0]?.length ?? 80;

    // City centre tile always contributes at least 2 food (Civ1 rule)
    const cityTile = gameState.worldMap[city.position.y]?.[city.position.x];
    let totalFood = cityTile ? Math.max(2, TaxSystem.getTileYields(cityTile).food) : 2;

    // Collect worked outer tiles
    if (city.workedTiles && city.workedTiles.length > 0) {
      // Manually selected tiles
      for (const { dx, dy } of city.workedTiles) {
        const tileY = city.position.y + dy;
        if (tileY < 0 || tileY >= gameState.worldMap.length) continue;
        const tileX = ((city.position.x + dx) % mapWidth + mapWidth) % mapWidth;
        const tile = gameState.worldMap[tileY]?.[tileX];
        if (tile) totalFood += TaxSystem.getTileYields(tile).food;
      }
    } else {
      // Auto-select up to `population` tiles, sorted by food yield descending
      const availableTiles = this.getAvailableTiles(city, gameState);
      const maxWorked = Math.min(city.population, availableTiles.length);
      availableTiles.sort((a, b) => TaxSystem.getTileYields(b).food - TaxSystem.getTileYields(a).food);
      for (let i = 0; i < maxWorked; i++) {
        totalFood += TaxSystem.getTileYields(availableTiles[i]).food;
      }
    }

    // AI food bonus: same difficulty multiplier pattern as production
    const cityPlayer = gameState.players.find(p => p.id === city.playerId);
    if (cityPlayer && !cityPlayer.isHuman) {
      const params = getDifficultyParams(gameState.difficulty ?? 'chieftain');
      if (params.aiFoodStorageMultiplier !== 1.0) {
        // aiFoodStorageMultiplier < 1 speeds AI growth via smaller storage;
        // also give a small food bonus so AI cities don't stall.
        totalFood = Math.ceil(totalFood * (2 - params.aiFoodStorageMultiplier));
      }
    }

    return totalFood;
  }

  // Process city production
  private processCityProduction(city: City, gameState: GameState, player?: any): void {
    const productionPerTurn = this.calculateProductionOutput(city, gameState);

    // Always accumulate shields, even when producing "nothing" (Civ1 shield bug)
    city.production_points += productionPerTurn;

    // If something is being produced, check for completion
    if (city.production) {
      const totalCost = ProductionManager.getProductionCost(
        city.production.type as ProductionType,
        city.production.item as any
      );

      // Primary completion trigger: shields accumulated >= production cost
      if (totalCost > 0 && city.production_points >= totalCost) {
        this.completeProduction(city, gameState);
        return;
      }

      // Keep turnsRemaining as a live estimate for UI display
      if (totalCost > 0) {
        const remaining = Math.max(0, totalCost - city.production_points);
        city.production.turnsRemaining = productionPerTurn > 0
          ? Math.max(1, Math.ceil(remaining / productionPerTurn))
          : 999;
      }
    } else if (player?.isHuman && city.autoFillQueue !== false) {
      // Production is null but auto-fill is on — kick off the queue without
      // waiting for the player to open the city screen.
      this.advanceProductionQueue(city, player, gameState);
    }
  }

  // Calculate production output for a city based on worked tiles
  public calculateProductionOutput(city: City, gameState?: GameState): number {
    let totalProduction = 0;
    
    // If no gameState provided, fall back to simple calculation
    if (!gameState) {
      return Math.max(1, Math.floor(city.population / 2));
    }
    
    // Calculate city center production based on underlying terrain (minimum 1)
    const cityTile = gameState.worldMap[city.position.y][city.position.x];
    const cityCenterYield = Math.max(1, this.getTileProductionYield(cityTile));
    totalProduction += cityCenterYield;
    
    // Calculate production from worked tiles
    if (city.workedTiles && city.workedTiles.length > 0) {
      // Use manually selected worked tiles (with horizontal map wrapping)
      const mapWidth = gameState.worldMap[0]?.length ?? 80;
      for (const workedTile of city.workedTiles) {
        const tileX = ((city.position.x + workedTile.dx) % mapWidth + mapWidth) % mapWidth;
        const tileY = city.position.y + workedTile.dy;
        if (tileY >= 0 && tileY < gameState.worldMap.length) {
          const tile = gameState.worldMap[tileY][tileX];
          totalProduction += this.getTileProductionYield(tile);
        }
      }
    } else {
      // Auto-select tiles based on population (simplified AI selection)
      const availableTiles = this.getAvailableTiles(city, gameState);
      const maxWorkedTiles = Math.min(city.population, availableTiles.length);
      
      // Sort tiles by production yield (prioritize production for this calculation)
      availableTiles.sort((a, b) => this.getTileProductionYield(b) - this.getTileProductionYield(a));
      
      for (let i = 0; i < maxWorkedTiles; i++) {
        totalProduction += this.getTileProductionYield(availableTiles[i]);
      }
    }
    
    // Production building chain — matches Civ1 rules:
    //   Factory alone:                +50%  (1.5×)
    //   Factory + Power/Hydro/Nuclear: +100% (2×)   — power plant doubles the factory bonus
    //   Manufacturing Plant alone:    +100% (2×)
    //   Mfg Plant + Power/Hydro/Nuke: +200% (3×)
    const hasFactory    = city.buildings.some(b => b.type === BuildingType.FACTORY);
    const hasMfgPlant   = city.buildings.some(b => b.type === BuildingType.MANUFACTURING_PLANT);
    const hasPowerPlant = city.buildings.some(b =>
      b.type === BuildingType.POWER_PLANT ||
      b.type === BuildingType.HYDRO_PLANT ||
      b.type === BuildingType.NUCLEAR_PLANT
    );
    let productionMultiplier = 1.0;
    if (hasMfgPlant) {
      productionMultiplier = hasPowerPlant ? 3.0 : 2.0;
    } else if (hasFactory) {
      productionMultiplier = hasPowerPlant ? 2.0 : 1.5;
    }
    if (productionMultiplier > 1.0) {
      totalProduction = Math.floor(totalProduction * productionMultiplier);
    }

    // AI production bonus: scaled by difficulty (Chieftain = 1×, Emperor = 2×)
    // Matches classic Civ 1 where higher difficulties give AI a production cheat.
    const cityPlayer = gameState.players.find(p => p.id === city.playerId);
    if (cityPlayer && !cityPlayer.isHuman) {
      const aiProductionMultiplier = getDifficultyParams(gameState.difficulty ?? 'chieftain').aiProductionMultiplier;
      totalProduction = Math.ceil(totalProduction * aiProductionMultiplier);
    }

    const base = Math.max(0, totalProduction);
    if (
      DebugSystem.getInstance().isFastProductionEnabled() &&
      cityPlayer?.isHuman
    ) {
      return Math.max(1, base) * TurnManager.FAST_PRODUCTION_SHIELD_MULTIPLIER;
    }
    return base;
  }
  
  // Get production yield from a single tile
  private getTileProductionYield(tile: Tile): number {
    return TaxSystem.getTileYields(tile).production;
  }
  
  // Get available tiles around a city (within working radius)
  private getAvailableTiles(city: City, gameState: GameState): Tile[] {
    const availableTiles: Tile[] = [];
    const workRadius = 2; // Cities can work tiles within 2 squares
    const mapWidth = gameState.worldMap[0]?.length ?? 80;

    for (let dy = -workRadius; dy <= workRadius; dy++) {
      for (let dx = -workRadius; dx <= workRadius; dx++) {
        // Skip city center (already counted)
        if (dx === 0 && dy === 0) continue;

        // Skip the four (±2, ±2) corners — outside the Civ1 21-tile diamond.
        // Must match the exclusion in TaxSystem.getAutoWorkedTiles so that
        // production and tax calculations operate on the same set of tiles.
        if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;

        // Apply horizontal map wrapping so cities near the edge work correctly.
        const tileX = ((city.position.x + dx) % mapWidth + mapWidth) % mapWidth;
        const tileY = city.position.y + dy;

        // Ensure tile is within map bounds
        if (tileY >= 0 && tileY < gameState.worldMap.length) {
          const tile = gameState.worldMap[tileY][tileX];
          
          // Check if tile is not worked by another city
          const isWorkedByOtherCity = gameState.cities.some(otherCity => 
            otherCity.id !== city.id && 
            otherCity.workedTiles?.some(workedTile => 
              otherCity.position.x + workedTile.dx === tileX &&
              otherCity.position.y + workedTile.dy === tileY
            )
          );
          
          if (!isWorkedByOtherCity) {
            availableTiles.push(tile);
          }
        }
      }
    }
    
    return availableTiles;
  }

  // Complete a production item
  private completeProduction(city: City, gameState: GameState): void {
    if (!city.production) return;

    // Get the player to validate they still have the required technologies
    const player = gameState.players.find(p => p.id === city.playerId);
    if (!player) return;

    const productionType = city.production.type;
    const productionItem = city.production.item;

    // Validate that the player can still produce this item
    const existingBuildings = city.buildings.map(b => b.type as any);
    const hasWaterAccess = WaterAccess.hasWaterAccess(city, gameState.worldMap);
    // Gather all wonders already built across the entire game (wonders are unique)
    const existingWonders = gameState.cities
      .flatMap((c: any) => c.buildings || [])
      .filter((b: any) => b.type && (b.type as string).startsWith('wonder_'))
      .map((b: any) => (b.type as string).replace('wonder_', ''));
    const canStillProduce = ProductionManager.canProduce(
      productionType,
      productionItem as string,
      player.technologies,
      existingBuildings,
      hasWaterAccess,
      existingWonders,
      true // isCurrentlyProducing = true (allows finishing obsolete units)
    );

    if (!canStillProduce) {
      // Give a specific reason so warnings are actionable in the console.
      const isWonder = productionType === 'wonder';
      const alreadyBuiltElsewhere = isWonder && existingWonders.includes(productionItem as string);
      if (alreadyBuiltElsewhere) {
        console.warn(`${city.name}: ${productionItem} already built by another civilization — clearing production.`);
      } else {
        console.warn(`${city.name}: Cannot complete production of ${productionItem} — requirements no longer met (missing tech or water access).`);
      }
      city.production = null;
      city.production_points = 0;
      return;
    }

    // Store info about what was completed for auto-production logic
    const completedType = productionType;
    const completedItem = productionItem;

    switch (productionType) {
      case 'unit':
        this.createUnit(city, productionItem as any, gameState);
        break;
      case 'building':
        this.createBuilding(city, productionItem as any);
        break;
      case 'wonder':
        this.createWonder(city, productionItem as string);
        break;
    }

    // Handle production completion based on Civilization 1 mechanics
    if (completedType === 'unit') {
      // Units: reset shields and handle production restart
      city.production_points = 0;
      
      // Check if this is an AI player
      if (!player.isHuman) {
        // For AI players, clear production so AI can re-evaluate what to build
        city.production = null;
        console.log(`AI City ${city.name} completed ${completedItem}, production cleared for AI re-evaluation`);
      } else {
        // For human players, advance to next item in the build queue
        this.advanceProductionQueue(city, player, gameState);
      }
    } else if (completedType === 'building' || completedType === 'wonder') {
      // Buildings/Wonders: reset shields
      city.production_points = 0;
      if (!player.isHuman) {
        // AI clears and re-evaluates
        city.production = null;
      } else {
        // Human: advance to next item in the build queue
        this.advanceProductionQueue(city, player, gameState);
      }
    }
  }

  /**
   * Advance a human city's production queue.
   * Skips any items that can no longer be built, then sets the next valid item
   * as city.production. If the queue is exhausted, regenerates the default queue.
   */
  private advanceProductionQueue(city: City, player: any, gameState: GameState): void {
    if (!city.productionQueue) {
      city.productionQueue = [];
    }

    const existingWonders = (gameState.cities as City[])
      .flatMap(c => c.buildings ?? [])
      .filter(b => (b.type as string).startsWith('wonder_'))
      .map(b => (b.type as string).replace('wonder_', ''));

    // Skip any queue entries that are no longer buildable
    while (city.productionQueue.length > 0) {
      const nextItem = city.productionQueue[0];
      const existingBuildings = city.buildings.map(b => b.type as any);
      const hasWaterAccess = WaterAccess.hasWaterAccess(city, gameState.worldMap);
      const canBuild = ProductionManager.canProduce(
        nextItem.type,
        nextItem.item as string,
        player.technologies,
        existingBuildings,
        hasWaterAccess,
        existingWonders,
        false
      );
      if (canBuild) break;
      console.log(`${city.name}: Skipping queue item ${nextItem.item} (no longer buildable)`);
      city.productionQueue.shift();
    }

    if (city.productionQueue.length > 0) {
      const nextItem = city.productionQueue.shift()!;
      const productionOutput = Math.max(1, this.calculateProductionOutput(city, gameState));
      const cost = ProductionManager.getProductionCost(nextItem.type, nextItem.item as any);
      city.production = {
        type: nextItem.type,
        item: nextItem.item,
        turnsRemaining: Math.max(1, Math.ceil(cost / productionOutput)),
      } as any;
      console.log(`${city.name}: Advanced queue to ${nextItem.item}`);
    } else {
      // Queue exhausted
      const autoFill = city.autoFillQueue !== false; // undefined → true (default ON)
      if (autoFill) {
        // Auto-fill: regenerate the default queue and take the first item
        const freshQueue = ProductionManager.generateDefaultQueue(city, player, gameState);
        city.productionQueue = freshQueue;
        if (city.productionQueue.length > 0) {
          const nextItem = city.productionQueue.shift()!;
          const productionOutput = Math.max(1, this.calculateProductionOutput(city, gameState));
          const cost = ProductionManager.getProductionCost(nextItem.type, nextItem.item as any);
          city.production = {
            type: nextItem.type,
            item: nextItem.item,
            turnsRemaining: Math.max(1, Math.ceil(cost / productionOutput)),
          } as any;
          console.log(`${city.name}: Queue exhausted — auto-refilled default, now building ${nextItem.item}`);
        } else {
          city.production = null;
        }
      } else {
        // Auto-fill is OFF — queue is empty, stop producing
        city.production = null;
        console.log(`${city.name}: Queue exhausted and auto-fill is off — production halted`);
      }
    }
  }

  // Create a new unit
  private createUnit(city: City, unitType: string, gameState: GameState): void {
    const newUnit = createUnit(
      `unit-${Date.now()}-${Math.random()}`,
      unitType as UnitType,
      city.position,
      city.playerId
    );

    // Barracks makes new units start as veterans (Civ1 rule)
    if (city.buildings.some(b => b.type === BuildingType.BARRACKS)) {
      newUnit.isVeteran = true;
    }

    gameState.units.push(newUnit);
  }

  // Create a new building
  private createBuilding(city: City, buildingType: string): void {
    city.buildings.push({
      type: buildingType as any,
      completedTurn: 0 // Would be set to current turn
    });

    // Notify about building completion
    if (this.onBuildingCompleted) {
      this.onBuildingCompleted(city, buildingType, false);
    }
  }

  // Create a new wonder
  private createWonder(city: City, wonderType: string): void {
    // For now, add wonders to the buildings array with a special prefix
    // In a full implementation, wonders might have their own system
    city.buildings.push({
      type: ('wonder_' + wonderType) as any,
      completedTurn: 0 // Would be set to current turn
    });

    // Notify about wonder completion
    if (this.onBuildingCompleted) {
      this.onBuildingCompleted(city, wonderType, true);
    }
  }

  // Update player resources (gold, science, culture) using the TaxSystem
  private updatePlayerResources(gameState: GameState): void {
    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayer);
    if (!currentPlayer) return;

    // Barbarians have no economy; skip all resource processing.
    if (currentPlayer.isBarbarian) return;

    // Calculate empire-wide income using proper Civ-1 tax mechanics
    const summary = TaxSystem.calculatePlayerTaxSummary(currentPlayer, gameState);

    // Apply net gold (income minus maintenance and unit support)
    currentPlayer.gold = Math.max(0, currentPlayer.gold + summary.netGoldIncome);

    // Culture from temples (keep simple flat calculation)
    const playerCities = gameState.cities.filter(c => c.playerId === currentPlayer.id);
    const cultureIncome = playerCities.reduce((sum, city) => {
      let culture = 1;
      if (city.buildings.some(b => b.type === BuildingType.TEMPLE)) culture += 2;
      return sum + culture;
    }, 0);
    currentPlayer.culture += cultureIncome;

    // Science accumulation
    const scienceIncome = summary.scienceIncome;
    if (scienceIncome > 0) {
      if (currentPlayer.currentResearch) {
        // Safety net: research can be obtained from huts/diplomacy outside this flow.
        if (currentPlayer.technologies.includes(currentPlayer.currentResearch)) {
          currentPlayer.currentResearch = undefined;
          currentPlayer.currentResearchProgress = 0;
          return;
        }
        currentPlayer.currentResearchProgress = (currentPlayer.currentResearchProgress || 0) + scienceIncome;

        // Check if research is complete (human players pay the difficulty research cost penalty)
        const cityCount = playerCities.length;
        const knownCount = currentPlayer.technologies.length;
        const researchMultiplier = currentPlayer.isHuman
          ? getDifficultyParams(gameState.difficulty ?? 'chieftain').researchCostMultiplier
          : 1.0;
        const researchCost = getResearchCost(currentPlayer.currentResearch, knownCount, cityCount, researchMultiplier);
        if (currentPlayer.currentResearchProgress >= researchCost) {
          // Award the technology immediately (do not defer to event handler,
          // because getGameState() returns a shallow copy and event clearing
          // via reassignment would not propagate back to the real game state)
          const completedTech = currentPlayer.currentResearch;
          if (!currentPlayer.technologies.includes(completedTech)) {
            currentPlayer.technologies.push(completedTech);
          }
          currentPlayer.currentResearch = undefined;
          currentPlayer.currentResearchProgress = 0;

          // Push event as a UI notification only (tech is already awarded above)
          gameState.events = gameState.events || [];
          gameState.events.push({
            type: 'technologyCompleted',
            playerId: currentPlayer.id,
            technologyType: completedTech,
            player: currentPlayer
          });
        }
      } else {
        currentPlayer.science += scienceIncome;
      }
    }
  }

  // Calculate gold income from a city (kept for backward-compat callers; now delegates to TaxSystem)
  private calculateCityGoldIncome(city: City): number {
    // Legacy – not called by processTurn any more but kept in case anything else references it
    return city.population;
  }

  // Calculate science income from a city (kept for backward-compat callers)
  private calculateCityScienceIncome(city: City): number {
    return Math.floor(city.population / 2);
  }

  // ── Happiness system ───────────────────────────────────────────────────────

  /**
   * Compute and persist happiness state for a single city, then update the
   * city's consecutive disorder counter.
   */
  private processCityHappiness(city: City, player: any, gameState: GameState): void {
    const result = HappinessSystem.calculateCityHappiness(city, player, gameState);

    city.happyCitizens    = result.happyCitizens;
    city.unhappyCitizens  = result.unhappyCitizens;
    city.contentCitizens  = result.contentCitizens;
    city.inDisorder       = result.inDisorder;

    if (result.inDisorder) {
      city.disorderTurns = (city.disorderTurns ?? 0) + 1;
    } else {
      city.disorderTurns = 0;
    }
  }

  /**
   * After all cities have been processed, check if the current player's
   * government should collapse due to sustained civil disorder.
   *
   * In Civ1, Republic and Democracy (governments with revolutionRisk: true)
   * fall into Anarchy when any city has been in disorder for 2+ turns.
   */
  private checkGovernmentDisorderCollapse(gameState: GameState): void {
    const currentPlayerId = gameState.currentPlayer;
    const player = gameState.players.find(p => p.id === currentPlayerId);
    if (!player || player.isBarbarian) return;

    // Already in Anarchy — nothing to collapse
    if (player.government === GovernmentType.ANARCHY) return;

    const gov = GOVERNMENTS[player.government];
    if (!gov.restrictions.revolutionRisk) return;

    // Find any city that has been in disorder for 2+ consecutive turns
    const playerCities = gameState.cities.filter(c => c.playerId === currentPlayerId);
    const collapseCity = playerCities.find(c => (c.disorderTurns ?? 0) >= 2);
    if (!collapseCity) return;

    // Push a game event so main.ts can show the disorder-collapse popup
    gameState.events = gameState.events ?? [];
    gameState.events.push({
      type: 'governmentCollapsed',
      playerId: currentPlayerId,
      cityId: collapseCity.id,
      reason: 'disorder',
      player,
    });

    // Invoke the callback so Game.ts can trigger the actual revolution
    this.onGovernmentCollapsed?.(currentPlayerId);
  }

  // Process fortification progression for current player's units
  private processFortificationProgression(gameState: GameState): void {
    const currentPlayer = gameState.currentPlayer;
    
    gameState.units
      .filter(unit => unit.playerId === currentPlayer)
      .forEach(unit => {
        // Only process units that are in the process of fortifying
        if (unit.fortifying && unit.fortificationTurns === 1) {
          // Complete the 2-turn fortification process
          unit.fortified = true;
          unit.fortifying = false;
          unit.fortificationTurns = 2;
        }
      });
  }

  private processMineBuilding(gameState: GameState): void {
    const currentPlayer = gameState.currentPlayer;
    
    gameState.units
      .filter(unit => unit.playerId === currentPlayer && unit.buildingMine)
      .forEach(unit => {
        // Safely increment regardless of whether mineBuildingTurns was initialised
        unit.mineBuildingTurns = (unit.mineBuildingTurns ?? 0) + 1;
        
        const tile = gameState.worldMap[unit.position.y]?.[unit.position.x];
        const requiredTurns = tile ? this.getMineBuildingTurns(tile.terrain) : 3;
        
        if (unit.mineBuildingTurns >= requiredTurns) {
          if (tile) {
            // Check if mine already exists (in case of race condition)
            const hasMine = tile.improvements?.some(imp => imp.type === ImprovementType.MINE);
            if (!hasMine) {
              // Add mine improvement, removing any irrigation first (mutually exclusive)
              if (!tile.improvements) {
                tile.improvements = [];
              }
              tile.improvements = tile.improvements.filter(imp => imp.type !== ImprovementType.IRRIGATION);
              tile.improvements.push({
                type: ImprovementType.MINE,
                completedTurn: gameState.turn
              });
              
              // Notify game layer so it can emit terrainImproved
              this.onTerrainImproved?.(unit.position);
            }
          }
          
          // Reset mine building state
          unit.buildingMine = false;
          unit.mineBuildingTurns = 0;
        }
      });
  }

  private processIrrigationBuilding(gameState: GameState): void {
    const currentPlayer = gameState.currentPlayer;

    gameState.units
      .filter(unit => unit.playerId === currentPlayer && unit.buildingIrrigation)
      .forEach(unit => {
        unit.irrigationBuildingTurns = (unit.irrigationBuildingTurns ?? 0) + 1;

        if (unit.irrigationBuildingTurns >= 2) {
          const tile = gameState.worldMap[unit.position.y]?.[unit.position.x];
          if (tile) {
            const hasIrrigation = tile.improvements?.some(imp => imp.type === ImprovementType.IRRIGATION);
            if (!hasIrrigation) {
              if (!tile.improvements) {
                tile.improvements = [];
              }
              // Mine and irrigation are mutually exclusive
              tile.improvements = tile.improvements.filter(imp => imp.type !== ImprovementType.MINE);
              tile.improvements.push({
                type: ImprovementType.IRRIGATION,
                completedTurn: gameState.turn
              });
              this.onTerrainImproved?.(unit.position);
            }
          }

          unit.buildingIrrigation = false;
          unit.irrigationBuildingTurns = 0;
        }
      });
  }

  private processRoadBuilding(gameState: GameState): void {
    const currentPlayer = gameState.currentPlayer;
    
    gameState.units
      .filter(unit => unit.playerId === currentPlayer && unit.buildingRoad)
      .forEach(unit => {
        // Safely increment regardless of whether roadBuildingTurns was initialised
        unit.roadBuildingTurns = (unit.roadBuildingTurns ?? 0) + 1;
        
        const tile = gameState.worldMap[unit.position.y]?.[unit.position.x];
        const player = gameState.players.find(p => p.id === unit.playerId);
        const hasRailroadTech = player?.technologies.includes(TechnologyType.RAILROAD) ?? false;
        const requiredTurns = tile ? this.getRoadBuildingTurns(tile.terrain, hasRailroadTech) : 2;
        
        if (unit.roadBuildingTurns >= requiredTurns) {
          if (tile) {
              const hasRoad = tile.improvements?.some(imp => imp.type === ImprovementType.ROAD);
              const hasRailroad = tile.improvements?.some(imp => imp.type === ImprovementType.RAILROAD);
              
              if (!hasRailroad) {
                if (!tile.improvements) {
                  tile.improvements = [];
                }
                
                if (hasRoad) {
                  // Upgrade to railroad
                  tile.improvements = tile.improvements.filter(imp => imp.type !== ImprovementType.ROAD);
                  tile.improvements.push({
                    type: ImprovementType.RAILROAD,
                    completedTurn: gameState.turn
                  });
                } else {
                  // Add road
                  tile.improvements.push({
                    type: ImprovementType.ROAD,
                    completedTurn: gameState.turn
                  });
                }
              this.onTerrainImproved?.(unit.position);
            }
          }
          
          // Reset road building state
          unit.buildingRoad = false;
          unit.roadBuildingTurns = 0;
        }
      });
  }

  /** Returns the number of turns required to build a road on the given terrain.
   * With Railroad technology all terrain costs just 1 turn.
   * Without it: 2 turns on easy terrain, 3 on difficult terrain.
   */
  private getRoadBuildingTurns(terrain: TerrainType, hasRailroadTech: boolean = false): number {
    if (hasRailroadTech) return 1;
    switch (terrain) {
      case TerrainType.GRASSLAND:
      case TerrainType.DESERT:
      case TerrainType.PLAINS:
        return 2;
      case TerrainType.FOREST:
      case TerrainType.JUNGLE:
      case TerrainType.HILLS:
      case TerrainType.MOUNTAINS:
      case TerrainType.RIVER:
        return 3;
      default:
        return 2;
    }
  }

  /** Returns the number of turns required to build a mine on the given terrain. */
  private getMineBuildingTurns(terrain: TerrainType): number {
    switch (terrain) {
      case TerrainType.GRASSLAND:
      case TerrainType.PLAINS:
        return 3;
      case TerrainType.DESERT:
        return 4;
      case TerrainType.HILLS:
        return 4;
      case TerrainType.FOREST:
        return 4;
      case TerrainType.MOUNTAINS:
        return 5;
      case TerrainType.JUNGLE:
        return 5;
      case TerrainType.RIVER:
        return 3;
      default:
        return 3;
    }
  }

  /**
   * Decrement the current player's revolution counter by one turn.
   * When it reaches 0 the flag stays at 0 – Game.ts will detect that and
   * either prompt the human or call AI government selection.
   */
  private decrementRevolution(gameState: GameState): void {
    const player = gameState.players.find((p) => p.id === gameState.currentPlayer);
    if (!player || player.isBarbarian || player.government !== GovernmentType.ANARCHY) return;
    if (player.revolutionTurns !== undefined && player.revolutionTurns > 0) {
      player.revolutionTurns--;
    }
  }

  // Move to next player
  private nextPlayer(gameState: GameState): void {
    const currentIndex = gameState.players.findIndex(p => p.id === gameState.currentPlayer);
    let nextIndex = (currentIndex + 1) % gameState.players.length;
    
    // Skip defeated players
    let attempts = 0;
    while (gameState.players[nextIndex].defeated && attempts < gameState.players.length) {
      nextIndex = (nextIndex + 1) % gameState.players.length;
      attempts++;
    }
    
    // If all players are defeated except current (shouldn't happen), stay with current
    if (attempts >= gameState.players.length) {
      console.warn('All players except current are defeated - this should not happen');
      return;
    }
    
    gameState.currentPlayer = gameState.players[nextIndex].id;
    gameState.currentPlayerIsHuman = gameState.players[nextIndex].isHuman;
  }
}
