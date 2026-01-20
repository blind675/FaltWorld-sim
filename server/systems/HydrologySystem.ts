import { type TerrainGrid, type TerrainCell } from "@shared/schema";
import { type GameTime } from "../storage";
import { type ISimulationSystem } from "./ISimulationSystem";
import { GridHelper } from "./GridHelper";
import { EROSION_CONFIG, PERFORMANCE_CONFIG } from "../config";
import { performance } from "node:perf_hooks";

/**
 * River data structure
 */
interface River {
    name: string;
    points: TerrainCell[];
}

interface RiverQueueItem {
    river: River;
    priority: number;
}

/**
 * Manages water flow, river formation, and erosion
 */
export class HydrologySystem implements ISimulationSystem {
    private rivers: River[] = [];
    private riverNameCounter: number = 0;

    /**
     * Initialize rivers from spring points in the terrain
     */
    initializeRivers(terrain: TerrainGrid): void {
        this.rivers = [];
        this.riverNameCounter = 0;

        const { width, height } = GridHelper.getDimensions(terrain);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];
                if (cell.type === "spring") {
                    const riverName = this.generateRiverName();
                    cell.river_name = riverName;
                    this.rivers.push({
                        name: riverName,
                        points: [cell]
                    });
                    console.log(`🌊 Created ${riverName} at (${cell.x}, ${cell.y})`);
                }
            }
        }
    }

    /**
     * Get current rivers (for external access)
     */
    getRivers(): River[] {
        return this.rivers;
    }

    update(terrain: TerrainGrid, gameTime: GameTime): void {
        const shouldLog = PERFORMANCE_CONFIG.ENABLE_PERFORMANCE_LOGGING;
        const start = shouldLog ? performance.now() : 0;
        const queue = this.buildRiverQueue();
        let iterations = 0;

        // Process water flow for each river/stream, prioritizing higher-altitude sources
        while (queue.length > 0 && iterations < PERFORMANCE_CONFIG.MAX_RIVER_FLOW_ITERATIONS) {
            const item = this.popHighestPriorityRiver(queue);
            if (!item) break;
            if (!this.rivers.includes(item.river)) continue;

            this.processRiverFlow(terrain, item.river, PERFORMANCE_CONFIG.MIN_WATER_HEIGHT_THRESHOLD);
            iterations++;
        }

        if (shouldLog) {
            const duration = performance.now() - start;
            if (duration > 1000) {
                console.warn(`${this.constructor.name} took ${Math.round(duration)}ms`);
            }
        }
    }

    /**
     * Generate a unique river name
     */
    private generateRiverName(): string {
        this.riverNameCounter++;
        const names = [
            "Azure", "Crystal", "Silver", "Golden", "Emerald", "Sapphire", "Ruby",
            "Amber", "Pearl", "Diamond", "Jade", "Opal", "Topaz", "Moonlit",
            "Starlight", "Shadow", "Misty", "Whispering", "Thunder", "Serpent",
            "Dragon", "Phoenix", "Eagle", "Wolf", "Bear", "Salmon", "Trout"
        ];
        const suffixes = ["River", "Stream", "Creek", "Brook", "Flow", "Waters"];

        const nameIndex = (this.riverNameCounter - 1) % names.length;
        const suffixIndex = Math.floor((this.riverNameCounter - 1) / names.length) % suffixes.length;

        return `${names[nameIndex]} ${suffixes[suffixIndex]}`;
    }

    /**
     * Find the river index that contains a specific cell
     */
    private findRiverContainingCell(cell: TerrainCell): number {
        for (let i = 0; i < this.rivers.length; i++) {
            if (this.rivers[i].points.some(c => c.x === cell.x && c.y === cell.y)) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Merge two rivers when they meet
     * The larger river absorbs the smaller one and keeps its name
     */
    private mergeRivers(riverIndex1: number, riverIndex2: number): void {
        if (riverIndex1 === riverIndex2) return;

        const river1 = this.rivers[riverIndex1];
        const river2 = this.rivers[riverIndex2];

        const largerRiver = river1.points.length >= river2.points.length ? river1 : river2;
        const smallerRiver = river1.points.length >= river2.points.length ? river2 : river1;
        const largerIndex = river1.points.length >= river2.points.length ? riverIndex1 : riverIndex2;
        const smallerIndex = river1.points.length >= river2.points.length ? riverIndex2 : riverIndex1;

        for (const cell of smallerRiver.points) {
            if (!largerRiver.points.some(c => c.x === cell.x && c.y === cell.y)) {
                cell.river_name = largerRiver.name;
                largerRiver.points.push(cell);
            }
        }

        console.log(`🌊 ${smallerRiver.name} merged into ${largerRiver.name} (${largerRiver.points.length} total points)`);

        this.rivers.splice(smallerIndex, 1);
    }

    /**
     * Process water flow for a single stream/river
     */
    private processRiverFlow(
        terrain: TerrainGrid,
        river: River,
        minWaterHeightThreshold: number
    ): boolean {
        if (river.points.length === 0) return false;

        // Process each cell in the river - apply erosion
        let lowestCell: TerrainCell | null = null;

        for (const cell of river.points) {
            if (cell.type !== "spring" && cell.water_height < minWaterHeightThreshold) {
                continue;
            }
            const erosionAmount = EROSION_CONFIG.EROSION_RATE_WATER;
            cell.terrain_height = Math.max(
                cell.terrain_height - erosionAmount,
                -200
            );
            cell.water_height += erosionAmount;
            cell.altitude = cell.terrain_height + cell.water_height;

            if (!lowestCell || cell.altitude < lowestCell.altitude) {
                lowestCell = cell;
            }
        }

        if (!lowestCell) return false;

        const neighbors = GridHelper.getCardinalNeighbors(terrain, lowestCell.x, lowestCell.y);

        // Find the lowest neighbor that is not water/river/spring
        const nonWaterNeighbors = neighbors.filter(
            n => n.type !== "river" && n.type !== "spring"
        );

        if (nonWaterNeighbors.length > 0) {
            const lowestNonWaterNeighbor = nonWaterNeighbors.reduce((min, current) =>
                current.altitude < min.altitude ? current : min
            );

            // Check if water should flow to this neighbor
            if (lowestNonWaterNeighbor.altitude < lowestCell.altitude) {
                lowestNonWaterNeighbor.type = "river";
                lowestNonWaterNeighbor.water_height = 0.5;
                lowestNonWaterNeighbor.base_moisture = 1;
                lowestNonWaterNeighbor.added_moisture = 0;
                lowestNonWaterNeighbor.moisture = 1;
                lowestNonWaterNeighbor.altitude =
                    lowestNonWaterNeighbor.terrain_height + lowestNonWaterNeighbor.water_height;
                lowestNonWaterNeighbor.distance_from_water = 0;
                lowestNonWaterNeighbor.river_name = river.name;

                river.points.push(lowestNonWaterNeighbor);
                return true;
            }
        }

        // Check if lowest point has river/spring neighbors (potential merge)
        const waterNeighbors = neighbors.filter(
            n => (n.type === "river" || n.type === "spring") &&
                !river.points.some(c => c.x === n.x && c.y === n.y)
        );

        if (waterNeighbors.length > 0) {
            for (const waterNeighbor of waterNeighbors) {
                const otherRiverIndex = this.findRiverContainingCell(waterNeighbor);
                if (otherRiverIndex !== -1) {
                    const currentRiverIndex = this.rivers.indexOf(river);
                    if (currentRiverIndex !== -1 && currentRiverIndex !== otherRiverIndex) {
                        this.mergeRivers(currentRiverIndex, otherRiverIndex);
                        return true;
                    }
                }
            }
        }

        // No expansion possible, increase water level at lowest point
        lowestCell.water_height += 0.5;
        lowestCell.altitude = lowestCell.terrain_height + lowestCell.water_height;

        return true;
    }

    private buildRiverQueue(): RiverQueueItem[] {
        const queue = this.rivers.map((river) => ({
            river,
            priority: this.getRiverPriority(river)
        }));
        this.heapify(queue);
        return queue;
    }

    private getRiverPriority(river: River): number {
        let highestAltitude = -Infinity;
        for (const cell of river.points) {
            if (cell.altitude > highestAltitude) {
                highestAltitude = cell.altitude;
            }
        }
        return highestAltitude;
    }

    private heapify(queue: RiverQueueItem[]): void {
        for (let i = Math.floor(queue.length / 2) - 1; i >= 0; i--) {
            this.siftDown(queue, i);
        }
    }

    private popHighestPriorityRiver(queue: RiverQueueItem[]): RiverQueueItem | undefined {
        if (queue.length === 0) return undefined;
        const top = queue[0];
        const last = queue.pop();
        if (queue.length > 0 && last) {
            queue[0] = last;
            this.siftDown(queue, 0);
        }
        return top;
    }

    private siftDown(queue: RiverQueueItem[], index: number): void {
        let currentIndex = index;
        while (true) {
            const left = currentIndex * 2 + 1;
            const right = currentIndex * 2 + 2;
            let largest = currentIndex;

            if (left < queue.length && queue[left].priority > queue[largest].priority) {
                largest = left;
            }
            if (right < queue.length && queue[right].priority > queue[largest].priority) {
                largest = right;
            }

            if (largest === currentIndex) break;

            [queue[currentIndex], queue[largest]] = [queue[largest], queue[currentIndex]];
            currentIndex = largest;
        }
    }
}
