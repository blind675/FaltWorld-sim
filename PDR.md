# FlatWorld: Product Design & Requirements Document (PDR)

**Version:** 1.0  
**Date:** January 2026  
**Status:** Active Development

---

## 1. Executive Summary

FlatWorld is a persistent, procedurally-generated world simulation that runs continuously on a server, independent of user presence. It models terrain, hydrology, climate (temperature, moisture, humidity), and will progressively introduce weather systems, ecology (plants, animals), and eventually human civilization with crafting and survival mechanics.

The simulation operates on a fixed tick cycle (5-minute intervals via cron), computing state changes based purely on current world state with no historical tracking. Clients connect to observe the world through a viewport-based interface with minimap navigation, receiving periodic updates as the world evolves.

**Core Philosophy:** Simplicity and performance over feature complexity. Each system should impose minimal computational overhead while creating emergent, realistic behaviors through interaction.

---

## 2. Product Vision & Goals

### 2.1 Vision Statement
Create an ever-evolving procedural world that simulates natural systems with sufficient depth to support emergent ecosystems and eventually human civilization, observable by any number of clients without affecting simulation state.

### 2.2 Primary Goals
- **Persistence:** World runs 24/7 via server cron, independent of client connections
- **Realism:** Natural systems (water, weather, ecology) produce emergent, believable behaviors
- **Performance:** Maintain smooth simulation at scale with minimal server overhead per tick
- **Observability:** Clients can explore and visualize world state through intuitive interfaces
- **Extensibility:** Architecture supports progressive feature additions without major refactoring

### 2.3 Non-Goals (Current Scope)
- Player agency or world manipulation (observation only)
- Real-time multiplayer interactions
- Historical playback or time-travel features
- Multiple simultaneous worlds (single canonical world only)
- Distributed simulation or horizontal scaling (vertical scaling acceptable)

---

## 3. User Personas & Use Cases

### 3.1 Primary Persona: Simulation Observer
**Profile:** Interested in watching complex systems evolve over time  
**Goals:**
- Explore different regions of the world
- Observe weather patterns, river formation, seasonal changes
- Watch ecosystems develop and interact

**Key Activities:**
- Open client and view current world state
- Pan/zoom through viewport to explore regions
- Check back periodically to see how areas have changed
- Use minimap for navigation and world overview

### 3.2 Secondary Persona: Researcher/Developer
**Profile:** Testing simulation parameters or studying emergent behaviors  
**Goals:**
- Configure world generation and system parameters
- Observe how parameter changes affect long-term world state
- Validate system behaviors and edge cases

**Key Activities:**
- Modify server configuration files
- Regenerate world with different seeds/parameters
- Monitor system performance and bottlenecks
- Document emergent behaviors

---

## 4. System Architecture Overview

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                     │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │   Viewport   │  │   Minimap   │  │  Game Clock  │  │
│  │  (3x3-100x100)│  │ (Low-res)   │  │   Display    │  │
│  └──────────────┘  └─────────────┘  └──────────────┘  │
│         │                  │                 │          │
│         └──────────────────┴─────────────────┘          │
│                          │                              │
│                    HTTP Polling                         │
│                   (every 5 minutes)                     │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│                     SERVER (Node.js)                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │           World Simulation Engine               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │   │
│  │  │ Terrain  │  │ Hydrology│  │ Temperature  │  │   │
│  │  └──────────┘  └──────────┘  └──────────────┘  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │   │
│  │  │ Moisture │  │ Humidity │  │   Weather    │  │   │
│  │  └──────────┘  └──────────┘  └──────────────┘  │   │
│  │                                                 │   │
│  │  (Future: Ecology, Animals, Humans)            │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│                   ┌──────┴──────┐                       │
│                   │  CRON JOB   │                       │
│                   │ (5 min tick)│                       │
│                   └─────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Key Architectural Decisions

**Single Canonical World**
- One persistent world state shared by all observers
- No per-user customization or parallel simulations
- Simplifies state management and resource allocation

**Stateless Simulation**
- Each tick computes new state from current state only
- No historical data tracking (reduces memory/storage)
- Current state is the complete truth

