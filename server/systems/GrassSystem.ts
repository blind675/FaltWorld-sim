import { type TerrainCell, type TerrainGrid } from "@shared/schema";
import { type GameTime } from "../storage";
import { type ISimulationSystem } from "./ISimulationSystem";
import { GridHelper } from "./GridHelper";
import { GRASS_CONFIG, GRASS_SPECIES, type GrassSpecies } from "../config";

export class GrassSystem implements ISimulationSystem {
    private speciesMap: Map<string, GrassSpecies>;

    constructor() {
        this.speciesMap = new Map();
        for (const species of GRASS_SPECIES) {
            this.speciesMap.set(species.id, species);
        }
    }

    update(terrain: TerrainGrid, gameTime: GameTime): void {
        const { width, height } = GridHelper.getDimensions(terrain);

        // First pass: update existing grass
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];
                if (cell.grass_density && cell.grass_density > 0) {
                    this.updateGrass(cell, gameTime);
                }
            }
        }

        // Second pass: spread grass to neighbors
        const spreadQueue: { x: number; y: number; type: string }[] = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];
                if (this.canSpread(cell)) {
                    const neighbors = GridHelper.getNeighborsWithOffset(terrain, x, y);
                    for (const neighbor of neighbors) {
                        if (this.canReceiveGrass(neighbor.cell, cell.grass_type!)) {
                            const species = this.speciesMap.get(cell.grass_type!);
                            if (species && Math.random() < species.spreadProbability) {
                                spreadQueue.push({
                                    x: (x + neighbor.dx + width) % width,
                                    y: (y + neighbor.dy + height) % height,
                                    type: cell.grass_type!,
                                });
                            }
                        }
                    }
                }
            }
        }

        // Apply spreading
        for (const spread of spreadQueue) {
            const cell = terrain[spread.y][spread.x];
            if (!cell.grass_density || cell.grass_density < GRASS_CONFIG.INITIAL_SPREAD_DENSITY) {
                cell.grass_density = GRASS_CONFIG.INITIAL_SPREAD_DENSITY;
                cell.grass_type = spread.type;
                cell.grass_health = 0.8;
                cell.grass_dormant = 0;
            }
        }

        // Log summary
        this.logSummary(terrain, width, height);
    }

    private updateGrass(cell: TerrainCell, gameTime: GameTime): void {
        const species = this.speciesMap.get(cell.grass_type ?? "cool_season");
        if (!species) return;

        const temp = cell.temperature ?? 15;
        const moisture = cell.moisture ?? 0;

        // Check dormancy
        if (cell.grass_dormant) {
            // Check if should wake up
            if (temp >= species.wakeFromDormantTemp && temp <= species.maxGrowthTemp) {
                cell.grass_dormant = 0;
                console.log(`GrassSystem: ${species.name} waking from dormancy at temp ${temp.toFixed(1)}°C`);
            } else {
                // Slow decay while dormant
                cell.grass_density = Math.max(0, (cell.grass_density ?? 0) - GRASS_CONFIG.DORMANCY_DECAY_RATE);
                return;
            }
        }

        // Check if should go dormant
        if (temp <= species.gosDormantTemp || temp >= species.maxGrowthTemp) {
            cell.grass_dormant = 1;
            return;
        }

        // Check death conditions
        if (temp < species.frostTolerance) {
            // Frost death
            cell.grass_density = Math.max(0, (cell.grass_density ?? 0) - GRASS_CONFIG.DEATH_RATE_EXTREME_TEMP);
            cell.grass_health = Math.max(0, (cell.grass_health ?? 1) - 0.1);
            return;
        }

        if (moisture < species.minMoisture) {
            // Drought death
            cell.grass_density = Math.max(0, (cell.grass_density ?? 0) - GRASS_CONFIG.DEATH_RATE_NO_WATER);
            cell.grass_health = Math.max(0, (cell.grass_health ?? 1) - 0.05);
            return;
        }

        // Calculate growth rate based on conditions
        const tempFactor = this.calculateTempFactor(temp, species);
        const moistureFactor = this.calculateMoistureFactor(moisture, species);
        const growthRate = species.baseGrowthRate * tempFactor * moistureFactor;

        // Apply growth
        cell.grass_density = Math.min(
            GRASS_CONFIG.MAX_GRASS_DENSITY,
            (cell.grass_density ?? 0) + growthRate
        );

        // Improve health in good conditions
        if (tempFactor > 0.7 && moistureFactor > 0.7) {
            cell.grass_health = Math.min(1, (cell.grass_health ?? 0.5) + 0.01);
        }
    }

    private calculateTempFactor(temp: number, species: GrassSpecies): number {
        if (temp < species.minGrowthTemp || temp > species.maxGrowthTemp) return 0;
        if (temp >= species.optimalTempMin && temp <= species.optimalTempMax) return 1;

        if (temp < species.optimalTempMin) {
            return (temp - species.minGrowthTemp) / (species.optimalTempMin - species.minGrowthTemp);
        }
        return (species.maxGrowthTemp - temp) / (species.maxGrowthTemp - species.optimalTempMax);
    }

    private calculateMoistureFactor(moisture: number, species: GrassSpecies): number {
        if (moisture < species.minMoisture || moisture > species.maxMoisture) return 0;
        if (moisture >= species.optimalMoistureMin && moisture <= species.optimalMoistureMax) return 1;

        if (moisture < species.optimalMoistureMin) {
            return (moisture - species.minMoisture) / (species.optimalMoistureMin - species.minMoisture);
        }
        return (species.maxMoisture - moisture) / (species.maxMoisture - species.optimalMoistureMax);
    }

    private canSpread(cell: TerrainCell): boolean {
        return (
            (cell.grass_density ?? 0) >= GRASS_CONFIG.MIN_DENSITY_TO_SPREAD &&
            (cell.grass_health ?? 0) > 0.5 &&
            !cell.grass_dormant
        );
    }

    private canReceiveGrass(cell: TerrainCell, grassType: string): boolean {
        if (!grassType) {
            return false;
        }
        // Can't grow in water
        if (cell.type === "river" || cell.type === "spring" || cell.water_height > 0.5) {
            return false;
        }
        // Can't grow on very high altitude (mountains)
        if ((cell.altitude ?? 0) > 1500) {
            return false;
        }
        // Already has significant grass
        if ((cell.grass_density ?? 0) > 0.5) {
            return false;
        }
        return true;
    }

    /**
     * Seed initial grass across the terrain based on moisture and temperature
     */
    seedInitialGrass(terrain: TerrainGrid): void {
        const { width, height } = GridHelper.getDimensions(terrain);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];

                // Skip water and high mountains
                if (cell.type === "river" || cell.type === "spring" || cell.water_height > 0.5) continue;
                if ((cell.altitude ?? 0) > 1500) continue;

                // Check if conditions are suitable
                const moisture = cell.moisture ?? 0;
                if (moisture < GRASS_CONFIG.SEED_MOISTURE_THRESHOLD) continue;

                // Random seeding
                if (Math.random() > GRASS_CONFIG.INITIAL_SEED_PROBABILITY) continue;

                // Select species based on climate
                const temp = cell.temperature ?? 15;
                let selectedSpecies: string;

                if (moisture < 0.25) {
                    selectedSpecies = "drought_resistant";
                } else if (temp > 25) {
                    selectedSpecies = "warm_season";
                } else {
                    selectedSpecies = "cool_season";
                }

                cell.grass_density = 0.2 + Math.random() * 0.3;
                cell.grass_type = selectedSpecies;
                cell.grass_health = 0.7 + Math.random() * 0.3;
                cell.grass_dormant = 0;
            }
        }

        console.log("GrassSystem: Initial grass seeded");
    }

    private logSummary(terrain: TerrainGrid, width: number, height: number): void {
        let totalGrass = 0;
        let cellsWithGrass = 0;
        const speciesCounts: Record<string, number> = {};

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cell = terrain[y][x];
                if (cell.grass_density && cell.grass_density > 0.01) {
                    totalGrass += cell.grass_density;
                    cellsWithGrass++;
                    const type = cell.grass_type ?? "unknown";
                    speciesCounts[type] = (speciesCounts[type] ?? 0) + 1;
                }
            }
        }

        if (cellsWithGrass > 0) {
            const avgDensity = totalGrass / cellsWithGrass;
            const coverage = ((cellsWithGrass / (width * height)) * 100).toFixed(1);
            console.log(
                `GrassSystem: ${coverage}% coverage, avg density: ${avgDensity.toFixed(2)}, species: ${JSON.stringify(speciesCounts)}`
            );
        }
    }
}
