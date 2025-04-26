import {
  terrainCells,
  type TerrainCell,
  type InsertTerrainCell,
  type TerrainGrid,
} from "@shared/schema";

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

  constructor() {
    this.terrain = [];
    this.perlin = new PerlinNoise();
  }

  private mapHeight(value: number): number {
    // Map from [0,1] to [-200,2200]
    return value * 2400 - 200;
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
    while (springs.length < 5 && candidates.length > 0) {
      const idx = Math.floor(Math.random() * candidates.length);
      springs.push(candidates[idx]);
      candidates.splice(idx, 1);
    }

    return springs;
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

  async landUpdate(): Promise<TerrainGrid> {
    const GRID_SIZE = this.terrain.length;
    if (GRID_SIZE === 0) return this.terrain;

    // Create a temporary grid for the updates
    const tempGrid: TerrainGrid = JSON.parse(JSON.stringify(this.terrain));

    // Process water flow for springs and rivers
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = this.terrain[y][x];
        if (cell.type !== "spring" && cell.type !== "river") continue;

        // Decrease terrain height and water level
        tempGrid[y][x].terrain_height = Math.max(
          cell.terrain_height - 0.0001,
          -200,
        );
        tempGrid[y][x].water_height = Math.max(cell.water_height - 0.001, 0);

        // Find lowest neighbor
        const neighbors = this.getNeighbors(x, y);
        const lowestNeighbor = neighbors.reduce((min, current) =>
          current.altitude < min.altitude ? current : min,
        );

        // Current cell's altitude
        const currentAltitude = cell.terrain_height + cell.water_height;

        // If neighbor is lower, water flows there
        if (lowestNeighbor.altitude < currentAltitude) {
          const targetCell = tempGrid[lowestNeighbor.y][lowestNeighbor.x];

          // Create new river
          targetCell.type = "river";
          targetCell.water_height = 1;
          targetCell.base_moisture = 1;
          targetCell.added_moisture = 0;
          targetCell.moisture = 1;
          targetCell.altitude =
            targetCell.terrain_height + targetCell.water_height;
          // console.log(
          //   `NEW RIVER - ${targetCell.x}, ${targetCell.y} water height: ${targetCell.water_height.toFixed(2)}, altitude: ${targetCell.altitude.toFixed(2)}`,
          // );
        } else {
          cell.water_height = cell.water_height + 1;
          cell.altitude = cell.terrain_height + cell.water_height;

          // console.log(
          //   `INCREASE  - ${targetCell.x}, ${targetCell.y} water height: ${targetCell.water_height.toFixed(2)}, altitude: ${targetCell.altitude.toFixed(2)}`,
          // );
        }
      }
    }

    const decay = 0.25;
    const minGain = 0.001;
    const altInfluence = 0.01;

    // Calculate moisture propagation (create another temporary array to avoid spreading moisture too quickly)
    const moistureGrid: TerrainGrid = JSON.parse(JSON.stringify(tempGrid));

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

    const moistureQueue: { x: number; y: number; moisture: number }[] = [];
    // First, propagate moisture from cells with moisture > 0.0001
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (tempGrid[y][x].base_moisture > 0.0001) {
          moistureQueue.push(tempGrid[y][x]);
        }
      }
    }

    // 4) Process queue: each time a cell’s moisture goes up, it pushes to its neighbours
    while (moistureQueue.length) {
      const { x, y, moisture } = moistureQueue.shift()!;
      const baseAlt = moistureGrid[y][x].altitude;

      // compute how much this cell passes on
      const rawGain = moisture * decay;
      if (rawGain <= minGain) continue;

      const neighbors = this.getNeighbors(x, y);

      for (const cell of neighbors) {
        // altitude factor: >1 downhill, <1 uphill, clamped ≥ 0
        const altDiff = baseAlt - cell.altitude;
        const altFactor = Math.max(0, 1 + altInfluence * altDiff);

        const gain = rawGain * altFactor;
        if (gain <= minGain) continue;

        // if this contribution beats the neighbour’s current moisture, update + re-enqueue
        if (gain > cell.base_moisture) {
          cell.base_moisture = +gain;
          // Don't change already wet cells (river, spring)
          if (cell.type === "river" || cell.type === "spring") continue;

          // Calculate total moisture (base + added)
          cell.moisture = cell.base_moisture + cell.added_moisture;

          // Update cell type based on moisture level
          if (cell.moisture > 0.75 && cell.moisture < 1) {
            // High moisture - mud
            cell.type = "mud";
            // console.log(
            //   `MUD      - ${x}, ${y} moisture: ${cell.moisture.toFixed(2)}`,
            // );
          } else if (cell.moisture > 0.25 && cell.moisture <= 0.75) {
            // Medium moisture - earth
            cell.type = "earth";
            // console.log(
            //   `EARTH    - ${x}, ${y} moisture: ${cell.moisture.toFixed(2)}`,
            // );
          }
          moistureQueue.push(cell);
        }
      }

      // for (const [dx, dy] of directions) {
      //   const nx = x + dx;
      //   const ny = y + dy;
      //   // skip out of bounds
      //   if (ny < 0 || ny >= GRID_SIZE || nx < 0 || nx >= GRID_SIZE) continue;

      //   // altitude factor: >1 downhill, <1 uphill, clamped ≥ 0
      //   const altDiff = baseAlt - moistureGrid[ny][nx].altitude;
      //   const altFactor = Math.max(0, 1 + altInfluence * altDiff);

      //   const gain = rawGain * altFactor;
      //   if (gain <= minGain) continue;

      //   const cell = moistureGrid[ny][nx];

      //   // if this contribution beats the neighbour’s current moisture, update + re-enqueue
      //   if (gain > cell.base_moisture) {
      //     cell.base_moisture = +gain;
      //     // Don't change already wet cells (river, spring)
      //     if (cell.type === "river" || cell.type === "spring") continue;

      //     // Calculate total moisture (base + added)
      //     cell.moisture = cell.base_moisture + cell.added_moisture;

      //     // Update cell type based on moisture level
      //     if (cell.moisture > 0.75 && cell.moisture < 1) {
      //       // High moisture - mud
      //       cell.type = "mud";
      //       // console.log(
      //       //   `MUD      - ${x}, ${y} moisture: ${cell.moisture.toFixed(2)}`,
      //       // );
      //     } else if (cell.moisture > 0.25 && cell.moisture <= 0.75) {
      //       // Medium moisture - earth
      //       cell.type = "earth";
      //       // console.log(
      //       //   `EARTH    - ${x}, ${y} moisture: ${cell.moisture.toFixed(2)}`,
      //       // );
      //     }
      //     moistureQueue.push({ x: nx, y: ny, moisture: gain });
      //   }
      // }
    }

    // Update the terrain with the new values
    this.terrain = moistureGrid;
    return this.terrain;
  }

  async getTerrainData(): Promise<TerrainGrid> {
    return this.terrain;
  }

  async generateTerrain(): Promise<TerrainGrid> {
    const GRID_SIZE = 150;
    const NOISE_SCALE = 0.04;

    // Initialize empty grid
    this.terrain = Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill(null));

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const noiseVal = this.perlin.noise(x * NOISE_SCALE, y * NOISE_SCALE);
        const mappedHeight = this.mapHeight(noiseVal);

        const cell: TerrainCell = {
          id: y * GRID_SIZE + x,
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
    for (const spring of springs) {
      if (this.terrain[spring.y] && this.terrain[spring.y][spring.x]) {
        this.terrain[spring.y][spring.x].type = "spring";
        this.terrain[spring.y][spring.x].base_moisture = 1;
        this.terrain[spring.y][spring.x].added_moisture = 0;
        this.terrain[spring.y][spring.x].moisture = 1;
      }
    }

    return this.terrain;
  }
}

export const storage = new MemStorage();
