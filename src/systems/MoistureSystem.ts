import { type TerrainGrid, type TerrainCell } from "../schema";
import { type GameTime } from "../storage";
import { type ISimulationSystem } from "./ISimulationSystem";
import { GridHelper } from "./GridHelper";
import { MOISTURE_CONFIG, PERFORMANCE_CONFIG } from "../config";
import { performance } from "node:perf_hooks";

/**
 * Manages ground moisture propagation from water sources
 */
export class MoistureSystem implements ISimulationSystem {
    update(terrain: TerrainGrid, gameTime: GameTime): void {
        const shouldLog = PERFORMANCE_CONFIG.ENABLE_PERFORMANCE_LOGGING;
        const start = shouldLog ? performance.now() : 0;

        this.propagateMoisture(terrain);

        if (shouldLog) {
            const duration = performance.now() - start;
            if (duration > 1000) {
                console.warn(`${this.constructor.name} took ${Math.round(duration)}ms`);
            }
        }
    }

    private propagateMoisture(terrain: TerrainGrid): void {
        const config = MOISTURE_CONFIG;
        const MAX_LAND_MOISTURE = config.maxLandMoisture;
        const MOISTURE_TRANSFER_RATE = config.transferRate;
        const UPHILL_PENALTY_PERCENT = config.uphillPenaltyPercent;
        const ALTITUDE_DRYNESS_PERCENT = config.altitudeDrynessPercent;
        const DOWNHILL_BONUS_PERCENT = config.downhillBonusPercent;
        const MIN_TRANSFER = config.minTransfer;
        const MAX_CELLS_PROCESSED = config.maxCellsProcessed;
        const BASE_DECAY = config.baseDecay;

        const visited = new Set<string>();
        let cellsProcessed = 0;

        const queue: Array<{ cell: TerrainCell, distance: number }> = [];
        const maxDistance = PERFORMANCE_CONFIG.MAX_MOISTURE_PROPAGATION_DISTANCE;
        const minMoistureThreshold = PERFORMANCE_CONFIG.MIN_MOISTURE_THRESHOLD;

        // Initialize queue with all river cells
        const { width, height } = GridHelper.getDimensions(terrain);
        let riverCount = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];
                if (cell.type === "river" || cell.type === "spring") {
                    const key = `${cell.x},${cell.y}`;
                    if (!visited.has(key)) {
                        visited.add(key);
                        cell.distance_from_water = 0;
                        cell.base_moisture = 1.0;
                        cell.moisture = 1.0;
                        queue.push({ cell, distance: 0 });
                        if (cell.type === "spring") riverCount++;
                    }
                }
            }
        }

        console.log(`[moisture] Found ${riverCount} springs, ${queue.length} water cells`);

        if (queue.length === 0) {
            console.log('[moisture] WARNING: No water sources found!');
            return;
        }

        // Breadth-first propagation
        let queueIndex = 0;
        while (queueIndex < queue.length && cellsProcessed < MAX_CELLS_PROCESSED) {
            const { cell, distance } = queue[queueIndex];
            queueIndex++;
            cellsProcessed++;

            const neighbors = GridHelper.getNeighbors(terrain, cell.x, cell.y);

            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;

                if (visited.has(neighborKey)) continue;
                if (neighbor.type === "river" || neighbor.type === "spring") continue;

                const newDistance = distance + 1;
                if (newDistance > maxDistance) continue;
                // Exponential decay for smoother, more organic falloff
                const distanceDecay = Math.exp(-newDistance * config.distanceDecayRate);

                const waterVolumeBoost = 1.0 + Math.min(
                    cell.water_height * config.waterVolumeBoostFactor,
                    config.maxWaterVolumeBoost
                );

                const baseMoisture = distanceDecay * MOISTURE_TRANSFER_RATE * waterVolumeBoost;

                if (baseMoisture < MIN_TRANSFER || baseMoisture < minMoistureThreshold) continue;

                let moistureMultiplier = 1.0;

                const heightDiff = neighbor.altitude - cell.altitude;
                if (heightDiff > 0) {
                    const uphillPenalty = heightDiff * UPHILL_PENALTY_PERCENT;
                    moistureMultiplier -= uphillPenalty;
                } else if (heightDiff < 0) {
                    const downhillBonus = Math.abs(heightDiff) * DOWNHILL_BONUS_PERCENT;
                    moistureMultiplier += downhillBonus;
                }

                const altitudeDryness = Math.max(0, neighbor.terrain_height) * ALTITUDE_DRYNESS_PERCENT;
                moistureMultiplier -= altitudeDryness;

                moistureMultiplier = Math.max(0.05, Math.min(1.5, moistureMultiplier));

                let effectiveTransfer = baseMoisture * moistureMultiplier;

                if (neighbor.base_moisture > 0) {
                    const saturationFactor = 1 - (neighbor.base_moisture / MAX_LAND_MOISTURE);
                    const diminishingReturns = Math.pow(saturationFactor, config.saturationExponent);
                    effectiveTransfer *= diminishingReturns;
                }

                if (neighbor.base_moisture >= MAX_LAND_MOISTURE) continue;

                if (effectiveTransfer > 0 && neighbor.base_moisture < MAX_LAND_MOISTURE) {
                    const newMoisture = Math.min(
                        neighbor.base_moisture + effectiveTransfer,
                        MAX_LAND_MOISTURE
                    );

                    if (newMoisture > neighbor.base_moisture + 0.00001) {
                        neighbor.base_moisture = newMoisture;
                        neighbor.moisture = newMoisture;
                        neighbor.distance_from_water = newDistance;

                        visited.add(neighborKey);
                        queue.push({
                            cell: neighbor,
                            distance: newDistance
                        });

                        if (neighbor.moisture > 0.8) {
                            neighbor.type = "mud";
                        } else if (neighbor.moisture > 0.2) {
                            neighbor.type = "earth";
                        }
                    }
                }
            }
        }

        if (cellsProcessed >= MAX_CELLS_PROCESSED) {
            console.log(`Hit cell processing limit: ${cellsProcessed} cells, queue remaining: ${queue.length}`);
        }

        // Apply evaporation to non-water cells
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];
                if (cell.type !== "spring" && cell.type !== "river") {
                    cell.base_moisture *= BASE_DECAY;
                    cell.moisture = cell.base_moisture;
                    if (cell.base_moisture < 0.000001) {
                        cell.base_moisture = 0;
                        cell.moisture = 0;
                    }
                }
            }
        }

        // Diffusion pass: smooth moisture transitions for organic appearance
        this.applyMoistureDiffusion(terrain, config.diffusionIterations, config.diffusionStrength);
    }

    /**
     * Apply diffusion to smooth moisture values between neighbors
     * This creates more organic, gradual transitions instead of blocky patterns
     */
    private applyMoistureDiffusion(
        terrain: TerrainGrid,
        iterations: number,
        strength: number
    ): void {
        const { width, height } = GridHelper.getDimensions(terrain);

        for (let iter = 0; iter < iterations; iter++) {
            // Create a copy of current moisture values
            const moistureCopy: number[][] = [];
            for (let y = 0; y < height; y++) {
                moistureCopy[y] = [];
                for (let x = 0; x < width; x++) {
                    moistureCopy[y][x] = terrain[y][x].moisture;
                }
            }

            // Apply diffusion
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const cell = terrain[y][x];

                    // Don't diffuse water sources
                    if (cell.type === "spring" || cell.type === "river") continue;

                    const neighbors = GridHelper.getNeighbors(terrain, x, y);
                    let totalMoisture = moistureCopy[y][x];
                    let count = 1;

                    for (const neighbor of neighbors) {
                        // Weight diagonal neighbors less (distance is sqrt(2) vs 1)
                        const isDiagonal = neighbor.x !== x && neighbor.y !== y;
                        const weight = isDiagonal ? 0.707 : 1.0;
                        totalMoisture += moistureCopy[neighbor.y][neighbor.x] * weight;
                        count += weight;
                    }

                    const averageMoisture = totalMoisture / count;
                    // Blend current value with average based on strength
                    const newMoisture = cell.moisture * (1 - strength) + averageMoisture * strength;

                    cell.moisture = newMoisture;
                    cell.base_moisture = newMoisture;
                }
            }
        }
    }
}
