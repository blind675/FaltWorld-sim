import { type TerrainGrid } from "@shared/schema";
import { type GameTime } from "../storage";
import { type ISimulationSystem } from "./ISimulationSystem";
import { GridHelper } from "./GridHelper";
import { WEATHER_CONFIG } from "../config";

const DEGREE_FULL_CIRCLE = 360;
const RAD_TO_DEG = DEGREE_FULL_CIRCLE / (2 * Math.PI);
const MIN_VECTOR_MAGNITUDE = 1e-6;

/**
 * Calculates atmospheric pressure and wind vectors from pressure gradients.
 */
export class WeatherSystem implements ISimulationSystem {
    update(terrain: TerrainGrid, gameTime: GameTime): void {
        this.updatePressure(terrain);
        this.updateWind(terrain);
    }

    private updatePressure(terrain: TerrainGrid): void {
        const { width, height } = GridHelper.getDimensions(terrain);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];
                const altitude = cell.altitude;
                const temperature = cell.temperature ?? 0;
                const humidity = cell.air_humidity ?? 0;

                cell.atmospheric_pressure = WEATHER_CONFIG.BASE_PRESSURE
                    - (altitude * WEATHER_CONFIG.PRESSURE_LAPSE_RATE)
                    - (temperature * WEATHER_CONFIG.TEMP_PRESSURE_FACTOR)
                    - (humidity * WEATHER_CONFIG.HUMIDITY_PRESSURE_FACTOR);
            }
        }
    }

    private updateWind(terrain: TerrainGrid): void {
        const { width, height } = GridHelper.getDimensions(terrain);
        const smoothing = WEATHER_CONFIG.WIND_SMOOTHING_FACTOR;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];
                const currentPressure = cell.atmospheric_pressure ?? WEATHER_CONFIG.BASE_PRESSURE;
                const neighbors = GridHelper.getNeighbors(terrain, x, y);

                let gradientX = 0;
                let gradientY = 0;

                for (const neighbor of neighbors) {
                    let dx = neighbor.x - x;
                    let dy = neighbor.y - y;

                    if (dx > 1) dx -= width;
                    if (dx < -1) dx += width;
                    if (dy > 1) dy -= height;
                    if (dy < -1) dy += height;

                    const neighborPressure = neighbor.atmospheric_pressure ?? currentPressure;
                    const pressureDiff = currentPressure - neighborPressure;

                    gradientX += dx * pressureDiff;
                    gradientY += dy * pressureDiff;
                }

                const gradientMagnitude = Math.sqrt(gradientX * gradientX + gradientY * gradientY);
                const gradientVectorX = gradientMagnitude > MIN_VECTOR_MAGNITUDE
                    ? gradientX / gradientMagnitude
                    : 0;
                const gradientVectorY = gradientMagnitude > MIN_VECTOR_MAGNITUDE
                    ? gradientY / gradientMagnitude
                    : 0;

                const rawSpeed = gradientMagnitude * WEATHER_CONFIG.WIND_GENERATION_FACTOR;
                const clampedSpeed = Math.min(rawSpeed, WEATHER_CONFIG.MAX_WIND_SPEED);
                const windVectorX = gradientVectorX * clampedSpeed;
                const windVectorY = gradientVectorY * clampedSpeed;

                const previousSpeed = cell.wind_speed ?? 0;
                const previousDirection = cell.wind_direction ?? 0;
                const previousRadians = (previousDirection * Math.PI) / 180;
                const previousVectorX = Math.sin(previousRadians) * previousSpeed;
                const previousVectorY = -Math.cos(previousRadians) * previousSpeed;

                let blendedX = previousVectorX * (1 - smoothing) + windVectorX * smoothing;
                let blendedY = previousVectorY * (1 - smoothing) + windVectorY * smoothing;

                let blendedSpeed = Math.sqrt(blendedX * blendedX + blendedY * blendedY);

                if (blendedSpeed > WEATHER_CONFIG.MAX_WIND_SPEED) {
                    const scale = WEATHER_CONFIG.MAX_WIND_SPEED / blendedSpeed;
                    blendedX *= scale;
                    blendedY *= scale;
                    blendedSpeed = WEATHER_CONFIG.MAX_WIND_SPEED;
                }

                if (blendedSpeed <= MIN_VECTOR_MAGNITUDE) {
                    cell.wind_speed = 0;
                    cell.wind_direction = 0;
                } else {
                    const directionRadians = Math.atan2(blendedX, -blendedY);
                    const directionDegrees = (directionRadians * RAD_TO_DEG + DEGREE_FULL_CIRCLE)
                        % DEGREE_FULL_CIRCLE;

                    cell.wind_speed = blendedSpeed;
                    cell.wind_direction = directionDegrees;
                }
            }
        }
    }
}
