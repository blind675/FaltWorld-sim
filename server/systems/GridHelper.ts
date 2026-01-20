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
     * Get only cardinal (4-direction) neighbors with world wrapping
     * Used for river propagation to avoid diagonal flow
     */
    static getCardinalNeighbors(terrain: TerrainGrid, x: number, y: number): TerrainCell[] {
        const neighbors: TerrainCell[] = [];
        const directions = [
            [0, -1], // North
            [0, 1], // South
            [-1, 0], // West
            [1, 0], // East
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
     * Get all 8 neighbors with their offset directions (for spreading algorithms)
     */
    static getNeighborsWithOffset(terrain: TerrainGrid, x: number, y: number): { cell: TerrainCell; dx: number; dy: number }[] {
        const neighbors: { cell: TerrainCell; dx: number; dy: number }[] = [];
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
            neighbors.push({ cell, dx, dy });
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
