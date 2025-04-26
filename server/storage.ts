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
  landUpdate(): Promise<TerrainGrid>;
}

export class MemStorage implements IStorage {
  private terrain: TerrainGrid;
  private perlin: PerlinNoise;
  private waterPoints: TerrainCell[];

  static GRID_SIZE = 100;
  static NOISE_SCALE = 0.05;

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

  private processWaterFlow(cell: TerrainCell, tempGrid: TerrainGrid): void {
    // Decrease terrain height and water level
    const x = cell.x;
    const y = cell.y;
    tempGrid[y][x].terrain_height = Math.max(
      cell.terrain_height - 0.0001,
      -200,
    );
    // evalopration
    tempGrid[y][x].water_height = Math.max(cell.water_height - 0.001, 0);

    // Find lowest neighbor
    const neighbors = this.getNeighbors(x, y);
    const lowestNeighbor = neighbors.reduce((min, current) =>
      current.altitude < min.altitude ? current : min,
    );

    // if this cell has two river neighbours or one sping or one river skip it
    if (
      neighbors.filter((n) => n.type === "river").length >= 2 ||
      neighbors.some((n) => n.type === "spring")
    ) {
      return;
    }

    // If neighbor is lower, water flows there
    if (lowestNeighbor.altitude < cell.altitude) {
      // if lowest neighbor is a river or spring, increase water level
      if (lowestNeighbor.type === "river" || lowestNeighbor.type === "spring") {
        this.increaseWaterLevel(lowestNeighbor);
      } else {
        this.createNewRiver(lowestNeighbor);
      }
    } else {
      this.increaseWaterLevel(cell);
    }
  }

  private createNewRiver(cell: TerrainCell): void {
    cell.type = "river";
    cell.water_height = 1;
    cell.base_moisture = 1;
    cell.added_moisture = 0;
    cell.moisture = 1;
    cell.altitude = cell.terrain_height + cell.water_height;

    this.waterPoints.push(cell);

    console.log(
      `NEW RIVER - ${cell.x}, ${cell.y} water height: ${cell.water_height.toFixed(2)}, altitude: ${cell.altitude.toFixed(2)}`,
    );
  }

  private increaseWaterLevel(cell: TerrainCell): void {
    cell.water_height = cell.water_height + 1;
    cell.altitude = cell.terrain_height + cell.water_height;

    console.log(
      `INCREASE  - ${cell.x}, ${cell.y} water height: ${cell.water_height.toFixed(2)}, altitude: ${cell.altitude.toFixed(2)} for type: ${cell.type}`,
    );
  }

  private propagateMoisture(
    moistureGrid: TerrainGrid,
    tempGrid: TerrainGrid,
    GRID_SIZE: number,
  ): void {
    const decay = 0.25;
    const minGain = 0.001;
    const altInfluence = 0.01;
    const directions = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ];

    const moistureQueue: TerrainCell[] = [];

    // Initialize queue with high moisture cells
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (tempGrid[y][x].base_moisture > 0.0001) {
          moistureQueue.push(tempGrid[y][x]);
        }
      }
    }

    while (moistureQueue.length) {
      const { x, y, moisture, altitude } = moistureQueue.shift()!;
      const rawGain = moisture * decay;
      if (rawGain <= minGain) continue;

      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (ny < 0 || ny >= GRID_SIZE || nx < 0 || nx >= GRID_SIZE) continue;

        const altDiff = altitude - moistureGrid[ny][nx].altitude;
        const altFactor = Math.max(0, 1 + altInfluence * altDiff);
        const gain = rawGain * altFactor;

        if (gain <= minGain) continue;

        const cell = moistureGrid[ny][nx];
        if (gain > cell.base_moisture) {
          cell.base_moisture = cell.base_moisture + gain;
          if (!(cell.type === "river" || cell.type === "spring")) {
            cell.moisture = cell.base_moisture + cell.added_moisture;

            if (cell.moisture > 0.75 && cell.moisture < 1) {
              cell.type = "mud";
            } else if (cell.moisture > 0.25 && cell.moisture <= 0.75) {
              cell.type = "earth";
            }
            moistureQueue.push(cell);
          }
        }
      }
    }
  }

  async landUpdate(): Promise<TerrainGrid> {
    const tempGrid: TerrainGrid = JSON.parse(JSON.stringify(this.terrain));

    // Process water flow
    this.waterPoints.forEach((cell) => {
      this.processWaterFlow(cell, tempGrid);
    });

    // Calculate moisture propagation
    const moistureGrid: TerrainGrid = JSON.parse(JSON.stringify(tempGrid));
    this.propagateMoisture(moistureGrid, tempGrid, MemStorage.GRID_SIZE);

    this.terrain = moistureGrid;
    return this.terrain;
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

    // Randomly select 5 points from candidates
    while (springs.length < 1 && candidates.length > 0) {
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

        this.waterPoints.push(cell);
      }
    }

    return this.terrain;
  }
}

export const storage = new MemStorage();
