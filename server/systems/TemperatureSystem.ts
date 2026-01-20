import { type TerrainGrid } from "../schema";
import { type GameTime } from "../storage";
import { type ISimulationSystem } from "./ISimulationSystem";
import { GridHelper } from "./GridHelper";
import { getTemperature } from "../temperature";
import { PERFORMANCE_CONFIG } from "../config";
import { performance } from "node:perf_hooks";

/**
 * Month information for temperature calculations
 */
interface MonthInfo {
    month: string;
    month_number: number;
    daylight_hours: number;
    temp_day: number;
    temp_night: number;
}

const MONTHS_INFO: MonthInfo[] = [
    { month: "January", month_number: 1, daylight_hours: 8, temp_day: 24, temp_night: 18 },
    { month: "February", month_number: 2, daylight_hours: 9, temp_day: 25, temp_night: 19 },
    { month: "March", month_number: 3, daylight_hours: 12, temp_day: 26, temp_night: 20 },
    { month: "April", month_number: 4, daylight_hours: 13, temp_day: 27, temp_night: 21 },
    { month: "May", month_number: 5, daylight_hours: 15, temp_day: 28, temp_night: 22 },
    { month: "June", month_number: 6, daylight_hours: 16, temp_day: 29, temp_night: 23 },
    { month: "July", month_number: 7, daylight_hours: 15, temp_day: 28, temp_night: 22 },
    { month: "August", month_number: 8, daylight_hours: 14, temp_day: 27, temp_night: 21 },
    { month: "September", month_number: 9, daylight_hours: 12, temp_day: 26, temp_night: 20 },
    { month: "October", month_number: 10, daylight_hours: 10, temp_day: 25, temp_night: 19 },
    { month: "November", month_number: 11, daylight_hours: 9, temp_day: 24, temp_night: 18 },
    { month: "December", month_number: 12, daylight_hours: 8, temp_day: 23, temp_night: 17 }
];

/**
 * Manages temperature calculations based on latitude, altitude, and time
 */
export class TemperatureSystem implements ISimulationSystem {
    update(terrain: TerrainGrid, gameTime: GameTime): void {
        const shouldLog = PERFORMANCE_CONFIG.ENABLE_PERFORMANCE_LOGGING;
        const start = shouldLog ? performance.now() : 0;

        this.updateTemperature(terrain, gameTime);

        if (shouldLog) {
            const duration = performance.now() - start;
            if (duration > 1000) {
                console.warn(`${this.constructor.name} took ${Math.round(duration)}ms`);
            }
        }
    }

    private updateTemperature(terrain: TerrainGrid, gameTime: GameTime): void {
        const monthInfo = MONTHS_INFO[gameTime.month - 1];
        const monthTempDay = monthInfo.temp_day;
        const monthTempNight = monthInfo.temp_night;
        const currentHour = gameTime.hour;

        const { width, height } = GridHelper.getDimensions(terrain);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];
                const altitudeMeters = cell.terrain_height;
                cell.temperature = getTemperature(
                    x,
                    y,
                    altitudeMeters,
                    width,
                    height,
                    monthTempDay,
                    monthTempNight,
                    currentHour
                );
            }
        }
    }
}
