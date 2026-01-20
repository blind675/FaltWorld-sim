import { type TerrainCell } from "@/shared/schema";
import { type VisualizationSettings } from "../types";
import { type ICanvasLayer, type LayerRenderContext } from "./ICanvasLayer";

export class HumidityLayer implements ICanvasLayer {
  id = "humidity";

  /** Whether this layer should render given current settings */
  shouldRender(settings: VisualizationSettings): boolean {
    return settings.colorMode === "humidity";
  }

  /** Render the layer to the canvas */
  render(_context: LayerRenderContext): void {}

  /** Get cell color for the humidity visualization */
  getCellColor(cell: TerrainCell): string {
    const humidityValue = Math.min(1, Math.max(0, cell.air_humidity));

    if (humidityValue < 0.5) {
      const factor = humidityValue * 2;
      const r = Math.floor(245 - (245 - 173) * factor);
      const g = Math.floor(222 - (222 - 216) * factor);
      const b = Math.floor(179 + (230 - 179) * factor);
      return `rgb(${r}, ${g}, ${b})`;
    }

    const factor = (humidityValue - 0.5) * 2;
    const r = Math.floor(173 - 173 * factor);
    const g = Math.floor(216 - 216 * factor);
    const b = Math.floor(230 - (230 - 139) * factor);
    return `rgb(${r}, ${g}, ${b})`;
  }
}
