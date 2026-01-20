# AI Agent Prompt: Complete Weather System Backend

## Objective
Complete the Weather System backend by implementing wind-based transport, cloud formation, and precipitation (rain only). This continues the work started in `WeatherSystem.ts` which already handles atmospheric pressure and wind generation.

## Context Summary

### Project Overview
FlatWorld is a persistent, procedurally-generated world simulation. The codebase uses a **modular systems architecture** where each natural system implements `ISimulationSystem` interface with an `update(terrain, gameTime)` method. Systems are orchestrated by `SimulationEngine.ts`.

### Current State
- **Implemented**: Temperature, Hydrology, Moisture, Humidity, Evaporation, Condensation, Weather (pressure + wind)
- **Wind data available**: Each cell has `wind_speed` and `wind_direction` (degrees, 0° = North, clockwise)
- **World size**: 1000x1000 grid with torus topology (wrapping edges)

### Key Files to Understand First
```
server/systems/
├── ISimulationSystem.ts    # Interface to implement
├── SimulationEngine.ts     # Add new systems here
├── WeatherSystem.ts        # Existing pressure/wind (reference for style)
├── GridHelper.ts           # Use for neighbor calculations + wrapping
├── HumiditySystem.ts       # Reference for diffusion patterns
server/config.ts            # Add configuration constants
shared/schema.ts            # Add new cell properties
```

---

## Tasks

### Task 1: Update Schema (`shared/schema.ts`)

Add these new cell properties to the terrain cell schema:

```typescript
cloud_density: real("cloud_density"),      // 0-1, cloud cover amount
precipitation_rate: real("precipitation_rate"), // current rainfall intensity
ground_wetness: real("ground_wetness"),    // rain-soaked soil (dries over time)
```

**Note**: `ground_wetness` is separate from `moisture` — it tracks surface wetness from rain that affects future animal movement penalties and dries over time.

---

### Task 2: Create `WindTransportSystem.ts`

**Purpose**: Transport humidity and heat based on wind vectors.

**Location**: `server/systems/WindTransportSystem.ts`

**Logic**:
1. For each cell, calculate transport based on wind speed and direction
2. Move a fraction of `air_humidity` from upwind cells to current cell
3. Apply minor heat transport (temperature advection)
4. Respect world wrapping (use `GridHelper`)

**Key considerations**:
- Wind direction is in degrees (0° = North, clockwise)
- Convert to vector components for transport calculation
- Transport rate should be proportional to wind speed
- Use smoothing to prevent numerical instability

**Configuration** (add to `server/config.ts`):
```typescript
export const WIND_TRANSPORT_CONFIG = {
  HUMIDITY_TRANSPORT_RATE: 0.1,  // fraction of humidity moved per tick
  HEAT_TRANSPORT_RATE: 0.02,     // fraction of temp difference advected
  MIN_WIND_FOR_TRANSPORT: 0.5,   // minimum wind speed to trigger transport
};
```

**Logging**: Log summary stats occasionally (e.g., "WindTransport: avg humidity moved: X")

---

### Task 3: Create `CloudSystem.ts`

**Purpose**: Form clouds when humidity exceeds saturation, advect clouds with wind.

**Location**: `server/systems/CloudSystem.ts`

**Logic**:
1. Calculate saturation threshold per cell (decreases with altitude — cooler air holds less moisture)
2. If `air_humidity > saturation_threshold`, excess becomes `cloud_density`
3. Advect existing clouds with wind vectors (similar to transport)
4. Clouds dissipate slowly when humidity drops below threshold

**Formula suggestions**:
```
saturation_threshold = base_saturation * (1 - altitude_factor * normalized_altitude)
new_cloud = max(0, air_humidity - saturation_threshold) * formation_rate
```

**Configuration** (add to `server/config.ts`):
```typescript
export const CLOUD_CONFIG = {
  BASE_SATURATION: 0.7,           // humidity threshold at sea level
  ALTITUDE_SATURATION_FACTOR: 0.3, // how much altitude reduces threshold
  CLOUD_FORMATION_RATE: 0.15,     // humidity → cloud conversion rate
  CLOUD_DISSIPATION_RATE: 0.05,   // cloud decay when undersaturated
  CLOUD_ADVECTION_RATE: 0.2,      // how much clouds move with wind
};
```

**Logging**: Log when significant cloud formation occurs (e.g., "CloudSystem: Dense clouds forming at region X,Y")

---

### Task 4: Create `PrecipitationSystem.ts`

**Purpose**: Generate rain from clouds, apply effects to ground.

**Location**: `server/systems/PrecipitationSystem.ts`

