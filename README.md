# FlatWorld Simulator

A procedural world generation and simulation system with dynamic weather, terrain evolution, and an interactive game clock with seasonal day/night cycles.

## Project Structure

The project is split into two independently deployable applications:

```
/FlatWorld-sim
├── server/                 # Backend (Node.js/Express)
│   ├── schema.ts           # Database schema (Drizzle ORM)
│   ├── index.ts            # Express server entry point
│   ├── routes.ts           # API endpoints
│   ├── storage.ts          # World state management
│   ├── config.ts           # Configuration constants
│   ├── worldGenerator.ts   # Procedural terrain generation
│   ├── systems/            # Simulation systems
│   └── scripts/            # CLI scripts
├── frontend/               # Frontend (Next.js) - separate project
│   ├── src/app/            # Next.js App Router pages
│   ├── src/components/     # React components
│   ├── src/lib/            # Utilities and API client
│   └── package.json        # Frontend dependencies
├── package.json            # Backend dependencies
├── tsconfig.json           # TypeScript config (backend)
└── drizzle.config.ts       # Database config
```

## Architecture

### Backend (This Repository)

The simulation uses a **modular systems architecture** where each natural system is an independent module in `server/systems/`:

- **`SimulationEngine.ts`** - Orchestrates all systems in execution order
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
- **`GrassSystem.ts`** - Grass growth, dormancy, and spreading
- **`GridHelper.ts`** - Shared utilities for grid operations with world wrapping

Each system implements the `ISimulationSystem` interface with a single `update(terrain, gameTime)` method.

### Frontend (Separate Project)

Located in `frontend/`, the Next.js application connects to this backend via REST API. See `frontend/README.md` for setup instructions.

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
  - Moisture propagation from water sources with exponential distance decay
  - Altitude-based moisture modifiers (uphill penalty, downhill bonus)
  - Evaporation and diminishing returns mechanics
  - **Diffusion smoothing**: Multi-pass blur for organic, gradual transitions
  - Eliminates blocky patterns for realistic moisture spread
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
  - **Humidity-temperature interaction**:
    - Thermal moderation: High humidity reduces day/night temperature swings
    - Evaporative cooling: Low humidity causes daytime cooling
    - Heat retention: High humidity traps heat at night (greenhouse effect)
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
- **Grass System**:
  - Data-driven species definitions with temperature/moisture ranges
  - Seasonal dormancy, growth, and health tracking
  - Probabilistic spreading to neighboring cells
- **Viewport System**:
  - Logarithmic zoom slider (20x20 to 100x100 cells visible)
  - Click-drag panning with world wrapping support
  - Optimized minimap with 10-minute terrain cache
  - Real-time viewport indicator updates during navigation
- **Visualization Modes**:
  - Default, Heightmap, Moisture, Temperature, Humidity, Pressure
  - **Wind mode**: Color-coded wind speed with directional arrows
  - **Cloud overlay**: Density-based white cloud cover
  - **Precipitation overlay**: Animated rainfall visualization
  - Cell info panel shows wind speed (m/s) and direction (degrees)

### Known Issues
- River visualization could be enhanced with better stream tracking

### Next Steps (Phase 2 Remaining)

**Weather System (remaining):**
- Snow accumulation and melting

**Weather Visualization (remaining):**
- Snow accumulation display

**Future Phases:**
- Phase 3: Ecology (grass, trees, mushrooms)
- Phase 4: Animals (rabbits, foxes, wolves, bears)
- Phase 5: Humans and civilization

## Getting Started

### Backend Setup

```bash
# Install dependencies
npm install

# Start development server (port 5001)
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local

# Start development server (port 3000)
npm run dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start backend dev server |
| `npm run build` | Build backend for production |
| `npm run start` | Run production backend |
| `npm run regenerate-terrain` | Regenerate world terrain (CLI) |
| `npm run db:push` | Push schema to database |

### Environment Variables

**Backend:**
- `DATABASE_URL` - PostgreSQL connection string
- `FRONTEND_URL` - Frontend URL for CORS (production)

**Frontend** (`frontend/.env.local`):
- `NEXT_PUBLIC_API_URL` - Backend API URL (default: `http://localhost:5001`)

## Development Guide

### Adding a New Simulation System

1. Create `server/systems/YourSystem.ts` implementing `ISimulationSystem`
2. Add system to `SimulationEngine` constructor
3. Add system to `SimulationEngine.update()` in the appropriate order
4. Add configuration to `server/config.ts` if needed

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/terrain` | GET | Full terrain data |
| `/api/viewport` | GET | Viewport chunk (x, y, width, height) |
| `/api/minimap` | GET | Low-res minimap data |
| `/api/time` | GET | Current game time |
| `/api/config` | GET | Server configuration |
| `/api/weather-stats` | GET | Weather metrics |
| `/api/terrain/update` | GET | Trigger terrain update |

See `PDR.md` for detailed architecture documentation.
