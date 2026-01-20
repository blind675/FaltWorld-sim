import { type TerrainCell } from "@shared/schema";
import { type VisualizationSettings } from "../types";
import { type ICanvasLayer, type LayerRenderContext } from "./ICanvasLayer";

export class RiverLayer implements ICanvasLayer {
  id = "rivers";

  /** Whether this layer should render given current settings */
  shouldRender(settings: VisualizationSettings): boolean {
    return settings.showRivers;
  }

  /** Render river segments on top of the terrain */
  render(context: LayerRenderContext): void {
    if (!this.shouldRender(context.settings)) {
      return;
    }

    const {
      ctx,
      terrainGrid,
      cellWidth,
      cellHeight,
      startX,
      startY,
      endX,
      endY,
      normalizedPanX,
      normalizedPanY,
      gridSize,
    } = context;

    const shouldRenderDetails = cellWidth >= 0.5 && cellHeight >= 0.5;
    if (!shouldRenderDetails) {
      return;
    }

    const drawRiverSegment = (
      cell: TerrainCell,
      x: number,
      y: number,
      neighborX: number,
      neighborY: number,
      screenNeighborX: number,
      screenNeighborY: number,
    ) => {
      const neighborCell = terrainGrid[neighborY]?.[neighborX];
      if (
        !neighborCell ||
        (neighborCell.type !== "river" && neighborCell.type !== "spring") ||
        neighborCell.river_name !== cell.river_name
      ) {
        return;
      }

      const baseWidth = Math.max(1, Math.min(3, cell.water_height || 1));
      const lineWidth =
        Math.max(1, Math.min(cellWidth, cellHeight) * 0.15) * baseWidth;

      ctx.strokeStyle =
        cell.water_height >= 2
          ? "rgba(0, 64, 192, 0.9)"
          : "rgba(0, 128, 255, 0.9)";
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(
        x * cellWidth + normalizedPanX + cellWidth / 2,
        y * cellHeight + normalizedPanY + cellHeight / 2,
      );
      ctx.lineTo(
        screenNeighborX + cellWidth / 2,
        screenNeighborY + cellHeight / 2,
      );
      ctx.stroke();
    };

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const wrappedX = ((x % gridSize) + gridSize) % gridSize;
        const wrappedY = ((y % gridSize) + gridSize) % gridSize;
        const cell = terrainGrid[wrappedY]?.[wrappedX];
        if (!cell) continue;

        if (
          (cell.type === "river" || cell.type === "spring") &&
          cell.river_name
        ) {
          const wrappedRightX = (wrappedX + 1) % gridSize;
          const wrappedDownY = (wrappedY + 1) % gridSize;

          drawRiverSegment(
            cell,
            x,
            y,
            wrappedRightX,
            wrappedY,
            (x + 1) * cellWidth + normalizedPanX,
            y * cellHeight + normalizedPanY,
          );

          drawRiverSegment(
            cell,
            x,
            y,
            wrappedX,
            wrappedDownY,
            x * cellWidth + normalizedPanX,
            (y + 1) * cellHeight + normalizedPanY,
          );
        }
      }
    }
  }
}
