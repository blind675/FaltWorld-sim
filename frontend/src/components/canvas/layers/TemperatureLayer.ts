import { type TerrainCell } from "@/shared/schema";
import { type VisualizationSettings } from "../types";
import { type ICanvasLayer, type LayerRenderContext } from "./ICanvasLayer";

export class TemperatureLayer implements ICanvasLayer {
  id = "temperature";

  /** Whether this layer should render given current settings */
  shouldRender(settings: VisualizationSettings): boolean {
    return settings.colorMode === "temperature";
  }

  /** Render the layer to the canvas */
  render(_context: LayerRenderContext): void {}

  /** Get cell color for the temperature visualization */
  getCellColor(cell: TerrainCell): string {
    const minTemp = -20;
    const maxTemp = 30;
    const normalizedTemp = (cell.temperature - minTemp) / (maxTemp - minTemp);
    const clampedTemp = Math.max(0, Math.min(1, normalizedTemp));

    if (clampedTemp < 0.25) {
      const factor = clampedTemp * 4;
      const r = 0;
      const g = Math.floor(255 * factor);
      const b = 255;
      return `rgb(${r}, ${g}, ${b})`;
    }

    if (clampedTemp < 0.5) {
      const factor = (clampedTemp - 0.25) * 4;
      const r = 0;
      const g = 255;
      const b = Math.floor(255 * (1 - factor));
      return `rgb(${r}, ${g}, ${b})`;
    }

    if (clampedTemp < 0.75) {
      const factor = (clampedTemp - 0.5) * 4;
      const r = Math.floor(255 * factor);
      const g = 255;
      const b = 0;
      return `rgb(${r}, ${g}, ${b})`;
    }

    const factor = (clampedTemp - 0.75) * 4;
    const r = 255;
    const g = Math.floor(255 * (1 - factor));
    const b = 0;
    return `rgb(${r}, ${g}, ${b})`;
  }
}
