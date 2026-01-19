import type { TerrainCell } from "@shared/schema";

const CHUNK_SIZE = 100;
const CACHE_LIMIT = 9;

type ViewportResponse = {
  viewport: TerrainCell[][];
  worldSize?: number;
  timestamp?: number;
};

export class ViewportManager {
  private cache: Map<string, TerrainCell[][]>;
  private worldSize: number;
  private lastTickTimestamp: number;

  constructor(worldSize: number) {
    this.cache = new Map();
    this.worldSize = worldSize;
    this.lastTickTimestamp = 0;
  }

  getWorldSize(): number {
    return this.worldSize;
  }

  invalidateCache(): void {
    this.cache.clear();
  }

  async getViewportData(
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<TerrainCell[][]> {
    const viewportWidth = Math.max(1, Math.floor(width));
    const viewportHeight = Math.max(1, Math.floor(height));

    const startChunkX = this.getChunkOrigin(x);
    const startChunkY = this.getChunkOrigin(y);
    const endChunkX = this.getChunkOrigin(x + viewportWidth - 1);
    const endChunkY = this.getChunkOrigin(y + viewportHeight - 1);

    const chunkPromises: Promise<void>[] = [];

    for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY += CHUNK_SIZE) {
      for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX += CHUNK_SIZE) {
        const key = this.getCacheKey(chunkX, chunkY, CHUNK_SIZE, CHUNK_SIZE);
        if (this.cache.has(key)) {
          const cached = this.cache.get(key)!;
          this.touchCacheEntry(key, cached);
          continue;
        }
        chunkPromises.push(
          this.fetchChunk(chunkX, chunkY).then((chunk) => {
            this.cache.set(key, chunk);
            this.touchCacheEntry(key, chunk);
          }),
        );
      }
    }

    if (chunkPromises.length) {
      await Promise.all(chunkPromises);
    }

    const viewport: TerrainCell[][] = [];

    for (let row = 0; row < viewportHeight; row += 1) {
      const worldY = y + row;
      const chunkY = this.getChunkOrigin(worldY);
      const localY = worldY - chunkY;
      const rowData: TerrainCell[] = [];

      for (let col = 0; col < viewportWidth; col += 1) {
        const worldX = x + col;
        const chunkX = this.getChunkOrigin(worldX);
        const localX = worldX - chunkX;
        const key = this.getCacheKey(chunkX, chunkY, CHUNK_SIZE, CHUNK_SIZE);
        const chunk = this.cache.get(key);
        const cell = chunk?.[localY]?.[localX];
        if (cell) {
          rowData.push(cell);
        }
      }

      viewport.push(rowData);
    }

    return viewport;
  }

  prefetchAdjacent(centerX: number, centerY: number): void {
    const offsets = [
      { dx: -CHUNK_SIZE, dy: 0 },
      { dx: CHUNK_SIZE, dy: 0 },
      { dx: 0, dy: -CHUNK_SIZE },
      { dx: 0, dy: CHUNK_SIZE },
    ];

    offsets.forEach(({ dx, dy }) => {
      void this.getViewportData(
        centerX + dx,
        centerY + dy,
        CHUNK_SIZE,
        CHUNK_SIZE,
      ).catch(() => undefined);
    });
  }

  private getCacheKey(x: number, y: number, w: number, h: number): string {
    return `${x},${y},${w},${h}`;
  }

  private getChunkOrigin(value: number): number {
    return Math.floor(value / CHUNK_SIZE) * CHUNK_SIZE;
  }

  private touchCacheEntry(key: string, data: TerrainCell[][]): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, data);
    this.pruneCache();
  }

  private pruneCache(): void {
    while (this.cache.size > CACHE_LIMIT) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      this.cache.delete(oldestKey);
    }
  }

  private async fetchChunk(
    x: number,
    y: number,
  ): Promise<TerrainCell[][]> {
    const response = await fetch(
      `/api/viewport?x=${x}&y=${y}&width=${CHUNK_SIZE}&height=${CHUNK_SIZE}`,
    );

    if (!response.ok) {
      throw new Error("Failed to fetch viewport chunk");
    }

    const data = (await response.json()) as ViewportResponse;

    if (typeof data.worldSize === "number" && data.worldSize > 0) {
      this.worldSize = data.worldSize;
    }

    if (typeof data.timestamp === "number") {
      if (this.lastTickTimestamp && data.timestamp !== this.lastTickTimestamp) {
        this.cache.clear();
      }
      this.lastTickTimestamp = data.timestamp;
    }

    this.pruneCache();

    return data.viewport;
  }
}