**Logic**:
1. If `cloud_density > precipitation_threshold`, rain occurs
2. Rain amount = `(cloud_density - threshold) * precip_rate`
3. Apply rain effects:
   - Increase `ground_wetness`
   - Increase `moisture` (some soaks into ground)
   - Reduce `cloud_density` (rain depletes clouds)
   - Reduce `air_humidity` slightly
   - Apply minor cooling effect to temperature
4. Ground wetness dries over time (evaporates)

**Rain only for now** — snow mechanics documented for future:
```typescript
// TODO: Future snow implementation
// - If temperature < freezing_point → snow instead of rain
// - Snow accumulates as snow_depth property
// - Snow melts when temperature > melting_point
// - Snow provides movement penalty for animals
// - Snow insulates ground (reduces temp fluctuation)
```

**Configuration** (add to `server/config.ts`):
```typescript
export const PRECIPITATION_CONFIG = {
  PRECIP_THRESHOLD: 0.4,         // cloud density required for rain
  PRECIP_RATE: 0.3,              // cloud → rain conversion rate
  GROUND_ABSORPTION_RATE: 0.5,   // rain → ground moisture
  WETNESS_FROM_RAIN: 0.8,        // rain → ground wetness
  HUMIDITY_REDUCTION: 0.1,       // humidity lost per unit rain
  COOLING_FACTOR: 0.5,           // temperature drop per unit rain
  WETNESS_DRY_RATE: 0.02,        // ground wetness evaporation per tick
};
```

**Logging**: Log rain events (e.g., "PrecipitationSystem: Rain at X,Y - intensity: Z")

---

### Task 5: Update `SimulationEngine.ts`

Add the three new systems in this execution order:

```typescript
// In constructor, add:
private windTransportSystem = new WindTransportSystem();
private cloudSystem = new CloudSystem();
private precipitationSystem = new PrecipitationSystem();

// In update(), new order:
1. this.temperatureSystem.update(terrain, gameTime);
2. this.weatherSystem.update(terrain, gameTime);        // pressure & wind
3. this.windTransportSystem.update(terrain, gameTime);  // NEW
4. this.cloudSystem.update(terrain, gameTime);          // NEW
5. this.precipitationSystem.update(terrain, gameTime);  // NEW
6. this.hydrologySystem.update(terrain, gameTime);
7. this.evaporationSystem.update(terrain, gameTime);
8. this.humiditySystem.update(terrain, gameTime);
9. this.condensationSystem.update(terrain, gameTime);
10. this.moistureSystem.update(terrain, gameTime);
```

---

### Task 6: Initialize New Properties in `storage.ts`

In the terrain generation/initialization, ensure new properties have default values:
```typescript
cloud_density: 0,
precipitation_rate: 0,
ground_wetness: 0,
```

---

### Task 7: Update Documentation

Update `PDR.md` Phase 2 checkboxes:
- [x] Wind-based humidity/heat transport
- [x] Cloud formation and dynamics  
- [x] Precipitation system (rain only)

Add to documentation:
```markdown
**Future Work - Snow & Movement:**
- Snow accumulation when temperature < freezing
- Snow melting mechanics
- Movement penalties for animals on:
  - Wet ground (ground_wetness > threshold)
  - Snowy terrain (future snow_depth property)
  - Muddy areas (high moisture + wetness)
```

Update `README.md` and `REFACTORING_SUMMARY.md` with the new systems.

---

## Verification Steps

After implementation, verify:

1. **Build passes**: `npm run build` — no TypeScript errors
2. **Server runs**: `npm run dev` — no runtime errors
3. **Logging works**: See transport, cloud, and rain log messages
4. **Data populated**: Check that cells have non-zero `cloud_density`, `precipitation_rate`, `ground_wetness` values after a few ticks
5. **Feedback loop**: Observe that rain reduces clouds and adds ground wetness

---

## Code Style Guidelines

- Follow existing system patterns (see `HumiditySystem.ts`, `WeatherSystem.ts`)
- Use `GridHelper` for all neighbor calculations and wrapping
- Keep systems stateless (operate only on passed terrain data)
- Use descriptive constant names in config
- Add brief JSDoc comments for public methods
- Console logging for key events (not every cell, just summaries/notable events)

---

## Files to Create/Modify Summary

| Action | File |
|--------|------|
| Modify | `shared/schema.ts` |
| Create | `server/systems/WindTransportSystem.ts` |
| Create | `server/systems/CloudSystem.ts` |
| Create | `server/systems/PrecipitationSystem.ts` |
| Modify | `server/systems/SimulationEngine.ts` |
| Modify | `server/config.ts` |
| Modify | `server/storage.ts` |
| Modify | `PDR.md` |
| Modify | `README.md` |
| Modify | `REFACTORING_SUMMARY.md` |

---

## Do NOT

- Do not implement snow mechanics yet (rain only)
- Do not modify frontend/visualization (separate task)
- Do not change existing system logic unless necessary for integration
- Do not break existing interfaces or tests
