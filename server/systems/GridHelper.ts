import { type TerrainGrid, type TerrainCell } from "@shared/schema";

/**
 * Utility functions for grid operations with wrapping support
 */
export class GridHelper {
    /**
     * Get all 8 neighbors of a cell with world wrapping
     */
    static getNeighbors(terrain: TerrainGrid, x: number, y: number): TerrainCell[] {
        const neighbors: TerrainCell[] = [];
        const directions = [
            [0, -1], // North
            [0, 1], // South
            [-1, 0], // West
            [1, 0], // East
            [-1, -1], // Northwest
            [1, -1], // Northeast
            [-1, 1], // Southwest
            [1, 1], // Southeast
        ];

        const width = terrain[0].length;
        const height = terrain.length;

        for (const [dx, dy] of directions) {
            const newX = (x + dx + width) % width;
            const newY = (y + dy + height) % height;
            const cell = terrain[newY][newX];
            neighbors.push(cell);
        }

        return neighbors;
    }

    /**
     * Get grid dimensions
     */
    static getDimensions(terrain: TerrainGrid): { width: number; height: number } {
        return {
            width: terrain[0]?.length || 0,
            height: terrain.length
        };
    }
}
