# Product Requirements Document (PRD)

## 1. Overview
FlatWorld is a web-based procedural world generation and simulation system with dynamic terrain, hydrology, moisture, temperature, and time systems. The current implementation focuses on a seamless, wrapping world grid, water flow/rivers, moisture diffusion, temperature modeling, and a client-facing game clock with seasonal day/night cycles. The simulation updates on server ticks and exposes terrain state to the client for visualization. The goal of this PRD is to capture what is implemented today and outline a backlog based on TODOs and documented next steps.

## 2. Goals
- Deliver a seamless, wrapping world with reproducible procedural terrain generation.
- Simulate hydrology, moisture, temperature, and humidity in a performant loop.
- Provide a clear, user-friendly timekeeping UI with seasonal day/night cycles.
- Keep the system extensible for weather, ecology, and gameplay systems.

## 3. Non-Goals (Current Scope Exclusions)
- Real-time multiplayer or player-driven simulation mechanics.
- High-scale persistent storage or distributed simulation (future scalability only).
- Full biome system or ecology (planned, not implemented).

## 4. Target Users
- **Simulation enthusiasts** who want to observe procedural terrain evolution.
- **Game prototypers** exploring world generation parameters and system behaviors.
- **Developers/Researchers** testing large-scale grid simulations and performance tradeoffs.

## 5. Current Experience (Implemented Features)

### 5.1 World & Terrain Generation
- **Wrapping world grid** with Perlin-noise-based terrain generation for seamless edge transitions (torus-based wrapping).【F:README.md†L8-L10】【F:WORLD_GENERATION.md†L1-L45】
- **Dedicated world generator module** (`WorldGenerator`) with configuration for grid size, noise scale, and elevation ranges.【F:WORLD_GENERATION.md†L10-L57】
- **Spring selection** based on terrain elevation to seed rivers, using wrapped distance calculations to avoid edge clustering.【F:WORLD_GENERATION.md†L58-L86】【F:MOISTURE_CONFIG.md†L178-L223】

### 5.2 Hydrology & Rivers
- **Random spring generation** with per-spring river tracking and named rivers.【F:README.md†L12-L18】
- **Water flow simulation** with river merging when streams meet, plus water accumulation and land erosion (water-based).【F:README.md†L12-L18】

### 5.3 Moisture & Humidity
- **Moisture propagation** using iterative diffusion with altitude modifiers and diminishing returns for realistic gradients.【F:README.md†L19-L23】【F:MOISTURE_CONFIG.md†L12-L44】
- **Evaporation + humidity system** with temperature-dependent evaporation, evapotranspiration from land, and diffusion of air humidity across the grid.【F:MOISTURE_CONFIG.md†L45-L171】

### 5.4 Temperature
- **Altitude- and latitude-aware temperature model** with seasonal variation and hemispheric season reversal, calculated each tick and optimized via precomputed seasonal factors.【F:README.md†L33-L41】

### 5.5 Time System & UI
- **In-game clock**: years, months (30 days), days, hours, minutes with 1 tick = 1 hour.【F:README.md†L24-L31】
- **Seasonal day/night cycles** with month-specific daylight hours and day starting at 6 AM.【F:README.md†L24-L31】
- **Interactive game clock UI**: animated analog clock, digital time/date, daylight info, and day/night indicator.【F:README.md†L24-L31】

### 5.6 Performance Posture (Documented Baseline)
- The simulation is designed to work smoothly at 300x300 and 500x500, with known bottlenecks for larger grids (rendering, memory, payload size).【F:PERFORMANCE_OPTIMIZATION.md†L7-L33】
- The performance guide outlines recommended optimizations such as HTTP compression, LOD rendering, and chunked APIs for future scaling.【F:PERFORMANCE_OPTIMIZATION.md†L34-L173】

## 6. Functional Requirements

### 6.1 Terrain & World Generation
- Generate a seamless, wrapping heightmap across the grid with configurable noise parameters.
- Support regeneration with new seeds to produce new worlds.
- Select spring points in elevated terrain with a minimum spacing rule.

### 6.2 Hydrology
- Seed rivers from springs and simulate water flow along terrain.
- Merge rivers when streams intersect.
- Track and persist river identities for visualization.

### 6.3 Moisture & Humidity
- Diffuse ground moisture from water sources with altitude and saturation modifiers.
- Evaporate water into air humidity based on temperature and depth.
- Allow land moisture to contribute to air humidity (evapotranspiration).
- Diffuse humidity across cells each tick.