**Modular Systems Architecture** ✅ IMPLEMENTED
- Each natural system (hydrology, temperature, moisture, etc.) is an independent module
- All systems implement `ISimulationSystem` interface with `update(terrain, gameTime)` method
- `SimulationEngine` orchestrates system execution in correct order
- Systems are stateless (operate only on passed terrain data)
- Enables parallel development without merge conflicts
- Located in `server/systems/` directory

**Viewport-Based Client Model**
- Clients request only visible cells (3x3 to 100x100)
- Separate low-resolution minimap for navigation
- Reduces network payload and client rendering load

**Simple Polling Architecture**
- HTTP polling every 5 minutes aligned with tick rate
- No WebSockets/SSE needed (reduces server complexity)
- Acceptable 5-minute latency for observation use case

---

## 5. Current Implementation Status

### 5.1 Implemented Features ✅

#### Architecture & Code Organization
- **Modular systems architecture:** Independent simulation systems in `server/systems/`
- **System orchestration:** `SimulationEngine` manages execution order
- **Shared utilities:** `GridHelper` for world wrapping and neighbor calculations
- **Clear interfaces:** `ISimulationSystem` base interface for all systems
- **Reduced complexity:** Main storage file reduced from 847 → 163 lines

#### World Generation & Terrain
- **Wrapping world grid:** Seamless torus topology (no edges)
- **Perlin noise terrain:** Configurable noise scale, elevation ranges
- **Reproducible generation:** Seed-based for consistent worlds
- **Spring selection:** Elevated terrain springs with minimum spacing

#### Hydrology System (`server/systems/HydrologySystem.ts`)
- **Water flow simulation:** Gravity-based downhill flow
- **River formation:** Spring-seeded rivers with identity tracking
- **River merging:** Streams combine when intersecting
- **Water accumulation:** Depth tracking per cell
- **Erosion:** Water-based terrain erosion
- **Independent module:** 211 lines, fully self-contained

#### Moisture System (`server/systems/MoistureSystem.ts`)
- **Ground moisture diffusion:** Iterative propagation from water sources
- **Altitude modifiers:** Elevation affects moisture spread
- **Saturation limits:** Diminishing returns prevent over-saturation
- **Independent module:** 160 lines, fully self-contained

#### Humidity & Evaporation Systems
- **EvaporationSystem** (`server/systems/EvaporationSystem.ts`):
  - Temperature-dependent evaporation: Water → air humidity
  - Evapotranspiration: Land moisture contributes to air humidity
  - 93 lines, fully self-contained
- **HumiditySystem** (`server/systems/HumiditySystem.ts`):
  - Air humidity diffusion across grid
  - Temperature change adjustments
  - Altitude bias (humid air rises)
  - 117 lines, fully self-contained
- **CondensationSystem** (`server/systems/CondensationSystem.ts`):
  - Oversaturation condensation → ground moisture
  - Dew formation in cold conditions
  - 62 lines, fully self-contained

#### Weather System (`server/systems/WeatherSystem.ts`) ✅ IMPLEMENTED
- **Atmospheric pressure calculation:**
  - Pressure based on altitude, temperature, and humidity
  - Configurable base pressure and factor coefficients
- **Wind generation from pressure gradients:**
  - Wind flows from high to low pressure
  - Pressure gradient neighbors used for direction calculation
  - Wind speed capped at configurable maximum
  - Wind direction stored in degrees (0° = North, clockwise)
- **Wind smoothing:** Blends new wind with previous for stability
- **Independent module:** 113 lines, fully self-contained

#### Temperature System (`server/systems/TemperatureSystem.ts`)
- **Latitude-based base temperature:** Equator warm, poles cold
- **Altitude effects:** Higher elevation = cooler
- **Seasonal variation:** Month-specific temperature adjustments
- **Hemispheric seasons:** North/South hemisphere season reversal
- **Independent module:** 67 lines, fully self-contained

#### Time System
- **Game clock:** Years, months (30 days), days, hours, minutes
- **Tick = 1 hour:** 1 server tick advances 1 game hour
- **Seasonal day/night:** Month-specific daylight duration
- **Day starts at 6 AM:** Consistent daily cycle

