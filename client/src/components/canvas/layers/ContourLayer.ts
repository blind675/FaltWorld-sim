import { type VisualizationSettings } from "../types";
import { type ICanvasLayer, type LayerRenderContext } from "./ICanvasLayer";

export class ContourLayer implements ICanvasLayer {
  id = "contours";

  /** Whether this layer should render given current settings */
  shouldRender(settings: VisualizationSettings): boolean {
    return settings.contourLines && settings.showElevation;
  }

  /** Render contour lines on top of the terrain */
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

    const viewportHeight = terrainGrid.length;
    const viewportWidth = terrainGrid[0]?.length || 0;

    for (let viewportY = 0; viewportY < viewportHeight; viewportY++) {
      for (let viewportX = 0; viewportX < viewportWidth; viewportX++) {
        const cell = terrainGrid[viewportY]?.[viewportX];
        if (!cell) continue;

        const worldX = startX + viewportX;
        const worldY = startY + viewportY;

        const altitude = cell.altitude;
        const interval = context.settings.contourInterval;

        if (
          Math.round(altitude / interval) * interval === Math.round(altitude)
        ) {
          ctx.strokeStyle = "rgba(0,0,0,0.5)";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(
            worldX * cellWidth + normalizedPanX,
            worldY * cellHeight + normalizedPanY,
            cellWidth,
            cellHeight,
          );
        }
      }
    }
  }
}
