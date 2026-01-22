import { type TerrainGrid } from "../schema";
import { type GameTime } from "../storage";
import { type ISimulationSystem } from "./ISimulationSystem";
import { GridHelper } from "./GridHelper";
import { DEBUG_CONFIG, MOISTURE_CONFIG, PRECIPITATION_CONFIG } from "../config";

/**
 * Generates rain from clouds and applies ground impacts.
 */
export class PrecipitationSystem implements ISimulationSystem {
    /**
     * Update precipitation, cloud depletion, and ground wetness.
     */
    update(terrain: TerrainGrid, gameTime: GameTime): void {
        const { width, height } = GridHelper.getDimensions(terrain);
        let maxRain = 0;
        let maxRainCell: { x: number; y: number } | null = null;
        let totalRain = 0;
        let rainingCells = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];
                cell.precipitation_rate = 0;

                const cloudDensity = cell.cloud_density ?? 0;
                if (cloudDensity > PRECIPITATION_CONFIG.PRECIP_THRESHOLD) {
                    const intensity = (cloudDensity - PRECIPITATION_CONFIG.PRECIP_THRESHOLD)
                        * PRECIPITATION_CONFIG.PRECIP_RATE;

                    cell.precipitation_rate = intensity;
                    totalRain += intensity;
                    rainingCells += 1;
                    cell.cloud_density = Math.max(0, cloudDensity - intensity);
                    cell.air_humidity = Math.max(0, cell.air_humidity - intensity * PRECIPITATION_CONFIG.HUMIDITY_REDUCTION);

                    const wetnessGain = intensity * PRECIPITATION_CONFIG.WETNESS_FROM_RAIN;
                    cell.ground_wetness = Math.min(1, (cell.ground_wetness ?? 0) + wetnessGain);

                    const absorbed = intensity * PRECIPITATION_CONFIG.GROUND_ABSORPTION_RATE;
                    const newMoisture = Math.min(
                        MOISTURE_CONFIG.maxLandMoisture,
                        (cell.moisture ?? 0) + absorbed,
                    );
                    cell.moisture = newMoisture;
                    cell.base_moisture = newMoisture;

                    cell.temperature -= intensity * PRECIPITATION_CONFIG.COOLING_FACTOR;

                    if (intensity > maxRain) {
                        maxRain = intensity;
                        maxRainCell = { x, y };
                    }
                }

                cell.ground_wetness = Math.max(
                    0,
                    (cell.ground_wetness ?? 0) - PRECIPITATION_CONFIG.WETNESS_DRY_RATE,
                );

                // TODO: Future snow implementation
                // - If temperature < freezing_point → snow instead of rain
                // - Snow accumulates as snow_depth property
                // - Snow melts when temperature > melting_point
                // - Snow provides movement penalty for animals
                // - Snow insulates ground (reduces temp fluctuation)
            }
        }

        if (maxRainCell && maxRain > 0.05 && gameTime.hour % 6 === 0) {
            console.log(
                `PrecipitationSystem: Rain at ${maxRainCell.x},${maxRainCell.y} - intensity: ${maxRain.toFixed(3)}`,
            );
        }

        if (DEBUG_CONFIG.WEATHER_VERBOSE_LOGGING && totalRain > 0) {
            console.log(
                `PrecipitationSystem: ${rainingCells} cells raining, total: ${totalRain.toFixed(2)}`,
            );
        }
    }
}