#### Client UI
- **Game clock display:** Animated analog + digital time/date
- **Daylight indicator:** Current day/night status
- **Canvas terrain rendering:** Visual representation of world state
- **Enhanced minimap:** 
  - Full-world overview with viewport indicator
  - **Cached rendering:** Terrain re-renders every 10 minutes for performance
  - **Real-time viewport indicator:** Gold rectangle updates instantly during pan/zoom
  - **Color mode sync:** Re-renders when visualization color mode changes
- **Viewport System:**
  - **Logarithmic zoom:** Smooth zoom from 20x20 to 100x100 cells
  - **Pan controls:** Click-drag navigation with world wrapping
  - **Dynamic zoom slider:** Non-linear for consistent feel across range
- **Visualization Modes:**
  - Default terrain colors
  - Heightmap (blue-white-brown gradient)
  - Moisture (white-blue gradient)
  - Temperature (blue-cyan-green-yellow-red gradient)
  - Humidity (tan-blue gradient)
  - **Wind mode:** Background color by speed + directional arrows
- **Cell Information Panel:**
  - Coordinates, altitude, terrain type
  - Temperature, humidity, moisture values
  - **Wind speed (m/s) and direction (degrees)**

#### Performance Baseline
- **Tested at 300x300 and 500x500:** Smooth performance
- **1000x1000 feasible:** With documented optimization work
- **Performance guide:** Detailed bottleneck analysis and solutions

### 5.2 Configuration & Tuning
- Centralized moisture/humidity parameters
- World generation settings (noise, elevation ranges)
- Temperature model coefficients
- Spring generation rules

---

## 6. Detailed Feature Requirements

### 6.1 Client Viewport System (NEW - Priority for Current Phase)

#### 6.1.1 Viewport Specifications
**Zoom Levels:**
- Minimum zoom: 3x3 cells visible
- Maximum zoom: 100x100 cells visible
- Smooth interpolation between zoom levels

**Navigation:**
- Pan in any direction (WASD or click-drag)
- World wraps seamlessly at edges
- Viewport position persists across refreshes (session storage)

**Data Loading:**
- Client requests only cells within current viewport bounds
- Server returns chunked data for requested region
- 5-minute polling cycle for viewport updates

#### 6.1.2 API Endpoints

**GET /api/viewport**
```typescript
Query Parameters:
  - x: number (center X coordinate)
  - y: number (center Y coordinate)
  - width: number (3-100)
  - height: number (3-100)

Response:
  - cells: TerrainCell[] (only requested region)
  - timestamp: number (tick number)
  - gameTime: GameTime object
```

**GET /api/minimap**
```typescript
Query Parameters:
  - resolution: number (optional, default: 200)

Response:
  - cells: SimplifiedCell[] (downsampled grid)
  - worldSize: { width: number, height: number }
  - version: number (cache-busting)
  
SimplifiedCell:
  - x, y: coordinates
  - elevation: number (0-1 normalized)
  - biomeColor: string (future: biome-based)
  - hasWater: boolean
```

**Minimap Refresh Strategy:**
- Full minimap regenerates every 60 minutes (12 ticks)
- Uses low-resolution downsampling (e.g., 1000x1000 → 200x200)
- Client caches minimap, checks version number for updates
- Dramatically reduces data transfer vs full-detail minimap

#### 6.1.3 Client UI Components

**Main Viewport Canvas:**
- Renders cells with appropriate detail for zoom level
- Color-coded visualization layers (toggleable):
  - Elevation (grayscale heightmap)
  - Water depth (blue gradient)
  - Moisture (green-brown gradient)
  - Temperature (red-blue gradient)
  - Rivers (highlighted flow paths)
  - Humidity (future: cloud-like overlay)

**Minimap Component:**
- Fixed corner position (bottom-right default)
- Simplified terrain visualization
- Viewport indicator rectangle
- Click-to-center: clicking minimap centers main viewport

**Navigation Controls:**
- Zoom slider or +/- buttons
- Pan controls (arrow buttons or keyboard)
- "Reset to spawn" button
- Current coordinates display

