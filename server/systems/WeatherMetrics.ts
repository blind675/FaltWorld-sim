import { type TerrainGrid } from "@shared/schema";
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
  cloudCoverage: number; // % cells with clouds > 0.1
  rainCoverage: number; // % cells with precipitation > 0
  wetGroundCoverage: number; // % cells with ground_wetness > 0.1
  // Totals
  totalEvaporation: number; // Estimated from water cells
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

    let sumTemp = 0;
    let sumHumidity = 0;
    let sumPressure = 0;
    let sumWind = 0;
    let sumCloud = 0;
    let sumPrecip = 0;
    let sumWetness = 0;
    let sumMoisture = 0;
    let cloudCells = 0;
    let rainCells = 0;
    let wetCells = 0;
    let maxWind = 0;
    let maxCloud = 0;
    let maxPrecip = 0;
    let waterCells = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const cell = terrain[y][x];

        sumTemp += cell.temperature ?? 0;
        sumHumidity += cell.air_humidity ?? 0;
        sumPressure += cell.atmospheric_pressure ?? 1013;
        sumWind += cell.wind_speed ?? 0;
        sumCloud += cell.cloud_density ?? 0;
        sumPrecip += cell.precipitation_rate ?? 0;
        sumWetness += cell.ground_wetness ?? 0;
        sumMoisture += cell.moisture ?? 0;

        if ((cell.cloud_density ?? 0) > 0.1) cloudCells += 1;
        if ((cell.precipitation_rate ?? 0) > 0) rainCells += 1;
        if ((cell.ground_wetness ?? 0) > 0.1) wetCells += 1;

        if ((cell.wind_speed ?? 0) > maxWind) maxWind = cell.wind_speed ?? 0;
        if ((cell.cloud_density ?? 0) > maxCloud) maxCloud = cell.cloud_density ?? 0;
        if ((cell.precipitation_rate ?? 0) > maxPrecip) maxPrecip = cell.precipitation_rate ?? 0;

        if (cell.type === "river" || cell.type === "spring" || (cell.water_height ?? 0) > 0) {
          waterCells += 1;
        }
      }
    }

    const snapshot: WeatherSnapshot = {
      tick: this.tickCounter,
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
      totalEvaporation: waterCells * 0.01,
      totalPrecipitation: sumPrecip,
      maxWindSpeed: maxWind,
      maxCloudDensity: maxCloud,
      maxPrecipitation: maxPrecip,
    };

    this.tickCounter += 1;
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

    const humidityTrend = this.calculateTrend(recent.map((snapshot) => snapshot.avgHumidity));
    const cloudTrend = this.calculateTrend(recent.map((snapshot) => snapshot.cloudCoverage));
    const rainTrend = this.calculateTrend(recent.map((snapshot) => snapshot.rainCoverage));
    const wetnessTrend = this.calculateTrend(recent.map((snapshot) => snapshot.wetGroundCoverage));

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
    const first = values.slice(0, 3).reduce((sum, value) => sum + value, 0) / 3;
    const last = values.slice(-3).reduce((sum, value) => sum + value, 0) / 3;
    return last - first;
  }

  private trendToString(trend: number): string {
    if (Math.abs(trend) < 0.01) return "→ Stable";
    if (trend > 0.05) return "↑↑ Rising fast";
    if (trend > 0) return "↑ Rising";
    if (trend < -0.05) return "↓↓ Falling fast";
    return "↓ Falling";
  }

  private assessLoopHealth(
    humidity: number,
    clouds: number,
    rain: number,
    wetness: number,
  ): string {
    const hasActivity = Math.abs(humidity) > 0.001 || Math.abs(clouds) > 0.1 || Math.abs(rain) > 0.1;

    if (!hasActivity) {
      return "⚠️ LOW ACTIVITY - Weather systems may be stagnant";
    }

    if (humidity > 0.1 && clouds > 5 && rain > 5) {
      return "⚠️ POSSIBLE RUNAWAY - All values increasing rapidly";
    }

    return "✅ HEALTHY - Feedback loops appear active";
  }
}
