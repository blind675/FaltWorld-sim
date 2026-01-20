import { type VisualizationSettings } from "../types";
import { type ICanvasLayer, type LayerRenderContext } from "./ICanvasLayer";

export class PrecipitationLayer implements ICanvasLayer {
  id = "precipitation";
  private animationOffset = 0;

  shouldRender(settings: VisualizationSettings): boolean {
    return settings.showPrecipitation === true;
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

    this.animationOffset = (this.animationOffset + 2) % 20;

    const viewportHeight = terrainGrid.length;
    const viewportWidth = terrainGrid[0]?.length || 0;

    for (let viewportY = 0; viewportY < viewportHeight; viewportY++) {
      for (let viewportX = 0; viewportX < viewportWidth; viewportX++) {
        const cell = terrainGrid[viewportY]?.[viewportX];
        if (!cell) continue;

        const worldX = startX + viewportX;
        const worldY = startY + viewportY;

        const precipRate = cell.precipitation_rate ?? 0;
        if (precipRate < 0.05) continue;

        const cellX = worldX * cellWidth + normalizedPanX;
        const cellY = worldY * cellHeight + normalizedPanY;

        const intensity = Math.min(1, precipRate * 2);
        const numLines = Math.floor(intensity * 3) + 1;

        ctx.strokeStyle = `rgba(100, 149, 237, ${0.3 + intensity * 0.4})`;
        ctx.lineWidth = 1;

        for (let i = 0; i < numLines; i++) {
          const offsetX = (cellWidth / (numLines + 1)) * (i + 1);
          const startYOffset = ((this.animationOffset + i * 7) % 20) - 10;

          ctx.beginPath();
          ctx.moveTo(cellX + offsetX, cellY + startYOffset);
          ctx.lineTo(cellX + offsetX - 3, cellY + startYOffset + 10);
          ctx.stroke();
        }
      }
    }
  }
}
