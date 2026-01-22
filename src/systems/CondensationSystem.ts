import { type TerrainGrid } from "../schema";
import { type GameTime } from "../storage";
import { type ISimulationSystem } from "./ISimulationSystem";
import { GridHelper } from "./GridHelper";
import { CONDENSATION_CONFIG, MOISTURE_CONFIG, PERFORMANCE_CONFIG } from "../config";
import { performance } from "node:perf_hooks";

/**
 * Manages condensation from air to ground moisture
 */
export class CondensationSystem implements ISimulationSystem {
    update(terrain: TerrainGrid, gameTime: GameTime): void {
        const shouldLog = PERFORMANCE_CONFIG.ENABLE_PERFORMANCE_LOGGING;
        const start = shouldLog ? performance.now() : 0;

        this.processCondensation(terrain);

        if (shouldLog) {
            const duration = performance.now() - start;
            if (duration > 1000) {
                console.warn(`${this.constructor.name} took ${Math.round(duration)}ms`);
            }
        }
    }

    /**
     * Process condensation from air to ground
     */
    private processCondensation(terrain: TerrainGrid): void {
        const config = CONDENSATION_CONFIG;
        const { width, height } = GridHelper.getDimensions(terrain);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];

                // Oversaturation condensation
                if (cell.air_humidity > 1.0) {
                    const excess = cell.air_humidity - 1.0;
                    const condensationAmount = excess * config.CONDENSATION_RATE;

                    cell.air_humidity -= condensationAmount;

                    if (cell.type !== "spring" && cell.type !== "river") {
                        cell.base_moisture = Math.min(
                            MOISTURE_CONFIG.maxLandMoisture,
                            cell.base_moisture + condensationAmount * config.AIR_TO_GROUND_FACTOR
                        );
                        cell.moisture = cell.base_moisture;
                    }
                }

                // Dew formation
                if (cell.air_humidity > config.DEW_THRESHOLD && cell.temperature < 15) {
                    const dewAmount = (cell.air_humidity - config.DEW_THRESHOLD) * config.DEW_CONDENSATION_RATE;

                    cell.air_humidity -= dewAmount;

                    if (cell.type !== "spring" && cell.type !== "river") {
                        cell.base_moisture = Math.min(
                            MOISTURE_CONFIG.maxLandMoisture,
                            cell.base_moisture + dewAmount * config.AIR_TO_GROUND_FACTOR
                        );
                        cell.moisture = cell.base_moisture;
                    }
                }
            }
        }
    }
}
