import { z } from "zod";

// Shared types for terrain cells (without drizzle dependencies)
export const terrainCellSchema = z.object({
    id: z.number(),
    x: z.number(),
    y: z.number(),
    altitude: z.number(),
    terrain_height: z.number(),
    water_height: z.number(),
    distance_from_water: z.number(),
    base_moisture: z.number(),
    added_moisture: z.number(),
    moisture: z.number(),
    temperature: z.number().default(0),
    air_humidity: z.number().default(0),
    cloud_density: z.number().default(0),
    precipitation_rate: z.number().default(0),
    ground_wetness: z.number().default(0),
    grass_density: z.number().nullable(),
    grass_type: z.string().nullable(),
    grass_health: z.number().nullable(),
    grass_dormant: z.number().nullable(),
    atmospheric_pressure: z.number().nullable(),
    wind_speed: z.number().nullable(),
    wind_direction: z.number().nullable(),
    type: z.string(),
    river_name: z.string().nullable(),
});

export type TerrainCell = z.infer<typeof terrainCellSchema>;

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
