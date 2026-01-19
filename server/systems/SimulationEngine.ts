import { type TerrainGrid } from "@shared/schema";
import { type GameTime } from "../storage";
import { type ISimulationSystem } from "./ISimulationSystem";
import { TemperatureSystem } from "./TemperatureSystem";
import { HydrologySystem } from "./HydrologySystem";
import { EvaporationSystem } from "./EvaporationSystem";
import { HumiditySystem } from "./HumiditySystem";
import { CondensationSystem } from "./CondensationSystem";
import { MoistureSystem } from "./MoistureSystem";
import { PERFORMANCE_CONFIG } from "../config";

/**
 * Orchestrates all simulation systems in the correct order
 * 
 * System execution order is critical:
 * 1. Temperature - affects saturation capacity
 * 2. Hydrology - river flow and erosion
 * 3. Humidity - adjusts for temperature changes and diffuses
 * 4. Evaporation - water bodies → air humidity
 * 5. Condensation - oversaturated air → ground moisture
 * 6. Moisture - ground moisture propagation from water sources
 */
export class SimulationEngine {
    private temperatureSystem: TemperatureSystem;
    private hydrologySystem: HydrologySystem;
    private evaporationSystem: EvaporationSystem;
    private humiditySystem: HumiditySystem;
    private condensationSystem: CondensationSystem;
    private moistureSystem: MoistureSystem;

    constructor() {
        this.temperatureSystem = new TemperatureSystem();
        this.hydrologySystem = new HydrologySystem();
        this.evaporationSystem = new EvaporationSystem();
        this.humiditySystem = new HumiditySystem();
        this.condensationSystem = new CondensationSystem();
        this.moistureSystem = new MoistureSystem();
    }

    /**
     * Get the hydrology system (for river initialization)
     */
    getHydrologySystem(): HydrologySystem {
        return this.hydrologySystem;
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

        // 2. Process hydrology (river flow, erosion)
        if (shouldLog) console.time("Hydrology");
        this.hydrologySystem.update(terrain, gameTime);
        if (shouldLog) console.timeEnd("Hydrology");

        // 3. Adjust humidity for temperature changes and diffuse
        if (shouldLog) console.time("Humidity");
        this.humiditySystem.update(terrain, gameTime);
        if (shouldLog) console.timeEnd("Humidity");

        // 4. Evaporation from water bodies and ground
        if (shouldLog) console.time("Evaporation");
        this.evaporationSystem.update(terrain, gameTime);
        if (shouldLog) console.timeEnd("Evaporation");

        // 5. Condensation (oversaturation → ground moisture)
        if (shouldLog) console.time("Condensation");
        this.condensationSystem.update(terrain, gameTime);
        if (shouldLog) console.timeEnd("Condensation");

        // 6. Ground moisture propagation
        if (shouldLog) console.time("Moisture");
        this.moistureSystem.update(terrain, gameTime);
        if (shouldLog) console.timeEnd("Moisture");

        if (shouldLog) {
            const totalTime = Date.now() - startTime;
            console.log(`Total tick time: ${totalTime}ms`);
            if (totalTime > PERFORMANCE_CONFIG.TICK_TIME_WARNING_MS) {
                console.warn("⚠️  Tick exceeded 5s target!");
            }
        }
    }
}
