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

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const wrappedX = ((x % gridSize) + gridSize) % gridSize;
        const wrappedY = ((y % gridSize) + gridSize) % gridSize;

        const cell = terrainGrid[wrappedY]?.[wrappedX];
        if (!cell) continue;

        const precipRate = cell.precipitation_rate ?? 0;
        if (precipRate < 0.05) continue;

        const cellX = x * cellWidth + normalizedPanX;
        const cellY = y * cellHeight + normalizedPanY;

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