**Performance Considerations:**
- Canvas rendering optimized for 100x100 max
- Viewport chunking prevents unnecessary data transfer
- Minimap uses simplified rendering (no per-cell details)

---

### 6.2 Weather System (NEXT MAJOR MILESTONE - Phase 2)

The weather system creates a closed-loop atmospheric cycle where temperature and humidity drive pressure, pressure creates wind, wind transports moisture/heat, and precipitation returns moisture to the ground.

#### 6.2.1 Atmospheric Pressure System

**Physics Model:**
- Pressure inversely related to temperature (hot air = low pressure)
- Humidity affects air density (moist air slightly lighter)
- Each cell calculates local pressure based on:
  ```
  pressure = base_pressure - (temperature_factor * temperature) 
             - (humidity_factor * air_humidity)
  ```

**Data Requirements:**
- New cell property: `atmosphericPressure: number`
- Pressure normalized to range (e.g., 950-1050 hPa equivalent)
- Updated each tick after temperature calculation

**Configuration Parameters:**
- `base_pressure`: baseline atmospheric pressure
- `temperature_factor`: sensitivity to temperature changes
- `humidity_factor`: sensitivity to moisture content

#### 6.2.2 Wind System

**Wind Generation:**
- Wind flows from high pressure → low pressure
- Wind vector calculated from pressure gradient:
  ```
  wind_direction = gradient(pressure_field)
  wind_speed = magnitude(pressure_gradient) * wind_coefficient
  ```

**Wind Effects:**
- **Humidity transport:** Moves air moisture between cells
  ```
  humidity_transfer = wind_speed * source_humidity * transport_rate
  ```
- **Heat transport:** Advects temperature (minor effect)
  ```
  temp_transfer = wind_speed * (source_temp - dest_temp) * heat_transport_rate
  ```

**Data Requirements:**
- New cell properties:
  - `windSpeed: number`
  - `windDirection: { x: number, y: number }` (vector)

**Wrapping Behavior:**
- Wind vectors respect world wrapping (torus topology)
- No special edge cases at world boundaries

**Configuration Parameters:**
- `wind_coefficient`: pressure gradient → wind speed conversion
- `humidity_transport_rate`: moisture transfer per wind unit
- `heat_transport_rate`: temperature advection rate
- `max_wind_speed`: cap for extreme pressure gradients

#### 6.2.3 Cloud System

**Cloud Formation:**
- Clouds form when air humidity exceeds saturation threshold
- Saturation threshold decreases with altitude (cooler air holds less moisture)
  ```
  saturation_threshold = base_saturation * (1 - altitude_factor * elevation)
  cloud_density = max(0, air_humidity - saturation_threshold)
  ```

**Cloud Dynamics:**
- Clouds move with wind (advected by wind vectors)
- Cloud density affects precipitation probability
- Clouds dissipate when humidity drops below threshold

**Data Requirements:**
- New cell property: `cloudDensity: number` (0-1 range)
- Clouds separate from air humidity (can drift away from source)

**Configuration Parameters:**
- `base_saturation`: humidity threshold at sea level
- `altitude_factor`: how much elevation reduces saturation point
- `cloud_dissipation_rate`: how quickly clouds evaporate

#### 6.2.4 Precipitation System

**Rain/Snow Determination:**
- Type depends on cell temperature:
  ```
  if (temperature < freezing_point) → snow
  else → rain
  ```

**Precipitation Trigger:**
- Occurs when cloud density exceeds precipitation threshold
- Amount based on cloud density and atmospheric conditions:
  ```
  precip_amount = (cloud_density - precip_threshold) * precip_rate
  ```

**Precipitation Effects:**
- **Adds ground moisture:** Direct moisture injection
  ```
  ground_moisture += precip_amount * absorption_rate
  ```
- **Adds water to cells:** Can form puddles/lakes if saturation exceeded
  ```
  if (ground_moisture > saturation) {
    water_depth += (ground_moisture - saturation)
  }
  ```
- **Reduces cloud density:** Precipitation removes moisture from clouds
  ```
  cloud_density -= precip_amount
  air_humidity -= precip_amount * humidity_reduction_factor
  ```