### 6.4 Temperature & Time
- Compute temperatures each tick based on latitude, altitude, and season.
- Maintain a game-time model that updates once per tick.
- Provide month-specific daylight hours for day/night logic.

### 6.5 UI/Visualization
- Render a client-side terrain map (current canvas-based rendering).
- Provide game clock UI (analog + digital) synchronized with server ticks.

## 7. Non-Functional Requirements
- **Performance**: Maintain smooth simulation at 300–500 grid sizes; support 1000+ with optimization work outlined in performance guide.【F:PERFORMANCE_OPTIMIZATION.md†L7-L96】
- **Scalability**: Plan for chunked APIs and LOD rendering to reduce payload and render load.【F:PERFORMANCE_OPTIMIZATION.md†L97-L173】
- **Maintainability**: Keep configuration centralized for tuning moisture/humidity and world generation parameters.【F:MOISTURE_CONFIG.md†L1-L11】【F:WORLD_GENERATION.md†L35-L57】

## 8. Data Model (Current)
Terrain cells include:
- Location (x, y)
- Elevation metrics (altitude, terrain height)
- Water state (water height, distance from water)
- Moisture state (base, added, total moisture)
- Temperature and air humidity
- Terrain type and river identifiers

This data structure is defined in the shared schema to synchronize server and client types.【F:shared/schema.ts†L1-L38】

## 9. Metrics & Observability (Current + Future)
- **Current**: Performance documentation provides grid-size benchmarks and recommended optimizations.【F:PERFORMANCE_OPTIMIZATION.md†L7-L33】【F:PERFORMANCE_OPTIMIZATION.md†L322-L366】
- **Future metrics**: In-app tick timing, memory usage, and moisture/humidity performance tracking (outlined in optimization doc).【F:PERFORMANCE_OPTIMIZATION.md†L256-L309】

## 10. Backlog (From TODOs & Next Steps)

### 10.1 Simulation & Systems
- Add atmospheric pressure modeling.【F:server/storage.ts†L754-L760】
- Add light/illumination modeling.【F:server/storage.ts†L754-L760】
- Add weather systems (rain, snow, wind).【F:server/storage.ts†L754-L760】【F:README.md†L47-L53】
- Extend erosion beyond water-based effects.【F:server/storage.ts†L754-L760】【F:README.md†L45-L46】
- Add ice and seasonal precipitation systems.【F:README.md†L52-L53】

### 10.2 Ecology & Biomes
- Add grass and growth mechanics.【F:server/storage.ts†L762-L763】【F:README.md†L46-L47】
- Add trees and fruit production systems.【F:server/storage.ts†L762-L764】【F:README.md†L46-L47】
- Add wildlife (rabbits, foxes, wolves, bears).【F:server/storage.ts†L765-L768】【F:README.md†L48-L50】

### 10.3 Agents & Gameplay
- Add humans (and player-controllable entities).【F:server/storage.ts†L769-L770】【F:README.md†L50-L51】

### 10.4 Visualization
- Temperature map visualization on the canvas (temperature layer).【F:README.md†L44-L45】
- Improved river visualization/stream tracking.【F:README.md†L42-L43】

### 10.5 Performance & Scalability
- Implement HTTP compression, LOD rendering, viewport culling, and chunked APIs to improve large-grid performance.【F:PERFORMANCE_OPTIMIZATION.md†L34-L173】
- Explore typed arrays, WebGL rendering, and multi-threading for large-scale simulations.【F:PERFORMANCE_OPTIMIZATION.md†L174-L254】

## 11. Open Questions
- Which visual layers are required in the first UX iteration (elevation, moisture, temperature, rivers, humidity)?
- What are the priority simulation systems after weather (ecology vs. gameplay agents)?
- Do we need persistence or deterministic seeds for sharing worlds?
- What scale (grid size) should be the official target for MVP performance?

---

## Appendix: Source Documentation Used
- README for implemented features and next steps.【F:README.md†L1-L53】
- World generation and wrapping noise documentation for terrain generation details.【F:WORLD_GENERATION.md†L1-L119】【F:WRAPPING_NOISE_IMPLEMENTATION.md†L1-L78】
- Moisture and humidity configuration guide for system behavior and tuning parameters.【F:MOISTURE_CONFIG.md†L1-L171】
- Performance optimization guide for current limits and planned improvements.【F:PERFORMANCE_OPTIMIZATION.md†L1-L366】
- Server TODO list for system-level backlog items.【F:server/storage.ts†L754-L770】
