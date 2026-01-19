import { type TerrainGrid } from "@shared/schema";
import { type GameTime } from "../storage";
import { type ISimulationSystem } from "./ISimulationSystem";
import { GridHelper } from "./GridHelper";
import { DIFFUSION_CONFIG, PERFORMANCE_CONFIG, SATURATION_CONFIG } from "../config";
import { performance } from "node:perf_hooks";

/**
 * Manages air humidity diffusion and saturation calculations
 */
export class HumiditySystem implements ISimulationSystem {
    update(terrain: TerrainGrid, gameTime: GameTime): void {
        const shouldLog = PERFORMANCE_CONFIG.ENABLE_PERFORMANCE_LOGGING;
        const start = shouldLog ? performance.now() : 0;

        this.adjustHumidityForTemperatureChange(terrain);
        this.diffuseHumidity(terrain);

        if (shouldLog) {
            const duration = performance.now() - start;
            if (duration > 1000) {
                console.warn(`${this.constructor.name} took ${Math.round(duration)}ms`);
            }
        }
    }

    /**
     * Calculate saturation capacity for air at given temperature and altitude
     * Returns maximum water vapor the air can hold (0-1 scale)
     */
    private getSaturationCapacity(temperatureCelsius: number, altitudeMeters: number): number {
        const config = SATURATION_CONFIG;

        const tempFactor = Math.exp(config.TEMP_COEFFICIENT * temperatureCelsius);
        const pressureFactor = Math.exp(-altitudeMeters / config.SCALE_HEIGHT);

        return config.BASE_SATURATION * tempFactor * pressureFactor;
    }

    /**
     * Adjust humidity when temperature changes (maintains absolute humidity)
     */
    private adjustHumidityForTemperatureChange(terrain: TerrainGrid): void {
        const { width, height } = GridHelper.getDimensions(terrain);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];

                const currentCapacity = this.getSaturationCapacity(cell.temperature, Math.max(0, cell.terrain_height));
                const absoluteHumidity = cell.air_humidity * currentCapacity;
                const newRelativeHumidity = absoluteHumidity / currentCapacity;

                cell.air_humidity = newRelativeHumidity;
            }
        }
    }

    /**
     * Diffuse humidity across the map with altitude bias
     */
    private diffuseHumidity(terrain: TerrainGrid): void {
        const config = DIFFUSION_CONFIG;
        const { width, height } = GridHelper.getDimensions(terrain);
        const minHumidity = Math.max(config.MIN_TRANSFER_THRESHOLD, PERFORMANCE_CONFIG.MIN_HUMIDITY_THRESHOLD);

        for (let iteration = 0; iteration < PERFORMANCE_CONFIG.HUMIDITY_DIFFUSION_ITERATIONS; iteration++) {
            const newHumidity: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));

            const activeCells: Array<{ x: number; y: number }> = [];

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const humidity = terrain[y][x].air_humidity;
                    newHumidity[y][x] = humidity;
                    if (humidity >= minHumidity) {
                        activeCells.push({ x, y });
                    }
                }
            }

            let cellsProcessed = 0;

            for (const { x, y } of activeCells) {
                if (cellsProcessed >= config.MAX_CELLS_PROCESSED_PER_TICK) break;
                const cell = terrain[y][x];

                const neighbors = GridHelper.getNeighbors(terrain, x, y);
                const cellCapacity = this.getSaturationCapacity(cell.temperature, Math.max(0, cell.terrain_height));
                const cellAbsolute = cell.air_humidity * cellCapacity;

                for (const neighbor of neighbors) {
                    const altitudeDiff = neighbor.altitude - cell.altitude;

                    let transfer = config.HUMIDITY_DIFFUSION_RATE;

                    if (altitudeDiff > 0) {
                        const altitudeBonus = Math.min(config.UPWARD_BIAS_MAX, altitudeDiff * config.UPWARD_BIAS_COEFF);
                        transfer *= (1 + altitudeBonus);
                    } else if (altitudeDiff < 0) {
                        const altitudePenalty = Math.min(config.DOWNWARD_PENALTY_MAX, Math.abs(altitudeDiff) * config.DOWNWARD_PENALTY_COEFF);
                        transfer *= (1 - altitudePenalty);
                    }

                    const neighborCapacity = this.getSaturationCapacity(neighbor.temperature, Math.max(0, neighbor.terrain_height));
                    const neighborAbsolute = neighbor.air_humidity * neighborCapacity;

                    const maxTransferAbsolute = Math.max(0, neighborCapacity - neighborAbsolute);
                    const transferAbsolute = Math.min(transfer * cellAbsolute, maxTransferAbsolute);

                    if (transferAbsolute > 0.0001) {
                        newHumidity[y][x] -= transferAbsolute / cellCapacity;
                        newHumidity[neighbor.y][neighbor.x] += transferAbsolute / neighborCapacity;
                        cellsProcessed++;
                    }
                }
            }

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    terrain[y][x].air_humidity = Math.max(0, newHumidity[y][x]);
                }
            }
        }
    }
}
