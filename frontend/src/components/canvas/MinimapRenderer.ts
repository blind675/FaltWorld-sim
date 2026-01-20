import { type TerrainCell, type TerrainGrid } from "@/shared/schema";
import { type VisualizationSettings } from "./types";

const MINIMAP_SIZE = 150;
const MINIMAP_REFRESH_INTERVAL = 10 * 60 * 1000;

export class MinimapRenderer {
  private cache: ImageData | null = null;
  private lastRender = 0;
  private lastColorMode: string | null = null;

  /** Render the minimap terrain and viewport indicator. */
  render(
    ctx: CanvasRenderingContext2D,
    terrainGrid: TerrainGrid,
    settings: VisualizationSettings,
    width: number,
    height: number,
    getCellColor: (cell: TerrainCell, settings: VisualizationSettings) => string,
    worldSize?: number,
    viewportPosition?: { x: number; y: number },
  ) {
    const gridSize = terrainGrid.length;
    if (!gridSize) {
      return;
    }

    // Use actual world size for viewport calculations, grid size for rendering
    const actualWorldSize = worldSize ?? gridSize;
    const cellSize = MINIMAP_SIZE / gridSize;
    const now = Date.now();
    const colorModeChanged = this.lastColorMode !== settings.colorMode;
    const shouldRenderTerrain =
      !this.cache ||
      colorModeChanged ||
      now - this.lastRender > MINIMAP_REFRESH_INTERVAL;

    if (shouldRenderTerrain) {
      console.log("Rendering minimap terrain (next update in 10 minutes)...");
      ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const cell = terrainGrid[y]?.[x];
          if (!cell) continue;
          ctx.fillStyle = getCellColor(cell, settings);
          ctx.fillRect(x * cellSize, y * cellSize, cellSize + 1, cellSize + 1);
        }
      }

      this.cache = ctx.getImageData(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
      this.lastRender = now;
      this.lastColorMode = settings.colorMode;
    } else if (this.cache) {
      ctx.putImageData(this.cache, 0, 0);
    }

    // Calculate visible area based on zoom
    // The viewport is 100x100 cells, but zoom affects how many are visible
    const VIEWPORT_SIZE = 100;
    const zoomLevel = settings.zoomLevel || 1.0;
    const visibleCells = VIEWPORT_SIZE / zoomLevel;

    ctx.strokeStyle = "rgba(255, 215, 0, 0.9)";
    ctx.lineWidth = 2;

    // Convert world coordinates to minimap coordinates
    const pixelPerWorldCell = MINIMAP_SIZE / actualWorldSize;

    // Get viewport position (defaults to 0,0 if not provided)
    const viewportX = viewportPosition?.x ?? 0;
    const viewportY = viewportPosition?.y ?? 0;

    // Calculate center of viewport
    const centerOffsetCells = (VIEWPORT_SIZE - visibleCells) / 2;

    // Position on minimap shows the visible area within the viewport
    const vpX = (viewportX + centerOffsetCells) * pixelPerWorldCell;
    const vpY = (viewportY + centerOffsetCells) * pixelPerWorldCell;
    const vpW = visibleCells * pixelPerWorldCell;
    const vpH = visibleCells * pixelPerWorldCell;

    // Draw the viewport indicator showing visible area
    ctx.strokeRect(vpX, vpY, vpW, vpH);
  }
}
