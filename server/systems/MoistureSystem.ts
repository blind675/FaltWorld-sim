import { type TerrainGrid, type TerrainCell } from "@shared/schema";
import { type GameTime } from "../storage";
import { type ISimulationSystem } from "./ISimulationSystem";
import { GridHelper } from "./GridHelper";
import { MOISTURE_CONFIG } from "../config";

/**
 * Manages ground moisture propagation from water sources
 */
export class MoistureSystem implements ISimulationSystem {
    update(terrain: TerrainGrid, gameTime: GameTime): void {
        this.propagateMoisture(terrain);
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

        const queue: Array<{ cell: TerrainCell, distance: number, moisture: number }> = [];

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
                        queue.push({ cell, distance: 0, moisture: 1.0 });
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
        while (queue.length > 0 && cellsProcessed < MAX_CELLS_PROCESSED) {
            const { cell, distance, moisture } = queue.shift()!;
            cellsProcessed++;

            const neighbors = GridHelper.getNeighbors(terrain, cell.x, cell.y);

            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;

                if (visited.has(neighborKey)) continue;
                if (neighbor.type === "river" || neighbor.type === "spring") continue;

                const newDistance = distance + 1;
                const distanceDecay = Math.max(0, 1 - (newDistance * 0.008));

                const waterVolumeBoost = 1.0 + Math.min(
                    cell.water_height * config.waterVolumeBoostFactor,
                    config.maxWaterVolumeBoost
                );

                const baseMoisture = distanceDecay * MOISTURE_TRANSFER_RATE * waterVolumeBoost;

                if (baseMoisture < MIN_TRANSFER) continue;

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
                            distance: newDistance,
                            moisture: newMoisture
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
    }
}
