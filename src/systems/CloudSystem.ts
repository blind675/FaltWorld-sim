import { type TerrainGrid } from "../schema";
import { type GameTime } from "../storage";
import { type ISimulationSystem } from "./ISimulationSystem";
import { GridHelper } from "./GridHelper";
import { CLOUD_CONFIG, DEBUG_CONFIG, DEFAULT_WORLD_CONFIG, WEATHER_CONFIG } from "../config";

const DEGREE_FULL_CIRCLE = 360;
const DEG_TO_RAD = Math.PI / (DEGREE_FULL_CIRCLE / 2);

/**
 * Forms and advects clouds based on humidity and wind.
 */
export class CloudSystem implements ISimulationSystem {
    /**
     * Update cloud density based on saturation and wind advection.
     */
    update(terrain: TerrainGrid, gameTime: GameTime): void {
        const { width, height } = GridHelper.getDimensions(terrain);
        const baseClouds: number[][] = Array.from({ length: height }, (_, y) =>
            Array.from({ length: width }, (_, x) => terrain[y][x].cloud_density ?? 0),
        );
        const newClouds = baseClouds.map((row) => [...row]);

        this.advectClouds(terrain, baseClouds, newClouds);

        let maxFormation = 0;
        let maxFormationCell: { x: number; y: number } | null = null;
        let cloudFormed = 0;

        const altitudeRange = DEFAULT_WORLD_CONFIG.maxHeight - DEFAULT_WORLD_CONFIG.minHeight;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];
                const altitudeNormalized = altitudeRange > 0
                    ? Math.min(1, Math.max(0, (cell.terrain_height - DEFAULT_WORLD_CONFIG.minHeight) / altitudeRange))
                    : 0;

                const saturationThreshold = Math.max(
                    0,
                    CLOUD_CONFIG.BASE_SATURATION * (1 - CLOUD_CONFIG.ALTITUDE_SATURATION_FACTOR * altitudeNormalized),
                );

                if (cell.air_humidity > saturationThreshold) {
                    const excessHumidity = cell.air_humidity - saturationThreshold;
                    const formation = excessHumidity * CLOUD_CONFIG.CLOUD_FORMATION_RATE;
                    newClouds[y][x] = Math.min(1, newClouds[y][x] + formation);
                    cell.air_humidity = Math.max(0, cell.air_humidity - formation);
                    cloudFormed += formation;

                    if (formation > maxFormation) {
                        maxFormation = formation;
                        maxFormationCell = { x, y };
                    }
                } else {
                    const deficit = saturationThreshold - cell.air_humidity;
                    newClouds[y][x] = Math.max(0, newClouds[y][x] - deficit * CLOUD_CONFIG.CLOUD_DISSIPATION_RATE);
                }
            }
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                terrain[y][x].cloud_density = Math.min(1, Math.max(0, newClouds[y][x]));
            }
        }

        if (DEBUG_CONFIG.WEATHER_VERBOSE_LOGGING && cloudFormed > 0) {
            console.log(`CloudSystem: Formed ${cloudFormed.toFixed(2)} cloud density from humidity`);
        }

        if (maxFormationCell && maxFormation > 0.08 && gameTime.hour % 6 === 0) {
            console.log(
                `CloudSystem: Dense clouds forming at region ${maxFormationCell.x},${maxFormationCell.y}`,
            );
        }
    }

    private advectClouds(
        terrain: TerrainGrid,
        baseClouds: number[][],
        newClouds: number[][],
    ): void {
        const { width, height } = GridHelper.getDimensions(terrain);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];
                const windSpeed = cell.wind_speed ?? 0;
                const windDirection = cell.wind_direction ?? 0;

                if (windSpeed <= 0) {
                    continue;
                }

                const radians = windDirection * DEG_TO_RAD;
                const windVectorX = Math.sin(radians);
                const windVectorY = -Math.cos(radians);

                const sourceOffsetX = Math.round(-windVectorX);
                const sourceOffsetY = Math.round(-windVectorY);

                if (sourceOffsetX === 0 && sourceOffsetY === 0) {
                    continue;
                }

                const sourceX = (x + sourceOffsetX + width) % width;
                const sourceY = (y + sourceOffsetY + height) % height;

                const speedFactor = Math.min(1, windSpeed / WEATHER_CONFIG.MAX_WIND_SPEED);
                const advectionAmount = baseClouds[sourceY][sourceX]
                    * CLOUD_CONFIG.CLOUD_ADVECTION_RATE
                    * speedFactor;

                if (advectionAmount > 0) {
                    newClouds[sourceY][sourceX] = Math.max(0, newClouds[sourceY][sourceX] - advectionAmount);
                    newClouds[y][x] = Math.min(1, newClouds[y][x] + advectionAmount);
                }
            }
        }
    }
}