- **Cooling effect:** Evaporative cooling during precipitation
  ```
  temperature -= precip_amount * cooling_factor
  ```

**Snow Mechanics:**
- Snow accumulates as `snowDepth: number` on ground
- Melts when temperature rises above freezing:
  ```
  if (temperature > melting_point) {
    melt_amount = (temperature - melting_point) * melt_rate
    water_depth += melt_amount
    snowDepth -= melt_amount
  }
  ```
- Snow insulates ground (reduces temperature fluctuation)

**Data Requirements:**
- New cell properties:
  - `precipitationRate: number` (current rainfall/snowfall)
  - `snowDepth: number` (accumulated snow)

**Configuration Parameters:**
- `freezing_point`: temperature threshold for snow vs rain
- `precip_threshold`: cloud density required for precipitation
- `precip_rate`: cloud → precipitation conversion rate
- `absorption_rate`: how much precipitation soaks into ground
- `cooling_factor`: temperature drop per unit precipitation
- `melting_point`: temperature for snow melt
- `melt_rate`: snow → water conversion rate

#### 6.2.5 Closed-Loop Integration

**Tick Order for Weather Cycle:**
1. **Calculate Temperature** (existing: latitude, altitude, season)
2. **Calculate Atmospheric Pressure** (from temperature + humidity)
3. **Calculate Wind** (from pressure gradients)
4. **Transport Humidity/Heat** (wind advection)
5. **Form/Update Clouds** (from air humidity + saturation)
6. **Generate Precipitation** (from cloud density)
7. **Apply Precipitation Effects:**
   - Add ground moisture
   - Add water depth (if saturated)
   - Reduce cloud density
   - Reduce air humidity
   - Apply cooling
8. **Evaporation** (existing: water → air humidity, influenced by temperature)
9. **Humidity Diffusion** (existing: spread air moisture)

**Feedback Loops:**
- Evaporation → Humidity → Clouds → Precipitation → Ground Moisture → Evaporation
- Temperature → Pressure → Wind → Humidity Transport → Clouds → Precipitation → Cooling → Temperature
- Rivers provide constant water source → Evaporation → Weather patterns

#### 6.2.6 Visualization Requirements

**New Visualization Layers:**
- **Pressure Map:** Color gradient (blue=low, red=high)
- **Wind Vectors:** Arrows showing direction/speed
- **Cloud Cover:** Semi-transparent overlay (white, density-based opacity)
- **Precipitation:** Animated rain/snow particles or intensity overlay
- **Snow Cover:** White overlay with depth-based opacity

**UI Controls:**
- Layer toggles for each visualization
- Wind vector density slider (show every N cells)
- Animation toggle for precipitation effects

**Performance Notes:**
- Wind vectors only rendered for visible viewport
- Precipitation animation uses lightweight particles
- Cloud overlay uses simple alpha blending

---

### 6.3 Ecology System (Phase 3)

#### 6.3.1 Plants & Fungi

**Grass:**
- Grows in cells with adequate moisture + temperature
- Growth rate based on moisture, temperature, sunlight
- Spreads to adjacent cells probabilistically
- Dies in drought or extreme cold
- Data: `grassDensity: number` (0-1)

**Flowers:**
- Similar to grass but requires higher moisture
- Produces seeds for reproduction
- Attracts future pollinators (bees)
- Data: `flowerType: string | null`, `flowerDensity: number`

**Trees:**
- Multi-stage growth (sapling → mature → old)
- Requires sustained moisture and temperature range
- Produces fruit/nuts seasonally
- Spreads via seeds (wind/animal dispersal)
- Blocks sunlight for ground plants
- Data: `treeType: string | null`, `treeAge: number`, `treeHealth: number`

**Fruits, Nuts, Seeds:**
- Produced by mature trees seasonally
- Falls to ground and can sprout new trees
- Can be consumed by animals (future)
- Data: `fruitCount: number`, `seedCount: number`

**Mushrooms:**
- Grows in moist, shaded areas (under trees)
- Decomposes organic matter (future: dead animals/plants)
- Spreads via spores
- Data: `mushroomType: string | null`, `mushroomDensity: number`

