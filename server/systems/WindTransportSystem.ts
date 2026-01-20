import { type TerrainGrid } from "@shared/schema";
import { type GameTime } from "../storage";
import { type ISimulationSystem } from "./ISimulationSystem";
import { GridHelper } from "./GridHelper";
import { WEATHER_CONFIG, WIND_TRANSPORT_CONFIG } from "../config";

const DEGREE_FULL_CIRCLE = 360;
const DEG_TO_RAD = Math.PI / (DEGREE_FULL_CIRCLE / 2);

/**
 * Transports humidity and heat based on wind vectors.
 */
export class WindTransportSystem implements ISimulationSystem {
    /**
     * Update humidity and temperature advection based on wind.
     */
    update(terrain: TerrainGrid, gameTime: GameTime): void {
        const { width, height } = GridHelper.getDimensions(terrain);
        const baseHumidity: number[][] = Array.from({ length: height }, (_, y) =>
            Array.from({ length: width }, (_, x) => terrain[y][x].air_humidity),
        );
        const baseTemperature: number[][] = Array.from({ length: height }, (_, y) =>
            Array.from({ length: width }, (_, x) => terrain[y][x].temperature),
        );
        const newHumidity = baseHumidity.map((row) => [...row]);
        const newTemperature = baseTemperature.map((row) => [...row]);

        let totalHumidityMoved = 0;
        let transports = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];
                const windSpeed = cell.wind_speed ?? 0;
                const windDirection = cell.wind_direction ?? 0;

                if (windSpeed < WIND_TRANSPORT_CONFIG.MIN_WIND_FOR_TRANSPORT) {
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
                const humidityTransfer = WIND_TRANSPORT_CONFIG.HUMIDITY_TRANSPORT_RATE * speedFactor;
                const heatTransfer = WIND_TRANSPORT_CONFIG.HEAT_TRANSPORT_RATE * speedFactor;

                const sourceHumidity = baseHumidity[sourceY][sourceX];
                const humidityDelta = sourceHumidity * humidityTransfer;

                if (humidityDelta > 0) {
                    newHumidity[sourceY][sourceX] = Math.max(0, newHumidity[sourceY][sourceX] - humidityDelta);
                    newHumidity[y][x] += humidityDelta;
                    totalHumidityMoved += humidityDelta;
                    transports++;
                }

                const sourceTemperature = baseTemperature[sourceY][sourceX];
                const temperatureDelta = (sourceTemperature - baseTemperature[y][x]) * heatTransfer;

                if (temperatureDelta !== 0) {
                    newTemperature[sourceY][sourceX] -= temperatureDelta;
                    newTemperature[y][x] += temperatureDelta;
                }
            }
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                terrain[y][x].air_humidity = Math.max(0, newHumidity[y][x]);
                terrain[y][x].temperature = newTemperature[y][x];
            }
        }

        if (transports > 0 && gameTime.hour % 6 === 0) {
            const avgHumidityMoved = totalHumidityMoved / transports;
            console.log(`WindTransport: avg humidity moved: ${avgHumidityMoved.toFixed(4)}`);
        }
    }
}
