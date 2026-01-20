# FlatWorld Simulator

A web-based procedural world generation and simulation system with dynamic water flow, terrain evolution, and an interactive game clock with seasonal day/night cycles.

## Architecture

The simulation uses a **modular systems architecture** where each natural system (hydrology, temperature, moisture, etc.) is implemented as an independent module. This design enables:
- **Parallel development**: Multiple developers can work on different systems simultaneously
- **Easy testing**: Each system can be tested in isolation
- **Clear separation of concerns**: Each system has a single, well-defined responsibility
- **Simple integration**: New systems can be added without modifying existing code

### System Modules

All simulation systems are located in `server/systems/`:

- **`SimulationEngine.ts`** - Orchestrates all systems in the correct execution order
- **`HydrologySystem.ts`** - River flow, erosion, and water dynamics
- **`TemperatureSystem.ts`** - Temperature calculations (latitude, altitude, seasonal)
- **`MoistureSystem.ts`** - Ground moisture propagation from water sources
- **`EvaporationSystem.ts`** - Water evaporation and evapotranspiration
- **`HumiditySystem.ts`** - Air humidity diffusion and saturation
- **`CondensationSystem.ts`** - Air-to-ground moisture transfer
- **`WeatherSystem.ts`** - Atmospheric pressure and wind generation
- **`WindTransportSystem.ts`** - Wind-driven humidity and heat transport
- **`CloudSystem.ts`** - Cloud formation and advection
- **`PrecipitationSystem.ts`** - Rainfall and ground wetness effects
- **`GridHelper.ts`** - Shared utilities for grid operations with world wrapping

Each system implements the `ISimulationSystem` interface with a single `update(terrain, gameTime)` method.

## Project Status

### Implemented Features
- **Terrain Generation**: Wrapping world grid with Perlin noise-based height generation
- **Hydrology System**: 
  - Random springs generation
  - Water flow simulation with river tracking
  - Water accumulation and land erosion
  - River merging when streams meet
  - Named river system with unique river tracking
- **Moisture System**: 
  - Moisture propagation from water sources
  - Altitude-based moisture modifiers
  - Evaporation and diminishing returns mechanics
- **Time System**: 
  - Complete time tracking with years, months (30 days each), days, hours, and minutes
  - Each server tick = 1 hour of in-game time
  - Seasonal day/night cycles with month-specific daylight hours (8-16 hours)
  - Day starts at 6 AM and lasts for the month's daylight hours
- **Game Clock**: 
  - Interactive animated analog clock with hour and minute hands
  - Smooth minute hand animation synchronized with server ticks
  - Digital time display showing hour:minute format
  - Date display with month name, day, and year
  - Day/night indicator with sun/moon icons and status badge
  - Daylight hours information
- **Temperature System**:
  - Temperature calculation based on altitude (lapse rate: -6°C per 1000m)
  - Latitude-dependent base temperature (28°C at equator, -12°C at poles)
  - Seasonal variation with reversed seasons between hemispheres (north/south poles)
  - Precomputed seasonal factor for performance (single calculation per tick)
  - Realistic temperature ranges: 2°C seasonal amplitude at equator, 15°C at poles
  - Scales to large maps (90k cells per update cycle)
- **Weather System**:
  - Atmospheric pressure calculated from altitude, temperature, and humidity
  - Wind generation from pressure gradients (flows high → low pressure)
  - Wind speed and direction stored per cell
  - Configurable max wind speed and smoothing factors
- **Wind Transport System**:
  - Wind-based humidity advection
  - Heat transport between cells
- **Cloud System**:
  - Cloud formation from excess humidity
  - Cloud advection with wind and altitude-based saturation
- **Precipitation System**:
  - Rainfall from dense clouds
  - Ground wetness tracking and moisture absorption
  - Cooling effects during precipitation
- **Viewport System**:
  - Logarithmic zoom slider (20x20 to 100x100 cells visible)
  - Click-drag panning with world wrapping support
  - Optimized minimap with 10-minute terrain cache
  - Real-time viewport indicator updates during navigation
- **Visualization Modes**:
  - Default, Heightmap, Moisture, Temperature, Humidity
  - **Wind mode**: Color-coded wind speed with directional arrows
  - Cell info panel shows wind speed (m/s) and direction (degrees)

### Known Issues
- River visualization could be enhanced with better stream tracking

### Next Steps (Phase 2 Remaining)

**Weather System (remaining):**
- Snow accumulation and melting

**Weather Visualization (remaining):**
- Pressure map color layer
- Cloud overlay visualization
- Precipitation animation

**Future Phases:**
- Phase 3: Ecology (grass, trees, mushrooms)
- Phase 4: Animals (rabbits, foxes, wolves, bears)
- Phase 5: Humans and civilization

### Development Guide

To add a new simulation system:

1. Create `server/systems/YourSystem.ts` implementing `ISimulationSystem`
2. Add system to `SimulationEngine` constructor
3. Add system to `SimulationEngine.update()` in the appropriate order
4. Add configuration to `server/config.ts` if needed

See `REFACTORING_SUMMARY.md` for detailed architecture documentation.