**Growth Mechanics:**
- Each tick, plants evaluate growth conditions
- Moisture, temperature, sunlight determine growth rate
- Probabilistic spreading to adjacent cells
- Death/decay when conditions deteriorate

**Configuration Per Species:**
- `minMoisture`, `maxMoisture`: viable moisture range
- `minTemp`, `maxTemp`: viable temperature range
- `growthRate`: base growth speed
- `spreadProbability`: chance to colonize adjacent cell
- `sunlightRequirement`: full sun / partial / shade

#### 6.3.2 Future: Animals & Birds (Phase 4)

**Core Animal Systems:**
- Vision system (perceive nearby cells)
- Memory (remember food sources, threats)
- Goals (reproduce, survive, grow population)
- Hunger (energy depletion over time)
- Energy/tiredness (activity drains energy)
- Sleep cycle (rest to restore energy)
- Communication (signals to same species)

**Genetic Algorithms:**
- Each animal has genes affecting behavior
- Reproduction combines parent genes with mutation
- Natural selection favors adapted traits
- Over time, species evolve to fit environment

**Species Complexity Tiers:**
- Simple (rabbits): basic needs, simple behavior
- Medium (foxes): hunting, territory
- Complex (wolves, bears): pack dynamics, complex strategies

**No Implementation:** Insects, fish (out of scope)

#### 6.3.3 Future: Humans (Phase 5)

**Human-Specific Systems:**
- All animal systems but more complex
- Complex goal hierarchies (not just reproduction)
- Crafting recipes (combine items to create tools/structures)
- Item gathering mechanics
- Inventory system
- Social structures (groups, tribes)

**Items & Crafting:**
- Gathering resources from environment (wood, stone, plants)
- Crafting recipes: input items → output item
- Tools enable new gathering/crafting options
- Storage and inventory management

---

## 7. Data Model

### 7.1 Core TerrainCell Schema

```typescript
interface TerrainCell {
  // Location
  x: number;
  y: number;
  
  // Elevation
  altitude: number;           // Absolute elevation
  terrainHeight: number;      // Base terrain without water
  
  // Water
  waterHeight: number;        // Current water depth
  distanceFromWater: number;  // Nearest water source distance
  
  // Moisture
  baseMoisture: number;       // Intrinsic moisture
  addedMoisture: number;      // Diffused moisture
  totalMoisture: number;      // baseMoisture + addedMoisture
  
  // Climate
  temperature: number;        // Current temperature (°C)
  airHumidity: number;        // Atmospheric moisture
  
  // Weather (Phase 2)
  atmosphericPressure?: number;
  windSpeed?: number;
  windDirection?: { x: number; y: number };
  cloudDensity?: number;
  precipitationRate?: number;
  snowDepth?: number;
  
  // Terrain classification
  terrainType: string;        // 'land' | 'water' | 'mountain'
  
  // Hydrology
  riverIds: string[];         // IDs of rivers passing through
  isSpring: boolean;          // River source point
  
  // Ecology (Phase 3)
  grassDensity?: number;
  flowerType?: string;
  flowerDensity?: number;
  treeType?: string;
  treeAge?: number;
  treeHealth?: number;
  mushroomType?: string;
  mushroomDensity?: number;
}
```

### 7.2 Minimap Simplified Cell

```typescript
interface SimplifiedCell {
  x: number;
  y: number;
  elevation: number;        // Normalized 0-1
  biomeColor: string;       // Hex color for visualization
  hasWater: boolean;
}
```

### 7.3 Game Time Model

```typescript
interface GameTime {
  year: number;
  month: number;          // 1-12
  day: number;            // 1-30
  hour: number;           // 0-23
  minute: number;         // 0-59
  
  // Derived
  isDay: boolean;
  daylightHours: number;  // Month-specific
  season: string;         // 'spring' | 'summer' | 'fall' | 'winter'
}
```

---

## 8. API Specification

### 8.1 Current Endpoints

**GET /api/world**
- Returns: Full world state (all cells)
- Use case: Initial load or small grids
- Performance: Not suitable for large worlds

