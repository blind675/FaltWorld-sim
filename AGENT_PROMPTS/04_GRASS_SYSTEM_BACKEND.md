# AI Agent Prompt 4: Grass System Backend

## ✅ CAN RUN IN PARALLEL
This agent works on backend files only. No conflicts with Agents 2, 3 (frontend) after Agent 1 completes.

## Objective
Implement a data-driven grass growth system with realistic mechanics including seasonal cycles, moisture/temperature requirements, spreading, and species diversity.

## Design Principles
1. **Data-driven species**: Grass mechanics are generic; species defined in config
2. **Realistic simulation**: Seasonal dormancy, climate adaptation, spreading
3. **Extensible**: Easy to add new grass species without code changes

---

## Task 1: Update Schema

**File**: `shared/schema.ts`

Add grass properties to TerrainCell:
```typescript
grass_density: real("grass_density"),     // 0-1, coverage amount
grass_type: text("grass_type"),           // Species identifier
grass_health: real("grass_health"),       // 0-1, plant health
grass_dormant: integer("grass_dormant"),  // 0 or 1, seasonal dormancy
```

---

## Task 2: Create Grass Species Config

**File**: `server/config.ts`

```typescript
export interface GrassSpecies {
  id: string;
  name: string;
  // Temperature preferences (°C)
  minGrowthTemp: number;      // Below this: dormant
  optimalTempMin: number;     // Optimal growth range start
  optimalTempMax: number;     // Optimal growth range end
  maxGrowthTemp: number;      // Above this: heat stress
  // Moisture preferences (0-1)
  minMoisture: number;        // Below this: dies
  optimalMoistureMin: number;
  optimalMoistureMax: number;
  maxMoisture: number;        // Above this: root rot
  // Growth characteristics
  baseGrowthRate: number;     // Growth per tick in optimal conditions
  spreadProbability: number;  // Chance to spread to adjacent cell
  droughtTolerance: number;   // How long survives without water (ticks)
  frostTolerance: number;     // How low temp before death
  // Seasonal behavior
  gosDormantTemp: number;     // Temperature to enter dormancy
  wakeFromDormantTemp: number; // Temperature to exit dormancy
}

export const GRASS_SPECIES: GrassSpecies[] = [
  {
    id: "cool_season",
    name: "Cool Season Grass",
    minGrowthTemp: 5,
    optimalTempMin: 15,
    optimalTempMax: 24,
    maxGrowthTemp: 30,
    minMoisture: 0.2,
    optimalMoistureMin: 0.4,
    optimalMoistureMax: 0.7,
    maxMoisture: 0.9,
    baseGrowthRate: 0.02,
    spreadProbability: 0.05,
    droughtTolerance: 48,  // 2 days
    frostTolerance: -10,
    gosDormantTemp: 30,    // Goes dormant in heat
    wakeFromDormantTemp: 25,
  },
  {
    id: "warm_season",
    name: "Warm Season Grass",
    minGrowthTemp: 15,
    optimalTempMin: 25,
    optimalTempMax: 35,
    maxGrowthTemp: 40,
    minMoisture: 0.15,
    optimalMoistureMin: 0.3,
    optimalMoistureMax: 0.6,
    maxMoisture: 0.85,
    baseGrowthRate: 0.025,
    spreadProbability: 0.04,
    droughtTolerance: 72,  // 3 days
    frostTolerance: 0,
    gosDormantTemp: 10,    // Goes dormant in cold
    wakeFromDormantTemp: 15,
  },
  {
    id: "drought_resistant",
    name: "Drought Resistant Grass",
    minGrowthTemp: 10,
    optimalTempMin: 20,
    optimalTempMax: 35,
    maxGrowthTemp: 45,
    minMoisture: 0.05,
    optimalMoistureMin: 0.15,
    optimalMoistureMax: 0.4,
    maxMoisture: 0.7,
    baseGrowthRate: 0.01,
    spreadProbability: 0.02,
    droughtTolerance: 168,  // 7 days
    frostTolerance: -5,
    gosDormantTemp: 5,
    wakeFromDormantTemp: 12,
  },
];

export const GRASS_CONFIG = {
  // General settings
  MIN_DENSITY_TO_SPREAD: 0.3,     // Minimum density before spreading
  DEATH_RATE_NO_WATER: 0.05,     // Density loss per tick without water
  DEATH_RATE_EXTREME_TEMP: 0.03, // Density loss per tick in extreme temps
  DORMANCY_DECAY_RATE: 0.001,    // Slow decay while dormant
  INITIAL_SPREAD_DENSITY: 0.1,   // Starting density when grass spreads
  MAX_GRASS_DENSITY: 1.0,
  // Seeding (initial grass placement)
  INITIAL_SEED_PROBABILITY: 0.3, // Chance for cell to start with grass
  SEED_MOISTURE_THRESHOLD: 0.2,  // Minimum moisture for initial seeding
};
```

