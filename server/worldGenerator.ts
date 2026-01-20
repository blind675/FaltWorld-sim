import { type TerrainCell, type TerrainGrid } from "@shared/schema";
import { type WorldConfig, DEFAULT_WORLD_CONFIG } from "./config";

/**
 * Wrapping Perlin Noise implementation for seamless circular world generation
 */
class WrappingPerlinNoise {
    private perm: number[];
    private gradients: Array<[number, number]>;

    constructor() {
        this.perm = new Array(512);
        const permutation = new Array(256)
            .fill(0)
            .map((_, i) => i)
            .sort(() => Math.random() - 0.5);

        for (let i = 0; i < 512; i++) {
            this.perm[i] = permutation[i & 255];
        }

        this.gradients = [
            [1, 1], [-1, 1], [1, -1], [-1, -1],
            [1, 0], [-1, 0], [0, 1], [0, -1],
            [Math.SQRT2, 0], [-Math.SQRT2, 0], [0, Math.SQRT2], [0, -Math.SQRT2]
        ];
    }

    private fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    private lerp(t: number, a: number, b: number): number {
        return a + t * (b - a);
    }

    private grad(hash: number, x: number, y: number): number {
        const g = this.gradients[hash % this.gradients.length];
        return g[0] * x + g[1] * y;
    }

    private sampleNoise(x: number, y: number): number {
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

    /**
     * 4D gradient function for 4D noise
     */
    private grad4d(hash: number, x: number, y: number, z: number, w: number): number {
        const h = hash & 31;
        const u = h < 24 ? x : y;
        const v = h < 16 ? y : z;
        const s = h < 8 ? z : w;
        return ((h & 1) ? -u : u) + ((h & 2) ? -v : v) + ((h & 4) ? -s : s);
    }

    /**
     * Sample 4D noise - required for proper wrapping
     */
    private sampleNoise4D(x: number, y: number, z: number, w: number): number {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;
        const W = Math.floor(w) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);
        w -= Math.floor(w);

        const u = this.fade(x);
        const v = this.fade(y);
        const s = this.fade(z);
        const t = this.fade(w);

        const A = this.perm[X] + Y;
        const AA = this.perm[A] + Z;
        const AB = this.perm[A + 1] + Z;
        const B = this.perm[X + 1] + Y;
        const BA = this.perm[B] + Z;
        const BB = this.perm[B + 1] + Z;

        const AAA = this.perm[AA] + W;
        const AAB = this.perm[AA + 1] + W;
        const ABA = this.perm[AB] + W;
        const ABB = this.perm[AB + 1] + W;
        const BAA = this.perm[BA] + W;
        const BAB = this.perm[BA + 1] + W;
        const BBA = this.perm[BB] + W;
        const BBB = this.perm[BB + 1] + W;

        return this.lerp(
            t,
            this.lerp(
                s,
                this.lerp(
                    v,
                    this.lerp(u, this.grad4d(this.perm[AAA], x, y, z, w), this.grad4d(this.perm[BAA], x - 1, y, z, w)),
                    this.lerp(u, this.grad4d(this.perm[ABA], x, y - 1, z, w), this.grad4d(this.perm[BBA], x - 1, y - 1, z, w))
                ),
                this.lerp(
                    v,
                    this.lerp(u, this.grad4d(this.perm[AAB], x, y, z - 1, w), this.grad4d(this.perm[BAB], x - 1, y, z - 1, w)),
                    this.lerp(u, this.grad4d(this.perm[ABB], x, y - 1, z - 1, w), this.grad4d(this.perm[BBB], x - 1, y - 1, z - 1, w))
                )
            ),
            this.lerp(
                s,
                this.lerp(
                    v,
                    this.lerp(u, this.grad4d(this.perm[AAA + 1], x, y, z, w - 1), this.grad4d(this.perm[BAA + 1], x - 1, y, z, w - 1)),
                    this.lerp(u, this.grad4d(this.perm[ABA + 1], x, y - 1, z, w - 1), this.grad4d(this.perm[BBA + 1], x - 1, y - 1, z, w - 1))
                ),
                this.lerp(
                    v,
                    this.lerp(u, this.grad4d(this.perm[AAB + 1], x, y, z - 1, w - 1), this.grad4d(this.perm[BAB + 1], x - 1, y, z - 1, w - 1)),
                    this.lerp(u, this.grad4d(this.perm[ABB + 1], x, y - 1, z - 1, w - 1), this.grad4d(this.perm[BBB + 1], x - 1, y - 1, z - 1, w - 1))
                )
            )
        );
    }

