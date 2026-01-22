export interface TerrainCell {
  x: number;
  y: number;
  altitude: number;
  terrain_height: number;
  water_height: number;
  distance_from_water: number;
  base_moisture: number;
  added_moisture: number;
  moisture: number;
  temperature: number;
  air_humidity: number;
  cloud_density: number;
  precipitation_rate: number;
  ground_wetness: number;
  grass_density?: number;
  grass_type?: string;
  grass_health?: number;
  grass_dormant?: number;
  atmospheric_pressure?: number;
  wind_speed?: number;
  wind_direction?: number;
  type: string;
  river_name?: string;
}

export type TerrainGrid = TerrainCell[][];

// Game time system
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
