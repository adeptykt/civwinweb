# CivWin - Civilization-like Game

A browser-based strategy game inspired by Civilization 1, built with Vite, TypeScript, and HTML5 Canvas.

## Features

- **Top-down tile-based world view** - Navigate through a procedurally generated world
- **Turn-based gameplay** - Classic Civilization-style turn management
- **Multiple terrain types** - Grassland, plains, desert, forest, hills, mountains, ocean, and rivers
- **Resource management** - Find and utilize wheat, gold, iron, horses, and fish
- **Unit system** - Control settlers, warriors, scouts, archers, and more
- **City building** - Found cities and manage their growth and production
- **Terrain improvements** - Build roads, irrigation, and mines with settlers
- **Modern UI** - Clean, responsive interface built for the web

## Game Controls

### Mouse Controls
- **Left Click**: Select units or tiles
- **Right Click**: Move selected unit to target location
- **Mouse Wheel**: Zoom in/out
- **Drag**: Pan around the map
- **City Minimap Click**: Select/deselect tiles to work in city view
- **City Minimap Double-Click**: Reset tile selection and auto-select optimal tiles (click in black area outside working tiles)

### Keyboard Controls
- **Arrow Keys**: Pan around the map
- **Spacebar**: End turn
- **B**: Build city (with settler selected)
- **R**: Build road (with settler selected) - Takes 1-2 turns depending on terrain
- **I**: Build irrigation (with settler selected)
- **N**: Build mine (with settler selected)
- **F**: Build fortress (with settler selected) or Fortify unit (with other units)
- **P**: Pause/unpause game
- **Escape**: Clear selections
- **+/-**: Zoom in/out

## Getting Started

### Prerequisites
- Node.js (v20.19.0 or higher)
- npm

### Installation

