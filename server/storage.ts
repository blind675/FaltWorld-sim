import { type TerrainCell, type TerrainGrid } from "@shared/schema";

// Simple implementation of Perlin noise for Node.js
class PerlinNoise {
  private perm: number[];

  constructor() {
    this.perm = new Array(512);
    const permutation = new Array(256)
      .fill(0)
      .map((_, i) => i)
      .sort(() => Math.random() - 0.5);

    for (let i = 0; i < 512; i++) {
      this.perm[i] = permutation[i & 255];
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 15;
    const grad2 = 1 + (h & 7);
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : x;
    return (h & 1 ? -u : u) + (h & 2 ? -v : v);
  }

  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);

    const u = this.fade(x);
    const v = this.fade(y);

    const A = this.perm[X] + Y;
    const B = this.perm[X + 1] + Y;

    return (
      this.lerp(
        v,
        this.lerp(
          u,
          this.grad(this.perm[A], x, y),
          this.grad(this.perm[B], x - 1, y),
        ),
        this.lerp(
          u,
          this.grad(this.perm[A + 1], x, y - 1),
          this.grad(this.perm[B + 1], x - 1, y - 1),
        ),
      ) *
        0.5 +
      0.5
    );
  }
}

export interface IStorage {
  getTerrainData(): Promise<TerrainGrid>;
  generateTerrain(): Promise<TerrainGrid>;
  landUpdate(): Promise<void>;
}

export class MemStorage implements IStorage {
  private terrain: TerrainGrid;
  private perlin: PerlinNoise;
  private waterPoints: TerrainCell[];

  static GRID_SIZE = 300;
  static NOISE_SCALE = 0.02;
  static NUMBER_OF_SPRINGS = 5;

  constructor() {
    this.terrain = [];
    this.perlin = new PerlinNoise();
    this.waterPoints = [];
  }

  private mapHeight(value: number): number {
    // Map from [0,1] to [-200,2200]
    return value * 2400 - 200;
  }

  private getNeighbors(x: number, y: number): TerrainCell[] {
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

    for (const [dx, dy] of directions) {
      const newX = x + dx;
      const newY = y + dy;

      if (
        newX >= 0 &&
        newX < this.terrain[0].length &&
        newY >= 0 &&
        newY < this.terrain.length
      ) {
        const cell = this.terrain[newY][newX];
        neighbors.push(cell);
      }
    }

    return neighbors;
  }

  private processWaterFlow(cell: TerrainCell): boolean {
    // Decrease terrain height and water level
    cell.terrain_height = Math.max(cell.terrain_height - 0.00001, -200);
    // evalopration
    cell.water_height = Math.max(cell.water_height - 0.0001, 0);

    cell.altitude = cell.terrain_height + cell.water_height;

    const x = cell.x;
    const y = cell.y;
    // Find lowest neighbor
    const neighbors = this.getNeighbors(x, y);
    const lowestNeighbor = neighbors.reduce((min, current) =>
      current.altitude < min.altitude ? current : min,
    );

    // if this cell has two river neighbours or one sping or one river skip it
    if (
      neighbors.filter((n) => n.type === "river" || n.type === "spring")
        .length >= 2 &&
      (lowestNeighbor.type === "spring" || lowestNeighbor.type === "river")
    ) {
      return false;
    }

    if (cell.type === "spring" && lowestNeighbor.type === "river") {
      return false;
    }

    if (Math.round(lowestNeighbor.altitude) < Math.round(cell.altitude)) {
      // If neighbor is lower, water flows there
      // if lowest neighbor is a river or spring, increase water level
      if (lowestNeighbor.type === "river" || lowestNeighbor.type === "spring") {
        lowestNeighbor.water_height = lowestNeighbor.water_height + 0.5;
        lowestNeighbor.altitude =
          lowestNeighbor.terrain_height + lowestNeighbor.water_height;
      } else {
        lowestNeighbor.type = "river";
        lowestNeighbor.water_height = 0.5;
        lowestNeighbor.base_moisture = 1;
        lowestNeighbor.added_moisture = 0;
        lowestNeighbor.moisture = 1;
        lowestNeighbor.altitude =
          lowestNeighbor.terrain_height + lowestNeighbor.water_height;
        lowestNeighbor.distance_from_water = 0;

        this.waterPoints.push(lowestNeighbor);
      }
    } else {
      cell.water_height = cell.water_height + 0.5;
      cell.altitude = cell.terrain_height + cell.water_height;
    }

    return true;
  }