---

## Task 3: Create GrassSystem

**File**: `server/systems/GrassSystem.ts`

```typescript
import { ISimulationSystem } from "./ISimulationSystem";
import { TerrainGrid, TerrainCell } from "@shared/schema";
import { GameTime } from "@shared/schema";
import { GridHelper } from "./GridHelper";
import { GRASS_SPECIES, GRASS_CONFIG, GrassSpecies } from "../config";

export class GrassSystem implements ISimulationSystem {
  private speciesMap: Map<string, GrassSpecies>;

  constructor() {
    this.speciesMap = new Map();
    for (const species of GRASS_SPECIES) {
      this.speciesMap.set(species.id, species);
    }
  }

  update(terrain: TerrainGrid, gameTime: GameTime): void {
    const { width, height } = GridHelper.getDimensions(terrain);
    
    // First pass: update existing grass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = terrain[y][x];
        if (cell.grass_density && cell.grass_density > 0) {
          this.updateGrass(cell, gameTime);
        }
      }
    }
    
    // Second pass: spread grass to neighbors
    const spreadQueue: { x: number; y: number; type: string }[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = terrain[y][x];
        if (this.canSpread(cell)) {
          const neighbors = GridHelper.getNeighbors(terrain, x, y);
          for (const neighbor of neighbors) {
            if (this.canReceiveGrass(neighbor.cell, cell.grass_type!)) {
              const species = this.speciesMap.get(cell.grass_type!);
              if (species && Math.random() < species.spreadProbability) {
                spreadQueue.push({ 
                  x: (x + neighbor.dx + width) % width, 
                  y: (y + neighbor.dy + height) % height, 
                  type: cell.grass_type! 
                });
              }
            }
          }
        }
      }
    }
    
    // Apply spreading
    for (const spread of spreadQueue) {
      const cell = terrain[spread.y][spread.x];
      if (!cell.grass_density || cell.grass_density < GRASS_CONFIG.INITIAL_SPREAD_DENSITY) {
        cell.grass_density = GRASS_CONFIG.INITIAL_SPREAD_DENSITY;
        cell.grass_type = spread.type;
        cell.grass_health = 0.8;
        cell.grass_dormant = 0;
      }
    }
    
    // Log summary
    this.logSummary(terrain, width, height);
  }

  private updateGrass(cell: TerrainCell, gameTime: GameTime): void {
    const species = this.speciesMap.get(cell.grass_type ?? "cool_season");
    if (!species) return;

    const temp = cell.temperature ?? 15;
    const moisture = cell.moisture ?? 0;

    // Check dormancy
    if (cell.grass_dormant) {
      // Check if should wake up
      if (temp >= species.wakeFromDormantTemp && temp <= species.maxGrowthTemp) {
        cell.grass_dormant = 0;
        console.log(`GrassSystem: ${species.name} waking from dormancy at temp ${temp.toFixed(1)}°C`);
      } else {
        // Slow decay while dormant
        cell.grass_density = Math.max(0, (cell.grass_density ?? 0) - GRASS_CONFIG.DORMANCY_DECAY_RATE);
        return;
      }
    }

    // Check if should go dormant
    if (temp <= species.gosDormantTemp || temp >= species.maxGrowthTemp) {
      cell.grass_dormant = 1;
      return;
    }

    // Check death conditions
    if (temp < species.frostTolerance) {
      // Frost death
      cell.grass_density = Math.max(0, (cell.grass_density ?? 0) - GRASS_CONFIG.DEATH_RATE_EXTREME_TEMP);
      cell.grass_health = Math.max(0, (cell.grass_health ?? 1) - 0.1);
      return;
    }

    if (moisture < species.minMoisture) {
      // Drought death
      cell.grass_density = Math.max(0, (cell.grass_density ?? 0) - GRASS_CONFIG.DEATH_RATE_NO_WATER);
      cell.grass_health = Math.max(0, (cell.grass_health ?? 1) - 0.05);
      return;
    }

    // Calculate growth rate based on conditions
    const tempFactor = this.calculateTempFactor(temp, species);
    const moistureFactor = this.calculateMoistureFactor(moisture, species);
    const growthRate = species.baseGrowthRate * tempFactor * moistureFactor;

    // Apply growth
    cell.grass_density = Math.min(
      GRASS_CONFIG.MAX_GRASS_DENSITY,
      (cell.grass_density ?? 0) + growthRate
    );
    
    // Improve health in good conditions
    if (tempFactor > 0.7 && moistureFactor > 0.7) {
      cell.grass_health = Math.min(1, (cell.grass_health ?? 0.5) + 0.01);
    }
  }

  private calculateTempFactor(temp: number, species: GrassSpecies): number {
    if (temp < species.minGrowthTemp || temp > species.maxGrowthTemp) return 0;
    if (temp >= species.optimalTempMin && temp <= species.optimalTempMax) return 1;
    
    if (temp < species.optimalTempMin) {
      return (temp - species.minGrowthTemp) / (species.optimalTempMin - species.minGrowthTemp);
    }
    return (species.maxGrowthTemp - temp) / (species.maxGrowthTemp - species.optimalTempMax);
  }

  private calculateMoistureFactor(moisture: number, species: GrassSpecies): number {
    if (moisture < species.minMoisture || moisture > species.maxMoisture) return 0;
    if (moisture >= species.optimalMoistureMin && moisture <= species.optimalMoistureMax) return 1;
    
    if (moisture < species.optimalMoistureMin) {
      return (moisture - species.minMoisture) / (species.optimalMoistureMin - species.minMoisture);
    }
    return (species.maxMoisture - moisture) / (species.maxMoisture - species.optimalMoistureMax);
  }

  private canSpread(cell: TerrainCell): boolean {
    return (
      (cell.grass_density ?? 0) >= GRASS_CONFIG.MIN_DENSITY_TO_SPREAD &&
      (cell.grass_health ?? 0) > 0.5 &&
      !cell.grass_dormant
    );
  }

  private canReceiveGrass(cell: TerrainCell, grassType: string): boolean {
    // Can't grow in water
    if (cell.type === "river" || cell.type === "spring" || cell.water_height > 0.5) {
      return false;
    }
    // Can't grow on very high altitude (mountains)
    if ((cell.altitude ?? 0) > 1500) {
      return false;
    }
    // Already has significant grass
    if ((cell.grass_density ?? 0) > 0.5) {
      return false;
    }
    return true;
  }

  private logSummary(terrain: TerrainGrid, width: number, height: number): void {
    let totalGrass = 0;
    let cellsWithGrass = 0;
    const speciesCounts: Record<string, number> = {};

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = terrain[y][x];
        if (cell.grass_density && cell.grass_density > 0.01) {
          totalGrass += cell.grass_density;
          cellsWithGrass++;
          const type = cell.grass_type ?? "unknown";
          speciesCounts[type] = (speciesCounts[type] ?? 0) + 1;
        }
      }
    }

    if (cellsWithGrass > 0) {
      const avgDensity = totalGrass / cellsWithGrass;
      const coverage = (cellsWithGrass / (width * height) * 100).toFixed(1);
      console.log(`GrassSystem: ${coverage}% coverage, avg density: ${avgDensity.toFixed(2)}, species: ${JSON.stringify(speciesCounts)}`);
    }
  }
}
```

