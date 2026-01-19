import { type TerrainGrid, type TerrainCell } from "@shared/schema";
import { type GameTime } from "../storage";

/**
 * Base interface for all simulation systems
 * Each system operates on the terrain grid and is stateless
 */
export interface ISimulationSystem {
    /**
     * Update the terrain state for this system
     * @param terrain - The terrain grid to update
     * @param gameTime - Current game time
     */
    update(terrain: TerrainGrid, gameTime: GameTime): void;
}

/**
 * Helper type for neighbor operations
 */
export interface NeighborHelper {
    getNeighbors(terrain: TerrainGrid, x: number, y: number): TerrainCell[];
}
