import { type TerrainCell } from "@/shared/schema";
import { type VisualizationSettings } from "../types";
import { type ICanvasLayer, type LayerRenderContext } from "./ICanvasLayer";

export class WindLayer implements ICanvasLayer {
  id = "wind";

  /** Whether this layer should render given current settings */
  shouldRender(settings: VisualizationSettings): boolean {
    return settings.colorMode === "wind";
  }

  /** Render wind direction arrows on top of the wind color mode */
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

    if (cellWidth < 8 || cellHeight < 8) {
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

        const windSpeed = cell.wind_speed ?? 0;
        const windDirection = cell.wind_direction ?? 0;

        if (windSpeed <= 0.1) {
          continue;
        }

        const centerX = worldX * cellWidth + normalizedPanX + cellWidth / 2;
        const centerY = worldY * cellHeight + normalizedPanY + cellHeight / 2;
        const maxWindSpeed = 15;
        const normalizedSpeed = Math.min(1, windSpeed / maxWindSpeed);
        const arrowLength =
          Math.min(cellWidth, cellHeight) * (0.3 + normalizedSpeed * 0.6) * 0.45;
        const angleRad = (windDirection - 90) * (Math.PI / 180);
        const tipX = centerX + Math.cos(angleRad) * arrowLength;
        const tipY = centerY + Math.sin(angleRad) * arrowLength;
        const tailX = centerX - Math.cos(angleRad) * arrowLength * 0.3;
        const tailY = centerY - Math.sin(angleRad) * arrowLength * 0.3;
        const headLength = arrowLength * 0.4;
        const headAngle = Math.PI / 6;

        ctx.strokeStyle = "rgba(40, 40, 40, 0.8)";
        ctx.lineWidth = Math.max(1, cellWidth * 0.08);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
          tipX - headLength * Math.cos(angleRad - headAngle),
          tipY - headLength * Math.sin(angleRad - headAngle),
        );
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
          tipX - headLength * Math.cos(angleRad + headAngle),
          tipY - headLength * Math.sin(angleRad + headAngle),
        );
        ctx.stroke();
      }
    }
  }

  /** Get cell color for the wind visualization */
  getCellColor(cell: TerrainCell): string {
    const windSpeed = cell.wind_speed ?? 0;
    const maxWindSpeed = 15;
    const normalizedSpeed = Math.min(1, windSpeed / maxWindSpeed);

    if (normalizedSpeed < 0.33) {
      const factor = normalizedSpeed * 3;
      const r = Math.floor(230 - (230 - 173) * factor);
      const g = Math.floor(230 - (230 - 216) * factor);
      const b = 230;
      return `rgb(${r}, ${g}, ${b})`;
    }

    if (normalizedSpeed < 0.66) {
      const factor = (normalizedSpeed - 0.33) * 3;
      const r = Math.floor(173 - (173 - 65) * factor);
      const g = Math.floor(216 - (216 - 105) * factor);
      const b = Math.floor(230 - (230 - 225) * factor);
      return `rgb(${r}, ${g}, ${b})`;
    }

    const factor = (normalizedSpeed - 0.66) * 3;
    const r = Math.floor(65 + (128 - 65) * factor);
    const g = Math.floor(105 - 105 * factor);
    const b = Math.floor(225 - (225 - 128) * factor);
    return `rgb(${r}, ${g}, ${b})`;
  }
}
