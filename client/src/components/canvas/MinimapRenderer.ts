import { type TerrainCell, type TerrainGrid } from "@shared/schema";
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
  ) {
    const gridSize = terrainGrid.length;
    if (!gridSize) {
      return;
    }

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

    const zoomLevel = settings.zoomLevel || 1.0;
    const panOffset = settings.panOffset || { x: 0, y: 0 };
    const cellWidth = (width / gridSize) * zoomLevel;
    const cellHeight = (height / gridSize) * zoomLevel;
    const worldWidth = gridSize * cellWidth;
    const worldHeight = gridSize * cellHeight;
    const normalizedPanX = ((panOffset.x % worldWidth) + worldWidth) % worldWidth;
    const normalizedPanY = ((panOffset.y % worldHeight) + worldHeight) % worldHeight;
    const viewportStartX = (-normalizedPanX / cellWidth) % gridSize;
    const viewportStartY = (-normalizedPanY / cellHeight) % gridSize;
    const viewportWidth = width / cellWidth;
    const viewportHeight = height / cellHeight;
    const normalizedStartX = ((viewportStartX % gridSize) + gridSize) % gridSize;
    const normalizedStartY = ((viewportStartY % gridSize) + gridSize) % gridSize;

    ctx.strokeStyle = "rgba(255, 215, 0, 0.9)";
    ctx.lineWidth = 2;

    const wrapsX = normalizedStartX + viewportWidth > gridSize;
    const wrapsY = normalizedStartY + viewportHeight > gridSize;

    if (!wrapsX && !wrapsY) {
      ctx.strokeRect(
        normalizedStartX * cellSize,
        normalizedStartY * cellSize,
        viewportWidth * cellSize,
        viewportHeight * cellSize,
      );
    } else if (wrapsX && !wrapsY) {
      const rightWidth = gridSize - normalizedStartX;
      const leftWidth = viewportWidth - rightWidth;
      ctx.strokeRect(
        normalizedStartX * cellSize,
        normalizedStartY * cellSize,
        rightWidth * cellSize,
        viewportHeight * cellSize,
      );
      ctx.strokeRect(
        0,
        normalizedStartY * cellSize,
        leftWidth * cellSize,
        viewportHeight * cellSize,
      );
    } else if (!wrapsX && wrapsY) {
      const bottomHeight = gridSize - normalizedStartY;
      const topHeight = viewportHeight - bottomHeight;
      ctx.strokeRect(
        normalizedStartX * cellSize,
        normalizedStartY * cellSize,
        viewportWidth * cellSize,
        bottomHeight * cellSize,
      );
      ctx.strokeRect(
        normalizedStartX * cellSize,
        0,
        viewportWidth * cellSize,
        topHeight * cellSize,
      );
    } else {
      const rightWidth = gridSize - normalizedStartX;
      const leftWidth = viewportWidth - rightWidth;
      const bottomHeight = gridSize - normalizedStartY;
      const topHeight = viewportHeight - bottomHeight;
      ctx.strokeRect(
        normalizedStartX * cellSize,
        normalizedStartY * cellSize,
        rightWidth * cellSize,
        bottomHeight * cellSize,
      );
      ctx.strokeRect(
        0,
        normalizedStartY * cellSize,
        leftWidth * cellSize,
        bottomHeight * cellSize,
      );
      ctx.strokeRect(
        normalizedStartX * cellSize,
        0,
        rightWidth * cellSize,
        topHeight * cellSize,
      );
      ctx.strokeRect(0, 0, leftWidth * cellSize, topHeight * cellSize);
    }
  }
}
