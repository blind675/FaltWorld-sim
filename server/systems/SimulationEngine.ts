import { type TerrainGrid } from "@shared/schema";
import { type GameTime } from "../storage";
import { type ISimulationSystem } from "./ISimulationSystem";
import { TemperatureSystem } from "./TemperatureSystem";
import { HydrologySystem } from "./HydrologySystem";
import { EvaporationSystem } from "./EvaporationSystem";
import { HumiditySystem } from "./HumiditySystem";
import { CondensationSystem } from "./CondensationSystem";
import { MoistureSystem } from "./MoistureSystem";

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
        // 1. Update temperature (affects saturation capacity)
        this.temperatureSystem.update(terrain, gameTime);

        // 2. Process hydrology (river flow, erosion)
        this.hydrologySystem.update(terrain, gameTime);

        // 3. Adjust humidity for temperature changes and diffuse
        this.humiditySystem.update(terrain, gameTime);

        // 4. Evaporation from water bodies and ground
        this.evaporationSystem.update(terrain, gameTime);

        // 5. Condensation (oversaturation → ground moisture)
        this.condensationSystem.update(terrain, gameTime);

        // 6. Ground moisture propagation
        this.moistureSystem.update(terrain, gameTime);
    }
}