---

## Task 4: Seed Initial Grass

**File**: `server/storage.ts`

In the terrain generation/initialization, seed initial grass:

```typescript
private seedInitialGrass(terrain: TerrainGrid): void {
  const { width, height } = GridHelper.getDimensions(terrain);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = terrain[y][x];
      
      // Skip water and high mountains
      if (cell.type === "river" || cell.type === "spring" || cell.water_height > 0.5) continue;
      if ((cell.altitude ?? 0) > 1500) continue;
      
      // Check if conditions are suitable
      const moisture = cell.moisture ?? 0;
      if (moisture < GRASS_CONFIG.SEED_MOISTURE_THRESHOLD) continue;
      
      // Random seeding
      if (Math.random() > GRASS_CONFIG.INITIAL_SEED_PROBABILITY) continue;
      
      // Select species based on climate
      const temp = cell.temperature ?? 15;
      let selectedSpecies: string;
      
      if (moisture < 0.25) {
        selectedSpecies = "drought_resistant";
      } else if (temp > 25) {
        selectedSpecies = "warm_season";
      } else {
        selectedSpecies = "cool_season";
      }
      
      cell.grass_density = 0.2 + Math.random() * 0.3;
      cell.grass_type = selectedSpecies;
      cell.grass_health = 0.7 + Math.random() * 0.3;
      cell.grass_dormant = 0;
    }
  }
  
  console.log("GrassSystem: Initial grass seeded");
}
```

