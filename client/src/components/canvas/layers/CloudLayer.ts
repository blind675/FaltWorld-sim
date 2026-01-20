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

    const viewportHeight = terrainGrid.length;
    const viewportWidth = terrainGrid[0]?.length || 0;

    for (let viewportY = 0; viewportY < viewportHeight; viewportY++) {
      for (let viewportX = 0; viewportX < viewportWidth; viewportX++) {
        const cell = terrainGrid[viewportY]?.[viewportX];
        if (!cell) continue;

        const worldX = startX + viewportX;
        const worldY = startY + viewportY;

        const cloudDensity = cell.cloud_density ?? 0;
        if (cloudDensity < 0.1) continue;

        const alpha = Math.min(0.7, cloudDensity * 0.8);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(
          worldX * cellWidth + normalizedPanX,
          worldY * cellHeight + normalizedPanY,
          Math.ceil(cellWidth + 1),
          Math.ceil(cellHeight + 1),
        );
      }
    }
  }
}
