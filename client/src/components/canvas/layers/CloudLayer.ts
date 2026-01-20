import { type VisualizationSettings } from "../types";
import { type ICanvasLayer, type LayerRenderContext } from "./ICanvasLayer";

export class CloudLayer implements ICanvasLayer {
  id = "clouds";

  shouldRender(settings: VisualizationSettings): boolean {
    return settings.showClouds === true;
  }

  render(context: LayerRenderContext): void {
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

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const wrappedX = ((x % gridSize) + gridSize) % gridSize;
        const wrappedY = ((y % gridSize) + gridSize) % gridSize;

        const cell = terrainGrid[wrappedY]?.[wrappedX];
        if (!cell) continue;

        const cloudDensity = cell.cloud_density ?? 0;
        if (cloudDensity < 0.1) continue;

        const alpha = Math.min(0.7, cloudDensity * 0.8);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(
          x * cellWidth + normalizedPanX,
          y * cellHeight + normalizedPanY,
          Math.ceil(cellWidth + 1),
          Math.ceil(cellHeight + 1),
        );
      }
    }
  }
}
