import type { TerrainCell } from "@/shared/schema";
import { getApiUrl } from "./api";

// Fixed viewport configuration
const VIEWPORT_SIZE = 100; // Always fetch 100x100 from backend

type ViewportResponse = {
    viewport: TerrainCell[][];
    worldSize?: number;
    timestamp?: number;
};

type MinimapResponse = {
    minimap: TerrainCell[][];
    resolution: number;
    worldSize: number;
};

/**
 * Simplified ViewportManager - fetches fixed 100x100 viewport
 * No panning, only zoom
 */
export class ViewportManager {
    private worldSize: number;
    private lastTimestamp: number;
    private pendingRequest: Promise<TerrainCell[][]> | null = null;
    private cachedViewport: TerrainCell[][] | null = null;
    private viewportStartX: number = 0;
    private viewportStartY: number = 0;

    constructor(worldSize: number) {
        this.worldSize = worldSize;
        this.lastTimestamp = 0;
    }

    getWorldSize(): number {
        return this.worldSize;
    }

    setWorldSize(size: number): void {
        if (size > 0) {
            this.worldSize = size;
        }
    }

    invalidateCache(): void {
        this.pendingRequest = null;
        this.cachedViewport = null;
    }

    setViewportPosition(x: number, y: number): void {
        this.viewportStartX = x;
        this.viewportStartY = y;
    }

    getViewportPosition(): { x: number; y: number } {
        return { x: this.viewportStartX, y: this.viewportStartY };
    }

    /**
     * Get fixed 100x100 viewport data
     */
    async getViewportData(): Promise<TerrainCell[][]> {
        // Return cached viewport if available
        if (this.cachedViewport) {
            return this.cachedViewport;
        }

        // If request is already pending, return that promise
        if (this.pendingRequest) {
            return this.pendingRequest;
        }

        // Make request for the viewport
        this.pendingRequest = this.fetchViewport();

        try {
            const result = await this.pendingRequest;
            this.cachedViewport = result;
            return result;
        } finally {
            this.pendingRequest = null;
        }
    }

    private async fetchViewport(): Promise<TerrainCell[][]> {
        const response = await fetch(
            `${getApiUrl()}/api/viewport?x=${this.viewportStartX}&y=${this.viewportStartY}&width=${VIEWPORT_SIZE}&height=${VIEWPORT_SIZE}`,
        );

        if (!response.ok) {
            throw new Error("Failed to fetch viewport");
        }

        const data = (await response.json()) as ViewportResponse;

        if (typeof data.worldSize === "number" && data.worldSize > 0) {
            this.worldSize = data.worldSize;
        }

        if (typeof data.timestamp === "number") {
            this.lastTimestamp = data.timestamp;
        }

        return data.viewport;
    }

    /**
     * Fetch minimap data at the specified resolution
     */
    async getMinimapData(resolution: number = 150): Promise<{ minimap: TerrainCell[][]; worldSize: number }> {
        const response = await fetch(`${getApiUrl()}/api/minimap?resolution=${resolution}`);

        if (!response.ok) {
            throw new Error("Failed to fetch minimap");
        }

        const data = (await response.json()) as MinimapResponse;

        if (data.worldSize > 0) {
            this.worldSize = data.worldSize;
        }

        return {
            minimap: data.minimap,
            worldSize: data.worldSize,
        };
    }
}
