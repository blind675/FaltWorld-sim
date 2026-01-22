import { type TerrainGrid } from "../schema";
import { type GameTime } from "../storage";
import { type ISimulationSystem } from "./ISimulationSystem";
import { GridHelper } from "./GridHelper";
import { EVAPORATION_CONFIG, PERFORMANCE_CONFIG } from "../config";
import { performance } from "node:perf_hooks";

/**
 * Manages evaporation from water bodies and evapotranspiration from ground
 */
export class EvaporationSystem implements ISimulationSystem {
    update(terrain: TerrainGrid, gameTime: GameTime): void {
        const shouldLog = PERFORMANCE_CONFIG.ENABLE_PERFORMANCE_LOGGING;
        const start = shouldLog ? performance.now() : 0;

        this.processWaterEvaporation(terrain);
        this.processEvapotranspiration(terrain);

        if (shouldLog) {
            const duration = performance.now() - start;
            if (duration > 1000) {
                console.warn(`${this.constructor.name} took ${Math.round(duration)}ms`);
            }
        }
    }

    /**
     * Process evaporation from water bodies into air
     */
    private processWaterEvaporation(terrain: TerrainGrid): void {
        const config = EVAPORATION_CONFIG;
        const { width, height } = GridHelper.getDimensions(terrain);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];

                if (cell.type !== "spring" && cell.type !== "river") continue;
                if (cell.water_height <= 0) continue;

                if (cell.temperature < 0) continue;
                const temperatureFactor = Math.max(0, 1 + config.EVAP_TEMP_COEFF * cell.temperature);

                const surfaceAreaFactor = Math.min(1.0, cell.water_height / config.MAX_EVAP_DEPTH);

                const saturationDeficit = Math.max(0, 1 - cell.air_humidity);

                const evaporationRate = config.BASE_EVAP_RATE
                    * temperatureFactor
                    * surfaceAreaFactor
                    * saturationDeficit;

                const waterLost = Math.min(evaporationRate, cell.water_height);
                cell.water_height -= waterLost;
                cell.altitude = cell.terrain_height + cell.water_height;

                const humidityGain = waterLost * config.WATER_TO_HUMIDITY_FACTOR;
                cell.air_humidity = Math.min(1.5, cell.air_humidity + humidityGain);
            }
        }
    }

    /**
     * Process evapotranspiration from ground moisture into air
     */
    private processEvapotranspiration(terrain: TerrainGrid): void {
        const config = EVAPORATION_CONFIG;
        const { width, height } = GridHelper.getDimensions(terrain);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];

                if (cell.type === "spring" || cell.type === "river") continue;

                if (cell.base_moisture < config.MIN_GROUND_MOISTURE) continue;

                if (cell.temperature < 0) continue;
                const temperatureFactor = Math.max(0, 1 + config.EVAP_TEMP_COEFF * cell.temperature);

                const saturationDeficit = Math.max(0, 1 - cell.air_humidity);

                const evapotranspirationRate = config.BASE_EVAPOTRANSPIRATION
                    * cell.base_moisture
                    * temperatureFactor
                    * saturationDeficit;

                const moistureLost = Math.min(evapotranspirationRate, cell.base_moisture);
                cell.base_moisture -= moistureLost;
                cell.moisture = cell.base_moisture;

                const humidityGain = moistureLost * config.WATER_TO_HUMIDITY_FACTOR;
                cell.air_humidity = Math.min(1.5, cell.air_humidity + humidityGain);
            }
        }
    }
}
