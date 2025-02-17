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
  base_moisture: real("base_moisture").notNull(),
  moisture: real("moisture").notNull(),
  type: text("type").notNull(),
});

export const insertTerrainCellSchema = createInsertSchema(terrainCells);

export type InsertTerrainCell = z.infer<typeof insertTerrainCellSchema>;
export type TerrainCell = typeof terrainCells.$inferSelect;

export type TerrainGrid = TerrainCell[][];
