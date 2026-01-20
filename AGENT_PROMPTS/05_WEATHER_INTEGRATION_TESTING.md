# AI Agent Prompt 5: Weather Integration Testing

## ✅ CAN RUN IN PARALLEL
This agent works on backend observability. No conflicts with frontend agents or GrassSystem.

## Objective
Add logging, metrics, and observability tooling to verify the weather closed-loop cycle works correctly:
**Evaporation → Humidity → Clouds → Rain → Ground moisture → Evaporation**

## Context
The weather systems are implemented but need verification that the feedback loops work as intended. This agent adds instrumentation without changing core logic.

---

## Task 1: Create WeatherMetrics Module

**File**: `server/systems/WeatherMetrics.ts`

```typescript
import { TerrainGrid, TerrainCell } from "@shared/schema";
import { GridHelper } from "./GridHelper";

export interface WeatherSnapshot {
  tick: number;
  timestamp: Date;
  // Averages
  avgTemperature: number;
  avgHumidity: number;
  avgPressure: number;
  avgWindSpeed: number;
  avgCloudDensity: number;
  avgPrecipitation: number;
  avgGroundWetness: number;
  avgMoisture: number;
  // Coverage percentages
  cloudCoverage: number;      // % cells with clouds > 0.1
  rainCoverage: number;       // % cells with precipitation > 0
  wetGroundCoverage: number;  // % cells with ground_wetness > 0.1
  // Totals
  totalEvaporation: number;   // Estimated from water cells
  totalPrecipitation: number;
  // Extremes
  maxWindSpeed: number;
  maxCloudDensity: number;
  maxPrecipitation: number;
}

export class WeatherMetrics {
  private history: WeatherSnapshot[] = [];
  private maxHistorySize = 100;
  private tickCounter = 0;

  captureSnapshot(terrain: TerrainGrid): WeatherSnapshot {
    const { width, height } = GridHelper.getDimensions(terrain);
    const totalCells = width * height;
    
    let sumTemp = 0, sumHumidity = 0, sumPressure = 0, sumWind = 0;
    let sumCloud = 0, sumPrecip = 0, sumWetness = 0, sumMoisture = 0;
    let cloudCells = 0, rainCells = 0, wetCells = 0;
    let maxWind = 0, maxCloud = 0, maxPrecip = 0;
    let waterCells = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = terrain[y][x];
        
        sumTemp += cell.temperature ?? 0;
        sumHumidity += cell.air_humidity ?? 0;
        sumPressure += cell.atmospheric_pressure ?? 1013;
        sumWind += cell.wind_speed ?? 0;
        sumCloud += cell.cloud_density ?? 0;
        sumPrecip += cell.precipitation_rate ?? 0;
        sumWetness += cell.ground_wetness ?? 0;
        sumMoisture += cell.moisture ?? 0;

        if ((cell.cloud_density ?? 0) > 0.1) cloudCells++;
        if ((cell.precipitation_rate ?? 0) > 0) rainCells++;
        if ((cell.ground_wetness ?? 0) > 0.1) wetCells++;
        
        if ((cell.wind_speed ?? 0) > maxWind) maxWind = cell.wind_speed ?? 0;
        if ((cell.cloud_density ?? 0) > maxCloud) maxCloud = cell.cloud_density ?? 0;
        if ((cell.precipitation_rate ?? 0) > maxPrecip) maxPrecip = cell.precipitation_rate ?? 0;
        
        if (cell.type === "river" || cell.type === "spring" || (cell.water_height ?? 0) > 0) {
          waterCells++;
        }
      }
    }

    const snapshot: WeatherSnapshot = {
      tick: this.tickCounter++,
      timestamp: new Date(),
      avgTemperature: sumTemp / totalCells,
      avgHumidity: sumHumidity / totalCells,
      avgPressure: sumPressure / totalCells,
      avgWindSpeed: sumWind / totalCells,
      avgCloudDensity: sumCloud / totalCells,
      avgPrecipitation: sumPrecip / totalCells,
      avgGroundWetness: sumWetness / totalCells,
      avgMoisture: sumMoisture / totalCells,
      cloudCoverage: (cloudCells / totalCells) * 100,
      rainCoverage: (rainCells / totalCells) * 100,
      wetGroundCoverage: (wetCells / totalCells) * 100,
      totalEvaporation: waterCells * 0.01, // Rough estimate
      totalPrecipitation: sumPrecip,
      maxWindSpeed: maxWind,
      maxCloudDensity: maxCloud,
      maxPrecipitation: maxPrecip,
    };

    this.history.push(snapshot);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    return snapshot;
  }

  getHistory(): WeatherSnapshot[] {
    return [...this.history];
  }

  getLatest(): WeatherSnapshot | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  logSummary(snapshot: WeatherSnapshot): void {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    WEATHER METRICS (Tick ${snapshot.tick})
╠══════════════════════════════════════════════════════════════╣
║ Temperature:  ${snapshot.avgTemperature.toFixed(1)}°C avg
║ Humidity:     ${(snapshot.avgHumidity * 100).toFixed(1)}% avg
║ Pressure:     ${snapshot.avgPressure.toFixed(0)} hPa avg
║ Wind:         ${snapshot.avgWindSpeed.toFixed(1)} m/s avg (max: ${snapshot.maxWindSpeed.toFixed(1)})
╠══════════════════════════════════════════════════════════════╣
║ Cloud Cover:  ${snapshot.cloudCoverage.toFixed(1)}% of cells (max density: ${snapshot.maxCloudDensity.toFixed(2)})
║ Rain Cover:   ${snapshot.rainCoverage.toFixed(1)}% of cells (max rate: ${snapshot.maxPrecipitation.toFixed(2)})
║ Wet Ground:   ${snapshot.wetGroundCoverage.toFixed(1)}% of cells
║ Moisture:     ${(snapshot.avgMoisture * 100).toFixed(1)}% avg
╚══════════════════════════════════════════════════════════════╝
    `);
  }

  analyzeClosedLoop(): void {
    if (this.history.length < 10) {
      console.log("WeatherMetrics: Not enough data for closed-loop analysis (need 10+ ticks)");
      return;
    }

    const recent = this.history.slice(-10);
    
    // Check if humidity leads to clouds
    const humidityTrend = this.calculateTrend(recent.map(s => s.avgHumidity));
    const cloudTrend = this.calculateTrend(recent.map(s => s.cloudCoverage));
    
    // Check if clouds lead to rain
    const rainTrend = this.calculateTrend(recent.map(s => s.rainCoverage));
    
    // Check if rain leads to wet ground
    const wetnessTrend = this.calculateTrend(recent.map(s => s.wetGroundCoverage));

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║               CLOSED-LOOP ANALYSIS (Last 10 ticks)
╠══════════════════════════════════════════════════════════════╣
║ Humidity trend:      ${this.trendToString(humidityTrend)}
║ Cloud cover trend:   ${this.trendToString(cloudTrend)}
║ Rain cover trend:    ${this.trendToString(rainTrend)}
║ Ground wetness trend:${this.trendToString(wetnessTrend)}
╠══════════════════════════════════════════════════════════════╣
║ Loop Status: ${this.assessLoopHealth(humidityTrend, cloudTrend, rainTrend, wetnessTrend)}
╚══════════════════════════════════════════════════════════════╝
    `);
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    const first = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const last = values.slice(-3).reduce((a, b) => a + b, 0) / 3;
    return last - first;
  }

  private trendToString(trend: number): string {
    if (Math.abs(trend) < 0.01) return "→ Stable";
    if (trend > 0.05) return "↑↑ Rising fast";
    if (trend > 0) return "↑ Rising";
    if (trend < -0.05) return "↓↓ Falling fast";
    return "↓ Falling";
  }

  private assessLoopHealth(humidity: number, clouds: number, rain: number, wetness: number): string {
    // Check for reasonable activity
    const hasActivity = Math.abs(humidity) > 0.001 || Math.abs(clouds) > 0.1 || Math.abs(rain) > 0.1;
    
    if (!hasActivity) {
      return "⚠️ LOW ACTIVITY - Weather systems may be stagnant";
    }
    
    // Check for runaway conditions
    if (humidity > 0.1 && clouds > 5 && rain > 5) {
      return "⚠️ POSSIBLE RUNAWAY - All values increasing rapidly";
    }
    
    return "✅ HEALTHY - Feedback loops appear active";
  }
}
```

---

## Task 2: Integrate with SimulationEngine

**File**: `server/systems/SimulationEngine.ts`

```typescript
import { WeatherMetrics } from "./WeatherMetrics";

export class SimulationEngine {
  private weatherMetrics = new WeatherMetrics();
  private ticksSinceLastMetrics = 0;
  private METRICS_INTERVAL = 12; // Log every 12 ticks (12 game hours)

  update(terrain: TerrainGrid, gameTime: GameTime): void {
    // ... existing system updates ...

    // Capture and log weather metrics periodically
    this.ticksSinceLastMetrics++;
    if (this.ticksSinceLastMetrics >= this.METRICS_INTERVAL) {
      const snapshot = this.weatherMetrics.captureSnapshot(terrain);
      this.weatherMetrics.logSummary(snapshot);
      
      // Every 5 intervals, do closed-loop analysis
      if (snapshot.tick % 5 === 0) {
        this.weatherMetrics.analyzeClosedLoop();
      }
      
      this.ticksSinceLastMetrics = 0;
    }
  }

  getWeatherMetrics(): WeatherMetrics {
    return this.weatherMetrics;
  }
}
```

---

## Task 3: Add Weather Stats API Endpoint (Optional)

**File**: `server/routes.ts`

```typescript
app.get("/api/weather-stats", async (req, res) => {
  try {
    const storage = await getStorage();
    const metrics = storage.getSimulationEngine().getWeatherMetrics();
    const latest = metrics.getLatest();
    const history = metrics.getHistory();
    
    res.json({
      current: latest,
      history: history.slice(-20), // Last 20 snapshots
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get weather stats" });
  }
});
```

This endpoint can be used for debugging or future dashboard displays.

---

## Task 4: Add Diagnostic Logging to Weather Systems

Add detailed logging (controlled by config flag) to track the feedback loop:

**File**: `server/config.ts`

```typescript
export const DEBUG_CONFIG = {
  WEATHER_VERBOSE_LOGGING: false, // Set true for detailed logs
};
```

**File**: `server/systems/CloudSystem.ts` (add to existing)

```typescript
import { DEBUG_CONFIG } from "../config";

// In update method, add:
if (DEBUG_CONFIG.WEATHER_VERBOSE_LOGGING && cloudFormed > 0) {
  console.log(`CloudSystem: Formed ${cloudFormed.toFixed(2)} cloud density from humidity`);
}
```

**File**: `server/systems/PrecipitationSystem.ts` (add to existing)

```typescript
import { DEBUG_CONFIG } from "../config";

// In update method, add:
if (DEBUG_CONFIG.WEATHER_VERBOSE_LOGGING && totalRain > 0) {
  console.log(`PrecipitationSystem: ${rainingCells} cells raining, total: ${totalRain.toFixed(2)}`);
}
```

---

## Task 5: Update Documentation

**File**: `PDR.md`

Update Milestone 2.2:
```markdown
- [x] Closed-loop integration testing
```

Add section:
```markdown
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
```

---

## Verification Steps

1. **Build passes**: `npm run build`
2. **Server runs**: `npm run dev`
3. **Metrics logged**: See weather metrics summary every 12 ticks
4. **Closed-loop analysis**: See loop health assessment periodically
5. **API works** (if implemented): `curl http://localhost:5000/api/weather-stats`
6. **No performance impact**: Metrics capture should be fast

---

## Files to Create

| File | Purpose |
|------|---------|
| `server/systems/WeatherMetrics.ts` | Metrics capture and analysis |

## Files to Modify

| File | Changes |
|------|---------|
| `server/systems/SimulationEngine.ts` | Integrate WeatherMetrics |
| `server/config.ts` | Add DEBUG_CONFIG |
| `server/routes.ts` | Add /api/weather-stats (optional) |
| `PDR.md` | Update checkboxes, add docs |

---

## Do NOT

- Do not modify weather system logic (only add logging)
- Do not modify frontend files
- Do not impact simulation performance significantly
- Do not break existing functionality
