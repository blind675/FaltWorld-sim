import { type TerrainGrid } from "../schema";
import { type GameTime } from "../storage";
import { type ISimulationSystem } from "./ISimulationSystem";
import { TemperatureSystem } from "./TemperatureSystem";
import { WeatherSystem } from "./WeatherSystem";
import { WindTransportSystem } from "./WindTransportSystem";
import { CloudSystem } from "./CloudSystem";
import { PrecipitationSystem } from "./PrecipitationSystem";
import { HydrologySystem } from "./HydrologySystem";
import { EvaporationSystem } from "./EvaporationSystem";
import { HumiditySystem } from "./HumiditySystem";
import { CondensationSystem } from "./CondensationSystem";
import { MoistureSystem } from "./MoistureSystem";
import { GrassSystem } from "./GrassSystem";
import { PERFORMANCE_CONFIG } from "../config";
import { WeatherMetrics } from "./WeatherMetrics";

/**
 * Orchestrates all simulation systems in the correct order
 * 
 * System execution order is critical:
 * 1. Temperature - affects saturation capacity
 * 2. Weather - pressure and wind generation
 * 3. Wind transport - humidity and heat advection
 * 4. Clouds - formation and advection
 * 5. Precipitation - rain and ground wetness
 * 6. Hydrology - river flow and erosion
 * 7. Evaporation - water bodies → air humidity
 * 8. Humidity - adjusts for temperature changes and diffuses
 * 9. Condensation - oversaturated air → ground moisture
 * 10. Moisture - ground moisture propagation from water sources
 * 11. Grass - growth, dormancy, and spreading
 */
export class SimulationEngine {
    private temperatureSystem: TemperatureSystem;
    private weatherSystem: WeatherSystem;
    private windTransportSystem: WindTransportSystem;
    private cloudSystem: CloudSystem;
    private precipitationSystem: PrecipitationSystem;
    private hydrologySystem: HydrologySystem;
    private evaporationSystem: EvaporationSystem;
    private humiditySystem: HumiditySystem;
    private condensationSystem: CondensationSystem;
    private moistureSystem: MoistureSystem;
    private grassSystem: GrassSystem;
    private weatherMetrics: WeatherMetrics;
    private ticksSinceLastMetrics = 0;
    private METRICS_INTERVAL = 12;
    private tickCount = 0;
    private grassInitialized = false;
    private GRASS_INIT_TICK = 100;

    constructor() {
        this.temperatureSystem = new TemperatureSystem();
        this.weatherSystem = new WeatherSystem();
        this.windTransportSystem = new WindTransportSystem();
        this.cloudSystem = new CloudSystem();
        this.precipitationSystem = new PrecipitationSystem();
        this.hydrologySystem = new HydrologySystem();
        this.evaporationSystem = new EvaporationSystem();
        this.humiditySystem = new HumiditySystem();
        this.condensationSystem = new CondensationSystem();
        this.moistureSystem = new MoistureSystem();
        this.grassSystem = new GrassSystem();
        this.weatherMetrics = new WeatherMetrics();
    }

    /**
     * Get the hydrology system (for river initialization)
     */
    getHydrologySystem(): HydrologySystem {
        return this.hydrologySystem;
    }

    getWeatherMetrics(): WeatherMetrics {
        return this.weatherMetrics;
    }

    /**
     * Run one simulation tick
     */
    update(terrain: TerrainGrid, gameTime: GameTime): void {
        const shouldLog = PERFORMANCE_CONFIG.ENABLE_PERFORMANCE_LOGGING;
        const startTime = Date.now();

        // 1. Update temperature (affects saturation capacity)
        if (shouldLog) console.time("Temperature");
        this.temperatureSystem.update(terrain, gameTime);
        if (shouldLog) console.timeEnd("Temperature");

        // 2. Calculate pressure and wind
        if (shouldLog) console.time("Weather");
        this.weatherSystem.update(terrain, gameTime);
        if (shouldLog) console.timeEnd("Weather");

        // 3. Wind-driven transport
        if (shouldLog) console.time("WindTransport");
        this.windTransportSystem.update(terrain, gameTime);
        if (shouldLog) console.timeEnd("WindTransport");

        // 4. Cloud formation and advection
        if (shouldLog) console.time("Clouds");
        this.cloudSystem.update(terrain, gameTime);
        if (shouldLog) console.timeEnd("Clouds");

        // 5. Precipitation and ground wetness
        if (shouldLog) console.time("Precipitation");
        this.precipitationSystem.update(terrain, gameTime);
        if (shouldLog) console.timeEnd("Precipitation");

        // 6. Process hydrology (river flow, erosion)
        if (shouldLog) console.time("Hydrology");
        this.hydrologySystem.update(terrain, gameTime);
        if (shouldLog) console.timeEnd("Hydrology");

        // 7. Evaporation from water bodies and ground
        if (shouldLog) console.time("Evaporation");
        this.evaporationSystem.update(terrain, gameTime);
        if (shouldLog) console.timeEnd("Evaporation");

        // 8. Adjust humidity for temperature changes and diffuse
        if (shouldLog) console.time("Humidity");
        this.humiditySystem.update(terrain, gameTime);
        if (shouldLog) console.timeEnd("Humidity");

        // 9. Condensation (oversaturation → ground moisture)
        if (shouldLog) console.time("Condensation");
        this.condensationSystem.update(terrain, gameTime);
        if (shouldLog) console.timeEnd("Condensation");

        // 10. Ground moisture propagation
        if (shouldLog) console.time("Moisture");
        this.moistureSystem.update(terrain, gameTime);
        if (shouldLog) console.timeEnd("Moisture");

        // 11. Grass growth and spreading (delayed until moisture is established)
        this.tickCount++;
        if (this.tickCount >= this.GRASS_INIT_TICK) {
            if (!this.grassInitialized) {
                console.log(`GrassSystem: Initializing grass at tick ${this.tickCount}`);
                this.grassSystem.seedInitialGrass(terrain);
                this.grassInitialized = true;
            }
            if (shouldLog) console.time("Grass");
            this.grassSystem.update(terrain, gameTime);
            if (shouldLog) console.timeEnd("Grass");
        }
        this.ticksSinceLastMetrics += 1;
        if (this.ticksSinceLastMetrics >= this.METRICS_INTERVAL) {
            const snapshot = this.weatherMetrics.captureSnapshot(terrain);
            this.weatherMetrics.logSummary(snapshot);

            if (snapshot.tick % 5 === 0) {
                this.weatherMetrics.analyzeClosedLoop();
            }

            this.ticksSinceLastMetrics = 0;
        }

        if (shouldLog) {
            const totalTime = Date.now() - startTime;
            console.log(`Total tick time: ${totalTime}ms`);
            if (totalTime > PERFORMANCE_CONFIG.TICK_TIME_WARNING_MS) {
                console.warn("⚠️  Tick exceeded 5s target!");
            }
        }
    }
}