**GET /api/time**
- Returns: Current game time object
- Use case: Clock display updates

### 8.2 New Endpoints (Phase 2 - Viewport)

**GET /api/viewport**
```
Query: x, y, width, height
Returns: { cells: TerrainCell[], timestamp: number, gameTime: GameTime }
Performance: Only transfers visible cells
```

**GET /api/minimap**
```
Query: resolution (optional)
Returns: { cells: SimplifiedCell[], worldSize: {w, h}, version: number }
Caching: 60-minute refresh cycle
```

**GET /api/world-info**
```
Returns: { 
  worldSize: { width: number, height: number },
  currentTick: number,
  generationSeed: string
}
```

### 8.3 Future Endpoints

**GET /api/statistics** (observability)
```
Returns: {
  averageTemperature: number,
  totalRivers: number,
  landCoverage: number,
  waterCoverage: number,
  weatherStats: { ... }
}
```

---

## 9. Configuration & Tuning

### 9.1 World Generation Config

```typescript
{
  gridSize: { width: number, height: number },
  seed: string,
  noiseScale: number,
  elevationRange: { min: number, max: number },
  springCount: number,
  minSpringSpacing: number
}
```

### 9.2 Moisture/Humidity Config

```typescript
{
  moisture: {
    diffusionRate: number,
    altitudeModifier: number,
    saturationLimit: number
  },
  humidity: {
    evaporationRate: number,
    evapotranspirationRate: number,
    diffusionRate: number
  }
}
```

### 9.3 Temperature Config

```typescript
{
  baseTemperature: number,
  latitudeEffect: number,
  altitudeEffect: number,
  seasonalVariation: number
}
```

### 9.4 Weather Config (Phase 2)

```typescript
{
  pressure: {
    basePressure: number,
    temperatureFactor: number,
    humidityFactor: number
  },
  wind: {
    windCoefficient: number,
    maxWindSpeed: number,
    humidityTransportRate: number,
    heatTransportRate: number
  },
  clouds: {
    baseSaturation: number,
    altitudeFactor: number,
    dissipationRate: number
  },
  precipitation: {
    freezingPoint: number,
    precipThreshold: number,
    precipRate: number,
    absorptionRate: number,
    coolingFactor: number,
    meltingPoint: number,
    meltRate: number
  }
}
```

---

## 10. Performance Requirements

### 10.1 Server Performance Targets

**Tick Processing Time:**
- 300x300 grid: < 2 seconds per tick
- 500x500 grid: < 5 seconds per tick
- 1000x1000 grid: < 30 seconds per tick (with optimizations)

**Memory Usage:**
- 300x300: < 100 MB
- 500x500: < 300 MB
- 1000x1000: < 1.2 GB

**API Response Times:**
- Viewport request (100x100): < 500ms
- Minimap request: < 200ms (cached), < 2s (regeneration)
- Time request: < 50ms

### 10.2 Client Performance Targets

**Rendering:**
- 60 FPS at 100x100 viewport
- 30 FPS acceptable for complex weather animations
- Minimap renders at 30 FPS minimum

**Network:**
- Viewport payload: < 500 KB
- Minimap payload: < 100 KB
- Total page load: < 2 MB initial

### 10.3 Scalability Plan

**Current Bottlenecks (Documented):**
- Full-grid serialization for API responses
- Client canvas rendering for large grids
- Memory usage for 1M+ cell grids

**Optimization Roadmap:**
- ✅ HTTP compression (gzip/brotli)
- ✅ Viewport chunking (Phase 2)
- ✅ Low-res minimap (Phase 2)
- ⬜ Typed arrays for cell data
- ⬜ WebGL rendering for client
- ⬜ Multi-threading for simulation (worker threads)
- ⬜ Spatial indexing (quadtree) for lookups

---

## 11. Visualization & UI

### 11.1 Current UI Components

- Canvas-based terrain renderer
- Analog + digital game clock
- Daylight indicator
- Basic full-world minimap

### 11.2 Phase 2 UI (Viewport + Weather)