  private propagateMoisture(): void {
    // Constants
    const MAX_LAND_MOISTURE = 0.9;
    const MOISTURE_TRANSFER_RATE = 0.01; // base amount spread each tick
    const BASE_DISTANCE_LOSS = 0.0002; // lose moisture per cell away
    const ALTITUDE_PENALTY = 0.0001; // lose extra per altitude unit climbed
    const BASE_DECAY = 0.85; // global evaporation (1% moisture lost per tick)

    for (let y = 0; y < this.terrain.length; y++) {
      for (let x = 0; x < this.terrain[0].length; x++) {
        const currentCell = this.terrain[y][x];
        if (currentCell.base_moisture === 0) continue;

        for (let neighborCell of this.getNeighbors(
          currentCell.x,
          currentCell.y,
        )) {
          if (neighborCell.type === "sprin" || neighborCell.type === "river")
            continue;
          // 1. Calculate distance-based loss
          let newDistance = currentCell.distance_from_water + 1; // +1 cell step

          if (newDistance < neighborCell.distance_from_water) {
            neighborCell.distance_from_water = newDistance;
          }

          let distanceLoss = newDistance * BASE_DISTANCE_LOSS;

          // 2. Altitude penalty
          let heightDiff = neighborCell.altitude - currentCell.altitude;
          let altitudeLoss = heightDiff > 0 ? heightDiff * ALTITUDE_PENALTY : 0;

          // 3. Total loss
          let totalLoss = distanceLoss + altitudeLoss;

          // 4. Final moisture gain attempt
          let attemptedGain = MOISTURE_TRANSFER_RATE - totalLoss;

          if (attemptedGain > 0) {
            let newMoisture = Math.min(
              neighborCell.base_moisture + attemptedGain,
              MAX_LAND_MOISTURE,
            );
            if (newMoisture > neighborCell.base_moisture) {
              neighborCell.base_moisture = newMoisture;
              neighborCell.moisture = newMoisture;

              if (neighborCell.moisture === 1) {
                neighborCell.type = "river";
                this.waterPoints.push(neighborCell);
              } else if (
                neighborCell.moisture > 0.8 &&
                neighborCell.moisture < 1
              ) {
                neighborCell.type = "mud";
              } else if (
                neighborCell.moisture > 0.2 &&
                neighborCell.moisture <= 0.8
              ) {
                neighborCell.type = "earth";
              }
            }
          }
        }

        if (!(currentCell.type === "sprin" || currentCell.type === "river")) {
          currentCell.base_moisture *= BASE_DECAY;
          currentCell.moisture = currentCell.base_moisture;
          if (currentCell.base_moisture < 0.000001) {
            currentCell.base_moisture = 0;
            currentCell.moisture = 0;
          }
        }
      }
    }
  }

  async landUpdate() {
    // Calculate moisture propagation
    this.propagateMoisture();

    let processedWatter = false;

    // TODO: change from wattr points to rivers
    // instead of array use array of arraws where each array is a river
    // and each river is an array of cells

    // Process water flow
    this.waterPoints.forEach((cell) => {
      processedWatter = this.processWaterFlow(cell);
    });

    // If no water was processed, add water to the lowest cell
    if (!processedWatter) {
      const lowestCell = this.waterPoints.reduce((min, current) =>
        this.terrain[current.y][current.x].altitude <
        this.terrain[min.y][min.x].altitude
          ? this.terrain[current.y][current.x]
          : this.terrain[min.y][min.x],
      );

      this.terrain[lowestCell.y][lowestCell.x].water_height =
        this.terrain[lowestCell.y][lowestCell.x].water_height + 0.5;
      this.terrain[lowestCell.y][lowestCell.x].altitude =
        this.terrain[lowestCell.y][lowestCell.x].terrain_height +
        this.terrain[lowestCell.y][lowestCell.x].water_height;
    }

    // TODO: add erosion
    // TODO: add grass - and grass mechanincs 
    // TODO: add trees - and tree mechanins
    // TODO: add fruits - and fruit mechanins
    // TODO: add temperature
    // TODO: add wind
    // TODO: add rain
    // TODO: add snow
    // TODO: add ice

    // TODO: add rabbits
    // TODO: add foxes
    // TODO: add wolves
    // TODO: add bears
    // TODO: add humans
    
  }

  async getTerrainData(): Promise<TerrainGrid> {
    return this.terrain;
  }

  private selectSpringPoints(): { x: number; y: number }[] {
    const springs: { x: number; y: number }[] = [];
    const candidates = [];

    // Find all points with suitable height for springs
    for (let y = 0; y < this.terrain.length; y++) {
      for (let x = 0; x < this.terrain[0].length; x++) {
        const height = this.terrain[y][x].terrain_height;
        if (height >= 1700 && height <= 1900) {
          candidates.push({ x, y });
        }
      }
    }

    // Randomly select spring points from candidates
    while (
      springs.length < MemStorage.NUMBER_OF_SPRINGS &&
      candidates.length > 0
    ) {
      const idx = Math.floor(Math.random() * candidates.length);
      springs.push(candidates[idx]);
      candidates.splice(idx, 1);
    }

    return springs;
  }

  async generateTerrain(): Promise<TerrainGrid> {
    // Initialize empty grid
    this.terrain = Array(MemStorage.GRID_SIZE)
      .fill(null)
      .map(() => Array(MemStorage.GRID_SIZE).fill(null));

    for (let y = 0; y < MemStorage.GRID_SIZE; y++) {
      for (let x = 0; x < MemStorage.GRID_SIZE; x++) {
        const noiseVal = this.perlin.noise(
          x * MemStorage.NOISE_SCALE,
          y * MemStorage.NOISE_SCALE,
        );
        const mappedHeight = this.mapHeight(noiseVal);

        const cell: TerrainCell = {
          id: y * MemStorage.GRID_SIZE + x,
          x,
          y,
          terrain_height: mappedHeight,
          water_height: 0,
          altitude: mappedHeight, // Initially same as terrain_height
          base_moisture: 0,
          added_moisture: 0,
          moisture: 0,
          type: "rock",
          distance_from_water: Infinity,
        };

        this.terrain[y][x] = cell;
      }
    }

    // Select and mark spring points
    const springs = this.selectSpringPoints();
    this.waterPoints = []; // Reset water points on new terrain generation

    for (const spring of springs) {
      if (this.terrain[spring.y] && this.terrain[spring.y][spring.x]) {
        const cell = this.terrain[spring.y][spring.x];
        cell.type = "spring";
        cell.base_moisture = 1;
        cell.added_moisture = 0;
        cell.moisture = 1;
        cell.water_height = 1;
        cell.altitude = cell.terrain_height + cell.water_height;
        cell.distance_from_water = 0;

        this.waterPoints.push(cell);
      }
    }

    return this.terrain;
  }
}

export const storage = new MemStorage();
