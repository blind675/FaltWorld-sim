import { type TerrainCell, type TerrainGrid } from "@shared/schema";
import { WorldGenerator } from "./worldGenerator";
import { DEFAULT_WORLD_CONFIG, TIME_CONFIG } from "./config";
import { SimulationEngine } from "./systems/SimulationEngine";

// Month information with daylight hours and base temperatures (at equator, sea level)
interface MonthInfo {
  month: string;
  month_number: number;
  daylight_hours: number;
  temp_day: number;    // Day temperature at equator, sea level (°C)
  temp_night: number;  // Night temperature at equator, sea level (°C)
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


// Game time tracking system
export interface GameTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  is_day: boolean;
  month_name: string;
  daylight_hours: number;
}

export interface IStorage {
  getTerrainData(): Promise<TerrainGrid>;
  generateTerrain(): Promise<TerrainGrid>;
  landUpdate(): Promise<void>;
  getGameTime(): GameTime;
}

export class MemStorage implements IStorage {
  private terrain: TerrainGrid;
  private worldGenerator: WorldGenerator;
  private gameTime: GameTime;
  private simulationEngine: SimulationEngine;

  constructor() {
    this.terrain = [];
    this.worldGenerator = new WorldGenerator(DEFAULT_WORLD_CONFIG);
    this.simulationEngine = new SimulationEngine();

    // Initialize game time - starting at Year 1, January 1st, midnight
    this.gameTime = {
      year: 1,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      is_day: false,
      month_name: "January",
      daylight_hours: 8
    };
    this.updateDayNightStatus();
  }

  private updateDayNightStatus(): void {
    // Get current month info
    const monthInfo = MONTHS_INFO[this.gameTime.month - 1];
    this.gameTime.month_name = monthInfo.month;
    this.gameTime.daylight_hours = monthInfo.daylight_hours;

    // Day starts at 6 AM and lasts for daylight_hours
    // For example, if daylight_hours = 8, day is from 6:00 to 14:00 (6am to 2pm)
    // If daylight_hours = 16, day is from 6:00 to 22:00 (6am to 10pm)
    const dayStartHour = 6;
    const dayEndHour = dayStartHour + monthInfo.daylight_hours;

    this.gameTime.is_day = this.gameTime.hour >= dayStartHour && this.gameTime.hour < dayEndHour;
  }

  private advanceTime(): void {
    // Each tick = 1 hour in-game
    this.gameTime.hour += 1;

    // Handle hour overflow (24 hours per day)
    if (this.gameTime.hour >= TIME_CONFIG.HOURS_PER_DAY) {
      this.gameTime.hour = 0;
      this.gameTime.day += 1;

      // Handle day overflow (30 days per month)
      if (this.gameTime.day > TIME_CONFIG.DAYS_PER_MONTH) {
        this.gameTime.day = 1;
        this.gameTime.month += 1;

        // Handle month overflow (12 months per year)
        if (this.gameTime.month > TIME_CONFIG.MONTHS_PER_YEAR) {
          this.gameTime.month = 1;
          this.gameTime.year += 1;
        }
      }
    }

    // Update day/night status after time change
    this.updateDayNightStatus();
  }

  getGameTime(): GameTime {
    return { ...this.gameTime };
  }


  async landUpdate() {
    this.advanceTime();
    this.simulationEngine.update(this.terrain, this.gameTime);
  }

  async getTerrainData(): Promise<TerrainGrid> {
    return this.terrain;
  }

  async generateTerrain(): Promise<TerrainGrid> {
    // Regenerate the world with new noise seed
    this.worldGenerator.regenerate();

    // Generate terrain using the world generator with wrapping noise
    this.terrain = this.worldGenerator.generateTerrain();

    // Select and mark spring points
    const springs = this.worldGenerator.selectSpringPoints(this.terrain);

    // Initialize springs in terrain
    for (const spring of springs) {
      if (this.terrain[spring.y] && this.terrain[spring.y][spring.x]) {
        const cell = this.terrain[spring.y][spring.x];
        cell.type = "spring";
        cell.base_moisture = 1;
        cell.added_moisture = 0;
        cell.moisture = 1;
        cell.water_height = 1;
        cell.altitude = cell.terrain_height + cell.water_height;
        cell.distance_from_water = 0;
        cell.temperature = 0;
      }
    }

    // Initialize rivers in the hydrology system
    this.simulationEngine.getHydrologySystem().initializeRivers(this.terrain);

    return this.terrain;
  }
}

export const storage = new MemStorage();