Call this after terrain generation.

---

## Task 5: Register with SimulationEngine

**File**: `server/systems/SimulationEngine.ts`

```typescript
import { GrassSystem } from "./GrassSystem";

// In constructor:
private grassSystem = new GrassSystem();

// In update(), add after moisture:
this.grassSystem.update(terrain, gameTime);
```

Execution order:
1. Temperature
2. Weather
3. WindTransport
4. Clouds
5. Precipitation
6. Hydrology
7. Evaporation
8. Humidity
9. Condensation
10. Moisture
11. **Grass** ← NEW (after moisture, needs moisture data)

---

## Task 6: Initialize Properties in Storage

**File**: `server/storage.ts`

Ensure new grass properties have defaults when creating cells:
```typescript
grass_density: 0,
grass_type: null,
grass_health: 0,
grass_dormant: 0,
```

---

## Task 7: Update Documentation

**File**: `PDR.md`

Update Phase 3 checkboxes:
```markdown
### Phase 3: Ecology Foundation
- [x] Grass growth and spreading
- [x] Ecology configuration system
- [ ] Flower systems
- [ ] Tree lifecycle
...
```

Add section describing grass species system.

**File**: `README.md`

Add grass system to implemented features.

**File**: `REFACTORING_SUMMARY.md`

Add GrassSystem to directory structure and system list.

---

## Verification Steps

1. **Build passes**: `npm run build`
2. **Server runs**: `npm run dev` — no errors
3. **Grass seeded**: See "GrassSystem: Initial grass seeded" log
4. **Grass growing**: See periodic logs with coverage stats
5. **Seasonal behavior**: Observe dormancy in extreme temps
6. **Spreading works**: Coverage should gradually increase

---

## Files to Create

| File | Purpose |
|------|---------|
| `server/systems/GrassSystem.ts` | Main grass mechanics |

## Files to Modify

| File | Changes |
|------|---------|
| `shared/schema.ts` | Add grass properties |
| `server/config.ts` | Add GRASS_SPECIES and GRASS_CONFIG |
| `server/systems/SimulationEngine.ts` | Register GrassSystem |
| `server/storage.ts` | Initialize grass, seed initial grass |
| `PDR.md` | Update checkboxes |
| `README.md` | Document grass system |
| `REFACTORING_SUMMARY.md` | Add to system list |

---

## Do NOT

- Do not modify frontend files (Agent 3 handles visualization)
- Do not implement flowers, trees, mushrooms yet (document for later)
- Do not break existing systems