**Main Viewport:**
- Zoomable/pannable canvas (3x3 to 100x100)
- Layer toggles:
  - Elevation
  - Water
  - Moisture
  - Temperature
  - Rivers
  - Pressure (new)
  - Wind (new)
  - Clouds (new)
  - Precipitation (new)
- Coordinate display
- Zoom controls

**Enhanced Minimap:**
- Low-resolution world overview
- Viewport indicator rectangle
- Click-to-center navigation
- Refresh indicator (shows when minimap updates)

**Weather Overlays:**
- Pressure color gradient
- Wind vector field (arrows)
- Cloud layer (semi-transparent white)
- Precipitation animation (rain/snow particles)

**Performance Display (Dev Mode):**
- Current tick number
- Last tick duration
- FPS counter
- Memory usage

### 11.3 Phase 3+ UI (Ecology)

- Plant density overlays
- Animal position markers
- Population statistics panel

---

## 12. Project Roadmap

### Phase 1: Foundation ✅ COMPLETE
- Terrain generation with wrapping
- Hydrology and rivers
- Moisture and humidity systems
- Temperature modeling
- Game clock and time system
- Basic client rendering
- Performance baseline established

### Phase 2: Viewport & Weather (IN PROGRESS)

**Milestone 2.1: Viewport System** ✅ COMPLETE
- [x] Implement viewport API endpoints
- [x] Create low-res minimap generation
- [x] Build zoomable/pannable canvas (20x20 to 100x100 cells)
- [x] Add navigation controls (logarithmic zoom, pan)
- [x] Implement minimap caching strategy (10-minute refresh)

**Milestone 2.2: Weather System** 🔄 PARTIAL
- [x] Atmospheric pressure calculation
- [x] Wind generation from pressure gradients
- [x] Wind-based humidity/heat transport
- [x] Cloud formation and dynamics
- [x] Precipitation system (rain only)
- [x] Closed-loop integration testing

### Weather Observability

The `WeatherMetrics` module provides:
- Per-tick snapshots of all weather variables
- Trend analysis for feedback loop verification
- Periodic summary logging
- `/api/weather-stats` endpoint for debugging

Metrics tracked:
- Average temperature, humidity, pressure, wind speed
- Cloud coverage percentage
- Rain coverage percentage
- Ground wetness coverage
- Feedback loop health assessment

**Future Work - Snow & Movement:**
- Snow accumulation when temperature < freezing
- Snow melting mechanics
- Movement penalties for animals on:
  - Wet ground (ground_wetness > threshold)
  - Snowy terrain (future snow_depth property)
  - Muddy areas (high moisture + wetness)

**Milestone 2.3: Weather Visualization** 🔄 PARTIAL
- [ ] Pressure map layer
- [x] Wind vector rendering (directional arrows with intensity-based sizing)
- [ ] Cloud overlay
- [ ] Precipitation animation
- [ ] Snow accumulation display

### Phase 3: Ecology Foundation (6-12 months out)
- [ ] Grass growth and spreading
- [ ] Flower systems
- [ ] Tree lifecycle (sapling → mature → old)
- [ ] Fruit/nut/seed production
- [ ] Mushroom growth
- [ ] Plant visualization layers
- [ ] Ecology configuration system

### Phase 4: Animals & Birds (12-18 months out)
- [ ] Vision and perception systems
- [ ] Memory and goal systems
- [ ] Hunger and energy mechanics
- [ ] Sleep cycles
- [ ] Communication systems
- [ ] Genetic algorithm framework
- [ ] Species configuration (rabbits, foxes, wolves, bears)
- [ ] Animal visualization and tracking

### Phase 5: Humans & Civilization (18+ months out)
- [ ] Human-specific AI systems
- [ ] Complex goal hierarchies
- [ ] Item and inventory system
- [ ] Gathering mechanics
- [ ] Crafting recipes and system
- [ ] Social structures
- [ ] Human visualization and activity tracking

---

## 13. Success Metrics

### 13.1 Technical Metrics

**Server Health:**
- Tick completion rate: 100% (no missed ticks)
- Average tick duration: < 50% of tick interval (2.5 min for 5-min ticks)
- Memory stability: No leaks over 
