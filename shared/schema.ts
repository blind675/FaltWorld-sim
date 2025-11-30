import { pgTable, text, serial, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const terrainCells = pgTable("terrain_cells", {
  id: serial("id").primaryKey(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  altitude: real("altitude").notNull(),
  terrain_height: real("terrain_height").notNull(),
  water_height: real("water_height").notNull(),
  distance_from_water: real("distance_from_water").notNull(),
  base_moisture: real("base_moisture").notNull(),
  added_moisture: real("added_moisture").notNull(),
  moisture: real("moisture").notNull(),
  temperature: real("temperature").notNull().default(0),
  type: text("type").notNull(),
  river_name: text("river_name"),
});

export const insertTerrainCellSchema = createInsertSchema(terrainCells);

export type InsertTerrainCell = z.infer<typeof insertTerrainCellSchema>;
export type TerrainCell = typeof terrainCells.$inferSelect;

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