    wrappingNoise(x: number, y: number, gridSize: number, scale: number): number {
        // Based on Unity implementation - map to 4D torus for seamless wrapping
        const octaves = 10;
        const lacunarity = 2.0;

        let value = 0;
        let amplitude = 1.0;
        let maxValue = 0;
        let freq = scale;

        for (let i = 0; i < octaves; i++) {
            // Normalize coordinates to [0, 1]
            const s = x / gridSize;
            const t = y / gridSize;

            // Map to 4D coordinates on torus surface
            // This matches the Unity implementation exactly
            const x1 = 0, x2 = 2;
            const y1 = 0, y2 = 2;
            const dx = x2 - x1;
            const dy = y2 - y1;

            // Calculate 4D coordinates
            const nx = x1 + Math.cos(s * 2 * Math.PI) * dx / (2 * Math.PI);
            const ny = y1 + Math.cos(t * 2 * Math.PI) * dy / (2 * Math.PI);
            const nz = x1 + Math.sin(s * 2 * Math.PI) * dx / (2 * Math.PI);
            const nw = y1 + Math.sin(t * 2 * Math.PI) * dy / (2 * Math.PI);

            // Sample 4D noise
            const signal = this.sampleNoise4D(nx * freq, ny * freq, nz * freq, nw * freq);

            value += signal * amplitude;
            maxValue += amplitude;

            // Prepare for next octave
            amplitude *= 0.5;
            freq *= lacunarity;
        }

        // Normalize to [0, 1]
        return (value / maxValue) * 0.5 + 0.5;
    }
}

export class WorldGenerator {
    private perlin: WrappingPerlinNoise;
    private config: WorldConfig;

    constructor(config: WorldConfig = DEFAULT_WORLD_CONFIG) {
        this.perlin = new WrappingPerlinNoise();
        this.config = config;
    }

    private mapHeight(value: number): number {
        const range = this.config.maxHeight - this.config.minHeight;
        return value * range + this.config.minHeight;
    }

    generateTerrain(): TerrainGrid {
        const { gridSize } = this.config;

        const terrain: TerrainGrid = Array(gridSize)
            .fill(null)
            .map(() => Array(gridSize).fill(null));

        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const noiseVal = this.perlin.wrappingNoise(
                    x,
                    y,
                    gridSize,
                    gridSize * gridSize / 100000
                );
                const mappedHeight = this.mapHeight(noiseVal);

                const cell: TerrainCell = {
                    id: y * gridSize + x,
                    x,
                    y,
                    terrain_height: mappedHeight,
                    water_height: 0,
                    altitude: mappedHeight,
                    base_moisture: 0,
                    added_moisture: 0,
                    moisture: 0,
                    temperature: 0,
                    air_humidity: 0,
                    cloud_density: 0,
                    precipitation_rate: 0,
                    ground_wetness: 0,
                    type: "rock",
                    distance_from_water: Infinity,
                    river_name: null,
                };

                terrain[y][x] = cell;
            }
        }

        return terrain;
    }

    selectSpringPoints(terrain: TerrainGrid): { x: number; y: number }[] {
        const springs: { x: number; y: number }[] = [];
        const candidates: { x: number; y: number }[] = [];

        const { springMinHeight, springMaxHeight } = this.config;

        const numberOfSprings = Math.floor((this.config.gridSize / 100) * 2);

        for (let y = 0; y < terrain.length; y++) {
            for (let x = 0; x < terrain[0].length; x++) {
                const height = terrain[y][x].terrain_height;
                if (height >= springMinHeight && height <= springMaxHeight) {
                    candidates.push({ x, y });
                }
            }
        }

        // Calculate minimum distance between springs based on map size and desired spring count
        // This ensures springs are well-distributed across the map
        const mapArea = terrain.length * terrain[0].length;
        const minDistance = Math.floor(Math.sqrt(mapArea / numberOfSprings) * 0.6);

        const mapWidth = terrain[0].length;
        const mapHeight = terrain.length;

        // Try to place springs with minimum distance constraint
        // numberOfSprings is treated as a maximum - we may place fewer if candidates run out
        while (springs.length < numberOfSprings && candidates.length > 0) {
            const idx = Math.floor(Math.random() * candidates.length);
            const candidate = candidates[idx];

            // Check if this candidate is far enough from all existing springs
            let tooClose = false;
            for (const spring of springs) {
                // Calculate toroidal distance (accounting for map wrapping)
                const dx = Math.abs(candidate.x - spring.x);
                const dy = Math.abs(candidate.y - spring.y);

                // For toroidal topology, the shortest distance might wrap around
                const wrappedDx = Math.min(dx, mapWidth - dx);
                const wrappedDy = Math.min(dy, mapHeight - dy);

                const distance = Math.sqrt(wrappedDx * wrappedDx + wrappedDy * wrappedDy);

                if (distance < minDistance) {
                    tooClose = true;
                    break;
                }
            }

            // Only add spring if it's far enough from others
            if (!tooClose) {
                springs.push(candidate);
            }

            // Remove candidate regardless to avoid infinite loops
            candidates.splice(idx, 1);
        }

        return springs;
    }

    regenerate(): void {
        this.perlin = new WrappingPerlinNoise();
    }
}
