import { type TerrainGrid } from "@shared/schema";
import { type GameTime } from "../storage";
import { type ISimulationSystem } from "./ISimulationSystem";
import { GridHelper } from "./GridHelper";
import { CONDENSATION_CONFIG, MOISTURE_CONFIG } from "../config";

/**
 * Manages condensation from air to ground moisture
 */
export class CondensationSystem implements ISimulationSystem {
    update(terrain: TerrainGrid, gameTime: GameTime): void {
        this.processCondensation(terrain);
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
