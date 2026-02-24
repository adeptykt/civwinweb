# CivWin Web – Improvement Backlog

Tracked issues and planned improvements identified during codebase review (February 2026).
Each item is marked with its status and category.

---

## 🔴 Performance

### P1 – Remove `console.log` / `console.debug` from hot paths
**Status:** ✅ Done  
**Files:** `src/renderer/Renderer.ts`, `src/main.ts`, `src/game/Game.ts`, `src/game/TurnManager.ts`  
**Problem:**  
- `Renderer.drawSprite` emits a `console.debug` on every single sprite blit – that fires hundreds of times per frame.  
- `CivWinApp.render()` emits a `console.debug` object with map dimensions on every render call.  
- `Game.moveUnit` and `TurnManager.processCityGrowth` emit `console.log` on each move / city tick.  
**Fix:** Remove or gate behind a `DebugSystem.isEnabled()` check so they only fire in explicit debug mode.

---

### P2 – Add render-pending guard to prevent `requestAnimationFrame` stacking
**Status:** ✅ Done  
**Files:** `src/main.ts`  
**Problem:**  
`requestRender()` unconditionally calls `requestAnimationFrame(() => this.render())`. When rapid events fire in quick succession (e.g. multiple AI moves, scroll + unit move), multiple frames are queued, causing redundant full re-renders.  
**Fix:** Add an `isRenderPending` boolean flag; skip scheduling if one is already in flight.

---

### P3 – Cache road/terrain connection analysis
**Status:** ✅ Done  
**Files:** `src/renderer/GameRenderer.ts`  
**Problem:**  
`analyzeConnections` and `analyzeRoadConnections` perform 8-neighbour map lookups for every visible tile on every render frame. Connections only change when an improvement is added, so recomputing them each frame is wasteful.  
**Fix:** Pre-compute a `Map<string, ConnectionPattern>` keyed by `"x,y"` when the world map is first cached. Expose an `invalidateConnectionCache()` method to call after any tile improvement is applied.

---

### P4 – Terrain layer offscreen canvas cache
**Status:** ✅ Done  
**Files:** `src/renderer/GameRenderer.ts`  
**Problem:**  
Terrain sprites never change during a session yet every `render()` call redraws all visible terrain tiles from scratch, including sprite lookups and canvas operations.  
**Fix:** Maintain an offscreen `HTMLCanvasElement` that represents the terrain layer at the current viewport. Only re-blit the full layer when the viewport scrolls by ≥1 tile, when zoom changes, or when a new map is loaded. In the common case (unit blinking, UI update) composite the cached layer in a single `drawImage` call.

---

### P5 – Optimise `VisibilitySystem.updateVisibilityForPlayer`
**Status:** ✅ Done  
**Files:** `src/game/VisibilitySystem.ts`  
**Problem:**  
On every unit move, the entire 80×50 tile grid is iterated to demote `VISIBLE → EXPLORED`, then iterated again to recalculate vision. For 8 AI players each making several moves per turn, this is up to `8 × moves × 8000` tile operations per turn.  
**Fix:** Keep a `Set<string>` of currently-visible tile keys per player. On recalculation, only touch tiles in that set plus the new vision radius, eliminating the full-map scan.

---

### P6 – Move AI processing off the main thread (Web Worker)
**Status:** 🔲 Pending  
**Files:** `src/game/AIPlayer.ts`, `src/game/Game.ts`  
**Problem:**  
All AI turn logic runs synchronously on the main thread. With 7 AI players and large unit stacks, this can lock the UI noticeably.  
**Fix:** Serialize the `GameState` snapshot and post it to a Web Worker. The worker computes all AI moves for the turn, posts back a list of `GameAction` commands, and the main thread applies them.

---

## 🟡 Architecture / Code Quality

### A1 – Split `main.ts` and `Game.ts` monoliths
**Status:** 🔲 Pending  
**Files:** `src/main.ts` (1 500 lines), `src/game/Game.ts` (2 454 lines)  
**Problem:** Both files handle multiple unrelated responsibilities. `main.ts` mixes event wiring, UI management, rendering coordination, and input handling. `Game.ts` mixes map generation, unit management, combat, research, diplomacy stubs, and turn logic.  
**Fix:** Extract into focused services – e.g. `EventCoordinator`, `UIManager`, `ResearchSystem`, `DiplomacySystem`.

---

### A2 – Populate the empty `src/game/ai/` directory
**Status:** 🔲 Pending  
**Files:** `src/game/AIPlayer.ts` (1 678 lines), `src/game/ai/`  
**Problem:** The sub-folder was scaffolded but never filled. All AI logic lives in a single giant class.  
**Fix:** Split strategies into separate modules: `CityPlacementStrategy.ts`, `MilitaryStrategy.ts`, `TechPriorityStrategy.ts`, `DiplomacyStrategy.ts`.

---

### A3 – Add A* pathfinding for units
**Status:** ✅ Done  
**Files:** `src/game/Game.ts` (comment at line 694)  
**Problem:** The `moveUnit` method notes "this would need pathfinding for proper implementation." AI units use Manhattan distance and can get stuck navigating around water or mountains. The "Show Unit Movement Paths" settings toggle exists but is unimplemented.  
**Fix:** Implement a generic A* in `src/utils/Pathfinder.ts`, parameterised by terrain movement costs. Use it for both AI navigation and for rendering the optional movement-path overlay.

---

### A4 – Implement context-menu unit movement
**Status:** ✅ Done  
**Files:** `src/main.ts` (line 375)  
**Problem:** `alert('Unit movement via menu coming soon!')` is still showing.  
**Fix:** Wire the tile context menu "Move Unit Here" action through the pathfinder (A3) to issue a queued multi-step move.

---

## 🟢 Missing Features

### F1 – Save / Load game state
**Status:** 🔲 Pending  
**Problem:** No serialization. Players lose all progress on a page refresh.  
**Fix:** JSON-serialize `GameState` to `localStorage` (auto-save each turn) and expose manual save-slot UI. For large states, compress with `CompressionStream`.

---

### F2 – Diplomacy system
**Status:** 🔲 Pending  
**Problem:** `CivilizationDefinitions` has AI aggression traits but no negotiation, peace treaty, or tribute logic exists.  
**Fix:** Implement a `DiplomacySystem` with relationship tracking, peace/war states, and tribute offers. Wire into the AI strategy system.

---

### F3 – Caravan / trade route mechanics
**Status:** 🔲 Pending  
**Problem:** `UnitType.CARAVAN` exists in definitions but establishing trade routes and receiving their gold/science bonuses is unimplemented.  
**Fix:** Add `TradeRouteSystem.ts` tracking active routes between cities, and apply bonuses in `TurnManager.processCities`.

---

### F4 – Win condition detection and victory screen
**Status:** 🔲 Pending  
**Problem:** Player elimination is detected but space-race, diplomatic, time-based, and score victory conditions are absent.  
**Fix:** Add a `VictorySystem.ts` that checks each end-of-turn for all Civ1 victory conditions and emits a `gameWon` event that triggers a victory modal.

---

### F5 – Expand test coverage
**Status:** 🔲 Pending  
**Problem:** Only 6 test files exist for ~10 000+ lines of game logic. `TurnManager`, `VisibilitySystem`, `AIPlayer`, and `ProductionManager` have no tests.  
**Fix:** Add unit tests for each system. Target ≥80 % branch coverage for core game logic.

---

## Legend
| Symbol | Meaning |
|--------|---------|
| ✅ Done | Implemented |
| 🔲 Pending | Not yet started |
| 🚧 In Progress | Currently being worked on |