1. Clone the repository or download the source code
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the displayed local URL (typically `http://localhost:5173`)

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
src/
├── game/           # Core game logic
│   ├── Game.ts            # Main game class
│   ├── MapGenerator.ts    # World map generation
│   └── TurnManager.ts     # Turn processing logic
├── renderer/       # Rendering and graphics
│   ├── Renderer.ts        # Core rendering system
│   └── GameRenderer.ts    # Game-specific rendering
├── types/          # TypeScript type definitions
│   └── game.ts            # Game-related types
├── utils/          # Utility functions
│   └── InputHandler.ts    # User input handling
├── assets/         # Game assets (sprites, sounds)
└── main.ts         # Application entry point
```

## Game Mechanics

### Units
- **Settlers**: Found new cities (1 movement point)
- **Militia**: Basic military unit (1 movement point)
- **Phalanx**: Standard defensive unit (1 movement point)
- **Legion**: Roman military unit (1 movement point)
- **Cavalry**: Fast mounted unit (2 movement points)
- **Chariot**: Fast attack unit (2 movement points)
- **Catapult**: Siege weapon (1 movement point)
- **Knights**: Medieval mounted unit (2 movement points)
- **Musketeers**: Gunpowder infantry (1 movement point)
- **Cannon**: Gunpowder siege weapon (1 movement point)
- **Riflemen**: Industrial infantry (1 movement point)
- **Artillery**: Advanced siege weapon (2 movement points)
- **Armor**: Modern tank unit (3 movement points)
- **Mech. Inf.**: Mechanized infantry (3 movement points)

### Terrain Types
- **Grassland**: Basic fertile land, good for cities
- **Plains**: Fertile land, suitable for roads and irrigation
- **Desert**: Harsh terrain, may contain gold
- **Forest**: Provides resources but blocks movement
- **Hills**: Elevated terrain, good for mining
- **Mountains**: Impassable terrain, rich in gold
- **Ocean**: Water terrain, may contain fish
- **River**: Fresh water, provides fish resources

### Terrain Improvements
- **Roads**: Connect cities and reduce movement costs (1/3 movement between connected road tiles)
  - **Construction Time**: 1 turn on grassland, plains, desert; 2 turns on hills, mountains, forest, rivers
  - **Requirements**: Bridge Building technology needed for roads over rivers
  - **Visual Indicator**: Units building roads show "R" symbol
- **Irrigation**: Increases food production (+1 food)
  - **Requirements**: Must be adjacent to water source (river, ocean, or irrigated tile)
  - **Valid Terrain**: Desert, grassland, hills, plains, rivers
- **Mines**: Increase production output
  - **Desert**: +1 production
  - **Hills**: +3 production  
  - **Mountains**: +1 production
- **Fortress**: Military defensive structure
  - **Requirements**: Construction technology, only Settlers can build
  - **Effects**: Doubles defensive strength of defending unit
  - **Restrictions**: Cannot be built in city squares, only one unit defends at a time
  - **Valid Terrain**: All land terrain except city squares

### Resources
- **Wheat**: Food production bonus
- **Gold**: Economic resource
- **Iron**: Military production bonus
- **Horses**: Cavalry unit requirement
- **Fish**: Food from water sources

## Development

This project uses:
- **Vite** for fast development and building
- **TypeScript** for type safety
- **HTML5 Canvas** for rendering
- **ES6+ modules** for clean architecture

### Adding New Features

1. Game logic goes in `src/game/`
2. Rendering code goes in `src/renderer/`
3. Type definitions go in `src/types/`
4. Utility functions go in `src/utils/`

### Code Style Guidelines

- Use TypeScript interfaces for type definitions
- Prefer functional programming patterns
- Keep functions small and focused
- Use modern ES6+ features
- Separate game logic from rendering code

## Future Enhancements

- Multiplayer support
- Technology tree
- Diplomacy system
- Combat system
- Wonder construction
- Advanced AI
- Sound effects and music
- Mobile touch controls
- Save/load functionality

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Enhanced City Dialog

The city dialog now features a detailed Civilization 1-style interface with:

### Visual Design
- **Pastel civilization color backgrounds** - Each civilization's cities have subtle color-themed backgrounds
- **Resource icons** - Visual representation with wheat (🌾), shields (🛡️), and trade arrows (💱)
- **Surplus/deficit indicators** - Color-coded displays showing positive (green), negative (red), or neutral (gray) resource flow

### City Information Display
- **Population breakdown** - Visual representation of population allocation with worker icons
- **Detailed resource calculations** - Enhanced food, production, and trade calculations
- **Trade breakdown** - Split into:
  - Luxuries (💎) - Improves happiness
  - Tax (🪙) - Generates gold income  
  - Science (💡) - Contributes to research

### Interactive Features
- **City renaming** - Click "Rename" to change city names
- **Production management** - Change what the city is building
- **Visual city radius** - See the tiles your city works
- **Unit management** - View units stationed in the city
- **Tile selection** - Click on tiles in the city minimap to manually select which tiles to work
- **Auto-selection reset** - Double-click on the black area outside the working tiles to clear manual selections and auto-select optimal tiles based on food and production priority

The dialog automatically adapts to show each civilization's unique visual theme while maintaining the classic Civilization 1 aesthetic.



### References
- Technology Advances: https://civfanatics.com/content/civ1/refcharts/civ1techchart.htm#7.5
- Military Units: https://civfanatics.com/content/civ1/refcharts/civ1indchart.htm
- Civs info: https://civfanatics.com/civ1/cia/
- Tile Improvements: https://civilization.fandom.com/wiki/Category:Improvements_(Civ1)
- Wonders: https://civfanatics.com/content/civ1/refcharts/civ1wdrchart.htm
- City improvements:
  - https://civfanatics.com/content/civ1/refcharts/civ1impchart.htm
  - https://civilization.fandom.com/wiki/List_of_buildings_in_Civ1
  - Wonders: https://civilization.fandom.com/wiki/List_of_wonders_in_Civ1
- Tiles: https://civilization.fandom.com/wiki/Terrain_(Civ1)

- Images: https://forums.civfanatics.com/threads/map-pic-and-pal-formats-figured-out-almost.478234/
- Images 2: https://forums.civfanatics.com/threads/jcived-a-toolbox-for-civilization.486470/#post-12167471
